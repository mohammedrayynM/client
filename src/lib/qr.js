// QR code as an SVG path, generated locally (no network, no extra dependency). The text encoded is exactly the string passed in —
// for invitations that is the one invite URL and nothing else (no tokens, no payment or personal data).
import qrcode from './qrcodeGenerator.js';

/** @returns {{ size: number, d: string }} `d` draws every dark module as a 1x1 square on a `size` x `size` grid (quiet zone included). */
export function qrPath(text, { margin = 2, errorCorrection = 'M' } = {}) {
  const qr = qrcode(0, errorCorrection);   // type 0 = pick the smallest version that fits
  qr.addData(String(text), 'Byte');
  qr.make();
  const n = qr.getModuleCount();
  let d = '';
  for (let r = 0; r < n; r += 1) {
    for (let c = 0; c < n; c += 1) {
      if (qr.isDark(r, c)) d += `M${c + margin} ${r + margin}h1v1h-1z`;
    }
  }
  return { size: n + margin * 2, d };
}
