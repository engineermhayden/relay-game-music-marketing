import { execSync } from 'node:child_process';
import { test, expect, type Browser, type Page } from '@playwright/test';

// Runs Django management code in the API container, or with MANAGE_PY (a command that runs manage.py) outside Docker.
function manage(code: string) {
  const command = process.env.MANAGE_PY ?? 'docker compose exec -T api python manage.py';
  return execSync(`${command} shell`, { cwd: '..', input: code, encoding: 'utf8' });
}

// End-to-end stacks run with CAPTCHA_TEST_MODE=true, which also accepts this answer.
async function solveCaptcha(page: Page) {
  await expect(page.getByRole('dialog').getByRole('img', { name: /CAPTCHA image/ })).toBeVisible();
  await page.getByLabel('Characters in the image').fill('PASSED');
}

async function openBoard(page: Page) {
  await page.goto('/');
  await page.getByRole('button', { name: 'Feedback board' }).click();
  await expect(page.getByRole('heading', { name: 'Help shape RELAY.' })).toBeVisible();
}

async function signIn(page: Page, email: string, password: string) {
  await page.locator('.account-button').click();
  await page.getByLabel('Email', { exact: true }).fill(email);
  await page.getByLabel('Password', { exact: true }).fill(password);
  await solveCaptcha(page);
  await page.getByRole('dialog').getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'You’re signed in.' })).toBeVisible();
  await page.getByRole('button', { name: 'Close dialog' }).click();
}

async function staffPage(browser: Browser, username: string, password: string) {
  const admin = await browser.newPage();
  await admin.goto('/admin/feedback/feedback/');
  await admin.getByLabel('Username').fill(username);
  await admin.getByLabel('Password').fill(password);
  await admin.getByRole('button', { name: /log in/i }).click();
  return admin;
}

async function adminAction(admin: Page, title: string, action: string, message: string) {
  await admin.goto('/admin/feedback/feedback/');
  await admin.getByRole('row', { name: new RegExp(title) }).getByRole('checkbox').check();
  await admin.locator('select[name=action]').selectOption(action);
  await admin.getByRole('button', { name: 'Go' }).click();
  await expect(admin.locator('.messagelist')).toContainText(message);
}

