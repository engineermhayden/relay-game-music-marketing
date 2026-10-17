# Select cannot choose an option using only the keyboard

Suggested priority: **P1**  
Suggested labels: bug, accessibility, components  
Reviewed version: 1.0.28 at `1474e6df7618ecadfd25ed91ce314da0e4edcb91`

## Problem and impact

The combobox handler only toggles the dropdown on Enter/Space. Options are nonfocusable divs with click handlers, with no arrow-key navigation or active option state. Opening the control, pressing ArrowDown, and pressing Enter simply closes it without changing the value. The label references also point to label-${label}, but the label receives no matching id.

## Reproduction

Render a labeled Select with Alpha and Beta options. Focus the combobox, press Enter, ArrowDown, then Enter. onChange is never called. Inspect aria-labelledby: its target is absent.

## Expected behavior

Keyboard and assistive-technology users can identify the control, navigate enabled choices, commit a selection, and dismiss the popup.

## Source references

- [src/components/Select/Select.tsx:495](https://github.com/auraoneai/galileo-glass-ui/blob/1474e6df7618ecadfd25ed91ce314da0e4edcb91/src/components/Select/Select.tsx#L495)
- [src/components/Select/Select.tsx:528](https://github.com/auraoneai/galileo-glass-ui/blob/1474e6df7618ecadfd25ed91ce314da0e4edcb91/src/components/Select/Select.tsx#L528)

## Acceptance criteria for one PR

- [ ] Implement an accessible combobox/listbox keyboard model, including arrow navigation, selection, Escape, and disabled-option handling.
- [ ] Associate labels and listbox IDs correctly and expose the active option.
- [ ] Add keyboard-focused unit tests and a real browser interaction test.

## Verification

Keyboard failure and broken label reference reproduced with the real Select component in JSDOM.
