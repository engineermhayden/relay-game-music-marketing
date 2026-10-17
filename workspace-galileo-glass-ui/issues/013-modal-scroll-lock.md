# Closing one Modal releases the body scroll lock owned by another Modal

Suggested priority: **P2**  
Suggested labels: bug, components  
Reviewed version: 1.0.28 at `1474e6df7618ecadfd25ed91ce314da0e4edcb91`

## Problem and impact

Each modal writes body overflow='hidden' on open and resets it to an empty string on cleanup, without tracking other open modals or preserving the original value. Unmounting one of two dialogs enables background scrolling while the second is still open. A pre-existing body overflow value is also lost.

## Reproduction

Open two Modal instances. Unmount the first while leaving the second mounted and open. document.body.style.overflow becomes ''. Repeat with an initial overflow of 'scroll' and observe it is not restored after the last modal closes.

## Expected behavior

Scrolling remains locked until the last owner releases it, and the original body style is restored afterward.

## Source references

- [src/components/Modal/Modal.tsx:345](https://github.com/auraoneai/galileo-glass-ui/blob/1474e6df7618ecadfd25ed91ce314da0e4edcb91/src/components/Modal/Modal.tsx#L345)
- [src/components/Modal/Modal.tsx:348](https://github.com/auraoneai/galileo-glass-ui/blob/1474e6df7618ecadfd25ed91ce314da0e4edcb91/src/components/Modal/Modal.tsx#L348)

## Acceptance criteria for one PR

- [ ] Manage body scroll locking with ownership or reference counting.
- [ ] Restore the exact previous overflow value after the last modal releases its lock.
- [ ] Test nested/sibling modals, close order, and unmount cleanup.

## Verification

Reproduced with two actual Modal instances: unmounting the first changed body overflow from hidden to an empty string while the second stayed open. Springs were stubbed to isolate scroll ownership.
