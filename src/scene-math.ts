export interface FishTransform {
  x: number;
  y: number;
  z: number;
  heading: number;
  scale: number;
}

export interface ReefModuleTransform {
  position: { x: number; y: number; z: number };
  rotation: { x: number; y: number; z: number };
  scale: { x: number; y: number; z: number };
}

const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5));

export function getFishTransform(
  index: number,
  timeSeconds: number,
  scatterProgress: number,
): FishTransform {
  const direction = index % 2 === 0 ? 1 : -1;
  const angle = index * GOLDEN_ANGLE + timeSeconds * 0.14 * direction;
  const baseRadius = 1.8 + (index % 6) * 0.52;
  const outwardDistance = Math.max(0, Math.min(1, scatterProgress)) * (7 + (index % 4) * 0.45);
  const radius = baseRadius + outwardDistance;

  return {
    x: Math.cos(angle) * radius,
    y: 1.15 + (index % 4) * 0.38 + Math.sin(timeSeconds * 1.2 + index) * 0.18,
    z: Math.sin(angle) * radius,
    heading: -angle + direction * Math.PI * 0.5,
    scale: 0.48 + (index % 5) * 0.055,
  };
}

export function getModuleCluster(row: number, column: number): number {
  return (row * 5 + column * 3) % 7;
}

function mix(from: number, to: number, progress: number): number {
  if (progress === 0) return from;
  if (progress === 1) return to;

  return from + (to - from) * progress;
}

export function getReefModuleTransform(
  row: number,
  column: number,
  gridSize: number,
  cellSize: number,
  isDark: boolean,
  progress: number,
): ReefModuleTransform {
  const finalX = (column - (gridSize - 1) * 0.5) * cellSize;
  const finalZ = (row - (gridSize - 1) * 0.5) * cellSize;
  const halfExtent = Math.max(cellSize, (gridSize - 1) * cellSize * 0.5);
  const centerDistance = Math.min(1, Math.hypot(finalX, finalZ) / halfExtent);
  const mound = 1 - centerDistance;
  const variation = ((row * 17 + column * 23) % 11) / 10;
  const xPattern = ((row * 7 + column * 11) % 9) - 4;
  const zPattern = ((row * 13 + column * 5) % 9) - 4;
  const cluster = getModuleCluster(row, column);
  const clusterAngle = ((cluster - 1) / 6) * Math.PI * 2;
  const clusterRadius = cluster === 0 ? 0 : halfExtent * (0.5 + (cluster % 2) * 0.08);
  const moduleAngle = (row * gridSize + column) * GOLDEN_ANGLE;
  const localRadius = halfExtent * (0.05 + variation * 0.14);
  const clusterX = Math.cos(clusterAngle) * clusterRadius + Math.cos(moduleAngle) * localRadius;
  const clusterZ = Math.sin(clusterAngle) * clusterRadius + Math.sin(moduleAngle) * localRadius;
  const family = cluster % 3;
  const familyHeight = family === 0 ? 0.2 : family === 1 ? 0.85 : -0.1;
  const familyWidth = family === 0 ? 1.3 : family === 1 ? 0.76 : 1.55;
  const startHeight = isDark
    ? 0.8 + variation * 1.5 + mound * 0.8 + (cluster === 0 ? 0.65 : 0) + familyHeight
    : 0.1 + variation * 0.18;
  const startWidth = isDark
    ? Math.max(cellSize * (0.78 + variation * 0.34), 0.18 + variation * 0.12) *
      familyWidth
    : cellSize * (1.04 + variation * 0.12);
  const finalHeight = isDark ? 0.14 : 0.1;
  const finalWidth = cellSize * 1.012;
  const clampedProgress = Math.max(0, Math.min(1, progress));
  const easedProgress = clampedProgress * clampedProgress * (3 - 2 * clampedProgress);
  const startX = isDark ? clusterX : finalX * 0.94 + xPattern * cellSize * 0.12;
  const startZ = isDark ? clusterZ : finalZ * 0.94 + zPattern * cellSize * 0.12;
  const startRotationX = (zPattern / 4) * 0.18;
  const startRotationY = (xPattern / 4) * 0.7;
  const startRotationZ = (xPattern / 4) * 0.32;

  return {
    position: {
      x: mix(startX, finalX, easedProgress),
      y: mix(startHeight * 0.5 + 0.04, finalHeight * 0.5 + 0.04, easedProgress),
      z: mix(startZ, finalZ, easedProgress),
    },
    rotation: {
      x: mix(startRotationX, 0, easedProgress),
      y: mix(startRotationY, 0, easedProgress),
      z: mix(startRotationZ, 0, easedProgress),
    },
    scale: {
      x: mix(startWidth, finalWidth, easedProgress),
      y: mix(startHeight, finalHeight, easedProgress),
      z: mix(startWidth * (0.82 + variation * 0.24), finalWidth, easedProgress),
    },
  };
}
