# useGalileoStateSpring leaves animation frames scheduled after unmount

Suggested priority: **P2**  
Suggested labels: bug, animation, resource-cleanup  
Reviewed version: 1.0.28 at `1474e6df7618ecadfd25ed91ce314da0e4edcb91`

## Problem and impact

The hook has a stop function that cancels RAF, but no effect registers it as unmount cleanup; the relevant cleanup code is commented out. Removing an animating component leaves its callback queued and able to continue updating/rescheduling work.

## Reproduction

Mount the hook with a controlled RAF queue, call result.current.start({to:100}), and unmount before advancing a frame. The scheduled callback remains in the queue and cancelAnimationFrame was not used to remove it.

## Expected behavior

Unmounting releases all animation callbacks and prevents further work for the removed component.

## Source references

- [src/hooks/useGalileoStateSpring.ts:180](https://github.com/auraoneai/galileo-glass-ui/blob/1474e6df7618ecadfd25ed91ce314da0e4edcb91/src/hooks/useGalileoStateSpring.ts#L180)
- [src/hooks/useGalileoStateSpring.ts:310](https://github.com/auraoneai/galileo-glass-ui/blob/1474e6df7618ecadfd25ed91ce314da0e4edcb91/src/hooks/useGalileoStateSpring.ts#L310)
- [src/hooks/useGalileoStateSpring.ts:313](https://github.com/auraoneai/galileo-glass-ui/blob/1474e6df7618ecadfd25ed91ce314da0e4edcb91/src/hooks/useGalileoStateSpring.ts#L313)

## Acceptance criteria for one PR

- [ ] Register stable unmount cleanup that cancels the outstanding frame.
- [ ] Prevent an already-running callback from scheduling more work after disposal.
- [ ] Add a regression asserting no queued callbacks or completion notification after unmount.

## Verification

Reproduced independently of the target-reset issue using a controlled RAF queue.
