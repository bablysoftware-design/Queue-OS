// ── QR Service ────────────────────────────────────────────────
// Uses goqr.me public API — no library needed, lightweight

export async function generateQRCodeUrl(text, size = 200) {
  // Returns a URL to a QR PNG — use in <img src="...">
  const encoded = encodeURIComponent(text);
  return `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${encoded}&format=png&margin=10`;
}

export async function generateQRCodeBase64(text, size = 200) {
  const url = await generateQRCodeUrl(text, size);
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error('QR fetch failed');
    const buf = await res.arrayBuffer();
    const b64 = btoa(String.fromCharCode(...new Uint8Array(buf)));
    return `data:image/png;base64,${b64}`;
  } catch(e) {
    // Fallback: return the URL directly
    return url;
  }
}
