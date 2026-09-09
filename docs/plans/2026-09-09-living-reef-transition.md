# Living Reef Transition

## Approval and Intent

The operator approved this correction after reviewing Aqua ICQR v1 against `https://tree.icqr.com/` and two reference screenshots.
The main experience must remain an animated underwater diorama until the visitor requests the QR view.
The reef must transform into a colored QR composition and return to the reef on request.
This plan replaces the earlier automatic reveal requirement.

## Design Contract

- Keep the open seabed, low-poly style, and existing ocean palette.
- Make the diorama the dominant surface on desktop and mobile.
- Keep the controls in a compact dock outside the scene's protected display area.
- Use the existing local fonts and procedural geometry.
- Connect the reef's colored geometry to the QR modules through a reversible transition.
- Keep a stable, high-contrast QR view with a four-module quiet zone.
- Preserve HTTP and HTTPS validation, fragment sharing, and the 69-module limit.
- Preserve sharing, replay, destination opening, and the 2D fallback.
- Do not add dependencies, remote assets, seasons, themes, exports, accounts, or storage.
- Keep reduced-motion scenes static and make their view changes immediate.
- Keep the physical-phone scan separate from automated decoding.

## Acceptance Criteria

1. A normal-motion creator or recipient can remain in the living reef view after a valid destination loads.
2. A scene tap or an accessible button changes the reef into the QR view.
3. The reverse action restores the same destination's living reef without regenerating the QR matrix.
4. The transition visibly changes the positions and shapes of colored reef geometry.
5. The final QR retains distinct reef color families and decodes to the exact normalized destination.
6. Result controls remain outside the QR and quiet zone, including when the manual share field expands.
7. Replay preserves functional controls in normal, reduced-motion, and 2D fallback modes.
8. Reduced-motion creator and recipient scenes remain static, including before a destination exists.
9. A settled QR and a hidden document do not continuously render WebGL frames.
10. WebGL initialization failure or actual context loss produces a decodable 2D QR with working share and destination actions.
11. Full-page captures decode at desktop, 390 by 844, and 390 by 667 viewports.
12. Unit tests, TypeScript, the production build, and Chrome E2E tests pass.

## Ownership and Integration

The root owns this plan, the design document, README, integration decisions, review packages, and final verification.
Implementation workers do not stage, commit, push, or delegate.
Each worker changes only its listed files.
The repository had no initial commit when implementation started, so review packages compared the preserved pre-edit snapshot with the working files.

The scene keeps `setSurface`, `setRevealFrame`, `render`, and `dispose` compatible.
It extends `resize(width, height, insets?)` with optional `{ top: number; bottom: number }` insets in CSS pixels.
The scene owns the camera framing within that display area.
The application measures the header and dock to supply those insets.
`RevealFrame` continues to carry fish and camera progress from zero at the reef to one at the QR.
The application can traverse these values in either direction.

## Task 1: Reversible Colored Reef Geometry

Owned files: `src/aquarium-scene.ts`, `src/scene-math.ts`, `src/scene-math.test.ts`.

Build a visibly volumetric coral garden from the existing procedural scene.
Use coral, kelp, and lagoon color families with strong silhouettes at the initial three-quarter camera angle.
The dark QR instances must participate in the reef geometry and transform into the QR grid.
Do not satisfy this requirement with a camera-only move, a cross-fade to another QR canvas, or a thin QR slab beneath disappearing decoration.
Preserve the same colors across the transformation while keeping the final dark modules sufficiently dark for decoding.
Keep the four-module quiet zone entirely light.
The final grid may be planar, as in the reference.

Derive transition geometry from `RevealFrame.cameraProgress` so reversing the progress restores the reef.
Keep fish and atmospheric motion in the reef view.
All motion must be deterministic for a supplied render time.
Honor the optional resize insets and keep the complete QR surface inside the remaining display area.
Dispose instanced resources when replacing the surface or disposing the scene.
Keep the existing public APIs compatible except for the optional resize argument.

