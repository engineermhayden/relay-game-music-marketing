import { test, expect, type Page } from '@playwright/test';

function recording() {
  // A real, decodable 30-second WAV keeps media lifecycle assertions deterministic.
  const pcmLength = 8000 * 2 * 30;
  const bytes = Buffer.alloc(44 + pcmLength);
  bytes.write('RIFF', 0); bytes.writeUInt32LE(36 + pcmLength, 4); bytes.write('WAVEfmt ', 8);
  bytes.writeUInt32LE(16, 16); bytes.writeUInt16LE(1, 20); bytes.writeUInt16LE(1, 22);
  bytes.writeUInt32LE(8000, 24); bytes.writeUInt32LE(16000, 28); bytes.writeUInt16LE(2, 32); bytes.writeUInt16LE(16, 34);
  bytes.write('data', 36); bytes.writeUInt32LE(pcmLength, 40);
  return bytes;
}

const track = (id: number, title: string) => ({ id, title, artist_name: 'The Relay Band', author: 'A Composer', artist_website: 'https://example.com/artist', audio: `/__test-music/${id}.wav`, cover_art: null, audio_description: 'Recorded for the expedition.', artist_description: 'Independent musicians.', duration_seconds: 30, is_published: true });

async function library(page: Page) {
  const state = { tracks: [track(1, 'First Signal'), track(2, 'Second Orbit'), track(3, 'Third Light')], fail: false };
  const wav = recording();
  await page.addInitScript(() => {
    if (!localStorage.getItem('relay:music:v1')) localStorage.setItem('relay:music:v1', JSON.stringify({ enabled: false }));
  });
  await page.route('**/api/music/tracks/', route => route.fulfill(state.fail ? { status: 503, json: {} } : { json: state.tracks }));
  await page.route('**/__test-music/*.wav', route => {
    const range = /bytes=(\d+)-(\d*)/.exec(route.request().headers().range || '');
    const start = range ? Number(range[1]) : 0;
    const end = range?.[2] ? Number(range[2]) : wav.length - 1;
    return route.fulfill({ status: range ? 206 : 200, contentType: 'audio/wav', body: wav.subarray(start, end + 1), headers: {
      'Accept-Ranges': 'bytes', 'Content-Length': String(end - start + 1),
      ...(range ? { 'Content-Range': `bytes ${start}-${end}/${wav.length}` } : {}),
    } });
  });
  await page.goto('/');
  await expect(page.locator('.music-now')).toContainText('First Signal', { timeout: 45000 });
  return state;
}

async function playing(page: Page) {
  await expect(page.getByRole('button', { name: 'Pause music', exact: true })).toBeVisible();
  await expect.poll(() => page.locator('audio').evaluate(audio => !(audio as HTMLAudioElement).paused)).toBe(true);
}

async function finish(page: Page) {
  await expect.poll(() => page.locator('audio').evaluate(audio => Number.isFinite((audio as HTMLAudioElement).duration))).toBe(true);
  await page.locator('audio').evaluate(audio => { const media = audio as HTMLAudioElement; media.currentTime = media.duration - .15; });
}

test('plays, mutes, skips and keeps playing across destination and panel changes', async ({ page }) => {
  await library(page);
  await page.getByRole('button', { name: 'Play music', exact: true }).click();
  await playing(page);
  await expect.poll(() => page.locator('audio').evaluate(audio => (audio as HTMLAudioElement).currentTime)).toBeGreaterThan(.1);
  const before = await page.locator('audio').evaluate(audio => (audio as HTMLAudioElement).currentTime);
  await page.getByRole('button', { name: 'Explore Ember Caldera', exact: true }).click();
  await page.getByRole('button', { name: 'Engine lab', exact: true }).first().click();
  await playing(page);
  expect(await page.locator('audio').evaluate(audio => (audio as HTMLAudioElement).currentTime)).toBeGreaterThanOrEqual(before);
  await page.getByRole('button', { name: 'Mute music', exact: true }).click();
  await expect(page.locator('audio')).toHaveJSProperty('muted', true);
  await page.getByRole('button', { name: 'Next track', exact: true }).click();
  await expect(page.locator('.music-now')).toContainText('Second Orbit');
  await playing(page);
  await expect(page.locator('audio')).toHaveJSProperty('muted', true);
  await page.getByRole('button', { name: 'Pause music', exact: true }).click();
  await expect(page.locator('audio')).toHaveJSProperty('paused', true);
});

