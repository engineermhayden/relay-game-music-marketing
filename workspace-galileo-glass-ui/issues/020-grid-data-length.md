# GlassDataGrid drops loaded rows and crashes when data shrinks

Suggested priority: **P1**  
Suggested labels: bug, data-grid  
Reviewed version: 1.0.28 at `1474e6df7618ecadfd25ed91ce314da0e4edcb91`

## Problem and impact

renderOrder is initialized once from the original row count and is not synchronized with subsequent data props. Mounting with an empty array and loading rows leaves renderOrder empty, so no rows display. Shrinking a populated array leaves stale indices and dereferences row.id on undefined, crashing rendering.

## Reproduction

Mount the grid with data=[] and rerender with one row: tbody remains empty. Separately mount with one row and rerender with data=[]: rendering throws while accessing the stale row.

## Expected behavior

The grid tracks additions/removals and asynchronous loading without losing rows or dereferencing stale indices.

## Source references

- [src/components/GlassDataGrid/GlassDataGrid.tsx:130](https://github.com/auraoneai/galileo-glass-ui/blob/1474e6df7618ecadfd25ed91ce314da0e4edcb91/src/components/GlassDataGrid/GlassDataGrid.tsx#L130)
- [src/components/GlassDataGrid/GlassDataGrid.tsx:135](https://github.com/auraoneai/galileo-glass-ui/blob/1474e6df7618ecadfd25ed91ce314da0e4edcb91/src/components/GlassDataGrid/GlassDataGrid.tsx#L135)
- [src/components/GlassDataGrid/GlassDataGrid.tsx:272](https://github.com/auraoneai/galileo-glass-ui/blob/1474e6df7618ecadfd25ed91ce314da0e4edcb91/src/components/GlassDataGrid/GlassDataGrid.tsx#L272)

## Acceptance criteria for one PR

- [ ] Reconcile row order with data changes using a defined identity/order policy.
- [ ] Preserve valid user ordering where possible and remove invalid references.
- [ ] Cover empty-to-populated, append, removal, replacement, and clearing data in rerender tests.

## Verification

Both failure cases reproduced with the real grid; animation/drag dependencies were stubbed to isolate data handling.
