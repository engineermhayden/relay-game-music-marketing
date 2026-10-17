# CommonJS package exports resolve to files treated as ES modules

Suggested priority: **P1**  
Suggested labels: bug, packaging  
Reviewed version: 1.0.28 at `1474e6df7618ecadfd25ed91ce314da0e4edcb91`

## Problem and impact

The package declares type=module, but Rollup writes CommonJS bundles with .js extensions and the require export conditions point to those files. Node therefore interprets the advertised CommonJS entry points as ES modules. This breaks consumers of the published package independently of the source implementation.

## Reproduction

Build the package, then run: node --input-type=commonjs -e "const m=require('@veerone/galileo-glass-ui/core'); console.log(Object.keys(m).length, typeof m.glassSurface)". On Node 22.20.0 the built core entry returned 0 exports and undefined. Importing dist/core.js directly as ESM failed with 'require is not defined in ES module scope'.

## Expected behavior

Both require and import entry points expose the documented API in their declared module format.

## Source references

- [package.json:15](https://github.com/auraoneai/galileo-glass-ui/blob/1474e6df7618ecadfd25ed91ce314da0e4edcb91/package.json#L15)
- [rollup.config.js:104](https://github.com/auraoneai/galileo-glass-ui/blob/1474e6df7618ecadfd25ed91ce314da0e4edcb91/rollup.config.js#L104)

## Acceptance criteria for one PR

- [ ] Emit CommonJS under .cjs or an explicit CommonJS package boundary and update every require mapping.
- [ ] Add packed-package consumer smoke tests for CommonJS and ESM, including at least the root and core subpath.

## Verification

Executed against the actual generated core bundle in an isolated copy; the format mismatch also applies to the other CommonJS outputs.
