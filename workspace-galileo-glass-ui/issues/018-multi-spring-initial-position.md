# MultiSpring starts nonzero values from zero on the first animation frame

Suggested priority: **P2**  
Suggested labels: bug, physics  
Reviewed version: 1.0.28 at `1474e6df7618ecadfd25ed91ce314da0e4edcb91`

## Problem and impact

MultiSpring stores the supplied initial values in its aggregate state, but each inner SpringPhysics starts at position zero. The constructor sets each target without setting the initial position. The first subsequent animation update jumps toward the new target from zero instead of the provided initial value.

## Reproduction

Create new MultiSpring({x:100}), call setTarget({to:{x:200}}), then update(). The returned x is below 100 rather than moving from 100 toward 200. This also affects useMultiSpring({from:{x:100}}).

## Expected behavior

The inner physics state and exposed initial values agree before the first frame.

## Source references

- [src/animations/physics/multiSpring.ts:35](https://github.com/auraoneai/galileo-glass-ui/blob/1474e6df7618ecadfd25ed91ce314da0e4edcb91/src/animations/physics/multiSpring.ts#L35)
- [src/animations/physics/multiSpring.ts:49](https://github.com/auraoneai/galileo-glass-ui/blob/1474e6df7618ecadfd25ed91ce314da0e4edcb91/src/animations/physics/multiSpring.ts#L49)
- [src/animations/physics/springPhysics.ts:123](https://github.com/auraoneai/galileo-glass-ui/blob/1474e6df7618ecadfd25ed91ce314da0e4edcb91/src/animations/physics/springPhysics.ts#L123)

## Acceptance criteria for one PR

- [ ] Initialize each inner spring's position and velocity consistently with the supplied starting vector.
- [ ] Test positive and negative nonzero starts, multiple dimensions, and reset followed by start.
- [ ] Assert continuity across the first frame rather than checking only the eventual destination.

## Verification

Reproduced with the actual MultiSpring and SpringPhysics classes.
