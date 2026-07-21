/**
 * Queue OS — Formatting Utilities
 */

/** HTML-escape a string for safe innerHTML insertion */
export function esc(s) {
  return String(s || '').replace(/[&<>"']/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]));
}

/** Return emoji icon for a business category */
export function catIcon(cat) {
  const c = (cat || '').toLowerCase();
  if (c.includes('hospital'))                         return '🏥';
  if (c.includes('dental') || c.includes('dentist'))  return '🦷';
  if (c.includes('lab') || c.includes('diagnostic'))  return '🔬';
  if (c.includes('pharmacy') || c.includes('chemist'))return '💊';
  if (c.includes('skin') || c.includes('aesthetic'))  return '✨';
  if (c.includes('eye') || c.includes('optic'))       return '👁';
  if (c.includes('physio') || c.includes('rehab'))    return '🩺';
  if (c.includes('salon') || c.includes('barber'))    return '✂️';
  if (c.includes('restaurant') || c.includes('cafe')) return '🍽️';
  if (c.includes('workshop') || c.includes('repair')) return '🔧';
  if (c.includes('clinic'))                           return '🏥';
  return '🏪';
}

/** Mask phone number for public display */
export function maskPhone(phone) {
  if (!phone || phone.startsWith('unclaimed-')) return null;
  return '****' + String(phone).slice(-4);
}

/** Format a date string to locale-friendly display */
export function formatDate(iso) {
  if (!iso) return '';
  return new Date(iso).toLocaleDateString();
}

/** Build a WhatsApp share URL */
export function waShareUrl(text) {
  return `https://wa.me/?text=${encodeURIComponent(text)}`;
}

/** Generate Google Maps URL for an address */
export function mapsUrl(address, city) {
  const q = [address, city].filter(Boolean).join(', ');
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q)}`;
}
