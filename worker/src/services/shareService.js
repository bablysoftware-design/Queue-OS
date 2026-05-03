// ── Share Service ─────────────────────────────────────────────

const BASE_URL = 'https://queue-os.pages.dev';

export function buildShareLink(shop) {
  const path = shop.slug ? `/s/${shop.slug}` : `/customer?shop=${shop.id}`;
  return `${BASE_URL}${path}`;
}

export function generateShareMessage(shop) {
  const link = buildShareLink(shop);
  return [
    `💈 *${shop.name}*`,
    ``,
    `Line mein wait karne ki zarurat nahi.`,
    `Ghar se token lein 👇`,
    ``,
    `👉 ${link}`,
    ``,
    `Aapka number aane par WhatsApp pe alert mil jayega.`,
  ].join('\n');
}

export function buildWhatsAppUrl(message) {
  return `https://wa.me/?text=${encodeURIComponent(message)}`;
}
