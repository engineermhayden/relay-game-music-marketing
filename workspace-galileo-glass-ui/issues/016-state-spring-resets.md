# useGalileoStateSpring recreates its spring every render and jumps to the target

Suggested priority: **P1**  
Suggested labels: bug, animation  
Reviewed version: 1.0.28 at `1474e6df7618ecadfd25ed91ce314da0e4edcb91`

## Problem and impact

The options rest destructuring produces a new directOptions object each render. It is a memo dependency, so finalSpringConfig and initializeSpring change every render. The initialization effect therefore recreates the physics spring and sets the displayed value to targetValue instead of preserving the in-progress value and velocity. Reactive updates visibly jump before any frame.

## Reproduction

Render useGalileoStateSpring(0), then rerender with target 100 without flushing requestAnimationFrame. The returned value is already 100 even though immediate is false and a frame remains scheduled.

## Expected behavior

Normal target changes animate continuously from the current position; unchanged configuration must not reinitialize the spring.

## Source references

- [src/hooks/useGalileoStateSpring.ts:84](https://github.com/auraoneai/galileo-glass-ui/blob/1474e6df7618ecadfd25ed91ce314da0e4edcb91/src/hooks/useGalileoStateSpring.ts#L84)
- [src/hooks/useGalileoStateSpring.ts:168](https://github.com/auraoneai/galileo-glass-ui/blob/1474e6df7618ecadfd25ed91ce314da0e4edcb91/src/hooks/useGalileoStateSpring.ts#L168)
- [src/hooks/useGalileoStateSpring.ts:210](https://github.com/auraoneai/galileo-glass-ui/blob/1474e6df7618ecadfd25ed91ce314da0e4edcb91/src/hooks/useGalileoStateSpring.ts#L210)

## Acceptance criteria for one PR

- [ ] Stabilize configuration comparisons and separate one-time initialization from configuration updates.
- [ ] Preserve current position and velocity across ordinary rerenders.
- [ ] Test intermediate values before/after the first frame and rerenders with unchanged option values.

## Verification

Reproduced with the actual spring implementation and a controlled RAF queue.
