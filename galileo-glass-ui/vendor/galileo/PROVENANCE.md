# Galileo source provenance

Upstream: https://github.com/auraoneai/galileo-glass-ui

Commit: `1474e6df7618ecadfd25ed91ce314da0e4edcb91` (main, retrieved October 16, 2026).

License: MIT, preserved in `LICENSE`. The package manifest declares version 1.0.28; upstream's root version constant still says 1.0.23.

The documented package `@veerone/galileo-glass-ui` returned HTTP 404 from the public npm registry. This project therefore vendors `src/` and imports its actual components through the `@galileo/*` TypeScript alias. It does not substitute another component library or require an unavailable package.

## Local compatibility changes

- Each vendored TypeScript implementation has a leading `@ts-nocheck`. The upstream tree contains unresolved type inconsistencies; source interfaces remain available to consumers. The app, API routes, and browser tests are checked in strict TypeScript. No global Next.js type-check bypass is enabled.
- `components/Chip/Chip.tsx`: correct inverted visibility interpolation; visible chips now have opacity 1.
- `components/Button/Button.tsx`: consume and render the declared start/end icons and loading state instead of forwarding those props to DOM elements; loading disables the button.
- `components/Button/MagneticButton.tsx`: suppress pointer attraction and return animation when reduced motion is requested.
- `components/Slider/Slider.tsx`: inherit readable label color; add slider semantics and Arrow/Home/End keyboard controls.
- `components/surfaces/DimensionalGlass.tsx`: apply the public style prop to the outer surface, leaving physics transforms on the inner content. This prevents material width, padding, blur, and color from creating a second nested surface.
- `components/Navigation/GlassNavigation.tsx`: stabilize initial spring values and stop feeding every animation frame back into the effect that starts the same animation.
- `hooks/useReducedMotion.ts`: combine the operating-system preference with the existing AccessibilityProvider preferences so the app switch reaches physics consumers.
- `hooks/useGalileoSprings.ts`: stabilize numerically equal targets and initial values. Fresh object identities previously restarted springs on their own render updates, preventing completion and generating excessive renders.
- `components/Modal/Modal.tsx`: drive visibility and focus restoration directly from the controlled open state, independently of animation completion. This also makes the dialog visible before its autofocus callback runs.
- `components/Icon/Icon.tsx`: accept the child-string icon API used by upstream navigation/theme components and map missing named icons to the already installed Lucide SVGs.
- `components/GlassDataGrid/GlassDataGrid.tsx`: preserve normal table layout and updated datasets when dragging is disabled, skip inactive drag physics, and use readable theme-aware fallback colors. Keep the table surface stationary so hover tilt cannot clip rows or focus outlines. Stabilize sort animation triggers and hide decorative arrows from accessible names. Upstream applied absolute row positioning unconditionally, clipping the table body.

The app explicitly registers Chart.js controllers through `chart.js/auto`; upstream's element-only registration was insufficient after production tree shaking.

Application integration provides ThemeProvider, AccessibilityProvider, AnimationProvider, and GlassLocalizationProvider with Galileo's date-fns adapter. Browser-dependent components are loaded on the client. Fixed-position gallery examples are contained by their preview frames. Other behavior and visual rendering remain upstream.

## Limits

The library has inconsistent theme schemas and some controls still need production accessibility review. The Card implementation always delegates to DimensionalGlass despite accepting other variant names; the material laboratory therefore selects the specialized surface components directly. Data-grid dragging is experimental upstream and is not enabled here. Several subcomponents are internal parts of composed examples rather than separate demos. Aliases are grouped with their corresponding component, not counted as distinct implementations.
