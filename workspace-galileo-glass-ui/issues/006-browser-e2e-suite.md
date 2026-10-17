# The browser test command is unusable and critical UI flows have no runnable E2E suite

Suggested priority: **P1**  
Suggested labels: testing, enhancement, accessibility  
Reviewed version: 1.0.28 at `1474e6df7618ecadfd25ed91ce314da0e4edcb91`

## Problem and impact

test:visual invokes start-server-and-test and test-storybook without declaring their packages. The standalone visual scenario configuration has no runner consuming it. No runnable application E2E suite or Playwright/Cypress configuration was found. Storybook does contain a sample Page login play function, so there is some interaction scaffolding, but it does not cover the library's modal, select, drag, calendar, or focus workflows.

## Reproduction

After a clean install, run npm.cmd run test:visual. It fails because start-server-and-test is unavailable. Search for consumers of visual-regression.config.js and for browser test configurations: the visual scenario file is not connected to an executable test pipeline.

## Expected behavior

A contributor can run a documented browser test command from a clean install and verify at least one real library interaction end to end.

## Source references

- [package.json:106](https://github.com/auraoneai/galileo-glass-ui/blob/1474e6df7618ecadfd25ed91ce314da0e4edcb91/package.json#L106)
- [src/__tests__/visual/visual-regression.config.js:10](https://github.com/auraoneai/galileo-glass-ui/blob/1474e6df7618ecadfd25ed91ce314da0e4edcb91/src/__tests__/visual/visual-regression.config.js#L10)
- [src/__tests__/visual/README.md:11](https://github.com/auraoneai/galileo-glass-ui/blob/1474e6df7618ecadfd25ed91ce314da0e4edcb91/src/__tests__/visual/README.md#L11)
- [examples/basic-components/Page.stories.ts:22](https://github.com/auraoneai/galileo-glass-ui/blob/1474e6df7618ecadfd25ed91ce314da0e4edcb91/examples/basic-components/Page.stories.ts#L22)

## Acceptance criteria for one PR

- [ ] Declare the required browser-test tooling and wire the actual tests/configuration into the command.
- [ ] Add initial browser smoke coverage for a keyboard-operated Select and a modal focus cycle.
- [ ] Keep screenshot checks separate from interaction assertions and document browser installation.
- [ ] Run the browser suite in CI once the workflow exists.

## Verification

Command failure reproduced; repository inventory confirmed missing E2E wiring. Browser interactions were not exercised in a real browser during this review.
