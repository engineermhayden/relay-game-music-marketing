# GlassFocusRing remains hidden when its child receives keyboard focus

Suggested priority: **P1**  
Suggested labels: bug, accessibility, testing  
Reviewed version: 1.0.28 at `1474e6df7618ecadfd25ed91ce314da0e4edcb91`

## Problem and impact

The component attaches useGlassFocus to a wrapper div. The hook listens for native focus/blur on that wrapper without capture, but those events do not bubble from its child. Focusing the actual button leaves the ring at opacity zero. The wrapper adds an extra tab stop, and nine behavioral tests are skipped with most relevant assertions commented out, concealing the focus defect.

## Reproduction

Render <GlassFocusRing><button>Focus me</button></GlassFocusRing>, then focus the button itself. document.activeElement is the button, but the ring's inline opacity stays '0'. Inspect the discovered test suite: focus visibility and reduced-motion checks are skipped.

## Expected behavior

The ring follows focus on the intended interactive child without introducing a redundant tab stop.

## Source references

- [src/components/GlassFocusRing/GlassFocusRing.tsx:30](https://github.com/auraoneai/galileo-glass-ui/blob/1474e6df7618ecadfd25ed91ce314da0e4edcb91/src/components/GlassFocusRing/GlassFocusRing.tsx#L30)
- [src/components/GlassFocusRing/GlassFocusRing.tsx:50](https://github.com/auraoneai/galileo-glass-ui/blob/1474e6df7618ecadfd25ed91ce314da0e4edcb91/src/components/GlassFocusRing/GlassFocusRing.tsx#L50)
- [src/hooks/useGlassFocus.ts:112](https://github.com/auraoneai/galileo-glass-ui/blob/1474e6df7618ecadfd25ed91ce314da0e4edcb91/src/hooks/useGlassFocus.ts#L112)
- [src/components/GlassFocusRing/__tests__/GlassFocusRing.test.tsx:36](https://github.com/auraoneai/galileo-glass-ui/blob/1474e6df7618ecadfd25ed91ce314da0e4edcb91/src/components/GlassFocusRing/__tests__/GlassFocusRing.test.tsx#L36)

## Acceptance criteria for one PR

- [ ] Observe child focus correctly using an appropriate event/ref strategy and preserve child refs/handlers.
- [ ] Remove the redundant focusable wrapper behavior unless explicitly part of the API.
- [ ] Restore meaningful focus/blur and reduced-motion assertions; re-enabling tests with assertions still commented out is insufficient.
- [ ] Add a keyboard browser regression for the actual child control.

## Verification

Reproduced using the real component and hook; the skipped behavioral tests were inspected.
