import { describe, expect, it } from 'vitest';

import { getRevealFrame, getReverseRevealFrame, REVEAL_DURATION_MS } from './reveal-timeline';

describe('reveal timeline', () => {
  it('exports the duration at which both directions settle', () => {
    expect(getRevealFrame(REVEAL_DURATION_MS - 1, false).phase).toBe('lifting');
    expect(getRevealFrame(REVEAL_DURATION_MS, false).phase).toBe('revealed');
    expect(getReverseRevealFrame(REVEAL_DURATION_MS - 1, false).fishProgress).toBeGreaterThan(0);
    expect(getReverseRevealFrame(REVEAL_DURATION_MS, false).fishProgress).toBe(0);
  });

  it('moves from scattering through lifting to revealed', () => {
    expect(getRevealFrame(0, false)).toEqual({
      phase: 'scattering',
      fishProgress: 0,
      cameraProgress: 0,
    });
    expect(getRevealFrame(1_100, false)).toEqual({
      phase: 'lifting',
      fishProgress: 1,
      cameraProgress: 0,
    });
    expect(getRevealFrame(3_000, false)).toEqual({
      phase: 'revealed',
      fishProgress: 1,
      cameraProgress: 1,
    });
  });

  it('clamps negative elapsed time to the first frame', () => {
    expect(getRevealFrame(-500, false)).toEqual(getRevealFrame(0, false));
  });

  it('returns the final frame immediately for reduced motion', () => {
    expect(getRevealFrame(0, true)).toEqual({
      phase: 'revealed',
      fishProgress: 1,
      cameraProgress: 1,
    });
  });

  it('returns from the QR view to the living reef in reverse', () => {
    expect(getReverseRevealFrame(0, false)).toEqual({
      phase: 'revealed',
      fishProgress: 1,
      cameraProgress: 1,
    });
    expect(getReverseRevealFrame(1_900, false)).toEqual({
      phase: 'scattering',
      fishProgress: 1,
      cameraProgress: 0,
    });
    expect(getReverseRevealFrame(3_000, false)).toEqual({
      phase: 'scattering',
      fishProgress: 0,
      cameraProgress: 0,
    });
  });

  it('returns to the living reef immediately for reduced motion', () => {
    expect(getReverseRevealFrame(0, true)).toEqual({
      phase: 'scattering',
      fishProgress: 0,
      cameraProgress: 0,
    });
  });
});
