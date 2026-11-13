import type { EngineSnapshot, Metrics, RenderOptions } from './types';

// The server accepts up to 1.5 MB decoded and re-encodes anyway, so send a modest JPEG.
const MAX_SIDE = 1600;
const MAX_BYTES = 1_400_000;

const bytes = (dataUrl: string) => Math.floor((dataUrl.length - dataUrl.indexOf(',') - 1) * 3 / 4);

/** Shrinks a photograph capture (a full-size PNG) to a JPEG small enough to attach. */
export async function prepareScreenshot(dataUrl: string): Promise<string> {
  const image = new Image();
  image.src = dataUrl;
  await image.decode();
  const canvas = document.createElement('canvas'), context = canvas.getContext('2d');
  if (!context) throw new Error('This browser cannot prepare the screenshot.');
  let scale = Math.min(1, MAX_SIDE / Math.max(image.naturalWidth, image.naturalHeight));
  for (let attempt = 0; attempt < 4; attempt++, scale *= 0.75) {
    canvas.width = Math.max(16, Math.round(image.naturalWidth * scale));
    canvas.height = Math.max(16, Math.round(image.naturalHeight * scale));
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    const jpeg = canvas.toDataURL('image/jpeg', 0.85);
    if (bytes(jpeg) <= MAX_BYTES) return jpeg;
  }
  throw new Error('The screenshot is too large to attach.');
}

/** A short browser name and version from the user agent, for the preview only. */
export function browserName(userAgent: string) {
  for (const [name, pattern] of [['Edge', /Edg\/(\d+)/], ['Opera', /OPR\/(\d+)/], ['Firefox', /Firefox\/(\d+)/], ['Chrome', /Chrome\/(\d+)/], ['Safari', /Version\/(\d+).*Safari/]] as const) {
    const match = pattern.exec(userAgent);
    if (match) return `${name} ${match[1]}`;
  }
  return 'Unknown browser';
}

/** What the Engine lab shows right now: browser, renderer path, frame rate and warnings. */
export function engineSnapshot(metrics: Metrics, options: RenderOptions, scene: { destination: string; mode: 'preview' | 'squad' }, renderError = ''): EngineSnapshot {
  const evidence = metrics.evidence;
  const platform = (navigator as Navigator & { userAgentData?: { platform?: string } }).userAgentData?.platform || navigator.platform;
  return {
    captured_at: new Date().toISOString(),
    browser: { user_agent: navigator.userAgent, language: navigator.language, platform, viewport: `${innerWidth}×${innerHeight}`, pixel_ratio: Math.round(devicePixelRatio * 100) / 100 },
    renderer: {
      backend: metrics.backend,
      ...(evidence ? {
        bloom: evidence.bloom, fog: evidence.fog, shadow_map: evidence.shadowMap, grounding: evidence.grounding, particles: evidence.particles,
        instanced_submissions: Math.round(evidence.instancedSubmissions), animated_assets: Math.round(evidence.animatedAssets),
      } : {}),
    },
    performance: {
      fps: Math.round(metrics.fps), ...(metrics.frameMs != null ? { frame_ms: Math.round(metrics.frameMs) } : {}),
      resolution_scale: metrics.resolution ?? 1, draws: Math.round(metrics.draws), triangles: Math.round(metrics.triangles),
    },
    settings: { quality: options.quality, camera: options.camera, material: options.material, bloom: options.bloom, fog: options.fog, particles: options.particles, shadows: options.shadows, lab: options.lab },
    scene,
    errors: [...(renderError ? [renderError] : []), ...metrics.errors],
    warnings: evidence?.warnings ?? [],
    limitations: evidence?.limitations ?? [],
  };
}
