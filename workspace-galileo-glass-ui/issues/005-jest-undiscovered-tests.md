# Default Jest discovery excludes 22 existing test files

Suggested priority: **P1**  
Suggested labels: bug, testing  
Reviewed version: 1.0.28 at `1474e6df7618ecadfd25ed91ce314da0e4edcb91`

## Problem and impact

testMatch only includes tests inside __tests__ directories. The repository contains 118 .test.ts/.test.tsx files, but 22 are colocated outside those directories and are invisible to the default command. This excludes asChild button behavior, physics constraints, particle tests, and several component/hook suites from normal validation.

## Reproduction

Compare node node_modules/jest/bin/jest.js --listTests --runInBand with all src/**/*.test.ts and src/**/*.test.tsx paths. Jest lists 96 files. For example, src/components/Button/Button.asChild.test.tsx and src/animations/physics/constraints.test.ts are missing.

## Expected behavior

All intended unit tests run under the documented default command, regardless of whether they are colocated or under __tests__.

## Source references

- [jest.config.js:27](https://github.com/auraoneai/galileo-glass-ui/blob/1474e6df7618ecadfd25ed91ce314da0e4edcb91/jest.config.js#L27)
- [src/components/Button/Button.asChild.test.tsx:1](https://github.com/auraoneai/galileo-glass-ui/blob/1474e6df7618ecadfd25ed91ce314da0e4edcb91/src/components/Button/Button.asChild.test.tsx#L1)
- [src/animations/physics/constraints.test.ts:1](https://github.com/auraoneai/galileo-glass-ui/blob/1474e6df7618ecadfd25ed91ce314da0e4edcb91/src/animations/physics/constraints.test.ts#L1)

## Acceptance criteria for one PR

- [ ] Expand discovery or consistently relocate the excluded suites without duplicate execution.
- [ ] Address any newly exposed incompatibilities explicitly; do not silently omit those files again.
- [ ] Add a discovery assertion or convention check for test files outside supported patterns.

## Verification

Executed Jest discovery and compared it with a filesystem inventory: 118 test files, 96 discovered, 22 excluded.
