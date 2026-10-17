# The shared RAF test helper catches callback failures instead of failing tests

Suggested priority: **P2**  
Suggested labels: bug, testing  
Reviewed version: 1.0.28 at `1474e6df7618ecadfd25ed91ce314da0e4edcb91`

## Problem and impact

runAllRafs catches every exception thrown by an animation callback and only logs it. An assertion or runtime exception inside a scheduled frame can therefore be hidden while the surrounding test passes. This weakens animation regression tests that depend on the shared helper.

## Reproduction

In a disposable test using the default setup, schedule requestAnimationFrame(() => { throw new Error('broken frame'); }), then call runAllRafs(). The helper catches the exception and returns normally instead of propagating it to Jest.

## Expected behavior

Exceptions in manually flushed animation frames cause the invoking test to fail with the original error.

## Source references

- [src/test/setup/jest.setup.ts:43](https://github.com/auraoneai/galileo-glass-ui/blob/1474e6df7618ecadfd25ed91ce314da0e4edcb91/src/test/setup/jest.setup.ts#L43)
- [src/test/setup/jest.setup.ts:51](https://github.com/auraoneai/galileo-glass-ui/blob/1474e6df7618ecadfd25ed91ce314da0e4edcb91/src/test/setup/jest.setup.ts#L51)

## Acceptance criteria for one PR

- [ ] Propagate callback failures, or collect and rethrow them after flushing.
- [ ] Add a focused harness regression that demonstrates a throwing frame fails the test path.
- [ ] Preserve bounded frame execution so recursively scheduled frames do not hang the helper.

## Verification

Confirmed directly from the helper's catch block; no existing test was edited.
