import { expect, test, type Page } from '@playwright/test';
import jsQR from 'jsqr';
import QRCode from 'qrcode';

const destination = 'https://example.com/reef';
const maxDensityDestination = `https://example.com/${'a'.repeat(300)}`;

interface ScreenshotPixels {
  data: number[];
  width: number;
  height: number;
}

interface Rectangle {
  x: number;
  y: number;
  width: number;
  height: number;
}

function attachBrowserErrorCapture(page: Page): { errors: string[]; contextLossDiagnostics: string[] } {
  const errors: string[] = [];
  const contextLossDiagnostics: string[] = [];
  const record = (message: string) => {
    if (/context lost|webglcontextlost/i.test(message)) {
      contextLossDiagnostics.push(message);
      return;
    }

    errors.push(message);
  };

  page.on('pageerror', (error) => record(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error' || message.type() === 'warning') record(message.text());
  });

  return { errors, contextLossDiagnostics };
}

type ShareStubs = {
  share: 'abort' | 'fail';
  clipboard: 'fail' | 'record';
};

async function installRafCounter(page: Page): Promise<void> {
  await page.addInitScript(() => {
    let callbacks = 0;
    const requestAnimationFrame = window.requestAnimationFrame.bind(window);
    window.requestAnimationFrame = (callback) =>
      requestAnimationFrame((time) => {
        callbacks += 1;
        callback(time);
      });
    Object.defineProperty(window, '__aquaRafCallbacks', { get: () => callbacks });
  });
}

function readRafCount(page: Page): Promise<number> {
  return page.evaluate(() => (window as typeof window & { __aquaRafCallbacks: number }).__aquaRafCallbacks);
}

async function stubShare(page: Page, stubs: ShareStubs): Promise<void> {
  await page.addInitScript((options: ShareStubs) => {
    Object.defineProperty(navigator, 'share', {
      configurable: true,
      value: async () => {
        if (options.share === 'abort') {
          throw new DOMException('The native sheet was dismissed.', 'AbortError');
        }
        throw new Error('native share failed');
      },
    });
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: {
        writeText: async (value: string) => {
          if (options.clipboard === 'record') {
            (window as typeof window & { __copiedShareUrl?: string }).__copiedShareUrl = value;
            return;
          }
          throw new Error('clipboard failed');
        },
      },
    });
  }, stubs);
}

async function createReef(page: Page, url = destination, expectedView: 'reef' | 'qr' = 'reef'): Promise<void> {
  await page.getByLabel('Destination URL').fill(url);
  await page.getByRole('button', { name: 'Create reef' }).click();
  await expect(page.locator('html')).toHaveAttribute('data-view', expectedView);
  await expect(page.locator('html')).toHaveAttribute(
    'data-reveal-phase',
    expectedView === 'reef' ? 'reef' : 'revealed',
  );
}

async function decodeCompositeScreenshot(page: Page): Promise<ScreenshotPixels> {
  await page.evaluate(() => new Promise<void>((resolve) => {
    window.requestAnimationFrame(() => window.requestAnimationFrame(() => resolve()));
  }));
  const viewport = page.viewportSize();
  const screenshot = await page.screenshot({
    scale: 'css',
    path: test.info().outputPath(`composite-${viewport?.width}x${viewport?.height}.png`),
  });
  await test.info().attach('composite', { body: screenshot, contentType: 'image/png' });

  return page.evaluate(async (pngBase64) => {
    const image = new Image();
    image.src = `data:image/png;base64,${pngBase64}`;
    await image.decode();

    const canvas = document.createElement('canvas');
    canvas.width = image.naturalWidth;
    canvas.height = image.naturalHeight;
    const context = canvas.getContext('2d', { willReadFrequently: true });

    if (!context) throw new Error('The temporary screenshot canvas has no 2D context.');

    context.drawImage(image, 0, 0);
    const pixels = context.getImageData(0, 0, canvas.width, canvas.height);
    return { data: Array.from(pixels.data), width: pixels.width, height: pixels.height };
  }, screenshot.toString('base64'));
}

function decodePixels(capture: ScreenshotPixels): string | null {
  return (
    jsQR(new Uint8ClampedArray(capture.data), capture.width, capture.height, {
      inversionAttempts: 'attemptBoth',
    })?.data ?? null
  );
}

