# GlassDataGrid sorts by column ID instead of the declared accessor key

Suggested priority: **P2**  
Suggested labels: bug, data-grid  
Reviewed version: 1.0.28 at `1474e6df7618ecadfd25ed91ce314da0e4edcb91`

## Problem and impact

The column contract separates id from accessorKey, and cells use accessorKey to display values. Sorting passes col.id to a hook that reads row[columnId], so a valid column whose ID differs from its data key sorts undefined values instead of the displayed data.

## Reproduction

Use columns=[{id:'nameColumn',accessorKey:'name',header:'Name',sortable:true}] and rows named Zoe then Alice. Click Name to sort ascending. The first visible row remains Zoe.

## Expected behavior

Sorting and initialSort resolve a column ID to the same data accessor used for rendering.

## Source references

- [src/components/GlassDataGrid/types.ts:11](https://github.com/auraoneai/galileo-glass-ui/blob/1474e6df7618ecadfd25ed91ce314da0e4edcb91/src/components/GlassDataGrid/types.ts#L11)
- [src/components/GlassDataGrid/GlassDataGrid.tsx:239](https://github.com/auraoneai/galileo-glass-ui/blob/1474e6df7618ecadfd25ed91ce314da0e4edcb91/src/components/GlassDataGrid/GlassDataGrid.tsx#L239)
- [src/hooks/useSortableData.ts:25](https://github.com/auraoneai/galileo-glass-ui/blob/1474e6df7618ecadfd25ed91ce314da0e4edcb91/src/hooks/useSortableData.ts#L25)

## Acceptance criteria for one PR

- [ ] Resolve the selected column to its accessor before comparing row values.
- [ ] Preserve column IDs in sorting UI state while using the actual accessor for data.
- [ ] Cover differing ID/accessor pairs for ascending, descending, and initial sorting.

## Verification

Reproduced with the actual grid and useSortableData; only animation/drag dependencies were stubbed.
