# Modal does not trap keyboard focus inside the open dialog

Suggested priority: **P1**  
Suggested labels: bug, accessibility, components  
Reviewed version: 1.0.28 at `1474e6df7618ecadfd25ed91ce314da0e4edcb91`

## Problem and impact

The modal declares aria-modal=true and initially focuses its content, but its keyboard handler only handles Escape. It neither uses the existing focus-trap hook nor implements a Tab boundary. Keyboard focus can reach background controls while the modal remains open.

## Reproduction

Render a Modal with one button and a background button. Focus the dialog button and continue pressing Tab. Focus leaves the dialog and reaches the background. Shift+Tab has no boundary protection either.

## Expected behavior

While a modal is open, keyboard traversal remains within the active dialog; closing restores a meaningful prior focus target.

## Source references

- [src/components/Modal/Modal.tsx:319](https://github.com/auraoneai/galileo-glass-ui/blob/1474e6df7618ecadfd25ed91ce314da0e4edcb91/src/components/Modal/Modal.tsx#L319)
- [src/components/Modal/Modal.tsx:389](https://github.com/auraoneai/galileo-glass-ui/blob/1474e6df7618ecadfd25ed91ce314da0e4edcb91/src/components/Modal/Modal.tsx#L389)
- [src/hooks/accessibility/useFocusTrap.ts:26](https://github.com/auraoneai/galileo-glass-ui/blob/1474e6df7618ecadfd25ed91ce314da0e4edcb91/src/hooks/accessibility/useFocusTrap.ts#L26)

## Acceptance criteria for one PR

- [ ] Integrate a focus trap with initial focus, empty-dialog behavior, and focus restoration.
- [ ] Account for nested dialogs so only the topmost active dialog traps focus.
- [ ] Add keyboard tests covering both traversal directions and a browser check with background controls.

## Verification

Reproduced with userEvent.tab in JSDOM: focus reached the background button while the actual Modal remained open. Spring values were stubbed to isolate focus behavior.
