import { describe, expect, it } from 'vitest';

import { createQrSurface, QrCapacityError } from './qr-surface';

describe('QR surface', () => {
  it('adds a four-module light quiet zone around the QR matrix', () => {
    const surface = createQrSurface('https://example.com');

    expect(surface.quietZone).toBe(4);
    expect(surface.gridSize).toBe(surface.moduleCount + 8);
    expect(
      surface.cells.slice(0, surface.gridSize * surface.quietZone).every((cell) => cell === 0),
    ).toBe(true);
  });

  it('preserves the top-left finder pattern inside the quiet zone', () => {
    const surface = createQrSurface('https://example.com');
    const offset = surface.quietZone;

    expect(surface.isDark(offset, offset)).toBe(true);
    expect(surface.isDark(offset + 1, offset + 1)).toBe(false);
    expect(surface.isDark(offset + 3, offset + 3)).toBe(true);
  });

  it('keeps every cell in all four quiet-zone bands light', () => {
    const surface = createQrSurface('https://example.com');

    for (let row = 0; row < surface.gridSize; row += 1) {
      for (let column = 0; column < surface.gridSize; column += 1) {
        const isQuietZone =
          row < surface.quietZone ||
          column < surface.quietZone ||
          row >= surface.gridSize - surface.quietZone ||
          column >= surface.gridSize - surface.quietZone;

        if (isQuietZone) expect(surface.isDark(row, column)).toBe(false);
      }
    }
  });

  it('rejects a matrix that is too dense for the smallest supported viewport', () => {
    const denseDestination = `https://example.com/${'reef'.repeat(100)}`;

    expect(() => createQrSurface(denseDestination)).toThrow(QrCapacityError);
  });

  it('accepts the 69-module density boundary', () => {
    const boundaryDestination = `https://example.com/${'a'.repeat(300)}`;

    expect(createQrSurface(boundaryDestination).moduleCount).toBe(69);
  });
});
