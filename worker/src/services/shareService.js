// ── Share Service ─────────────────────────────────────────────

export function buildShareLink(shop, siteUrl) {
  const base = siteUrl || 'https://queue-os.pages.dev';
  const path = shop.slug ? `/s/${shop.slug}` : `/customer.html?shop=${shop.id}`;
  return `${base}${path}`;
}

export function generateShareMessage(shop, siteUrl) {
  const link = buildShareLink(shop, siteUrl);
  return [
    `🏪 *${shop.name}* — Ab Line Mein Khare Rehne Ki Zarurat Nahi!`,
    ``,
    `✅ Ghar baithe apna token lein`,
    `✅ Apni position live dekhein`,
    `✅ Apni baari pe khud aa jaein`,
    ``,
    `👉 ${link}`,
    ``,
    `🚀 *WaitMate* — Your Smart Queue Partner`,
    `Apna waqt bachayein. Smart banein.`,
  ].join('\n');
}

export function buildWhatsAppUrl(message) {
  return `https://wa.me/?text=${encodeURIComponent(message)}`;
}
