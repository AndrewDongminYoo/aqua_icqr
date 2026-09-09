# Aqua ICQR v1 Implementation Plan

This document records the initial implementation plan.
The approved [Living Reef Transition](2026-09-09-living-reef-transition.md) plan supersedes its automatic reveal and canvas-only verification requirements.

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task.
> Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a shareable low-poly underwater QR experience that generates and renders the QR code entirely in the browser.

**Architecture:** Use a small Vite and TypeScript application with direct Three.js ownership.
Pure modules handle URL state, QR data, and animation timing.
One scene class owns the WebGL resources, while `main.ts` coordinates the DOM and fallbacks.

**Tech Stack:** Vite 8.2.2, TypeScript 7.0.2, Three.js 0.185.0, qrcode 1.5.4, Vitest 5.0.0, Playwright 1.63.0, and jsQR 1.4.0.

**Spec:** `docs/plans/2026-09-09-aqua-icqr-v1-design.md`

## Global Constraints

- Keep the application client-only.
- Accept only absolute HTTP and HTTPS destination URLs.
- Store the destination in `#to=<encoded-destination>`.
- Use one orthographic camera for the three-quarter and top-down views.
- Keep all decorative geometry outside the final QR quiet zone.
- Reject a QR matrix that exceeds 69 modules on one side.
- Use no component framework, animation library, model file, remote image, or remote font.
- Provide reduced-motion behavior and a 2D QR fallback.
- Do not include accounts, storage, analytics, galleries, or export.

---

### Task 1: Project foundation and URL state

**Files:**

- Create: `.gitignore`
- Create: `package.json`
- Create: `package-lock.json`
- Create: `tsconfig.json`
- Create: `tsconfig.app.json`
- Create: `tsconfig.node.json`
- Create: `playwright.config.ts`
- Create: `vitest.config.ts`
- Create: `index.html`
- Create: `src/url-state.test.ts`
- Create: `src/url-state.ts`

**Interfaces:**

- Produces: `parseDestination(value: string): DestinationResult`
- Produces: `toShareFragment(destination: string): string`
- Produces: `fromShareFragment(fragment: string): DestinationResult`

- [ ] **Step 1: Create the package and TypeScript configuration**

Create exact runtime dependencies for `qrcode@1.5.4` and `three@0.185.0`.
Create exact development dependencies for `@playwright/test@1.63.0`, `@types/node@26.5.0`, `@types/qrcode@1.5.6`, `@types/three@0.185.0`, `jsqr@1.4.0`, `typescript@7.0.2`, `vite@8.2.2`, and `vitest@5.0.0`.
Define `dev`, `build`, `test`, `test:watch`, `test:e2e`, and `check` scripts.
Configure Playwright to use the installed Chrome channel and the Vite development server at `http://127.0.0.1:4173`.
Configure Vitest to collect only `src/**/*.test.ts` so it does not execute Playwright specifications.
Run `npm install` to create the lockfile.

- [ ] **Step 2: Write the failing URL-state tests**

```typescript
import { describe, expect, it } from 'vitest';
import { fromShareFragment, parseDestination, toShareFragment } from './url-state';

describe('destination URL state', () => {
  it('normalizes an absolute HTTPS destination', () => {
    expect(parseDestination('  https://example.com/reef?q=fish  ')).toEqual({
      ok: true,
      destination: 'https://example.com/reef?q=fish',
    });
  });

  it.each(['', 'example.com', 'mailto:reef@example.com', 'javascript:alert(1)'])(
    'rejects unsupported destination %j',
    (value) => {
      expect(parseDestination(value).ok).toBe(false);
    },
  );

  it('round-trips reserved characters through the share fragment', () => {
    const destination = 'https://example.com/a%20path/?q=fish&tone=blue#deep';
    expect(fromShareFragment(toShareFragment(destination))).toEqual({ ok: true, destination });
  });
});
```

- [ ] **Step 3: Run the URL-state test and verify RED**

Run: `npm test -- src/url-state.test.ts`

Expected: FAIL because `src/url-state.ts` does not exist.

- [ ] **Step 4: Implement the minimum URL-state module**

