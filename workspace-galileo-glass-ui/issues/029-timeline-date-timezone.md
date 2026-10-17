# Timeline date-only strings display the previous day in timezones west of UTC

Suggested priority: **P2**  
Suggested labels: bug, timeline, testing  
Reviewed version: 1.0.28 at `1474e6df7618ecadfd25ed91ce314da0e4edcb91`

## Problem and impact

parseDate passes YYYY-MM-DD strings directly to Date, which represents them at UTC midnight. The timeline then formats and inspects local calendar fields. In America/Denver, '2023-01-15' becomes January 14 locally. The existing test expects the 15th and fails on this environment, while UTC can hide the mismatch.

## Reproduction

With TZ=America/Denver, run node node_modules/jest/bin/jest.js --runInBand --runTestsByPath src/components/Timeline/__tests__/TimelineUtils.test.ts. The parseDate test reports Expected:15, Received:14. Formatting the resulting date also exposes the previous local day.

## Expected behavior

Date-only input has an explicit calendar-date interpretation consistent with timeline display; timestamp strings retain their intended instant/timezone semantics.

## Source references

- [src/components/Timeline/TimelineUtils.ts:16](https://github.com/auraoneai/galileo-glass-ui/blob/1474e6df7618ecadfd25ed91ce314da0e4edcb91/src/components/Timeline/TimelineUtils.ts#L16)
- [src/components/Timeline/TimelineUtils.ts:62](https://github.com/auraoneai/galileo-glass-ui/blob/1474e6df7618ecadfd25ed91ce314da0e4edcb91/src/components/Timeline/TimelineUtils.ts#L62)
- [src/components/Timeline/__tests__/TimelineUtils.test.ts:24](https://github.com/auraoneai/galileo-glass-ui/blob/1474e6df7618ecadfd25ed91ce314da0e4edcb91/src/components/Timeline/__tests__/TimelineUtils.test.ts#L24)

## Acceptance criteria for one PR

- [ ] Define separate handling for date-only strings and timestamp strings.
- [ ] Add timezone-matrix cases for UTC and zones east/west of UTC, including a day near a month boundary.
- [ ] Fix the input/display inconsistency rather than merely forcing the test process to UTC.

## Verification

The unmodified default suite reproduced this failure: 869 passed, 1 failed, 98 skipped. This was the only failing test in that run.
