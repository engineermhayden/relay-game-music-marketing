# Immediate useGalileoSprings loops when targets are supplied inline

Suggested priority: **P1**  
Suggested labels: bug, animation  
Reviewed version: 1.0.28 at `1474e6df7618ecadfd25ed91ce314da0e4edcb91`

## Problem and impact

The immediate path resets state to targets whenever the targets object identity changes. An inline object is new on every render; reset stores that object, causes another render, and repeats. Internal consumers such as Modal construct targets inline. Disabling animation or preferring reduced motion can therefore trigger unbounded renders.

## Reproduction

Render a hook/component calling useGalileoSprings({x:1}, {immediate:true}). A review harness with a 30-render guard exceeded the guard without any target change. The same issue applies when immediate is derived from reduced motion.

## Expected behavior

Numerically unchanged targets settle without additional renders, including immediate and reduced-motion paths.

## Source references

- [src/hooks/useGalileoSprings.ts:79](https://github.com/auraoneai/galileo-glass-ui/blob/1474e6df7618ecadfd25ed91ce314da0e4edcb91/src/hooks/useGalileoSprings.ts#L79)
- [src/hooks/useGalileoSprings.ts:85](https://github.com/auraoneai/galileo-glass-ui/blob/1474e6df7618ecadfd25ed91ce314da0e4edcb91/src/hooks/useGalileoSprings.ts#L85)
- [src/animations/physics/useMultiSpring.ts:194](https://github.com/auraoneai/galileo-glass-ui/blob/1474e6df7618ecadfd25ed91ce314da0e4edcb91/src/animations/physics/useMultiSpring.ts#L194)

## Acceptance criteria for one PR

- [ ] Compare target values or otherwise stabilize semantic targets before resetting state.
- [ ] Handle actual target changes without requiring consumers to memoize every object literal.
- [ ] Add a regression for inline targets with immediate=true and reduced motion enabled.

## Verification

Reproduced with the actual multi-spring hooks; the render guard stopped the otherwise repeating update chain.