function eraseRectangle(capture: ScreenshotPixels, rectangle: Rectangle): ScreenshotPixels {
  const data = new Uint8ClampedArray(capture.data);
  const startX = Math.max(0, Math.floor(rectangle.x));
  const startY = Math.max(0, Math.floor(rectangle.y));
  const endX = Math.min(capture.width, Math.ceil(rectangle.x + rectangle.width));
  const endY = Math.min(capture.height, Math.ceil(rectangle.y + rectangle.height));

  for (let y = startY; y < endY; y += 1) {
    for (let x = startX; x < endX; x += 1) {
      const offset = (y * capture.width + x) * 4;
      data[offset] = 255;
      data[offset + 1] = 255;
      data[offset + 2] = 255;
      data[offset + 3] = 255;
    }
  }

  return { ...capture, data: Array.from(data) };
}

async function protectedStage(page: Page): Promise<Rectangle> {
  return page.evaluate(() => {
    const header = document.querySelector('.site-header');
    const dock = document.querySelector('.experience-dock');

    if (!(header instanceof HTMLElement) || !(dock instanceof HTMLElement)) {
      throw new Error('The header and result dock are required to locate the protected stage.');
    }

    const headerRect = header.getBoundingClientRect();
    const dockRect = dock.getBoundingClientRect();
    return {
      x: 0,
      y: headerRect.bottom + 8,
      width: window.innerWidth,
      height: Math.max(1, dockRect.top - headerRect.bottom - 16),
    };
  });
}

async function loseWebGlContext(page: Page): Promise<void> {
  await page.locator('.scene-canvas').evaluate((canvas) => {
    if (!(canvas instanceof HTMLCanvasElement)) throw new Error('The scene surface is not a canvas.');

    const context = canvas.getContext('webgl2') ?? canvas.getContext('webgl');
    const extension = context?.getExtension('WEBGL_lose_context');

    if (!extension) throw new Error('WEBGL_lose_context is unavailable in this browser.');
    extension.loseContext();
  });
}

