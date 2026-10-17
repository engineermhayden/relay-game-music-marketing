# useGlassTheme reads a disconnected context and ignores ThemeProvider changes

Suggested priority: **P1**  
Suggested labels: bug, theming  
Reviewed version: 1.0.28 at `1474e6df7618ecadfd25ed91ce314da0e4edcb91`

## Problem and impact

useGlassTheme consumes GlassThemeContext, which defaults to a light theme and no-op setters. The public ThemeProvider supplies other contexts and styled-components' context, but never supplies GlassThemeContext. Components using useGlassTheme remain on its default values even when the real provider forces dark mode.

## Reproduction

Render a probe under <ThemeProvider forceColorMode='dark' enableAutoDetection={false}>. useColorMode().isDarkMode is true, but useGlassTheme().isDarkMode is false. Calling the latter hook's default setters is also a no-op.

## Expected behavior

Public theme hooks and library components observe the same provider state and theme changes.

## Source references

- [src/hooks/useGlassTheme.ts:377](https://github.com/auraoneai/galileo-glass-ui/blob/1474e6df7618ecadfd25ed91ce314da0e4edcb91/src/hooks/useGlassTheme.ts#L377)
- [src/hooks/useGlassTheme.ts:392](https://github.com/auraoneai/galileo-glass-ui/blob/1474e6df7618ecadfd25ed91ce314da0e4edcb91/src/hooks/useGlassTheme.ts#L392)
- [src/theme/ThemeProvider.tsx:1054](https://github.com/auraoneai/galileo-glass-ui/blob/1474e6df7618ecadfd25ed91ce314da0e4edcb91/src/theme/ThemeProvider.tsx#L1054)

## Acceptance criteria for one PR

- [ ] Bridge or consolidate the contexts while preserving a clear public theme shape.
- [ ] Verify theme switching updates both hooks and representative useGlassTheme consumers.
- [ ] Add integration tests using the real public provider, rather than supplying GlassThemeContext directly in every hook test.

## Verification

Reproduced with the real ThemeProvider and both hooks.
