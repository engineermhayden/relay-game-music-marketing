# The chunked test runner crashes because it uses require inside an ES module

Suggested priority: **P2**  
Suggested labels: bug, testing  
Reviewed version: 1.0.28 at `1474e6df7618ecadfd25ed91ce314da0e4edcb91`

## Problem and impact

npm run test:chunk targets a .js script containing top-level require calls even though the package is ESM. It exits before discovering or executing any test chunks. This prevents use of the repository's intended memory-saving test command.

## Reproduction

Run npm.cmd run test:chunk. Node throws ReferenceError: require is not defined in ES module scope at scripts/chunked-test-runner.js:5.

## Expected behavior

The chunk runner starts successfully, runs discovered test batches, and propagates failing test exit status.

## Source references

- [scripts/chunked-test-runner.js:5](https://github.com/auraoneai/galileo-glass-ui/blob/1474e6df7618ecadfd25ed91ce314da0e4edcb91/scripts/chunked-test-runner.js#L5)
- [package.json:99](https://github.com/auraoneai/galileo-glass-ui/blob/1474e6df7618ecadfd25ed91ce314da0e4edcb91/package.json#L99)

## Acceptance criteria for one PR

- [ ] Make the runner's module format consistent with package.json and its dependencies.
- [ ] Keep the command portable when invoking Jest.
- [ ] Verify one passing batch and one intentionally failing batch in a disposable fixture.

## Verification

Executed and reproduced on Node 22.20.0.
