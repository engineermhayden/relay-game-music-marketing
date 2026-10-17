# Last Month returns the wrong month after short-month rollover

Suggested priority: **P2**  
Suggested labels: bug, date-picker  
Reviewed version: 1.0.28 at `1474e6df7618ecadfd25ed91ce314da0e4edcb91`

## Problem and impact

The Last Month preset subtracts one month from a Date while retaining its day number, then derives month boundaries from the overflowed result. March 31, 2026 becomes March 3 rather than a February date, so the preset returns March 1 through March 31 instead of February.

## Reproduction

Call StandardDateRangePresets.find(p=>p.id==='lastMonth').getRangeFunction(new Date(2026,2,31)). Both returned endpoints are in March, not February.

## Expected behavior

The preset returns the entire immediately preceding calendar month for every date in the current month.

## Source references

- [src/components/DateRangePicker/DateRangePresets.ts:114](https://github.com/auraoneai/galileo-glass-ui/blob/1474e6df7618ecadfd25ed91ce314da0e4edcb91/src/components/DateRangePicker/DateRangePresets.ts#L114)
- [src/components/DateRangePicker/DateRangePresets.ts:119](https://github.com/auraoneai/galileo-glass-ui/blob/1474e6df7618ecadfd25ed91ce314da0e4edcb91/src/components/DateRangePicker/DateRangePresets.ts#L119)

## Acceptance criteria for one PR

- [ ] Anchor subtraction to a safe month boundary before calculating both endpoints.
- [ ] Test March 29/30/31, May 31, leap years, and January year transitions.
- [ ] Keep this preset fix separate from the calendar-navigation handler so each has its own regression.

## Verification

Reproduced by invoking the actual preset function.