test('a guest sends a bug report with an opt-in screenshot and Engine lab snapshot, and staff triage it', async ({ page, browser }) => {
  test.skip(!process.env.NETWORK_TESTS, 'Requires the running Docker Compose stack.');
  const stamp = Date.now(), title = `Sentinel clips through the relay ${stamp}`;
  const staff = { username: `feedback-e2e-${stamp}`, password: `amber-beacon-${stamp}` };
  manage(`from django.contrib.auth import get_user_model\nget_user_model().objects.create_superuser('${staff.username}', '', '${staff.password}')\n`);
  try {
    await openBoard(page);
    await expect(page.locator('.world-canvas')).toHaveAttribute('data-ready', 'true', { timeout: 30000 });
    await page.getByRole('button', { name: 'Send feedback' }).click();
    await page.getByLabel('Type').selectOption('bug');
    await page.getByLabel('Title').fill(title);
    await page.getByLabel('Details (optional)').fill('Launch Ember Rift,\nwait two minutes, watch the north relay.');

    // Nothing is attached unless the player opts in, and each attachment is previewed.
    const screenshot = page.getByLabel('Attach a screenshot of the game view'), snapshot = page.getByLabel('Attach an Engine lab snapshot');
    await expect(screenshot).not.toBeChecked();
    await expect(snapshot).not.toBeChecked();
    await screenshot.check();
    await expect(page.getByRole('img', { name: 'Screenshot that will be attached' })).toBeVisible();
    await snapshot.check();
    const preview = page.getByLabel('Engine lab snapshot that will be attached');
    for (const label of ['Browser', 'Renderer', 'Frame rate', 'Warnings']) await expect(preview).toContainText(label);

    // A failed CAPTCHA sends nothing, and keeps the draft and the chosen attachments.
    await page.getByLabel('Characters in the image').fill('WRONG');
    await page.getByRole('button', { name: 'Send for review' }).click();
    await expect(page.getByRole('dialog').getByRole('alert')).toContainText('did not match');
    await expect(screenshot).toBeChecked();
    await expect(snapshot).toBeChecked();

    // Opted in and past the CAPTCHA: both attachments travel with the post.
    await solveCaptcha(page);
    const sent = page.waitForRequest(r => r.url().endsWith('/api/feedback/') && r.method() === 'POST');
    await page.getByRole('button', { name: 'Send for review' }).click();
    const body = (await sent).postDataJSON();
    expect(body.screenshot).toMatch(/^data:image\/jpeg;base64,/);
    expect(body.diagnostics.renderer.backend).toBeTruthy();
    await expect(page.getByRole('dialog').getByRole('status')).toContainText('The RELAY team will review it');
    const yours = page.getByRole('region', { name: 'Your submissions' });
    for (const text of [title, 'Awaiting review', 'Bug report', 'Screenshot, Engine lab snapshot']) await expect(yours).toContainText(text);

    // Rapid repeat submissions are rejected by the rate limiter.
    await page.getByRole('button', { name: 'Send feedback' }).click();
    await page.getByLabel('Title').fill(`A second report straight away ${stamp}`);
    await solveCaptcha(page);
    await page.getByRole('button', { name: 'Send for review' }).click();
    await expect(page.getByRole('dialog').getByRole('alert')).toContainText('You just sent feedback');

    // It arrives in the admin review queue as New, with both attachments.
    const admin = await staffPage(browser, staff.username, staff.password);
    const row = admin.getByRole('row', { name: new RegExp(title) });
    await expect(row).toContainText('New');
    await expect(row).toContainText('Screenshot, Engine lab');
    await row.getByRole('link', { name: title }).click();
    const shot = admin.getByRole('img', { name: 'Player screenshot' });
    await expect(shot).toBeVisible();
    expect(await shot.evaluate((image: HTMLImageElement) => image.naturalWidth)).toBeGreaterThan(100);
    await expect(admin.locator('.field-engine_lab_snapshot')).toContainText('renderer.backend');

    // Marked planned in the admin, the bug report goes on the public board, open for upvotes and without
    // its attachments. Done keeps it there; declined takes it off. (The next test has another player upvote one.)
    const card = page.locator('.feedback-item', { hasText: title });
    await adminAction(admin, title, 'mark_planned', '1 feedback item marked planned.');
    await openBoard(page);
    await page.getByRole('button', { name: 'New' }).click();
    for (const text of ['Bug report', 'Planned', 'Yours']) await expect(card).toContainText(text);
    await expect(card.getByRole('button', { name: new RegExp(`^Upvote “${title}”`) })).toBeVisible();
    await expect(card.locator('img')).toHaveCount(0);  // No screenshot on the board (icons are inline SVG).
    await adminAction(admin, title, 'mark_done', '1 feedback item marked done.');
    await openBoard(page);
    await page.getByRole('button', { name: 'New' }).click();
    await expect(card).toContainText('Done');
    await adminAction(admin, title, 'mark_declined', '1 feedback item marked declined.');
    await admin.close();
    await openBoard(page);
    await expect(card).toHaveCount(0);
    await expect(page.getByRole('region', { name: 'Your submissions' })).toContainText('Declined');
  } finally {
    manage(`from django.contrib.auth import get_user_model\nfrom feedback.models import Feedback\nFeedback.objects.filter(title__endswith='${stamp}').delete()\nget_user_model().objects.filter(username='${staff.username}').delete()\n`);
  }
});

