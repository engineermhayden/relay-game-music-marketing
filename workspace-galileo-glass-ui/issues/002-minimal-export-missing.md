# The minimal package export points to artifacts the build never creates

Suggested priority: **P1**  
Suggested labels: bug, packaging  
Reviewed version: 1.0.28 at `1474e6df7618ecadfd25ed91ce314da0e4edcb91`

## Problem and impact

The export map advertises ./minimal at dist-min/minimal.js and dist-min/minimal.esm.js. None of the 40 Rollup configurations creates either file, and prepublishOnly runs only the normal build. A clean source build cannot satisfy this public import.

## Reproduction

Inspect all Rollup output paths, build from a clean checkout, and import '@veerone/galileo-glass-ui/minimal' from a consumer of the packed package. The advertised paths are absent from the build configuration.

## Expected behavior

Every supported export resolves to files included in a clean package tarball.

## Source references

- [package.json:32](https://github.com/auraoneai/galileo-glass-ui/blob/1474e6df7618ecadfd25ed91ce314da0e4edcb91/package.json#L32)
- [rollup.config.js:125](https://github.com/auraoneai/galileo-glass-ui/blob/1474e6df7618ecadfd25ed91ce314da0e4edcb91/rollup.config.js#L125)
- [scripts/build/process-configs.js:45](https://github.com/auraoneai/galileo-glass-ui/blob/1474e6df7618ecadfd25ed91ce314da0e4edcb91/scripts/build/process-configs.js#L45)

## Acceptance criteria for one PR

- [ ] Either build and package a supported minimal entry, or remove the broken export and update its documentation.
- [ ] Add a package smoke check that walks every export target and verifies it exists.

## Verification

Confirmed from the export map and complete build configuration. An actual import of the minimal subpath failed with ERR_MODULE_NOT_FOUND; no minimal build step is invoked by prepublishOnly.
