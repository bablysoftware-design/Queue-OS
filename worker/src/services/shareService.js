// ── Share Service ─────────────────────────────────────────────

const BASE_URL = 'https://queue-os.pages.dev';

export function buildShareLink(shop) {
  const path = shop.slug ? `/s/${shop.slug}` : `/customer?shop=${shop.id}`;
  return `${BASE_URL}${path}`;
}

export function generateShareMessage(shop) {
  const link = buildShareLink(shop);
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
