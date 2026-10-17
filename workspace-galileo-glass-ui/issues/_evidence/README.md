# Review evidence and reproduction probes

These files support the 30 issue drafts. They are not production fixes or a proposed replacement test suite.

## Reproducing the probes

Use a disposable checkout at commit `1474e6df7618ecadfd25ed91ce314da0e4edcb91`. Copy the five files whose names start with `review` from this directory into that checkout's root. Install the package manifest dependencies with `npm install --ignore-scripts --no-package-lock`. On Windows PowerShell, use `npm.cmd` if script execution policy blocks `npm.ps1`.

Run:

```text
node node_modules/jest/bin/jest.js --config review.config.cjs --runInBand --verbose
```

The 21 assertions describe observed defects. A passing probe confirms the defect remains reproducible. Future PR regression tests should instead assert the corrected behavior described in each issue's acceptance criteria. Some probes replace unrelated animation, presentation, or engine dependencies to isolate the behavior under review; these are not browser E2E tests.

## Recorded validation

| File | Meaning |
| --- | --- |
| full-tests.log | Unmodified default discovery, run through Jest's JavaScript entry with `--runInBand --testTimeout=3000`: 869 passed, 1 failed, 98 skipped |
| baseline-tests.log | Six initial sampled suites: 36 passed |
| review-probes.log | All 21 review-only defect probes passed |
| test-discovery.log | The 96 files matched by the default Jest configuration |
| windows-build.log and windows-test.log | Failures of the documented npm wrappers on Windows |
| chunk.log | ESM/CommonJS mismatch in the chunked test runner |
| visual.log | Browser test runner command cannot start after clean installation |
| cjs-smoke.log and esm-smoke.log | CommonJS core exposes zero exports; ESM core exposes 53, including glassSurface |
| minimal-smoke.log | Missing minimal entry point |
| export-targets.log | Post-build audit: 30 targets exist and the two minimal targets are missing |
| pack-dry-run.json | Successful npm pack inventory, including the core bundles and excluding minimal artifacts |
| build-8gb.log | All 40 Rollup configurations completed successfully with the configured 8 GB Node heap |
| typecheck.log | `tsc --noEmit --skipLibCheck` exited zero |

PowerShell records stderr as a NativeCommandError wrapper in some logs, including successful Jest output. Read the Jest summary or explicit exit marker rather than treating that wrapper alone as a failed check. The original repository was not modified; temporary dependency installations, test probes, and build artifacts were created in an isolated copy.

The full Jest suite was executed in the local America/Denver environment. Its timeline test exposes date-only parsing that can pass in UTC and fail west of UTC. No real-browser run is claimed.
