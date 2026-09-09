import { describe, expect, it } from 'vitest';

import { getFishTransform, getReefModuleTransform } from './scene-math';

describe('fish transforms', () => {
  it('moves every fish farther from the QR center during scattering', () => {
    for (let index = 0; index < 18; index += 1) {
      const before = getFishTransform(index, 0, 0);
      const after = getFishTransform(index, 0, 1);

      expect(Math.hypot(after.x, after.z)).toBeGreaterThan(Math.hypot(before.x, before.z));
    }
  });

  it('returns the same transform for the same frame inputs', () => {
    expect(getFishTransform(7, 1.25, 0.4)).toEqual(getFishTransform(7, 1.25, 0.4));
  });
});

describe('reef module transforms', () => {
  it('restores the same reef transform after visiting the aligned endpoint', () => {
    const reef = getReefModuleTransform(8, 13, 29, 0.4, true, 0);

    expect(getReefModuleTransform(8, 13, 29, 0.4, true, 1)).not.toEqual(reef);
    expect(getReefModuleTransform(8, 13, 29, 0.4, true, 0)).toEqual(reef);
  });

  it('gives a dark module visible volume at the reef endpoint', () => {
    const transform = getReefModuleTransform(8, 13, 29, 0.4, true, 0);

    expect(transform.scale.y).toBeGreaterThan(0.7);
    expect(transform.position.y).toBe(transform.scale.y * 0.5 + 0.04);
    expect(Math.abs(transform.rotation.z)).toBeGreaterThan(0);
  });

  it('aligns exactly to the QR grid at the revealed endpoint', () => {
    const transform = getReefModuleTransform(1, 3, 5, 0.4, true, 1);

    expect(transform.position.x).toBeCloseTo(0.4);
    expect(transform.position.y).toBeCloseTo(0.11);
    expect(transform.position.z).toBeCloseTo(-0.4);
    expect(transform.rotation).toEqual({ x: 0, y: 0, z: 0 });
    expect(transform.scale.x).toBeCloseTo(0.4048);
    expect(transform.scale.y).toBeCloseTo(0.14);
    expect(transform.scale.z).toBeCloseTo(0.4048);
  });

  it('clamps progress before interpolating between endpoints', () => {
    expect(getReefModuleTransform(4, 6, 21, 0.5, false, -1)).toEqual(
      getReefModuleTransform(4, 6, 21, 0.5, false, 0),
    );
    expect(getReefModuleTransform(4, 6, 21, 0.5, false, 2)).toEqual(
      getReefModuleTransform(4, 6, 21, 0.5, false, 1),
    );
  });
});
