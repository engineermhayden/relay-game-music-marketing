# Draggable list cleanup removes physics bodies without recreating them in StrictMode

Suggested priority: **P1**  
Suggested labels: bug, physics, react  
Reviewed version: 1.0.28 at `1474e6df7618ecadfd25ed91ce314da0e4edcb91`

## Problem and impact

The initialization effect skips setup whenever the item count matches the remembered count. Its cleanup removes all bodies but leaves that count unchanged. React StrictMode's setup-cleanup-setup cycle therefore leaves the second setup with an empty body map. Changing mass, direction, or spacing at the same item count has the same cleanup/skip problem.

## Reproduction

Mount one item under React.StrictMode with a stable physics engine. The review probe observed one addBody call followed by one removeBody call, with no replacement body after StrictMode replays setup. Also rerender at the same count with a different spacing value.

## Expected behavior

Every live effect setup has a valid set of physics bodies after cleanup, including StrictMode replay and configuration changes.

## Source references

- [src/hooks/useDraggableListPhysics.ts:167](https://github.com/auraoneai/galileo-glass-ui/blob/1474e6df7618ecadfd25ed91ce314da0e4edcb91/src/hooks/useDraggableListPhysics.ts#L167)
- [src/hooks/useDraggableListPhysics.ts:266](https://github.com/auraoneai/galileo-glass-ui/blob/1474e6df7618ecadfd25ed91ce314da0e4edcb91/src/hooks/useDraggableListPhysics.ts#L266)

## Acceptance criteria for one PR

- [ ] Base the initialization guard on actual resource state or reset its bookkeeping during cleanup.
- [ ] Recreate bodies when relevant configuration changes even if item count is unchanged.
- [ ] Add StrictMode and same-count configuration regression tests with body lifecycle assertions.

## Verification

Reproduced using the real hook and a minimal stable engine double to observe add/remove calls.
