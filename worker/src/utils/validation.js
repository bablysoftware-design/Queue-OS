// ============================================================
// utils/validation.js — Input validation helpers
// ============================================================

/** Validate Pakistani phone number (WhatsApp format: 923xxxxxxxxx) */
export function isValidPhone(phone) {
  return /^92[0-9]{10}$/.test(phone);
}

/** Validate 4-digit PIN */
export function isValidPin(pin) {
  return /^\d{4}$/.test(String(pin));
}

/** Validate plan name */
export function isValidPlan(name) {
  return ['free', 'basic', 'pro'].includes(name);
}

/** Validate UUID format */
export function isValidUUID(id) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
}

/** Strip non-digit characters from phone input */
export function sanitizePhone(phone) {
  return String(phone).replace(/\D/g, '');
}