```typescript
export type DestinationResult =
  | { ok: true; destination: string }
  | { ok: false; reason: 'empty' | 'invalid' | 'unsupported-protocol' };

export function parseDestination(value: string): DestinationResult;
export function toShareFragment(destination: string): string;
export function fromShareFragment(fragment: string): DestinationResult;
```

Use `URL` for parsing.
Use `URLSearchParams` for the fragment payload.
Return the normalized `URL.href` value.

- [ ] **Step 5: Run the URL-state test and verify GREEN**

Run: `npm test -- src/url-state.test.ts`

Expected: PASS.

### Task 2: QR surface and reveal timeline

**Files:**

- Create: `src/qr-surface.test.ts`
- Create: `src/qr-surface.ts`
- Create: `src/reveal-timeline.test.ts`
- Create: `src/reveal-timeline.ts`

**Interfaces:**

- Consumes: A validated destination string from `parseDestination`.
- Produces: `createQrSurface(destination: string): QrSurface`
- Produces: `getRevealFrame(elapsedMs: number, reducedMotion: boolean): RevealFrame`

- [ ] **Step 1: Write the failing QR surface tests**

```typescript
import { describe, expect, it } from 'vitest';
import { createQrSurface } from './qr-surface';

describe('QR surface', () => {
  it('adds a four-module light quiet zone around the QR matrix', () => {
    const surface = createQrSurface('https://example.com');
    expect(surface.quietZone).toBe(4);
    expect(surface.gridSize).toBe(surface.moduleCount + 8);
    expect(surface.cells.slice(0, surface.gridSize * 4).every((cell) => cell === 0)).toBe(true);
  });

  it('preserves the top-left finder pattern inside the quiet zone', () => {
    const surface = createQrSurface('https://example.com');
    const offset = surface.quietZone;
    expect(surface.isDark(offset, offset)).toBe(true);
    expect(surface.isDark(offset + 1, offset + 1)).toBe(false);
    expect(surface.isDark(offset + 3, offset + 3)).toBe(true);
  });
});
```

- [ ] **Step 2: Run the QR test and verify RED**

Run: `npm test -- src/qr-surface.test.ts`

Expected: FAIL because `src/qr-surface.ts` does not exist.

- [ ] **Step 3: Implement the QR surface module**

```typescript
export interface QrSurface {
  moduleCount: number;
  gridSize: number;
  quietZone: 4;
  cells: Uint8Array;
  isDark(row: number, column: number): boolean;
}

export function createQrSurface(destination: string): QrSurface;
```

Generate the source matrix with error-correction level `M`.
Copy the source modules into a new matrix with four light modules on every side.
Throw a typed `QrCapacityError` when the QR library cannot encode the destination or when the source matrix exceeds 69 modules on one side.

- [ ] **Step 4: Run the QR test and verify GREEN**

Run: `npm test -- src/qr-surface.test.ts`

Expected: PASS.

- [ ] **Step 5: Write the failing reveal timeline tests**

```typescript
import { describe, expect, it } from 'vitest';
import { getRevealFrame } from './reveal-timeline';

describe('reveal timeline', () => {
  it('moves from scattering through lifting to revealed', () => {
    expect(getRevealFrame(0, false).phase).toBe('scattering');
    expect(getRevealFrame(1_100, false).phase).toBe('lifting');
    expect(getRevealFrame(3_000, false)).toMatchObject({
      phase: 'revealed',
      fishProgress: 1,
      cameraProgress: 1,
    });
  });

  it('returns the final frame immediately for reduced motion', () => {
    expect(getRevealFrame(0, true)).toMatchObject({
      phase: 'revealed',
      fishProgress: 1,
      cameraProgress: 1,
    });
  });
});
```

- [ ] **Step 6: Run the timeline test and verify RED**

Run: `npm test -- src/reveal-timeline.test.ts`

Expected: FAIL because `src/reveal-timeline.ts` does not exist.

- [ ] **Step 7: Implement the reveal timeline**

```typescript
export type RevealPhase = 'scattering' | 'lifting' | 'revealed';

export interface RevealFrame {
  phase: RevealPhase;
  fishProgress: number;
  cameraProgress: number;
}

export function getRevealFrame(elapsedMs: number, reducedMotion: boolean): RevealFrame;
```

