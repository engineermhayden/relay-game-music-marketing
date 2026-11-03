# Live renderer evidence: origin and refreshing the reports

## Where the panel comes from

The **Live renderer evidence** panel is part of RELAY's React application. Aura3D supplies the diagnostic data and many of the warning strings displayed inside it.

The panel existed before the recent renderer fixes. Git history first records the `Live renderer evidence` text in commit `6b93abf`, titled `check in evaluation`.

The copied text `Live renderer evidenceReported by Aura3D` combines two adjacent labels in the interface. The relevant JSX, with the icon omitted, is:

```jsx
<summary>
  Live renderer evidence <span>Reported by Aura3D</span>
</summary>
```

**Reported by Aura3D** is an attribution authored in RELAY's interface. It is not an independent certification or an AI-generated assessment.

| Component | Owner and location |
| --- | --- |
| Panel, title, labels, layout and visibility in Engine lab | RELAY: [frontend/src/App.tsx](../frontend/src/App.tsx) |
| Periodic collection through `app.diagnostics()` | RELAY: [frontend/src/scene.ts](../frontend/src/scene.ts) |
| Renderer instrumentation and original diagnostic messages | Installed `@aura3d/engine` package |
| Interpretation of current and legacy diagnostic fields | RELAY: [frontend/src/rendererEvidence.ts](../frontend/src/rendererEvidence.ts) |

Aura3D's built-in diagnostic overlay is explicitly disabled in the application configuration:

```ts
diagnostics: { overlay: false }
```

The visible panel therefore comes from RELAY's source code, rather than an overlay automatically inserted by the engine.

## What produces the messages

Aura3D's diagnostics combine runtime observations, scene-description checks and informational messages. RELAY selects and formats those results for display.

Examples from the installed Aura3D 4.0.0 package:

| Message | Engine source, relative to `frontend/node_modules/@aura3d/engine/` | Meaning |
| --- | --- | --- |
| `Scene has no interactions...` | `dist/engine/agent-api/looks/generatedCodeWarnings.js` | The structural check did not find an interaction node in the scene description. |
| `scene has no contact shadow or contact-occlusion grounding cue` | `dist/engine/agent-api/rendererDiagnostics.js` | The scene audit did not recognize an authored grounding cue. |
| `Production runtime bridge active...` | `dist/engine/agent-api/compiler/renderer.js` | Informational counts of actors and primitives using the production renderer. |
| `Effect nodes are requested in the scene graph...` | `dist/engine/agent-api/compiler/renderer.js` | A general reminder that an authored effect request does not establish execution support. |

The interaction warning illustrates the limits of a structural check: RELAY already had working keyboard gameplay and mouse/touch camera controls, but those custom event listeners were not visible to the engine's scene-node audit. Pointer and keyboard declarations now describe that existing input in the scene graph.

The reporting runs locally in the visitor's browser. Calling `app.diagnostics()` does not send an AI evaluation request or invoke Anthropic. It also does not independently inspect screenshots or assess visual quality.

## How the reports refresh

While the renderer is running, `scene.ts` requests a diagnostic snapshot approximately once per second:

```ts
if (performance.now() - last > 1000) {
  const diagnostics = app.diagnostics();
  // Collect evidence and update the React metrics state.
}
```

The current adapter then interprets that snapshot for the panel. Opening the panel reveals the collected readings; it does not start a separate audit job.

Some structural warnings are generated during scene initialization. A new diagnostic read collects current telemetry and available reports, but does not reconstruct the scene or necessarily rerun every initialization check.

## Requesting a fresh evaluation

### Read the latest live evidence

1. Open the game and wait for the scene to load.
2. Open **Engine lab**.
3. Expand **Live renderer evidence**.
4. Leave the tab active while the scene renders. Readings refresh approximately once per second.

### Recreate the scene and rerun initialization checks

Reload the page to create a new renderer instance, rerun initialization checks and reset its cumulative counters.

Changing a destination or rendering option also rebuilds the scene. With the renderer fixes applied, each rebuild uses a fresh canvas to avoid a stale Aura3D VFX attachment.

After deploying an updated frontend, use **Ctrl+Shift+R** in Chrome or Edge to request a hard refresh. Refreshing the browser loads the frontend available on the server; local source changes must be built and deployed before they can affect production reports.

### Obtain an immediate raw diagnostic snapshot

Open the browser's developer console on the game page and run:

```js
{
  const app = globalThis.__AURA3D_LIVE_APPS__?.all()[0];

  if (!app) {
    throw new Error("Wait for the game to initialize.");
  }

  await app.ready();
  console.log(app.diagnostics());
}
```

This reads the current app's diagnostic snapshot. Reload the page first if the objective is to rerun scene initialization checks.

To copy a JSON snapshot to the clipboard in the Chrome or Edge developer console, use its `copy()` helper:

```js
{
  const app = globalThis.__AURA3D_LIVE_APPS__?.all()[0];

  if (!app) {
    throw new Error("Wait for the game to initialize.");
  }

  await app.ready();
  copy(JSON.stringify(app.diagnostics(), null, 2));
}
```

`copy()` is a developer-console helper, rather than an application API. A copied JSON report preserves the values at capture time, which is useful when comparing deployments or reporting an engine issue.

## Interpreting the current panel

- **Sampled:** The shadow diagnostics report a sampled shadow map. In Aura3D 4.0.0, the newer cascaded-shadow report can be positive while the legacy target-allocation-based report remains false. RELAY now prefers the newer report when available.
- **Rendered:** Execution evidence is reported for that feature. This does not establish visual-quality parity with another renderer.
- **Enabled:** The feature is enabled according to the available report. Fog uses this label.
- **Off:** The feature is disabled in RELAY's current rendering options.
- **Requested · unreported:** The feature was requested, but the adapter has no sufficient execution evidence.
- **Blob footprints:** Relay grounding uses authored translucent geometry beneath the bases. These footprints are not a screen-space occlusion pass.
- **Instanced submissions (total):** A cumulative count since scene mount, including renderer passes. The viewport draw count is the per-frame measurement.
- **GLB animation clips:** The reported imported animation-clip count. A count of one is expected for ORA's `Hover` clip.
- **Runtime limitations:** Specific missing inputs, dropped passes and effect limitations.
- **Raw Aura3D reports:** Original engine messages, including informational scene and lighting reports.

The direct-light count and ambient-light message describe different lighting roles. Two directional lights are collected as direct lights; the authored ambient light remains environment-lighting intent. These messages do not by themselves indicate a failure.

## When diagnostics are not enough

For a fresh assessment of visible behavior, use browser interaction tests and captured pixels in addition to diagnostic snapshots.

The renderer regression coverage in [frontend/tests/renderer-evidence.spec.ts](../frontend/tests/renderer-evidence.spec.ts) checks diagnostic interpretation, feature toggles, particle recovery after scene rebuilds, and a frozen-frame pixel comparison proving the grounding footprints affect the rendered image.

Other browser tests cover cameras, destinations, gameplay, lab behavior and downloaded photographs. See [frontend/tests](../frontend/tests) and the [README](../README.md) for the broader application context and deployment instructions.
