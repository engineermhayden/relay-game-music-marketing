# ThemeProvider crashes when browser storage access is denied

Suggested priority: **P2**  
Suggested labels: bug, theming, resilience  
Reviewed version: 1.0.28 at `1474e6df7618ecadfd25ed91ce314da0e4edcb91`

## Problem and impact

Preference reads and writes call localStorage without guarding storage access errors. Only JSON parsing is caught. In contexts where storage throws, the provider's mount effect fails and can take down the application tree. Theme setters can likewise throw on blocked/quota-limited writes.

## Reproduction

Mock Storage.prototype.getItem to throw a SecurityError or equivalent denial, then mount ThemeProvider. The exception escapes the provider. Separately make setItem throw and exercise a theme/preference update.

## Expected behavior

The provider remains usable in memory when persistence is unavailable, while retaining normal persistence when available.

## Source references

- [src/theme/ThemeProvider.tsx:329](https://github.com/auraoneai/galileo-glass-ui/blob/1474e6df7618ecadfd25ed91ce314da0e4edcb91/src/theme/ThemeProvider.tsx#L329)
- [src/theme/ThemeProvider.tsx:408](https://github.com/auraoneai/galileo-glass-ui/blob/1474e6df7618ecadfd25ed91ce314da0e4edcb91/src/theme/ThemeProvider.tsx#L408)
- [src/theme/ThemeProvider.tsx:456](https://github.com/auraoneai/galileo-glass-ui/blob/1474e6df7618ecadfd25ed91ce314da0e4edcb91/src/theme/ThemeProvider.tsx#L456)

## Acceptance criteria for one PR

- [ ] Guard both storage acquisition and individual read/write operations.
- [ ] Use current/default state when persistence fails and keep callbacks/state updates coherent.
- [ ] Test denied reads, denied writes, malformed stored JSON, and normal persistence.

## Verification

Mount failure reproduced with a throwing Storage.getItem and the real provider; write paths confirmed by inspection.