Use 1,100 milliseconds for scattering and 1,900 milliseconds for camera lifting.
Clamp negative input to zero and total progress to one.
Use an ease-in-out cubic function for both progress values.

- [ ] **Step 8: Run the timeline test and verify GREEN**

Run: `npm test -- src/reveal-timeline.test.ts`

Expected: PASS.

### Task 3: Low-poly aquarium scene

**Files:**

- Create: `src/aquarium-scene.ts`
- Create: `src/scene-math.test.ts`
- Create: `src/scene-math.ts`

**Interfaces:**

- Consumes: `QrSurface` and `RevealFrame`.
- Produces: `AquariumScene` with `setSurface`, `setRevealFrame`, `resize`, `render`, and `dispose` methods.
- Produces: `getFishTransform(index: number, timeSeconds: number, scatterProgress: number): FishTransform`.

- [ ] **Step 1: Write a failing test for deterministic fish scattering**

```typescript
import { describe, expect, it } from 'vitest';
import { getFishTransform } from './scene-math';

describe('fish transforms', () => {
  it('moves every fish farther from the QR center during scattering', () => {
    for (let index = 0; index < 18; index += 1) {
      const before = getFishTransform(index, 0, 0);
      const after = getFishTransform(index, 0, 1);
      expect(Math.hypot(after.x, after.z)).toBeGreaterThan(Math.hypot(before.x, before.z));
    }
  });
});
```

- [ ] **Step 2: Run the fish transform test and verify RED**

Run: `npm test -- src/scene-math.test.ts`

Expected: FAIL because `src/scene-math.ts` does not exist.

- [ ] **Step 3: Implement deterministic scene math**

```typescript
export interface FishTransform {
  x: number;
  y: number;
  z: number;
  heading: number;
  scale: number;
}

export function getFishTransform(
  index: number,
  timeSeconds: number,
  scatterProgress: number,
): FishTransform;
```

Use index-derived angles, radii, heights, scales, and phase offsets.
Do not call `Math.random()`.
Add outward distance as scatter progress increases.

- [ ] **Step 4: Run the fish transform test and verify GREEN**

Run: `npm test -- src/scene-math.test.ts`

Expected: PASS.

- [ ] **Step 5: Implement the Three.js scene against the tested interfaces**

Create the renderer with an alpha channel and antialiasing.
Cap device pixel ratio at two.
Build the QR modules from one box geometry and two material colors.
Build 18 fish from shared low-poly geometry.
Add low-poly coral, kelp, rocks, sparse particles, fog, ambient light, and one directional light.
Keep all decoration outside the surface bounds.

Use these camera endpoints:

```typescript
const START_CAMERA = { position: [8.5, 7.2, 10.5], zoom: 0.88 } as const;
const END_CAMERA = { position: [0, 15, 0.001], zoom: 1 } as const;
```

Update fish transforms and interpolate the camera from each `RevealFrame`.
Shift the final camera target toward the upper mobile viewport so the result actions do not overlap the QR surface.
Dispose every geometry, material, and renderer resource in `dispose()`.

- [ ] **Step 6: Run unit tests and the type checker**

Run: `npm test && npx tsc -b`

Expected: PASS.

### Task 4: Creator and recipient interface

**Files:**

- Create: `src/main.ts`
- Create: `src/styles.css`
- Create: `tests/app.e2e.spec.ts`
- Modify: `index.html`

**Interfaces:**

- Consumes: `parseDestination`, `fromShareFragment`, `toShareFragment`, `createQrSurface`, `getRevealFrame`, and `AquariumScene`.
- Produces: Creator form, recipient auto-reveal, result actions, accessible status, and fallback UI.

- [ ] **Step 1: Write a failing creator-flow browser test**

```typescript
import { expect, test } from '@playwright/test';

test('creates an underwater QR and reaches the revealed state', async ({ page }) => {
  await page.goto('/');
  await page.getByLabel('Destination URL').fill('https://example.com/reef');
  await page.getByRole('button', { name: 'Create reef' }).click();
  await expect(page.locator('html')).toHaveAttribute('data-reveal-phase', 'revealed');
  await expect(page.getByRole('button', { name: 'Share experience' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Open destination' })).toHaveAttribute(
    'href',
    'https://example.com/reef',
  );
});
```

