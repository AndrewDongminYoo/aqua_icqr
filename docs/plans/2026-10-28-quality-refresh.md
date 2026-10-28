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
