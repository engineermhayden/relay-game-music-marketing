# Immediate useGalileoSprings updates never invoke onRest

Suggested priority: **P2**  
Suggested labels: bug, animation  
Reviewed version: 1.0.28 at `1474e6df7618ecadfd25ed91ce314da0e4edcb91`

## Problem and impact

onRest only runs after isAnimating transitions from true to false. The immediate path resets values without ever entering the animating state. Components using completion callbacks for exit visibility, unmounting, or focus restoration can miss their lifecycle completion when animations are disabled.

## Reproduction

Use stable memoized target objects to avoid the separate inline-target loop. Mount useGalileoSprings({x:0}, {immediate:true,onRest}), then change targets to {x:1}. Values update to 1, but onRest is never invoked.

## Expected behavior

A successful immediate target update emits the same completion contract as a settled animation, without duplicate notifications.

## Source references

- [src/hooks/useGalileoSprings.ts:77](https://github.com/auraoneai/galileo-glass-ui/blob/1474e6df7618ecadfd25ed91ce314da0e4edcb91/src/hooks/useGalileoSprings.ts#L77)
- [src/hooks/useGalileoSprings.ts:91](https://github.com/auraoneai/galileo-glass-ui/blob/1474e6df7618ecadfd25ed91ce314da0e4edcb91/src/hooks/useGalileoSprings.ts#L91)
- [src/components/Modal/Modal.tsx:282](https://github.com/auraoneai/galileo-glass-ui/blob/1474e6df7618ecadfd25ed91ce314da0e4edcb91/src/components/Modal/Modal.tsx#L282)

## Acceptance criteria for one PR

- [ ] Define and implement completion behavior for immediate updates and cancelled/replaced targets.
- [ ] Cover stable targets, changed targets, and switching reduced motion during animation.
- [ ] Verify an exit consumer can finish cleanup when animations are disabled.

## Verification

Reproduced with stable targets and a spy callback; related to, but independently fixable from, issue 014.
