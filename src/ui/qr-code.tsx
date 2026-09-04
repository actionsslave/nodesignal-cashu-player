/**
 * FR-16: Export als QR-Code. Die Matrix kommt von qrcode-generator, das SVG
 * bauen wir selbst, damit es der Theme-Farbe folgt und ohne Canvas auskommt.
 */
import qrcode from 'qrcode-generator';

/** Fehlerkorrektur L — Cashu-Token sind lang, und der Bildschirm ist sauber. */
const ERROR_CORRECTION = 'L';

export function toQrMatrix(value: string): boolean[][] {
  const qr = qrcode(0, ERROR_CORRECTION);
  qr.addData(value);
  qr.make();
  const size = qr.getModuleCount();
  return Array.from({ length: size }, (_row, row) =>
    Array.from({ length: size }, (_column, column) => qr.isDark(row, column)),
  );
}

export interface QrCodeProps {
  value: string;
  /** Kantenlänge in Pixeln. */
  size?: number;
}

export function QrCode({ value, size = 220 }: QrCodeProps) {
  if (value === '') return null;
  const matrix = toQrMatrix(value);
  const count = matrix.length;

  return (
    <svg
      class="qr"
      width={size}
      height={size}
      viewBox={`0 0 ${count} ${count}`}
      shape-rendering="crispEdges"
      role="img"
      aria-label="Cashu-Token als QR-Code"
    >
      <rect width={count} height={count} fill="#ffffff" />
      {matrix.map((row, y) =>
        row.map((dark, x) =>
          dark ? <rect key={`${x}-${y}`} x={x} y={y} width={1} height={1} fill="#000000" /> : null,
        ),
      )}
    </svg>
  );
}
