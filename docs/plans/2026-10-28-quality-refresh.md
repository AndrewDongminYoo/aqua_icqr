# Quality Tooling Refresh Plan

## Work

1. Verify repository identity, instructions, current changes and Oracle precedent.
2. Refresh compatible dependency and linter versions with existing package managers.
3. Run the declared local gates and `trunk check --all --no-fix`.
4. Reconcile affected knowledge and review the scoped candidate.
5. Commit locally and prepare visible evidence before requesting publication approval.

## Declared Gates

- `npm ci`
- `npm run check`
- `npm audit`
- `trunk check --all --no-fix --jobs=2`

## Implementation Boundaries

Use the installed Node.js `24.20.0` runtime declared by CI.
Use the existing installed Google Chrome browser and Playwright configuration for runtime verification.
Limit changes to dependency resolution, Trunk configuration and affected documentation.
Keep the exact direct dependency pins when registry metadata confirms they are current.
Keep `package-lock.json` visible to dependency scanning and use no advisory suppressions without specific evidence and approval.
Record results and unresolved warnings in the external review evidence directory rather than adding generated logs to this repository.

## Reader Follow-up Verification

1. Confirm byte identity with the independently reviewed shared reader and its thirteen tests, then run the CLI suite.
2. Reproduce old-reader decoded loss and require actual configured Trunk failures for encoded and literal controls, with clean input passing.
3. Run the full no-fix Trunk scan and audit affected commands and CI scope.
4. Retain existing passing application gates only after the application, test, dependency and asset inputs compare equal.

## Source-Line Repair

The current reader uses the independently reviewed `localizations` repair at `b47e59659a886ad673a2f4a9bed6a3bf4986615b`.
It prefers a positive integer filesystem line only when the literal starts on that line.
Invalid hints retain literal-search and file-level fallbacks.
Thirteen CLI tests cover repeated and out-of-order findings in addition to the existing lossless conversion cases.