test('only accepted items reach the board, and upvotes need the CAPTCHA once per session or account', async ({ page, browser }) => {
  test.skip(!process.env.NETWORK_TESTS, 'Requires the running Docker Compose stack.');
  const stamp = Date.now(), idea = `Night-time destination ${stamp}`, email = `voter-${stamp}@example.com`, password = `violet-relay-${stamp}`;
  // Seeded directly, so this test does not wait out the previous test's submission cooldown.
  manage([
    'from django.contrib.auth import get_user_model', 'from accounts.models import Account', 'from feedback.models import Feedback, set_status',
    `for title, category, status in [('${idea}', 'idea', 'planned'), ('Bug planned ${stamp}', 'bug', 'planned'), ('Idea new ${stamp}', 'idea', 'new'), ('Idea declined ${stamp}', 'idea', 'declined')]:`,
    `    item = Feedback.objects.create(title=title, category=category, submitter='guest:e2e')`,
    `    set_status(Feedback.objects.filter(pk=item.pk), status)`,
    `user = get_user_model().objects.create_user('player-e2e-${stamp}', '${email}', '${password}')`,
    `Account.objects.create(user=user, email='${email}')`, '',
  ].join('\n'));
  try {
    await openBoard(page);
    await page.getByRole('button', { name: 'New' }).click();
    // Accepted items of every type are shown; New and Declined ones are not.
    for (const shown of [idea, `Bug planned ${stamp}`]) await expect(page.locator('.feedback-item', { hasText: shown })).toHaveCount(1);
    for (const hidden of [`Idea new ${stamp}`, `Idea declined ${stamp}`]) await expect(page.locator('.feedback-item', { hasText: hidden })).toHaveCount(0);

    // A guest passes the CAPTCHA once, then votes once.
    const upvote = (p: Page) => p.getByRole('button', { name: new RegExp(`^Upvote “${idea}”`) });
    const remove = (p: Page) => p.getByRole('button', { name: new RegExp(`^Remove your upvote from “${idea}”`) });
    await upvote(page).click();
    await expect(page.getByText('One quick check before you vote.')).toBeVisible();
    await solveCaptcha(page);
    await page.locator('.feedback-check').getByRole('button', { name: 'Upvote' }).click();
    await expect(remove(page)).toHaveAttribute('aria-pressed', 'true');
    await expect(remove(page)).toContainText('1');
    // The same session cannot add a second vote: the button now removes it, with no new CAPTCHA after a reload.
    await openBoard(page);
    await page.getByRole('button', { name: 'New' }).click();
    await expect(remove(page)).toContainText('1');
    await remove(page).click();
    await expect(upvote(page)).toContainText('0');
    await upvote(page).click();
    await expect(remove(page)).toContainText('1');
    await expect(page.locator('.feedback-check')).toHaveCount(0);

    // A planned bug report is upvoted like an idea (reported: planned items were missing from the board).
    const bug = `Bug planned ${stamp}`;
    await page.getByRole('button', { name: new RegExp(`^Upvote “${bug}”`) }).click();
    await expect(page.getByRole('button', { name: new RegExp(`^Remove your upvote from “${bug}”`) })).toContainText('1');
    await expect(page.locator('.feedback-item', { hasText: bug })).toContainText('Bug report');

    // A signed-in player passes the CAPTCHA too, and their account votes once across devices.
    const phone = await (await browser.newContext()).newPage();
    await phone.goto('/');
    await signIn(phone, email, password);
    await phone.getByRole('button', { name: 'Feedback board' }).click();
    await phone.getByRole('button', { name: 'New' }).click();
    await upvote(phone).click();
    await expect(phone.getByText('One quick check before you vote.')).toBeVisible();
    await solveCaptcha(phone);
    await phone.locator('.feedback-check').getByRole('button', { name: 'Upvote' }).click();
    await expect(remove(phone)).toContainText('2');
    const laptop = await (await browser.newContext()).newPage();
    await laptop.goto('/');
    await signIn(laptop, email, password);
    await laptop.getByRole('button', { name: 'Feedback board' }).click();
    await laptop.getByRole('button', { name: 'New' }).click();
    await expect(remove(laptop)).toHaveAttribute('aria-pressed', 'true');  // Already counted for this account.
    await expect(remove(laptop)).toContainText('2');
  } finally {
    manage(`from django.contrib.auth import get_user_model\nfrom feedback.models import Feedback\nFeedback.objects.filter(title__endswith='${stamp}').delete()\nget_user_model().objects.filter(username='player-e2e-${stamp}').delete()\n`);
  }
});