test('reorders, selects and persists the playlist, credits, volume, mute and repeat', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await library(page);
  await page.getByRole('button', { name: 'Show playlist' }).click();
  await expect(page.getByRole('region', { name: 'Available tracks' })).toContainText('Written by A Composer');
  await expect(page.getByRole('link', { name: 'Artist website' })).toHaveAttribute('href', 'https://example.com/artist');
  await page.getByRole('button', { name: 'Move Third Light up' }).click();
  await page.getByRole('button', { name: 'Move Third Light up' }).click();
  expect(await page.locator('.music-track-select').evaluateAll(elements => elements.map(element => element.getAttribute('aria-label')))).toEqual(['Play Third Light', 'Play First Signal', 'Play Second Orbit']);
  await page.getByRole('button', { name: 'Play Third Light', exact: true }).click();
  await playing(page);
  await page.getByRole('button', { name: 'Next track', exact: true }).click();
  await expect(page.locator('.music-now')).toContainText('First Signal', { timeout: 45000 });
  await page.getByRole('button', { name: 'Mute music', exact: true }).click();
  await page.getByRole('combobox', { name: 'Repeat mode' }).selectOption('one');
  await page.getByRole('slider', { name: 'Music volume', exact: true }).fill('0.3');
  await page.getByRole('button', { name: 'Pause music', exact: true }).click();
  await page.reload();
  await expect(page.locator('.music-now')).toContainText('First Signal', { timeout: 45000 });
  await expect(page.locator('audio')).toHaveJSProperty('muted', true);
  await expect(page.locator('audio')).toHaveJSProperty('volume', .3);
  await expect(page.locator('audio')).toHaveJSProperty('loop', true);
  await page.getByRole('button', { name: 'Show playlist' }).click();
  await expect(page.locator('.music-track-select').first()).toHaveAttribute('aria-label', 'Play Third Light');
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.getByRole('region', { name: 'Available tracks' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Next track', exact: true })).toBeInViewport();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: '../artifacts/relay-music-mobile.png', fullPage: true });
  expect(errors).toEqual([]);
});

test('handles natural endings for repeat one, repeat all, repeat off and manual skip', async ({ page }) => {
  await library(page);
  await page.getByRole('button', { name: 'Play music', exact: true }).click();
  await playing(page);
  await page.getByRole('combobox', { name: 'Repeat mode' }).selectOption('one');
  await finish(page);
  await expect.poll(() => page.locator('audio').evaluate(audio => (audio as HTMLAudioElement).currentTime)).toBeLessThan(3);
  await expect(page.locator('.music-now')).toContainText('First Signal');
  await page.getByRole('button', { name: 'Next track', exact: true }).click();
  await expect(page.locator('.music-now')).toContainText('Second Orbit');
  await page.getByRole('combobox', { name: 'Repeat mode' }).selectOption('off');
  await playing(page); await finish(page);
  await expect(page.locator('.music-now')).toContainText('Third Light');
  await playing(page); await finish(page);
  await expect(page.getByRole('button', { name: 'Play music', exact: true })).toBeVisible();
  await expect(page.locator('.music-now')).toContainText('Third Light');
  await page.getByRole('combobox', { name: 'Repeat mode' }).selectOption('all');
  await page.getByRole('button', { name: 'Play music', exact: true }).click();
  await playing(page); await finish(page);
  await expect(page.locator('.music-now')).toContainText('First Signal');
  await playing(page);
});

test('new releases append without resetting audio or listener order; failures retain the queue', async ({ page }) => {
  const state = await library(page);
  await page.getByRole('button', { name: 'Play music', exact: true }).click();
  await playing(page);
  await page.getByRole('button', { name: 'Show playlist' }).click();
  await page.getByRole('button', { name: 'Move Second Orbit up' }).click();
  state.tracks.push(track(4, 'New Release'));
  const before = await page.locator('audio').evaluate(audio => (audio as HTMLAudioElement).currentTime);
  await page.getByRole('button', { name: 'Refresh tracks' }).click();
  await expect(page.locator('.music-track-select').last()).toHaveAttribute('aria-label', 'Play New Release');
  await expect(page.locator('.music-track-select').first()).toHaveAttribute('aria-label', 'Play Second Orbit');
  expect(await page.locator('audio').evaluate(audio => (audio as HTMLAudioElement).currentTime)).toBeGreaterThanOrEqual(before);
  state.fail = true;
  await page.getByRole('button', { name: 'Refresh tracks' }).click();
  await expect(page.locator('.music-message')).toContainText('Music library unavailable');
  await expect(page.locator('.music-track-select')).toHaveCount(4);
  await playing(page);
  state.fail = false;
  state.tracks = state.tracks.filter(song => song.id !== 1);
  await page.getByRole('button', { name: 'Refresh tracks' }).click();
  await expect(page.locator('.music-track-select')).toHaveCount(3);
  await expect(page.locator('.music-now')).toContainText('Second Orbit');
  await playing(page);
});

test('playlist keyboard controls do not move the pilot', async ({ page }) => {
  await library(page);
  await expect(page.locator('canvas')).toHaveAttribute('data-ready', 'true', { timeout: 45000 });
  await page.getByRole('button', { name: 'Show playlist' }).click();
  const before = await page.locator('.coordinate strong').textContent();
  await page.getByRole('button', { name: 'Play First Signal', exact: true }).focus();
  await page.keyboard.down('ArrowRight'); await page.waitForTimeout(350); await page.keyboard.up('ArrowRight');
  await expect(page.locator('.coordinate strong')).toHaveText(before!);
  await page.keyboard.press('Escape');
  await expect(page.getByRole('region', { name: 'Available tracks' })).toHaveCount(0);
});

test('sample MP3s stream through nginx and actually play', async ({ page, request }) => {
  test.skip(!process.env.NETWORK_TESTS, 'Requires the Docker stack with imported sample songs.');
  const response = await request.get('/api/music/tracks/');
  expect(response.ok()).toBe(true);
  const songs = await response.json();
  expect(songs.length).toBeGreaterThanOrEqual(3);
  const bytes = await request.get(songs[0].audio, { headers: { Range: 'bytes=0-1023' } });
  expect(bytes.status()).toBe(206);
  expect(bytes.headers()['content-type']).toContain('audio/');
  expect((await bytes.body()).length).toBe(1024);
  await page.addInitScript(() => localStorage.setItem('relay:music:v1', JSON.stringify({ enabled: false })));
  await page.goto('/');
  await expect(page.getByRole('button', { name: 'Play music', exact: true })).toBeEnabled({ timeout: 45000 });
  await page.getByRole('button', { name: 'Play music', exact: true }).click();
  await playing(page);
  await expect.poll(() => page.locator('audio').evaluate(audio => (audio as HTMLAudioElement).currentTime)).toBeGreaterThan(.2);
  const before = await page.locator('audio').evaluate(audio => (audio as HTMLAudioElement).currentTime);
  await page.getByRole('button', { name: 'Launch squad', exact: true }).click();
  await page.getByLabel('Pilot callsign').fill('Music test pilot');
  await page.getByLabel('Squad name').fill('Music continuity check');
  await page.getByLabel('Invite-only expedition').check();
  await page.getByRole('button', { name: 'Launch expedition', exact: true }).click();
  await expect(page.locator('.connection')).toContainText('connected', { timeout: 15000 });
  await playing(page);
  expect(await page.locator('audio').evaluate(audio => (audio as HTMLAudioElement).currentTime)).toBeGreaterThan(before);
  await page.getByRole('button', { name: 'Show playlist' }).click();
  await page.screenshot({ path: '../artifacts/relay-music-desktop.png', fullPage: true });
});