- [ ] **Step 2: Run the browser test and verify RED**

Run: `npm run test:e2e -- tests/app.e2e.spec.ts`

Expected: FAIL because the creator UI does not exist.

- [ ] **Step 3: Implement the application shell and creator flow**

Build the semantic page structure in `main.ts`.
Use English product copy for a public sharing surface.
Create the scene after the DOM is ready.
On valid submit, update the fragment with `history.replaceState`, apply the new QR surface, and start the reveal.
On a valid initial fragment, start the recipient reveal after the first render.

Set `document.documentElement.dataset.revealPhase` on every state transition.
Disable create and share controls while the reveal runs.
Use `aria-live="polite"` for state and error messages.

- [ ] **Step 4: Implement the approved design contract**

Define CSS tokens for abyss, lagoon, sand, kelp, coral, ink, and foam.
Use the canvas as the full viewport background.
Place the brand at the upper-left edge.
Place the form in an asymmetric lower-left panel on desktop.
Use a bottom sheet layout below 720 pixels.
Add visible keyboard focus styles.
Keep controls outside the central QR scan area in the revealed state.

- [ ] **Step 5: Implement sharing, replay, and same-device navigation**

Use `navigator.share` when available.
Use `navigator.clipboard.writeText` as the first fallback.
Expose a read-only share URL field when browser sharing and clipboard copying both fail.
Treat `AbortError` as user cancellation and do not show an error.
Replay the existing QR matrix without regenerating it.

- [ ] **Step 6: Implement reduced motion and the 2D fallback**

Read `matchMedia('(prefers-reduced-motion: reduce)')` before each reveal.
Call `QRCode.toCanvas` with the same validated destination when WebGL initialization fails.
Listen for `webglcontextlost` and replace an active 3D result with the same 2D QR fallback.
Keep the result actions available in fallback mode.

- [ ] **Step 7: Run the browser test and verify GREEN**

Run: `npm run test:e2e -- tests/app.e2e.spec.ts`

Expected: PASS.

### Task 5: Runtime QR decoding and completion gates

**Files:**

- Modify: `tests/app.e2e.spec.ts`
- Create: `README.md`

**Interfaces:**

- Consumes: The final pixels rendered by the real application canvas.
- Produces: Independent evidence that the final frame encodes the requested destination.

- [ ] **Step 1: Add an independent decoder test with a failing control**

Read the final scene pixels into an `ImageData`-compatible byte array in the browser.
Decode the array in the Playwright process with `jsQR`.

Use this assertion order:

```typescript
const invalidResult = jsQR(invalidPixels, width, height);
expect(invalidResult).toBeNull();

const renderedResult = jsQR(renderedPixels, width, height);
expect(renderedResult?.data).toBe('https://example.com/reef');
```

The invalid pixels must come from a deliberately blanked central capture.
They must not come from the application under test.

- [ ] **Step 2: Run the decoder test and verify RED**

Run: `npm run test:e2e -- tests/app.e2e.spec.ts -g 'decodes'`

Expected: FAIL until the final camera framing and tile contrast are scannable.

- [ ] **Step 3: Adjust only QR presentation properties until GREEN**

Adjust camera zoom, tile gap, tile height, light colors, dark colors, or final decoration visibility.
Do not change the encoded matrix or weaken the decoder assertion.

Run: `npm run test:e2e -- tests/app.e2e.spec.ts -g 'decodes'`

Expected: PASS with the exact destination.

- [ ] **Step 4: Write the project README**

Document purpose, local commands, architecture, sharing privacy, accessibility, browser fallback, and the manual physical-device scan gate.
Do not claim that the physical-device gate passed until that check occurs.

- [ ] **Step 5: Run all automated gates**

Run: `npm run check`

Expected: Unit tests, TypeScript build, Vite production build, and Playwright tests pass.

- [ ] **Step 6: Review the complete Git scope**

Run: `git status --short && git diff --check && git diff --stat && git diff -- . ':(exclude).superpowers/**'`

Expected: Only the planned product files and documentation appear outside `.superpowers/`.

- [ ] **Step 7: Record the remaining manual gate**

Report the physical-phone scan as `[PENDING]` unless the operator completes it during this task.
Do not describe automated QR decoding as proof of the physical-phone result.
