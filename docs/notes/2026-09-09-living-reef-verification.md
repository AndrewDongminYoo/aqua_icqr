# Living Reef Verification

## Result

The corrected experience keeps the living reef visible after creator or recipient entry.
The same colored instances transform into the QR and return to the reef.
The control dock remains separate from the QR quiet zone in the tested layouts.

`npm run check` completed with exit code 0 on 2026-09-09.

| Gate | What it reads | Result |
| --- | --- | --- |
| Vitest | URL validation, QR mapping, timeline endpoints, and deterministic geometry | 22 tests passed |
| TypeScript and Vite | Application and test types, production bundling | Passed |
| Chrome E2E | Rendered controls, browser events, canvas pixels, and complete page PNGs | 10 tests passed |

## Rendered Evidence

The dedicated browser worker inspected the initial scene, living reef, transition, final QR, and return action.
The first pass exposed reef occlusion, a tall mobile dock, and footer overlap.
The second pass confirmed the framing and dock corrections at 1440 by 900, 390 by 844, and 390 by 667.
It also found no horizontal overflow at 750 by 800 or 1024 by 600.
The second pass completed before the final QR zoom increase and fallback raster corrections.
Final E2E captures verify those later changes.

The final decoder tests use complete screenshots at CSS pixel resolution.
The mobile tests assert exactly 390 by 844 and 390 by 667 pixels with device scale factor 1.
They verify that the fixture has 69 source modules.
The tests erase the captured QR area and expect decoding to fail before checking the original capture against the exact destination URL.

The 390 by 667 cases include the expanded manual share field in both WebGL and fallback modes.
The fallback test also checks the canvas bounds against the header and dock after layout settles.
The context-loss test uses the actual `WEBGL_lose_context` extension and decodes the recovered fallback.

Reduced-motion tests compare scene PNG bytes before and after a same-viewport resize event.
The images remain identical.
Animation callback counts verify that a settled QR stops continuous rendering.
A simulated document visibility change verifies the application's stop and restart handlers.

## Review Corrections

Independent source reviews approved the scene and view integration.
The adversarial review found two additional defects despite an earlier green gate.

- The QR library set inline canvas dimensions that overrode responsive fallback sizing.
  The fallback now redraws when its destination or available size changes.
  It clears the library's inline dimensions and uses integer CSS pixel coordinates to avoid blurred QR edges.
- Reduced-motion layout renders used the current animation time.
  These renders now use a fixed time, including after resize.

Both defects had failing regression checks before the corrections.
The final integrated gate includes the corrected checks.
The adversarial re-review approved the corrected source and evidence with no blockers.

## Oracle Precedent

Oracle returned `wiki/concepts/authoring-time-vs-runtime-verification.md` at source revision `7049be0f6c7cefadb3d3d24a51ac74aa66e48824`.
The current freshness of that wiki revision was not verified.
The precedent separates authored structure from runtime behavior.
It confirmed the decision to inspect native browser captures and decode composed page pixels instead of relying on source checks alone.
No indexed precedent was found for the scoped `QR animation` query.

## Remaining Checks and Diagnostics

- Physical phone-camera scanning remains `[PENDING]`.
  Automated jsQR decoding does not establish acceptance for a physical camera.
- The Vite build reports a chunk-size warning for the approximately 575 kB JavaScript bundle.
  No dependency or bundle-splitting change was included in this correction.
- The second dedicated browser pass logged one message-channel error: `A listener indicated an asynchronous response by returning true, but the message channel closed before a response was received`.
  Its source remains `[UNKNOWN]`.
  The fallback and context-loss E2E cases reported no unexpected browser errors.

The local preview is available at `http://127.0.0.1:4173/` while its process remains running.
The verification above completed before the repository's initial commits.
No push or deployment was performed.

## Local Artifacts

The full gate log is `.superpowers/sdd/2026-09-09-living-reef-transition/final-verification.log`.
The dedicated browser screenshots use `/tmp/aqua-icqr-v1-*` and `/tmp/aqua-icqr-v2-*` paths.
Final decoder captures are `test-results/**/composite-*.png`.
These local artifacts are not tracked and can be replaced by later runs.

## 2026-09-10 Review-Fix Pass

The counts above describe the 2026-09-09 run and are left as recorded.
A code review on 2026-09-10 produced fifteen findings; fourteen were applied and one was declined.
The declined finding asked to remove the `supportsWebGL` probe: three r185 logs its own console error before throwing when WebGL2 is missing, and the fallback E2E case asserts a clean console, so the probe stays and now checks `webgl2` only.

`npm run test:e2e` now builds before Playwright starts, and `npm run check` is `test` followed by `test:e2e`, so the E2E gate cannot serve a stale `dist/`.
The E2E config no longer reuses a preview server that is already listening on port 4173.

After the pass, `npx vitest run` reported 29 tests passed and `npm run test:e2e` reported 13 tests passed.
The three new E2E cases (context loss mid-transition, an undrawable fallback QR, and the fallback QR on a 2x display) each failed at their own assertion with the matching fix hunk reverted, then passed with it restored.
