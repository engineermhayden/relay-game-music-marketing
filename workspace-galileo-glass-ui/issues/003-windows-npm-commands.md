# Build and test scripts fail on a standard Windows npm shell

Suggested priority: **P1**  
Suggested labels: bug, developer-experience  
Reviewed version: 1.0.28 at `1474e6df7618ecadfd25ed91ce314da0e4edcb91`

## Problem and impact

The build uses rm -rf and several variants use POSIX environment assignments. npm uses cmd.exe by default on Windows. In addition, npm test feeds node_modules/.bin/jest, a shell shim on Windows, directly to Node. The primary contributor commands fail before building or running tests.

## Reproduction

On Windows with Node 22.20.0 and npm 10.9.3, install dependencies and run npm.cmd run build, then npm.cmd test -- --listTests --runInBand. Build reports 'rm is not recognized'; test reports a JavaScript SyntaxError while parsing the Jest shell shim. Calling node node_modules/jest/bin/jest.js directly works.

## Expected behavior

The documented commands run without requiring contributors to install a Unix shell or change npm shell settings.

## Source references

- [package.json:87](https://github.com/auraoneai/galileo-glass-ui/blob/1474e6df7618ecadfd25ed91ce314da0e4edcb91/package.json#L87)
- [package.json:98](https://github.com/auraoneai/galileo-glass-ui/blob/1474e6df7618ecadfd25ed91ce314da0e4edcb91/package.json#L98)
- [package.json:88](https://github.com/auraoneai/galileo-glass-ui/blob/1474e6df7618ecadfd25ed91ce314da0e4edcb91/package.json#L88)

## Acceptance criteria for one PR

- [ ] Use platform-neutral cleanup and environment handling for build variants.
- [ ] Invoke the actual Jest JavaScript entry or use npm's executable resolution.
- [ ] Validate build and test discovery on Windows and Linux.

## Verification

Both command failures were reproduced after a clean dependency installation.
