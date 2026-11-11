import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { test, expect, type Page } from '@playwright/test';

// Without EMAIL_HOST, the API prints emails to its log. Read links from there
// (or from MAIL_LOG, a file capturing the API's console output).
function mailLog() {
  if (process.env.MAIL_LOG) return readFileSync(process.env.MAIL_LOG, 'utf8');
  return execSync('docker compose logs --no-color --no-log-prefix api', { cwd: '..', encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
}

async function emailLink(email: string, action: 'verify-email' | 'reset-password') {
  let link = '';
  await expect.poll(() => {
    const log = mailLog();
    const messages = log.split(/^Content-Type: text\/plain/m).filter(m => m.includes(`To: ${email}`));
    link = messages.flatMap(m => m.match(new RegExp(`https?://\\S+#account=${action}\\S+`, 'g')) ?? []).at(-1) ?? '';
    return link;
  }, { timeout: 15000 }).not.toBe('');
  // Links must keep tokens in the fragment, never the query string.
  expect(new URL(link).search).toBe('');
  return new URL(link).hash;
}

// End-to-end stacks run with CAPTCHA_TEST_MODE=true, which also accepts this answer.
async function solveCaptcha(page: Page) {
  await expect(page.getByRole('dialog').getByRole('img', { name: /CAPTCHA image/ })).toBeVisible();
  await page.getByLabel('Characters in the image').fill('PASSED');
}

async function openAccount(page: Page) {
  await page.locator('.account-button').click();
  await expect(page.getByRole('dialog')).toBeVisible();
}

test('optional accounts: sign up mid-squad, verify, sign out, reset password, sign in', async ({ page, browser }) => {
  test.skip(!process.env.NETWORK_TESTS, 'Requires the running Docker Compose stack.');
  const email = `pilot-${Date.now()}@example.com`, password = 'violet-relay-signal-42', newPassword = 'amber-beacon-signal-77';
  await page.goto('/');

  // Guests play without an account.
  await expect(page.locator('.account-button')).toHaveText('Sign in');
  await page.getByRole('button', { name: 'Launch squad' }).click();
  await page.getByLabel('Pilot callsign').fill('Account pilot');
  await page.getByLabel('Squad name').fill('Account verification');
  await page.getByLabel('Invite-only expedition').check();
  const created = page.waitForResponse(r => r.url().endsWith('/api/rooms/') && r.request().method() === 'POST');
  await page.getByRole('button', { name: 'Launch expedition', exact: true }).click();
  const { room } = await (await created).json();
  await expect(page.locator('.connection')).toContainText('connected', { timeout: 15000 });

  // Sign up without leaving the squad.
  await openAccount(page);
  await expect(page.getByRole('heading', { name: 'Welcome back, pilot.' })).toBeVisible();
  await page.getByRole('button', { name: 'Create an account' }).click();
  await page.getByLabel('Email', { exact: true }).fill(email);
  await page.getByLabel('Password', { exact: true }).fill('password123');
  await solveCaptcha(page);
  await page.getByRole('button', { name: 'Create account' }).click();
  await expect(page.getByRole('alert')).toContainText('too common');
  await page.getByLabel('Password', { exact: true }).fill(password);
  await solveCaptcha(page);
  await page.getByRole('button', { name: 'Create account' }).click();
  await expect(page.getByRole('status').filter({ hasText: 'verification link' })).toContainText(email);
  await expect(page.locator('.account-card')).toContainText('Email not verified yet');
  await expect(page.locator('.account-button')).toHaveText(email);
  await expect(page.locator('.unverified-dot')).toBeVisible();
  await page.getByRole('button', { name: 'Close dialog' }).click();
  await expect(page.locator('.connection')).toContainText('connected');
  expect((await page.request.get(`/api/rooms/${room.code}/`)).status()).toBe(200);

  // Verify from a different, signed-out browser, as if opening the email on a phone.
  const verifyHash = await emailLink(email, 'verify-email');
  const phone = await browser.newContext();
  const phonePage = await phone.newPage();
  await phonePage.goto(`/${verifyHash}`);
  await expect(phonePage.getByRole('status').filter({ hasText: 'confirmed' })).toContainText(email);
  await expect(phonePage).toHaveURL(url => url.hash === '');
  await expect(phonePage.locator('.account-button')).toHaveText('Sign in');
  await phone.close();
  await openAccount(page);
  await expect(page.locator('.account-card')).toContainText('Email verified');
  await expect(page.locator('.unverified-dot')).toHaveCount(0);

  // Signing out ends this browser's pilot session and leaves the squad.
  await page.getByRole('button', { name: 'Sign out' }).click();
  await expect(page.getByRole('heading', { name: 'Welcome back, pilot.' })).toBeVisible();
  await expect(page.locator('.account-button')).toHaveText('Sign in');
  await expect(page.locator('.connection')).toHaveText('Local preview');
  expect((await page.request.get(`/api/rooms/${room.code}/`)).status()).toBe(403);

  // Wrong password, then reset by email.
  await page.getByLabel('Email', { exact: true }).fill(email);
  await page.getByLabel('Password', { exact: true }).fill('not-my-password');
  await solveCaptcha(page);
  await page.getByRole('dialog').getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page.getByRole('alert')).toHaveText('Email or password is incorrect.');
  await page.getByRole('button', { name: 'Forgot password?' }).click();
  await page.getByLabel('Email', { exact: true }).fill(email.toUpperCase());
  await solveCaptcha(page);
  await page.getByRole('button', { name: 'Send reset link' }).click();
  await expect(page.getByRole('status').filter({ hasText: 'reset link' })).toBeVisible();
  const resetHash = await emailLink(email, 'reset-password');
  await page.goto(`/${resetHash}`);
  await expect(page.getByRole('heading', { name: 'Choose a new password.' })).toBeVisible();
  await expect(page).toHaveURL(url => url.hash === '');
  await page.getByLabel('New password', { exact: true }).fill(newPassword);
  await page.getByRole('button', { name: 'Save new password' }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Password updated' })).toBeVisible();
  await expect(page.locator('.account-button')).toHaveText(email);

  // The reset link is single use.
  await page.goto(`/${resetHash}`);
  await page.getByLabel('New password', { exact: true }).fill('another-signal-phrase-9');
  await page.getByRole('button', { name: 'Save new password' }).click();
  await expect(page.getByRole('alert')).toContainText('invalid or has expired');
  await page.getByRole('button', { name: 'Close dialog' }).click();

  // The new password works after signing out.
  await openAccount(page);
  await page.getByRole('button', { name: 'Sign out' }).click();
  await page.getByLabel('Email', { exact: true }).fill(email);
  await page.getByLabel('Password', { exact: true }).fill(newPassword);
  await solveCaptcha(page);
  await page.getByRole('dialog').getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page.locator('.account-card')).toContainText(email);
  await expect(page.locator('.account-button')).toHaveText(email);
});

test('change password, change email behind recovery keys, reactivate, recover and regenerate keys', async ({ page, browser }) => {
  test.skip(!process.env.NETWORK_TESTS, 'Requires the running Docker Compose stack.');
  test.slow(); // A long journey with about twenty deliberately slow password hashes.
  const stamp = Date.now(), email = `change-${stamp}@example.com`, moved = `moved-${stamp}@example.com`, typo = `typo-${stamp}@exampel.com`;
  const password = 'violet-relay-signal-42', second = 'amber-beacon-signal-77', third = 'cobalt-orbit-signal-19';
  const dialog = page.getByRole('dialog');
  const signInAs = async (address: string, secret: string) => {
    await page.getByLabel('Email', { exact: true }).fill(address);
    await page.getByLabel('Password', { exact: true }).fill(secret);
    await solveCaptcha(page);
    await dialog.getByRole('button', { name: 'Sign in', exact: true }).click();
  };
  const startChange = async (fields: { email?: string; password?: string; current: string }) => {
    await page.getByRole('button', { name: 'Change email or password' }).click();
    if (fields.email) await page.getByLabel('New email', { exact: true }).fill(fields.email);
    if (fields.password) await page.getByLabel('New password', { exact: true }).fill(fields.password);
    await page.getByLabel('Current password', { exact: true }).fill(fields.current);
    await page.getByRole('button', { name: 'Continue', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Sign out everywhere?' })).toBeVisible();
    await expect(dialog).toContainText('every device, including this one');
  };
  const shownKeys = async () => {
    await page.getByRole('button', { name: 'Continue to recovery keys' }).click();
    await expect(page.getByRole('heading', { name: 'Save your recovery keys.' })).toBeVisible();
    const keys = await page.getByRole('list', { name: 'Recovery keys' }).locator('code').allTextContents();
    expect(keys).toHaveLength(8);
    for (const key of keys) expect(key).toMatch(/^\d{4}-\d{4}-\d{4}$/);
    return keys;
  };

  await page.goto('/');
  await openAccount(page);
  await page.getByRole('button', { name: 'Create an account' }).click();
  await page.getByLabel('Email', { exact: true }).fill(email);
  await page.getByLabel('Password', { exact: true }).fill(password);
  await solveCaptcha(page);
  await page.getByRole('button', { name: 'Create account' }).click();
  await expect(page.locator('.account-card')).toContainText('No recovery keys yet');
  const phone = await browser.newContext();
  const phonePage = await phone.newPage();
  await phonePage.goto('/');
  await phonePage.locator('.account-button').click();
  await phonePage.getByLabel('Email', { exact: true }).fill(email);
  await phonePage.getByLabel('Password', { exact: true }).fill(password);
  await solveCaptcha(phonePage);
  await phonePage.getByRole('dialog').getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(phonePage.locator('.account-button')).toHaveText(email);

  // Server-side validation happens before the warning.
  await page.getByRole('button', { name: 'Change email or password' }).click();
  await page.getByLabel('New password', { exact: true }).fill(second);
  await page.getByLabel('Current password', { exact: true }).fill('not-my-password');
  await page.getByRole('button', { name: 'Continue', exact: true }).click();
  await expect(page.getByRole('alert')).toHaveText('Your current password is incorrect.');
  await page.getByRole('button', { name: 'Cancel', exact: true }).click();

  // Cancelling the warning keeps the panel open and changes nothing.
  await startChange({ password: second, current: password });
  await page.getByRole('button', { name: 'Cancel', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'You’re signed in.' })).toBeVisible();
  await expect(page.getByRole('status')).toHaveText('Nothing was changed.');

  // A password change signs out everywhere and requires the new password.
  await startChange({ password: second, current: password });
  await page.getByRole('button', { name: 'Change password and sign out' }).click();
  await expect(page.getByRole('heading', { name: 'Welcome back, pilot.' })).toBeVisible();
  await expect(page.getByRole('status')).toContainText('Sign in with your new password');
  await expect(page.getByLabel('Email', { exact: true })).toHaveValue(email);
  await expect(page.locator('.account-button')).toHaveText('Sign in');
  await phonePage.reload();
  await expect(phonePage.locator('.account-button')).toHaveText('Sign in');
  await signInAs(email, password);
  await expect(page.getByRole('alert')).toHaveText('Email or password is incorrect.');
  await signInAs(email, second);
  await expect(page.locator('.account-card')).toContainText(email);

  // Leaving at the recovery-key step disregards the email change; the same keys come back.
  await startChange({ email: moved, current: second });
  const keys = await shownKeys();
  await expect(page.getByRole('button', { name: `Change email to ${moved}` })).toBeDisabled();
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Download' }).click();
  const file = await download;
  expect(file.suggestedFilename()).toBe('relay-recovery-keys.txt');
  expect(readFileSync(await file.path(), 'utf8')).toContain(keys.join('\n'));
  await page.getByRole('button', { name: 'Close dialog' }).click();
  await openAccount(page);
  await expect(page.locator('.account-card')).toContainText(email);
  await expect(page.locator('.account-card')).toContainText('Recovery keys: 8 of 8 unused');
  await startChange({ email: moved, current: second });
  expect(await shownKeys()).toEqual(keys);
  await page.getByRole('button', { name: `Cancel and keep ${email}` }).click();
  await expect(page.getByRole('status')).toContainText(`It is still ${email}`);

  // Confirming deactivates the account until the new address is confirmed.
  await startChange({ email: moved, current: second });
  expect(await shownKeys()).toEqual(keys);
  await page.getByLabel('I have stored these recovery keys somewhere safe').check();
  await page.getByRole('button', { name: `Change email to ${moved}` }).click();
  await expect(page.getByRole('status')).toContainText(`deactivated until you open the link we sent to ${moved}`);
  await expect(page.locator('.account-button')).toHaveText('Sign in');
  await signInAs(email, second);
  await expect(page.getByRole('alert')).toHaveText('Email or password is incorrect.');
  await signInAs(moved, second);
  await expect(page.getByRole('alert')).toContainText(`Confirm ${moved} to reactivate`);
  await page.getByRole('button', { name: 'Send a new activation link' }).click();
  await expect(page.getByRole('status')).toContainText(`Activation link sent to ${moved}`);
  await page.goto(`/${await emailLink(moved, 'verify-email')}`);
  await expect(page.getByRole('status')).toContainText('active again');
  await dialog.getByRole('button', { name: 'Sign in' }).click();
  await signInAs(moved, second);
  await expect(page.locator('.account-card')).toContainText(moved);

  // A mistyped address can be undone with a recovery key and the previous email.
  await startChange({ email: typo, current: second });
  expect(await shownKeys()).toEqual(keys);
  await page.getByLabel('I have stored these recovery keys somewhere safe').check();
  await page.getByRole('button', { name: `Change email to ${typo}` }).click();
  await expect(page.getByRole('heading', { name: 'Welcome back, pilot.' })).toBeVisible();
  await page.getByRole('button', { name: 'Use a recovery key' }).click();
  await page.getByLabel('Email', { exact: true }).fill(moved);
  await page.getByLabel('Recovery key').fill(keys[0]);
  await page.getByLabel('New password', { exact: true }).fill(third);
  await page.getByRole('button', { name: 'Recover account' }).click();
  await expect(page.getByRole('status')).toContainText('7 keys remain');
  await expect(page.locator('.account-card')).toContainText(moved);
  await expect(page.locator('.account-card')).toContainText('Recovery keys: 7 of 8 unused');

  // Regenerating replaces every key.
  await page.getByRole('button', { name: 'Regenerate recovery keys' }).click();
  await page.getByLabel('Current password', { exact: true }).fill(third);
  await page.getByRole('button', { name: 'Replace my keys' }).click();
  await expect(page.getByRole('heading', { name: 'Save your recovery keys.' })).toBeVisible();
  const fresh = await page.getByRole('list', { name: 'Recovery keys' }).locator('code').allTextContents();
  expect(fresh).toHaveLength(8);
  expect(fresh.filter(key => keys.includes(key))).toEqual([]);
  await expect(page.getByRole('button', { name: 'Done' })).toBeDisabled();
  await page.getByLabel('I have stored these recovery keys somewhere safe').check();
  await page.getByRole('button', { name: 'Done' }).click();
  await expect(page.locator('.account-card')).toContainText('Recovery keys: 8 of 8 unused');

  // Used and replaced keys no longer recover the account.
  await page.getByRole('button', { name: 'Sign out' }).click();
  for (const old of [keys[0], keys[1]]) {
    await page.getByRole('button', { name: 'Use a recovery key' }).click();
    await page.getByLabel('Email', { exact: true }).fill(moved);
    await page.getByLabel('Recovery key').fill(old);
    await page.getByLabel('New password', { exact: true }).fill('another-signal-phrase-9');
    await page.getByRole('button', { name: 'Recover account' }).click();
    await expect(page.getByRole('alert')).toContainText('do not match an account');
    await page.getByRole('button', { name: 'Back to sign in' }).click();
  }
  await phone.close();
});

test('self-service deletion erases personal data, leaves the squad and keeps the expedition', async ({ page }) => {
  test.skip(!process.env.NETWORK_TESTS, 'Requires the running Docker Compose stack.');
  const stamp = Date.now(), email = `delete-${stamp}@example.com`, password = 'violet-relay-signal-42', callsign = `Quill ${stamp % 100000}`;
  const dialog = page.getByRole('dialog');
  await page.goto('/');
  await page.getByRole('button', { name: 'Launch squad' }).click();
  await page.getByLabel('Pilot callsign').fill(callsign);
  await page.getByLabel('Squad name').fill(`${callsign}'s public squad`);
  const created = page.waitForResponse(r => r.url().endsWith('/api/rooms/') && r.request().method() === 'POST');
  await page.getByRole('button', { name: 'Launch expedition', exact: true }).click();
  const { room } = await (await created).json();
  await expect(page.locator('.connection')).toContainText('connected', { timeout: 15000 });
  expect(await page.evaluate(() => localStorage.getItem('relay:name'))).toBe(callsign);
  await openAccount(page);
  await page.getByRole('button', { name: 'Create an account' }).click();
  await page.getByLabel('Email', { exact: true }).fill(email);
  await page.getByLabel('Password', { exact: true }).fill(password);
  await solveCaptcha(page);
  await page.getByRole('button', { name: 'Create account' }).click();
  await expect(page.locator('.account-card')).toContainText(email);

  // Cancelling keeps everything.
  await page.getByRole('button', { name: 'Delete account' }).click();
  await expect(page.getByRole('heading', { name: 'Delete your account?' })).toBeVisible();
  await expect(dialog).toContainText('this browser leaves its current squad');
  await page.getByRole('button', { name: 'Cancel and keep my account' }).click();
  await expect(dialog.getByRole('status')).toHaveText('Nothing was changed.');

  await page.getByRole('button', { name: 'Delete account' }).click();
  await page.getByLabel('Current password', { exact: true }).fill('not-my-password');
  await expect(page.getByRole('button', { name: 'Delete my account' })).toBeDisabled();
  await page.getByLabel('I understand my account can’t be restored').check();
  await page.getByRole('button', { name: 'Delete my account' }).click();
  await expect(page.getByRole('alert')).toHaveText('Your current password is incorrect.');
  await page.getByLabel('Current password', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Delete my account' }).click();
  await expect(page.getByRole('heading', { name: 'Account deleted.' })).toBeVisible();

  // Signed out, out of the squad, and nothing personal left in this browser.
  await expect(page.locator('.account-button')).toHaveText('Sign in');
  await expect(page.locator('.connection')).toHaveText('Local preview');
  expect(await page.evaluate(() => [localStorage.getItem('relay:name'), localStorage.getItem('relay:room')])).toEqual([null, null]);
  await expect(page.locator('.rail .avatar')).toHaveText('E');
  await page.getByRole('button', { name: 'Keep exploring' }).click();

  // The expedition itself survives, with its squad name scrambled.
  const listed = (await (await page.request.get('/api/rooms/')).json() as { code: string; name: string; players: number }[]).find(r => r.code === room.code);
  expect(listed?.name).toMatch(/^[0-9a-f]{48}$/);
  expect(listed?.players).toBe(1);

  // A final confirmation went to the old address, and the address can start over.
  const log = mailLog();
  expect(log.split(/^Content-Type: text\/plain/m).some(m => m.includes(`To: ${email}`) && m.includes('was deleted'))).toBe(true);
  await openAccount(page);
  await page.getByLabel('Email', { exact: true }).fill(email);
  await page.getByLabel('Password', { exact: true }).fill(password);
  await solveCaptcha(page);
  await dialog.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page.getByRole('alert')).toHaveText('Email or password is incorrect.');
  await page.getByRole('button', { name: 'Create an account' }).click();
  await page.getByLabel('Email', { exact: true }).fill(email);
  await page.getByLabel('Password', { exact: true }).fill(password);
  await solveCaptcha(page);
  await page.getByRole('button', { name: 'Create account' }).click();
  await expect(page.locator('.account-card')).toContainText(email);
});

test('downloads the account’s data as a JSON file behind the current password, without leaving the squad', async ({ page }) => {
  test.skip(!process.env.NETWORK_TESTS, 'Requires the running Docker Compose stack.');
  const stamp = Date.now(), email = `export-${stamp}@example.com`, password = 'violet-relay-signal-42', callsign = `Lark ${stamp % 100000}`;
  const squadName = `${callsign} data run`, prompt = `Plot a course for relay ${stamp}`;
  const dialog = page.getByRole('dialog');
  await page.goto('/');
  await page.getByRole('button', { name: 'Launch squad' }).click();
  await page.getByLabel('Pilot callsign').fill(callsign);
  await page.getByLabel('Squad name').fill(squadName);
  await page.getByLabel('Invite-only expedition').check();
  const created = page.waitForResponse(r => r.url().endsWith('/api/rooms/') && r.request().method() === 'POST');
  await page.getByRole('button', { name: 'Launch expedition', exact: true }).click();
  const { room } = await (await created).json();
  await expect(page.locator('.connection')).toContainText('connected', { timeout: 15000 });

  // Ask ORA something as a guest; signing up brings this pilot and its prompt to the account.
  const answered = page.waitForResponse(r => r.url().endsWith(`/api/rooms/${room.code}/ai/`) && r.request().method() === 'POST');
  await page.getByLabel('Message ORA').fill(prompt);
  await page.getByRole('button', { name: 'Send to ORA' }).click();
  expect((await answered).status()).toBe(200);
  await openAccount(page);
  await page.getByRole('button', { name: 'Create an account' }).click();
  await page.getByLabel('Email', { exact: true }).fill(email);
  await page.getByLabel('Password', { exact: true }).fill(password);
  await solveCaptcha(page);
  await page.getByRole('button', { name: 'Create account' }).click();
  await expect(page.locator('.account-card')).toContainText(email);

  // A wrong password downloads nothing.
  const downloads: string[] = [];
  page.on('download', file => downloads.push(file.suggestedFilename()));
  await page.getByRole('button', { name: 'Download my data' }).click();
  await expect(page.getByRole('heading', { name: 'Download your data.' })).toBeVisible();
  await page.getByLabel('Current password', { exact: true }).fill('not-my-password');
  await page.getByRole('button', { name: 'Download JSON file' }).click();
  await expect(page.getByRole('alert')).toHaveText('Your current password is incorrect.');
  expect(downloads).toEqual([]);

  await page.getByLabel('Current password', { exact: true }).fill(password);
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Download JSON file' }).click();
  const file = await download;
  expect(file.suggestedFilename()).toMatch(/^relay-account-data-\d{4}-\d{2}-\d{2}\.json$/);
  const text = readFileSync(await file.path(), 'utf8');
  const data = JSON.parse(text);
  expect(data.account.email).toBe(email);
  expect(data.pilots.map((p: { callsign: string }) => p.callsign)).toEqual([callsign]);
  expect(data.squads).toEqual([expect.objectContaining({ code: room.code, name: squadName, invite_only: true, created_by_you: true })]);
  expect(data.ora_prompts).toEqual([expect.objectContaining({ squad: room.code, callsign, prompt })]);
  expect(data.mission_events).toContainEqual(expect.objectContaining({ squad: room.code, kind: 'ai', asked_by_you: true }));
  expect(text).not.toContain(password);

  // Downloading changes nothing: still signed in and still flying with the squad.
  await expect(dialog.getByRole('status')).toContainText(`Downloaded ${file.suggestedFilename()}`);
  await expect(page.locator('.account-card')).toContainText(email);
  await page.getByRole('button', { name: 'Close dialog' }).click();
  await expect(page.locator('.connection')).toContainText('connected');
  expect((await page.request.get(`/api/rooms/${room.code}/`)).status()).toBe(200);
});

test('the CAPTCHA changes on request, after every failed attempt and on page refresh', async ({ page }) => {
  test.skip(!process.env.NETWORK_TESTS, 'Requires the running Docker Compose stack.');
  const image = page.getByRole('dialog').getByRole('img', { name: /CAPTCHA image/ });
  const changes = async (action: () => Promise<unknown>) => {
    await expect(image).toBeVisible();
    const before = await image.getAttribute('src');
    await action();
    await expect(image).toBeVisible();
    await expect.poll(() => image.getAttribute('src')).not.toBe(before);
  };
  await page.goto('/');
  await openAccount(page);
  await changes(() => page.getByRole('button', { name: 'Show a new image' }).click());

  // A wrong answer is rejected before the password is even checked, and the image is replaced.
  await page.getByLabel('Email', { exact: true }).fill('nobody@example.com');
  await page.getByLabel('Password', { exact: true }).fill('violet-relay-signal-42');
  await changes(async () => {
    await page.getByLabel('Characters in the image').fill('WRONG');
    await page.getByRole('dialog').getByRole('button', { name: 'Sign in', exact: true }).click();
    await expect(page.getByRole('alert')).toContainText('did not match the image');
  });
  await expect(page.getByLabel('Characters in the image')).toHaveValue('');
  // A failed sign-in with a correct CAPTCHA also gets a new image.
  await changes(async () => {
    await solveCaptcha(page);
    await page.getByRole('dialog').getByRole('button', { name: 'Sign in', exact: true }).click();
    await expect(page.getByRole('alert')).toHaveText('Email or password is incorrect.');
  });
  // The other protected forms show one too.
  await page.getByRole('button', { name: 'Create an account' }).click();
  await expect(image).toBeVisible();
  await page.getByRole('button', { name: 'Already have an account? Sign in' }).click();
  await page.getByRole('button', { name: 'Forgot password?' }).click();
  await expect(image).toBeVisible();
  await changes(async () => { await page.reload(); await openAccount(page); });
});
