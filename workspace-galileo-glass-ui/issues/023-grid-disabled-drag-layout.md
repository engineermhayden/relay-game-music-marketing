# GlassDataGrid applies absolute drag positioning even when dragging is disabled

Suggested priority: **P2**  
Suggested labels: bug, data-grid, layout  
Reviewed version: 1.0.28 at `1474e6df7618ecadfd25ed91ce314da0e4edcb91`

## Problem and impact

The grid always initializes the drag physics hook and applies its styles to every tr. enableRowDragging only gates handlers and handles. With dragging disabled, rows are still position:absolute with userSelect:none and a grab cursor. This removes rows from normal table flow, prevents ordinary text selection, and leaves no spacer to account for row heights.

## Reproduction

Render a normal grid with enableRowDragging=false and inspect tbody tr. It has position:absolute and user-select:none. In a browser, check table/body height and column alignment rather than relying on JSDOM geometry.

## Expected behavior

A non-draggable grid uses normal table layout and selectable text, without unnecessary drag physics work.

## Source references

- [src/components/GlassDataGrid/GlassDataGrid.tsx:154](https://github.com/auraoneai/galileo-glass-ui/blob/1474e6df7618ecadfd25ed91ce314da0e4edcb91/src/components/GlassDataGrid/GlassDataGrid.tsx#L154)
- [src/components/GlassDataGrid/GlassDataGrid.tsx:274](https://github.com/auraoneai/galileo-glass-ui/blob/1474e6df7618ecadfd25ed91ce314da0e4edcb91/src/components/GlassDataGrid/GlassDataGrid.tsx#L274)
- [src/hooks/useDraggableListPhysics.ts:114](https://github.com/auraoneai/galileo-glass-ui/blob/1474e6df7618ecadfd25ed91ce314da0e4edcb91/src/hooks/useDraggableListPhysics.ts#L114)

## Acceptance criteria for one PR

- [ ] Separate disabled-drag rendering from the positioned drag layout without violating hook ordering.
- [ ] Keep a valid table height/layout when drag positioning is enabled.
- [ ] Add DOM assertions for disabled mode and browser checks for table geometry and text selection.

## Verification

Absolute positioning and userSelect:none reproduced using the real grid and drag hook with an engine double; visual layout impact is source-derived and needs browser validation.
