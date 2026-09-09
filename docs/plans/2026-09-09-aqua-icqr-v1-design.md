# Aqua ICQR v1 Design

## Purpose

Aqua ICQR turns one destination URL into a shareable underwater QR experience.
The primary audience receives an Aqua ICQR link and explores a living low-poly ocean diorama.
The visitor can transform the reef into a scannable QR code and return to the reef.
The creator can generate and share the experience without an account or server-side storage.

Success requires a coherent transformation between the reef and QR views, plus a QR code that a separate device can read.
The operator approved this revised interaction after comparing the first implementation with `https://tree.icqr.com/`.
The reference establishes a persistent 3D scene, reversible view changes, and color continuity between the scene and its QR view.

## Approved Product Decisions

- The scene is an open-sided seabed diorama without glass walls.
- The visual style is a low-poly aquarium with sand, coral, plants, light rays, and stylized fish.
- The creator enters one HTTP or HTTPS URL.
- The browser generates the QR code locally.
- The reef view remains active after generation or after a recipient opens a shared Aqua ICQR link.
- A scene tap or the `Show QR` button starts the transformation.
- Colored reef geometry transforms into QR modules while fish clear the scan area.
- The `View reef` action reverses the transformation without generating another matrix.
- The primary output is the interactive shared page.
- The final view includes `View reef`, `Share experience`, `Replay`, and `Open destination` actions.
- The first version does not include accounts, server storage, analytics, a gallery, or PNG export.

## Experience Flow

The initial creator view shows the living diorama and a compact URL form below the scene.
The reef uses a decorative surface until the creator supplies a valid destination.

The application completes these actions after the creator selects `Create reef`:

1. Validate the destination URL.
2. Generate the QR matrix in the browser.
3. Store the destination in the URL fragment.
4. Connect the validated matrix to the colored reef geometry.
5. Keep the reef view active and enable the view controls.

The interaction has two stable views with transitions between them:

1. Reef view: Fish swim above a volumetric coral garden while the camera uses a three-quarter view.
2. QR transition: Fish clear the scan area, colored reef geometry aligns with the QR grid, and the camera approaches a top-down view.
3. QR view: The colored QR surface is square to the viewport with an unobstructed quiet zone.
4. Return transition: The same geometry restores the coral garden and fish return to their living paths.

The transition is brief enough for repeated use.
The application changes views immediately when the browser reports `prefers-reduced-motion: reduce`.
The creator and recipient reef views also remain static under that preference.

## Sharing Model

The shared URL stores the encoded destination in the fragment as `#to=<encoded-destination>`.
The fragment keeps the destination out of ordinary HTTP request logs because browsers do not send fragments to servers.
The application still treats the destination as public because any recipient can inspect a shared URL.

The recipient view validates the fragment before it builds the scene.
A valid shared destination opens the reef view after the first stable render.
A missing, malformed, or unsupported destination returns the application to the creator form.

Desktop recipients can scan the final QR code with another device.
Same-device recipients can select `Open destination`.

## Technical Architecture

The application uses Vite, TypeScript, and Three.js without a component framework.
The small interface does not justify React or React Three Fiber in the first version.
The application does not use an animation library.

The runtime has these modules:

- `src/url-state.ts` validates destinations and converts them to and from the share fragment.
- `src/qr-surface.ts` converts the QR library output into a quiet-zone-aware tile matrix.
- `src/reveal-timeline.ts` converts elapsed time into deterministic fish and camera progress.
- `src/aquarium-scene.ts` owns Three.js resources, scene updates, rendering, resize behavior, and disposal.
- `src/main.ts` owns DOM events, page state, sharing, fallback behavior, and the animation loop.
- `src/styles.css` implements the responsive interface and non-WebGL visual layers.

The scene uses one `OrthographicCamera` for both the three-quarter and top-down views.
The QR surface uses instanced geometry for the colored reef modules.
The same instances participate in the reef and QR views.
The fish use a small shared low-poly geometry and deterministic paths.
The water effect uses gradients, light shafts, particles, and restrained object movement.
The first version does not use refraction, post-processing, physics, model files, or texture downloads.

## Design Contract

The page fills the viewport and supports desktop and mobile layouts.
The scene remains the dominant surface.
The creator form and result controls use a compact dock below the scene.
The camera and fallback QR use the available area between the header and dock.
Result actions remain outside the protected QR area, including when the manual share field expands.

The palette uses abyss navy, lagoon teal, warm sand, kelp green, and coral orange.
The implementation defines the primary palette as CSS or TypeScript tokens.
It does not depend on remote images, remote fonts, or generated visual assets.

Typography uses locally available humanist sans-serif families.
Large labels use condensed tracking and strong weight.
Body copy stays short and functional.

The memorable visual is the reversible change from a living miniature reef into a colored top-down QR mosaic.
Coral, kelp, and lagoon color families connect the two views.
The scan view retains sufficient contrast between every dark module and the light background.
Motion must support that change instead of adding unrelated effects.

## Validation and Failure Behavior

The URL parser accepts only absolute HTTP and HTTPS destinations.
The renderer accepts QR matrices up to 69 modules on each side so the smallest supported viewport keeps usable module density.
The form shows an inline error and does not start the reveal when validation fails.
The application reports a QR-capacity error without changing the existing scene.

The application locks create and share actions during a view transition.
Replay restarts the existing transition and does not regenerate the QR code.
Repeated replay actions must preserve the result controls in reduced-motion and fallback modes.

If WebGL initialization fails or the active context is lost, the application renders a conventional 2D QR code from the same destination.
The fallback retains `Share experience` and `Open destination` actions.
It does not offer an unavailable 3D reef view.
If the Web Share API is unavailable or fails for a reason other than user cancellation, the application copies the share URL when clipboard access is available.
If neither method is available, the application exposes the share URL in a selectable field.

## Accessibility

All controls use semantic HTML and visible focus states.
The canvas has an accessible description, while status changes use a polite live region.
Color is not the only signal for validation or state.
The creator and result controls remain operable with a keyboard.

Reduced-motion mode freezes the reef and changes views without camera or fish animation.
Preference changes apply while the page is open.
The static fallback preserves the product's functional purpose when the 3D layer is unavailable.
The application stops continuous WebGL rendering in the settled QR view and while the document is hidden.

## Verification

Unit tests cover URL validation, fragment round trips, QR quiet-zone mapping, and reveal timeline boundaries.
Browser tests cover creator input, shared-link reef entry, both view directions, reduced-motion behavior, sharing, replay, and fallback presentation.

The final QR tests read composited page screenshots and give their pixels to an independent QR decoder.
The test expects the original destination URL.
The browser suite also decodes a 69-module source matrix from complete 390 by 844 and 390 by 667 mobile viewports.
The fallback QR and expanded manual-share layout must also decode.
The decoder fixture must first demonstrate a failure after its captured QR pixels are damaged.
Browser inspection must show the reef, intermediate transformation, QR view, and restored reef.

An automated decoder result does not prove physical-device behavior.
Final acceptance therefore keeps a separate manual check that scans the desktop result with a real phone camera.
This separation follows the precedent in `wiki/concepts/authoring-time-vs-runtime-verification.md`.
The Aqua ICQR project query returned `[no precedent found]` for a project-specific rule.

## Non-Goals

- User accounts or authentication
- Server-side URL storage or short links
- Usage analytics
- Saved QR galleries
- PNG, SVG, video, or 3D asset export
- Custom colors, logos, error-correction controls, or scene themes
- WebGPU-specific shaders
- Physics simulation
- A full 3D scene editor
