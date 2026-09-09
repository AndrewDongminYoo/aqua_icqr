import QRCode from 'qrcode';

const QUIET_ZONE = 4 as const;
const MAX_MODULE_COUNT = 69;

export interface QrSurface {
  moduleCount: number;
  gridSize: number;
  quietZone: typeof QUIET_ZONE;
  cells: Uint8Array;
  isDark(row: number, column: number): boolean;
}

export class QrCapacityError extends Error {
  constructor() {
    super('This destination is too long to render as a scannable reef.');
    this.name = 'QrCapacityError';
  }
}

export function createQrSurface(destination: string): QrSurface {
  let source: ReturnType<typeof QRCode.create>;

  try {
    source = QRCode.create(destination, { errorCorrectionLevel: 'M' });
  } catch {
    throw new QrCapacityError();
  }

  const moduleCount = source.modules.size;

  if (moduleCount > MAX_MODULE_COUNT) {
    throw new QrCapacityError();
  }

  const gridSize = moduleCount + QUIET_ZONE * 2;
  const cells = new Uint8Array(gridSize * gridSize);

  for (let row = 0; row < moduleCount; row += 1) {
    for (let column = 0; column < moduleCount; column += 1) {
      const targetRow = row + QUIET_ZONE;
      const targetColumn = column + QUIET_ZONE;
      cells[targetRow * gridSize + targetColumn] = source.modules.get(row, column) ? 1 : 0;
    }
  }

  return {
    moduleCount,
    gridSize,
    quietZone: QUIET_ZONE,
    cells,
    isDark(row, column) {
      if (row < 0 || column < 0 || row >= gridSize || column >= gridSize) {
        return false;
      }

      return cells[row * gridSize + column] === 1;
    },
  };
}
