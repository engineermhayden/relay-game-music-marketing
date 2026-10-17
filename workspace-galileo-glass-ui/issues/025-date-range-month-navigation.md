# Date range month navigation skips short months near month end

Suggested priority: **P2**  
Suggested labels: bug, date-picker  
Reviewed version: 1.0.28 at `1474e6df7618ecadfd25ed91ce314da0e4edcb91`

## Problem and impact

viewDate starts at today's full date. Month navigation clones it and calls setMonth while retaining its day of month. On January 31, moving forward overflows February into March; on March 31, moving backward can remain in March. The comparison calendar uses the same code.

## Reproduction

Freeze the clock at January 31, 2026, mount the picker, and click Next month: new Date(2026,0,31).setMonth(1) produces a March date. Repeat Previous month from March 31 and with the comparison calendar.

## Expected behavior

Each navigation action moves exactly one calendar month regardless of the current day number.

## Source references

- [src/components/DateRangePicker/GlassDateRangePicker.tsx:998](https://github.com/auraoneai/galileo-glass-ui/blob/1474e6df7618ecadfd25ed91ce314da0e4edcb91/src/components/DateRangePicker/GlassDateRangePicker.tsx#L998)
- [src/components/DateRangePicker/GlassDateRangePicker.tsx:1258](https://github.com/auraoneai/galileo-glass-ui/blob/1474e6df7618ecadfd25ed91ce314da0e4edcb91/src/components/DateRangePicker/GlassDateRangePicker.tsx#L1258)

## Acceptance criteria for one PR

- [ ] Normalize the calendar view date or clamp the day before changing its month.
- [ ] Apply the same policy to primary and comparison navigation.
- [ ] Test 29th/30th/31st dates, February in leap and non-leap years, and year boundaries.

## Verification

Confirmed from the event handler and deterministic JavaScript calendar rollover behavior; no browser click test was run for this case.
