# Public MenuItem components render placeholders and ignore all props

Suggested priority: **P1**  
Suggested labels: bug, components  
Reviewed version: 1.0.28 at `1474e6df7618ecadfd25ed91ce314da0e4edcb91`

## Problem and impact

MenuItem and GlassMenuItem ignore children, onClick, disabled, and selected, rendering only literal placeholder text. MenuItem is exported from the package root, so consumers can import an apparently supported component that cannot perform its documented action.

## Reproduction

Render <MenuItem onClick={handler}>Delete record</MenuItem> and click the li. The text is 'MenuItem Placeholder' and handler is never called. GlassMenuItem has the same implementation pattern.

## Expected behavior

The component renders its content, handles enabled activation, and exposes the documented disabled/selected behavior.

## Source references

- [src/components/MenuItem/MenuItem.tsx:32](https://github.com/auraoneai/galileo-glass-ui/blob/1474e6df7618ecadfd25ed91ce314da0e4edcb91/src/components/MenuItem/MenuItem.tsx#L32)
- [src/index.ts:62](https://github.com/auraoneai/galileo-glass-ui/blob/1474e6df7618ecadfd25ed91ce314da0e4edcb91/src/index.ts#L62)

## Acceptance criteria for one PR

- [ ] Implement the declared MenuItem contract and appropriate accessible menu-item semantics.
- [ ] Cover children, pointer/keyboard activation, disabled suppression, selected state, and forwarded ref.
- [ ] Exercise the public export in a consumer test.

## Verification

Reproduced with the actual MenuItem implementation; both placeholder implementations inspected.
