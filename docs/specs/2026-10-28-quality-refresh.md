# Quality Tooling Refresh

## Approved Scope

Refresh supported dependencies and existing quality tooling.
Preserve public APIs, generated artifacts and repository-specific boundaries.
Use npm and preserve the existing exact direct dependency pins when they already match the registry's current releases.
Refresh compatible transitive dependencies through npm, without deleting the lockfile.
Keep source code, browser fixtures, release media and existing CI behavior unchanged.

## Tooling Baseline

Use Trunk CLI `1.25.0`, the official plugin at `v1.11.0`, and managed Python `3.14.4` for scanner parsers and Pinact.
Enable Actionlint `1.7.12` for the existing GitHub Actions workflow, OSV Scanner `2.7.0` for `package-lock.json`, Pinact `4.1.1!`, and TruffleHog `3.99.7`.
Enable Pinact's `lint` and `upgrade` commands.
Run TruffleHog with `--no-verification --no-update` so candidate credentials are not sent to external providers.
Enable the changed-file pre-push check and keep automatic formatting hooks disabled.
Do not add formatters or style linters without an existing project convention to support them.

## Acceptance

- Pinact remains locked to `4.1.1` with `lint` and `upgrade`.
- The full no-fix Trunk scan and declared project gates pass.
- Changed manifests have package-manager-generated lockfiles under repository policy.
- Advisory dispositions have specific evidence and affected knowledge claims are reconciled.
- Run `npm ci`, `npm run check`, `npm audit`, and `trunk check --all --no-fix --jobs=2` with the installed CI-matching Node.js `24.20.0` runtime.
- `npm run check` must run the actual Chrome browser tests; a build or test listing alone does not satisfy the browser gate.
- Preserve the pending physical-phone QR scan release gate.

## Publication

Push and PR creation require explicit repository-specific approval.
After approval, continue the requested hosted gates, merge, cleanup and memory recording.
