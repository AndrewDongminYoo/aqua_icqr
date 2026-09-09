const SCATTER_DURATION_MS = 1_100;
const LIFT_DURATION_MS = 1_900;
const REVEAL_DURATION_MS = SCATTER_DURATION_MS + LIFT_DURATION_MS;

export type RevealPhase = 'scattering' | 'lifting' | 'revealed';

export interface RevealFrame {
  phase: RevealPhase;
  fishProgress: number;
  cameraProgress: number;
}

function clampUnit(value: number): number {
  return Math.min(1, Math.max(0, value));
}

function easeInOutCubic(value: number): number {
  const progress = clampUnit(value);

  return progress < 0.5
    ? 4 * progress * progress * progress
    : 1 - Math.pow(-2 * progress + 2, 3) / 2;
}

export function getRevealFrame(elapsedMs: number, reducedMotion: boolean): RevealFrame {
  if (reducedMotion || elapsedMs >= REVEAL_DURATION_MS) {
    return { phase: 'revealed', fishProgress: 1, cameraProgress: 1 };
  }

  const elapsed = Math.max(0, elapsedMs);
  const fishProgress = easeInOutCubic(elapsed / SCATTER_DURATION_MS);
  const cameraProgress = easeInOutCubic(
    (elapsed - SCATTER_DURATION_MS) / LIFT_DURATION_MS,
  );

  return {
    phase: elapsed < SCATTER_DURATION_MS ? 'scattering' : 'lifting',
    fishProgress,
    cameraProgress,
  };
}

export function getReverseRevealFrame(
  elapsedMs: number,
  reducedMotion: boolean,
): RevealFrame {
  if (reducedMotion || elapsedMs >= REVEAL_DURATION_MS) {
    return { phase: 'scattering', fishProgress: 0, cameraProgress: 0 };
  }

  const elapsed = Math.max(0, elapsedMs);
  const cameraProgress = 1 - easeInOutCubic(elapsed / LIFT_DURATION_MS);
  const fishProgress =
    elapsed < LIFT_DURATION_MS
      ? 1
      : 1 - easeInOutCubic((elapsed - LIFT_DURATION_MS) / SCATTER_DURATION_MS);

  return {
    phase: elapsed < LIFT_DURATION_MS ? 'revealed' : 'scattering',
    fishProgress,
    cameraProgress,
  };
}
