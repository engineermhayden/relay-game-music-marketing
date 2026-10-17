# Reordering sorted grid rows reports a different order to the parent

Suggested priority: **P1**  
Suggested labels: bug, data-grid  
Reviewed version: 1.0.28 at `1474e6df7618ecadfd25ed91ce314da0e4edcb91`

## Problem and impact

The displayed order maps indices into sortedData, but onRowOrderChange maps the same indices into initialData. After sorting, those arrays differ. A parent that persists the callback result saves an order that disagrees with the visible grid.

## Reproduction

Provide rows Zoe, Alice and initialSort={columnId:'name',direction:'asc'}. Reorder the sorted indices to [1,0]. The grid displays Zoe first, but onRowOrderChange reports Alice first.

## Expected behavior

The callback's data order matches the user's visible reorder operation, with clearly defined behavior when sorting is active.

## Source references

- [src/components/GlassDataGrid/GlassDataGrid.tsx:140](https://github.com/auraoneai/galileo-glass-ui/blob/1474e6df7618ecadfd25ed91ce314da0e4edcb91/src/components/GlassDataGrid/GlassDataGrid.tsx#L140)
- [src/components/GlassDataGrid/GlassDataGrid.tsx:144](https://github.com/auraoneai/galileo-glass-ui/blob/1474e6df7618ecadfd25ed91ce314da0e4edcb91/src/components/GlassDataGrid/GlassDataGrid.tsx#L144)

## Acceptance criteria for one PR

- [ ] Map drag indices through the same row identity/data sequence used for display.
- [ ] Define how active sorting interacts with manual ordering and controlled parent updates.
- [ ] Add a sort-then-reorder test that compares visible row identities with the callback payload.

## Verification

Reproduced by driving the grid's real order-update callback through a captured drag-hook callback.