Add focused unit coverage for deterministic geometry mapping and both transition endpoints if pure mapping helpers are introduced.
Run `npm test -- src/scene-math.test.ts` and `npx tsc -p tsconfig.app.json --noEmit`.
Do not run browser tests or edit other files.
Return the exact changes, verification results, and any visual requirements that still need browser inspection.

## Task 2: Persistent Reef and Bidirectional Controls

Owned files: `src/main.ts`, `src/styles.css`, `src/reveal-timeline.ts`, `src/reveal-timeline.test.ts`.

After a valid destination loads, keep the normal-motion visitor in the reef view.
Support creator and fragment-recipient entry.
Provide a semantic `Show QR` button and a scene tap to enter the QR view.
In the QR view, rename that control to `View reef` and support the reverse transition.
The scene tap and its keyboard equivalent must also support both directions.
Ignore repeated transition requests while a transition is active.
Keep `Replay`, `Share experience`, and `Open destination` available where they make sense.
Replay must not lose controls when motion is reduced or the renderer is the 2D fallback.
In the 2D fallback, show the QR directly and do not offer a broken 3D-view action.
Explain briefly that the 3D view is unavailable and the QR still works.

Use a compact responsive dock so the scene remains dominant.
Keep the dock usable when a short viewport or the mobile keyboard reduces available height.
Measure the header and dock after layout changes.
Reserve the initial creator form's space before the result dock appears.
Pass their reserved space to `AquariumScene.resize` and size the fallback QR to the same available area.
Preserve the current transition progress when the viewport changes.
Keep the manual share field inside the dock without covering the QR.
Keep focus and status announcements usable across the transitions.
Keep the destination input available for changing a link after creation.

Freeze all scene motion when reduced motion is requested, including the initial creator view.
Apply preference changes while the page is open.
Stop continuous rendering at a settled QR, in fallback mode, and while the document is hidden.
Render again after resize or preference changes and restart animation when returning to the living reef.
Do not regenerate the QR matrix for view changes or replay.
Preserve URL validation and the exact fragment format.
Keep share cancellation distinct from failure, clipboard fallback, and the selectable URL fallback.

Use small explicit state transitions rather than a new framework or general state-machine library.
Expose the stable current view as `data-view="reef"` or `data-view="qr"` on the document element.
Keep the existing reveal-phase attribute where practical and represent reverse transitions explicitly.
Tests must inspect visible controls and screenshots in addition to these attributes.
Preserve the existing forward timeline API if it remains useful and add only the helpers needed for reverse transitions.
Add timeline tests that cover both directions and reduced motion.
Run the relevant unit tests and TypeScript checks.
Do not run browser tests or edit other files.

## Task 3: User-Visible Regression Coverage

Owned files: `tests/app.e2e.spec.ts`, `playwright.config.ts`.

Update the browser suite to the approved persistent reef flow.
Verify creator and recipient entry, both view directions, and replay.
Verify reduced-motion and fallback replay without missing controls.
Verify native-share cancellation, share failure to clipboard, and failure to the selectable field with safe browser stubs.
Do not send a real share or navigate to the destination.

Decode complete composited page screenshots with the existing jsQR dependency.
Use browser image decoding if needed instead of adding a PNG package.
Before trusting a successful capture, overwrite its QR region and demonstrate the expected decode failure.
Cover the maximum density on 390 by 844 and 390 by 667 viewports.
Decode the fallback QR and the expanded manual-share layout.
Trigger real WebGL context loss with `WEBGL_lose_context` and verify recovery.
Capture browser errors for the relevant paths and distinguish expected context-loss diagnostics.
Use the production preview server for E2E validation if it can be done with the existing scripts and without new dependencies.

Run the full browser suite once the root confirms that Tasks 1 and 2 are integrated.
Report failures against the specific product behavior, not only data attributes.

## Verification and Remaining Acceptance

The root reviews each implementation task and then the integrated change.
Native browser inspection covers the initial reef, the transition, the final QR, and the return to the reef.
The final gate is `npm run check`.
The actual phone-camera scan remains `[PENDING]` until the operator performs it.
The supplied precedent `wiki/concepts/authoring-time-vs-runtime-verification.md` requires this distinction.