test('keeps a creator reef, then supports button, scene click, keyboard return, and replay', async ({
  page,
}) => {
  test.setTimeout(45_000);
  await installRafCounter(page);
  await page.goto('/');
  await expect(page.locator('html')).toHaveAttribute('data-reveal-phase', 'idle');
  await createReef(page);
  await expect(page.getByRole('button', { name: 'Show QR' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Open destination' })).toHaveAttribute('href', destination);

  await page.getByRole('button', { name: 'Show QR' }).click();
  await expect(page.locator('html')).toHaveAttribute('data-view', 'qr', { timeout: 8_000 });
  await expect(page.locator('html')).toHaveAttribute('data-reveal-phase', 'revealed');
  const settledFrames = await readRafCount(page);
  await page.waitForTimeout(250);
  expect(await readRafCount(page)).toBe(settledFrames);

  const desktopCapture = await decodeCompositeScreenshot(page);
  expect(decodePixels(eraseRectangle(desktopCapture, await protectedStage(page)))).toBeNull();
  expect(decodePixels(desktopCapture)).toBe(destination);

  await page.getByRole('button', { name: 'View reef' }).click();
  await expect(page.locator('html')).toHaveAttribute('data-view', 'reef', { timeout: 8_000 });

  await page.locator('.scene-canvas').click({ position: { x: 8, y: 8 } });
  await expect(page.locator('html')).toHaveAttribute('data-view', 'qr', { timeout: 8_000 });

  await page.locator('.scene-canvas').press('Enter');
  await expect(page.locator('html')).toHaveAttribute('data-view', 'reef', { timeout: 8_000 });

  await page.getByRole('button', { name: 'Replay' }).click();
  await expect(page.getByRole('button', { name: 'Replay' })).toBeDisabled();
  await expect(page.locator('html')).toHaveAttribute('data-view', 'qr', { timeout: 8_000 });
  await expect(page.getByRole('button', { name: 'View reef' })).toBeEnabled();
  await expect(page.getByRole('button', { name: 'Share experience' })).toBeEnabled();
});

test('loads a shared recipient in the living reef and preserves its normalized destination', async ({
  page,
}) => {
  const sharedDestination = 'https://example.com/reef?from=share';
  await page.goto(`/#to=${encodeURIComponent(sharedDestination)}`);

  await expect(page.locator('html')).toHaveAttribute('data-view', 'reef');
  await expect(page.locator('html')).toHaveAttribute('data-reveal-phase', 'reef');
  await expect(page.getByRole('button', { name: 'Show QR' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Open destination' })).toHaveAttribute(
    'href',
    sharedDestination,
  );
});

test('keeps reduced-motion initial and QR states static while retaining replay controls', async ({ page }) => {
  await installRafCounter(page);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  await page.waitForTimeout(100);
  const initialFrames = await readRafCount(page);
  await page.waitForTimeout(250);
  expect(await readRafCount(page)).toBe(initialFrames);

  const initialScene = await page.locator('.scene-canvas').screenshot();
  await page.waitForTimeout(300);
  await page.evaluate(() => window.dispatchEvent(new Event('resize')));
  await page.evaluate(() => new Promise<void>((resolve) => {
    window.requestAnimationFrame(() => window.requestAnimationFrame(() => resolve()));
  }));
  expect((await page.locator('.scene-canvas').screenshot()).equals(initialScene)).toBe(true);

  await createReef(page);
  await page.getByRole('button', { name: 'Show QR' }).click();
  await expect(page.locator('html')).toHaveAttribute('data-view', 'qr');
  const settledFrames = await readRafCount(page);
  await page.waitForTimeout(250);
  expect(await readRafCount(page)).toBe(settledFrames);

  await page.getByRole('button', { name: 'Replay' }).click();
  await expect(page.locator('html')).toHaveAttribute('data-view', 'qr');
  await expect(page.getByRole('button', { name: 'Replay' })).toBeEnabled();
  await expect(page.getByRole('button', { name: 'View reef' })).toBeVisible();
});

test('stops and resumes animation frames when a normal-motion reef becomes hidden and visible', async ({ page }) => {
  await installRafCounter(page);
  await page.goto('/');
  await page.waitForTimeout(100);
  const reefFrames = await readRafCount(page);
  await page.waitForTimeout(250);
  const activeFrames = await readRafCount(page);
  expect(activeFrames).toBeGreaterThan(reefFrames);
  await page.evaluate(() => {
    Object.defineProperty(document, 'hidden', { configurable: true, get: () => true });
    document.dispatchEvent(new Event('visibilitychange'));
  });
  const hiddenFrames = await readRafCount(page);
  await page.waitForTimeout(250);
  expect(await readRafCount(page)).toBe(hiddenFrames);
  await page.evaluate(() => {
    Object.defineProperty(document, 'hidden', { configurable: true, get: () => false });
    document.dispatchEvent(new Event('visibilitychange'));
  });
  await page.waitForTimeout(250);
  expect(await readRafCount(page)).toBeGreaterThan(hiddenFrames);
});

test('rejects unsupported and over-capacity destinations without changing the current URL', async ({ page }) => {
  await page.goto('/');
  await page.getByLabel('Destination URL').fill('javascript:alert(1)');
  await page.getByRole('button', { name: 'Create reef' }).click();
  await expect(page.getByText('Use an HTTP or HTTPS destination.')).toBeVisible();
  await expect(page.locator('html')).toHaveAttribute('data-reveal-phase', 'idle');

  const originalUrl = page.url();
  await page.getByLabel('Destination URL').fill(`https://example.com/${'reef'.repeat(1_500)}`);
  await page.getByRole('button', { name: 'Create reef' }).click();
  await expect(page.getByText('This destination is too long to render as a scannable reef.')).toBeVisible();
  expect(page.url()).toBe(originalUrl);
});

test('keeps native-share cancellation separate from clipboard fallback', async ({ page }) => {
  await stubShare(page, { share: 'abort', clipboard: 'fail' });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  await createReef(page);
  await page.getByRole('button', { name: 'Share experience' }).click();

  await expect(page.getByText('Sharing was cancelled.')).toBeVisible();
  await expect(page.locator('.share-fallback')).toBeHidden();
});

test('copies after a native-share failure without navigating away', async ({ page }) => {
  await stubShare(page, { share: 'fail', clipboard: 'record' });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  await createReef(page);
  const originalUrl = page.url();
  await page.getByRole('button', { name: 'Share experience' }).click();

  await expect(page.getByText('Share URL copied.')).toBeVisible();
  expect(await page.evaluate(() => (window as typeof window & { __copiedShareUrl?: string }).__copiedShareUrl)).toBe(originalUrl);
  expect(page.url()).toBe(originalUrl);
  await expect(page.locator('.share-fallback')).toBeHidden();
});

test('uses a selectable share field and decodable fallback QR when WebGL initialization fails', async ({ page }) => {
  const browser = attachBrowserErrorCapture(page);
  await page.addInitScript(() => {
    const getContext = HTMLCanvasElement.prototype.getContext;
    Object.defineProperty(HTMLCanvasElement.prototype, 'getContext', {
      configurable: true,
      value(this: HTMLCanvasElement, contextId: string, ...args: unknown[]) {
        if (contextId === 'webgl' || contextId === 'webgl2') return null;
        return Reflect.apply(getContext, this, [contextId, ...args]);
      },
    });
  });
  await stubShare(page, { share: 'fail', clipboard: 'fail' });
  await page.setViewportSize({ width: 390, height: 667 });
  await page.goto('/');
  await expect(page.locator('html')).toHaveAttribute('data-renderer', 'fallback');
  await createReef(page, maxDensityDestination, 'qr');
  await expect(page.locator('html')).toHaveAttribute('data-view', 'qr');
  await expect(page.locator('.fallback-canvas')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Show QR' })).toBeHidden();
  await expect(page.getByText('3D view is unavailable. Your QR still works.')).toBeVisible();
  await page.getByRole('button', { name: 'Replay' }).click();
  await expect(page.getByRole('button', { name: 'Replay' })).toBeEnabled();

  await page.getByRole('button', { name: 'Share experience' }).click();
  const shareField = page.locator('.share-fallback input');
  await expect(shareField).toBeVisible();
  await expect(shareField).toHaveValue(/#to=https%3A%2F%2Fexample\.com%2F/);
  expect(
    await shareField.evaluate((input) => {
      if (!(input instanceof HTMLInputElement)) {
        throw new Error('The fallback share control is not an input.');
      }

      return input.selectionStart === 0 && input.selectionEnd === input.value.length;
    }),
  ).toBe(true);

  const capture = await decodeCompositeScreenshot(page);
  const fallbackBox = await page.locator('.fallback-canvas').boundingBox();
  if (!fallbackBox) throw new Error('The visible fallback QR has no bounding box.');
  const stage = await protectedStage(page);
  expect(fallbackBox.y).toBeGreaterThanOrEqual(stage.y);
  expect(fallbackBox.y + fallbackBox.height).toBeLessThanOrEqual(stage.y + stage.height);
  expect(decodePixels(eraseRectangle(capture, fallbackBox))).toBeNull();
  expect(decodePixels(capture)).toBe(maxDensityDestination);
  expect(browser.errors).toEqual([]);
});

test('recovers from actual WebGL context loss without unexpected browser errors', async ({ page }) => {
  const browser = attachBrowserErrorCapture(page);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  await createReef(page, 'https://example.com/context-loss');
  await expect(page.locator('html')).toHaveAttribute('data-renderer', 'webgl');
  await loseWebGlContext(page);

  await expect(page.locator('html')).toHaveAttribute('data-renderer', 'fallback');
  await expect(page.locator('.fallback-canvas')).toBeVisible();
  await expect(page.getByRole('link', { name: 'Open destination' })).toHaveAttribute(
    'href',
    'https://example.com/context-loss',
  );
  const capture = await decodeCompositeScreenshot(page);
  const fallbackBox = await page.locator('.fallback-canvas').boundingBox();
  if (!fallbackBox) throw new Error('The recovered fallback QR has no bounding box.');
  expect(decodePixels(eraseRectangle(capture, fallbackBox))).toBeNull();
  expect(decodePixels(capture)).toBe('https://example.com/context-loss');
  expect(browser.errors).toEqual([]);
  expect(browser.contextLossDiagnostics.every((message) => /context lost|webglcontextlost/i.test(message))).toBe(true);
});

test('clears the transition status when the WebGL context is lost mid-transition', async ({ page }) => {
  const browser = attachBrowserErrorCapture(page);
  await page.goto('/');
  await createReef(page);
  await page.getByRole('button', { name: 'Show QR' }).click();
  await expect(page.locator('.reveal-status')).toBeVisible();
  await loseWebGlContext(page);

  await expect(page.locator('html')).toHaveAttribute('data-renderer', 'fallback');
  await expect(page.locator('.reveal-status')).toBeHidden();
  await expect(page.locator('.reveal-status p')).toHaveText('');
  await expect(page.locator('html')).toHaveAttribute('data-view', 'qr');
  await expect(page.locator('.fallback-canvas')).toBeVisible();
  expect(browser.errors).toEqual([]);
});

test('reports a fallback QR that could not be drawn instead of leaving a blank stage', async ({ page }) => {
  const browser = attachBrowserErrorCapture(page);
  await page.addInitScript(() => {
    const getContext = HTMLCanvasElement.prototype.getContext;
    Object.defineProperty(HTMLCanvasElement.prototype, 'getContext', {
      configurable: true,
      value(this: HTMLCanvasElement, contextId: string, ...args: unknown[]) {
        if (contextId === 'webgl' || contextId === 'webgl2') return null;
        if (contextId === '2d' && this.classList.contains('fallback-canvas')) return null;
        return Reflect.apply(getContext, this, [contextId, ...args]);
      },
    });
  });
  await page.goto('/');
  await expect(page.locator('html')).toHaveAttribute('data-renderer', 'fallback');
  await createReef(page, destination, 'qr');

  await expect(page.getByText('The QR code could not be drawn in this browser.')).toBeVisible();
  await expect(page.locator('.fallback-canvas')).toBeHidden();
  // The notice changes the dock height, so a second attempt at the new size is expected; a rejection would surface as a page error instead.
  expect(browser.errors.length).toBeGreaterThan(0);
  expect(browser.errors.every((message) => message.startsWith('a-que-ar could not draw the fallback QR code.'))).toBe(true);
});

test.describe('fallback QR on a high-density display', () => {
  test.use({ deviceScaleFactor: 2 });

  test('rasterizes the fallback QR at device resolution while keeping its CSS size', async ({ page }) => {
    await page.addInitScript(() => {
      const getContext = HTMLCanvasElement.prototype.getContext;
      Object.defineProperty(HTMLCanvasElement.prototype, 'getContext', {
        configurable: true,
        value(this: HTMLCanvasElement, contextId: string, ...args: unknown[]) {
          if (contextId === 'webgl' || contextId === 'webgl2') return null;
          return Reflect.apply(getContext, this, [contextId, ...args]);
        },
      });
    });
    await page.setViewportSize({ width: 390, height: 667 });
    await page.goto('/');
    await createReef(page, maxDensityDestination, 'qr');
    await expect(page.locator('.fallback-canvas')).toBeVisible();

    const fallbackBox = await page.locator('.fallback-canvas').boundingBox();
    if (!fallbackBox) throw new Error('The visible fallback QR has no bounding box.');
    const bitmap = await page.locator('.fallback-canvas').evaluate((canvas) => {
      if (!(canvas instanceof HTMLCanvasElement)) throw new Error('The fallback surface is not a canvas.');
      return { width: canvas.width, height: canvas.height };
    });
    expect(bitmap.width).toBe(bitmap.height);
    expect(Math.abs(bitmap.width - fallbackBox.width * 2)).toBeLessThanOrEqual(1);
    const stage = await protectedStage(page);
    expect(fallbackBox.y).toBeGreaterThanOrEqual(stage.y);
    expect(fallbackBox.y + fallbackBox.height).toBeLessThanOrEqual(stage.y + stage.height);
  });
});

test.describe('mobile composite QR captures at CSS pixel resolution', () => {
  test.use({ deviceScaleFactor: 1 });

  test('decodes the 69-module QR from full mobile composites at both supported viewport heights', async ({
    page,
  }) => {
    expect(QRCode.create(maxDensityDestination, { errorCorrectionLevel: 'M' }).modules.size).toBe(69);
    await stubShare(page, { share: 'fail', clipboard: 'fail' });

    for (const height of [844, 667]) {
      await page.setViewportSize({ width: 390, height });
      await page.emulateMedia({ reducedMotion: 'reduce' });
      await page.goto('/');
      await createReef(page, maxDensityDestination);
      await page.getByRole('button', { name: 'Show QR' }).click();
      await expect(page.locator('html')).toHaveAttribute('data-view', 'qr');
      if (height === 667) {
        await page.getByRole('button', { name: 'Share experience' }).click();
        await expect(page.locator('.share-fallback input')).toBeVisible();
      }

      const capture = await decodeCompositeScreenshot(page);
      expect([capture.width, capture.height]).toEqual([390, height]);
      expect(decodePixels(eraseRectangle(capture, await protectedStage(page)))).toBeNull();
      expect(decodePixels(capture)).toBe(maxDensityDestination);
    }
  });
});
