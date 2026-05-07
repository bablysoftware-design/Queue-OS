// ── Share Service ─────────────────────────────────────────────

export function buildShareLink(shop, siteUrl) {
  const base = siteUrl || 'https://queue-os.pages.dev';
  const path = shop.slug ? `/s/${shop.slug}` : `/customer.html?shop=${shop.id}`;
  return `${base}${path}`;
}

export function generateShareMessage(shop, siteUrl) {
  const link = buildShareLink(shop, siteUrl);
  // Practical Urdu — sounds like a real person sharing, not marketing copy
  return [
    `*${shop.name}* اب WaitMate پر ہے 🏪`,
    ``,
    `گھر بیٹھے ٹوکن لیں — باری آنے پر آئیں`,
    `لائن میں کھڑے ہونے کی ضرورت نہیں`,
    ``,
    `📱 ٹوکن لینے کے لیے:`,
    `${link}`,
    ``,
    `_یہ لنک محفوظ رکھیں — اگلی بار بھی کام آئے گا_`,
  ].join('\n');
}

export function buildWhatsAppUrl(message) {
  return `https://wa.me/?text=${encodeURIComponent(message)}`;
}
