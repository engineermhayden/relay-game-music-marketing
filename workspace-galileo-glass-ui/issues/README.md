# Galileo Glass UI issue review

30 issue drafts for local review, dated October 16, 2026. Each numbered file can become a separate GitHub issue and defines a focused PR outcome. No issues were submitted to GitHub and no repository source or tests were changed.

Reviewed checkout: `galileo-glass-ui`, version 1.0.28, commit `1474e6df7618ecadfd25ed91ce314da0e4edcb91`. Priority suggestions: 17 P1 and 13 P2. P1 means a core workflow, package entry, or essential accessibility behavior is broken; P2 means a narrower correctness or validation gap.

## Validation results

- The complete default Jest discovery found 96 of 118 existing test files. Issue 005 covers the 22 excluded files.
- Full default suite, run through the actual Jest JavaScript entry on Windows: **869 passed, 1 failed, 98 skipped**; **87 suites passed, 1 failed, 8 skipped**. The failing timeline date case is issue 029. The command used `--runInBand --testTimeout=3000`.
- **21 isolated review probes reproduced defects**. These probes assert the observed broken behavior; a passing probe is evidence of the defect, not evidence that the feature is correct. Their source and logs are in `_evidence`.
- The Windows build/test wrappers, chunk runner, and visual-test command fail as described in issues 003, 004, and 006.
- The generated ESM core entry exposed 53 exports, including glassSurface; the CommonJS core entry exposed zero exports on Node 22.20.0. The minimal import failed with ERR_MODULE_NOT_FOUND.
- A successful npm pack dry-run included the generated core bundles and omitted both minimal artifacts. Of 32 declared export targets, 30 exist; only the two minimal targets are missing.
- TypeScript checking passed. All 40 Rollup build configurations passed when invoked with the same 8 GB heap setting used by the build script; the npm build wrapper itself remains broken on Windows.

Dependencies and generated artifacts were confined to a disposable copy. Environment: Windows, Node 22.20.0, npm 10.9.3, React 18.3.1, TypeScript 5.9.3, America/Denver. Installation used the manifest's ranges without a tracked lockfile, so resolved versions may differ on another date.

No real-browser E2E run was possible through the repository's supplied command. JSDOM interaction probes do not establish visual layout or cross-browser behavior. Each draft distinguishes executed reproduction from source inspection. The review concentrated on public exports, build/test wiring, theme state, animation lifecycle, data grids, calendars, carousels, and keyboard/focus behavior; it is not a proof that every source path is defect-free.

## Suggested review order

Start with package/workflow blockers 001–006, then shared spring lifecycle defects 014–019 and the disconnected theme context 027. Those affect many components. Grid issues 020–023 are separate behaviors but touch the same file; implement them sequentially. Modal issues 011–013 can use isolated animation dependencies in tests until the spring fixes land. Issue 015 remains distinct from the render-loop fix in 014.

## Drafts

| Draft | Priority | Issue |
| --- | --- | --- |
| 001 | P1 | [CommonJS package exports resolve to files treated as ES modules](001-commonjs-exports.md) |
| 002 | P1 | [The minimal package export points to artifacts the build never creates](002-minimal-export-missing.md) |
| 003 | P1 | [Build and test scripts fail on a standard Windows npm shell](003-windows-npm-commands.md) |
| 004 | P2 | [The chunked test runner crashes because it uses require inside an ES module](004-chunk-runner-esm.md) |
| 005 | P1 | [Default Jest discovery excludes 22 existing test files](005-jest-undiscovered-tests.md) |
| 006 | P1 | [The browser test command is unusable and critical UI flows have no runnable E2E suite](006-browser-e2e-suite.md) |
| 007 | P2 | [The repository has no pull request workflow for build and test validation](007-pull-request-ci.md) |
| 008 | P2 | [The shared RAF test helper catches callback failures instead of failing tests](008-raf-errors-swallowed.md) |
| 009 | P1 | [Public MenuItem components render placeholders and ignore all props](009-menuitem-placeholder.md) |
| 010 | P1 | [Select cannot choose an option using only the keyboard](010-select-keyboard.md) |
| 011 | P1 | [Rendering a closed Modal on the server accesses document and throws](011-modal-server-rendering.md) |
| 012 | P1 | [Modal does not trap keyboard focus inside the open dialog](012-modal-focus-escape.md) |
| 013 | P2 | [Closing one Modal releases the body scroll lock owned by another Modal](013-modal-scroll-lock.md) |
| 014 | P1 | [Immediate useGalileoSprings loops when targets are supplied inline](014-multi-spring-render-loop.md) |
| 015 | P2 | [Immediate useGalileoSprings updates never invoke onRest](015-multi-spring-immediate-completion.md) |
| 016 | P1 | [useGalileoStateSpring recreates its spring every render and jumps to the target](016-state-spring-resets.md) |
| 017 | P2 | [useGalileoStateSpring leaves animation frames scheduled after unmount](017-state-spring-unmount.md) |
| 018 | P2 | [MultiSpring starts nonzero values from zero on the first animation frame](018-multi-spring-initial-position.md) |
| 019 | P1 | [Draggable list cleanup removes physics bodies without recreating them in StrictMode](019-draggable-strict-mode.md) |
| 020 | P1 | [GlassDataGrid drops loaded rows and crashes when data shrinks](020-grid-data-length.md) |
| 021 | P2 | [GlassDataGrid sorts by column ID instead of the declared accessor key](021-grid-sort-accessor.md) |
| 022 | P1 | [Reordering sorted grid rows reports a different order to the parent](022-grid-reorder-callback.md) |
| 023 | P2 | [GlassDataGrid applies absolute drag positioning even when dragging is disabled](023-grid-disabled-drag-layout.md) |
| 024 | P1 | [GlassCarousel never attaches the measurement ref and cannot advance its track](024-carousel-container-ref.md) |
| 025 | P2 | [Date range month navigation skips short months near month end](025-date-range-month-navigation.md) |
| 026 | P2 | [Last Month returns the wrong month after short-month rollover](026-last-month-preset.md) |
| 027 | P1 | [useGlassTheme reads a disconnected context and ignores ThemeProvider changes](027-glass-theme-context.md) |
| 028 | P2 | [ThemeProvider crashes when browser storage access is denied](028-theme-storage-errors.md) |
| 029 | P2 | [Timeline date-only strings display the previous day in timezones west of UTC](029-timeline-date-timezone.md) |
| 030 | P1 | [GlassFocusRing remains hidden when its child receives keyboard focus](030-focus-ring-child-focus.md) |

## Final validation note

`node node_modules/typescript/bin/tsc --noEmit --skipLibCheck` exited 0. `node --max-old-space-size=8192 scripts/build/process-configs.js` completed all 40 configurations and exited 0. This direct invocation bypassed only the Windows-incompatible `rm -rf` wrapper; source and build configuration were unchanged. The successful build does not fix the CommonJS module-format mismatch or create the missing minimal artifacts. See `_evidence` for the exact output.

The original checkout remained clean under `git status --porcelain` after review. All changes delivered here are issue drafts, their index, and review evidence in the requested sibling `issues` folder.
