# The repository has no pull request workflow for build and test validation

Suggested priority: **P2**  
Suggested labels: testing, ci, enhancement  
Reviewed version: 1.0.28 at `1474e6df7618ecadfd25ed91ce314da0e4edcb91`

## Problem and impact

The only checked-in GitHub Actions workflow mirrors main/tags to GitLab. There is no pull_request workflow to run unit tests, type checks, or package checks before changes merge. The .gitignore also ignores .github/, making new workflow files easy to leave untracked. This is a gap in repository-managed automation; external organization checks were not inspected.

## Reproduction

Inspect .github/workflows and the tracked workflow files. The mirror workflow runs on pushes, schedule, and manual dispatch, and never runs the project validation commands.

## Expected behavior

Pull requests receive repeatable repository-owned validation results before review and merge.

## Source references

- [.github/workflows/mirror-to-gitlab.yml:3](https://github.com/auraoneai/galileo-glass-ui/blob/1474e6df7618ecadfd25ed91ce314da0e4edcb91/.github/workflows/mirror-to-gitlab.yml#L3)
- [.gitignore:69](https://github.com/auraoneai/galileo-glass-ui/blob/1474e6df7618ecadfd25ed91ce314da0e4edcb91/.gitignore#L69)

## Acceptance criteria for one PR

- [ ] Add a pull_request workflow with dependency installation and meaningful unit/build checks.
- [ ] Resolve or explicitly track the current command failures before making the checks required.
- [ ] Ensure the new workflow is tracked despite the existing ignore rule.
- [ ] Do not change the organization-managed mirror workflow for this task.

## Verification

Confirmed by inspection of the tracked workflow directory. Branch protection and organization-level automation are outside this checkout.
