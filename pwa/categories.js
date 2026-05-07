// ============================================================
// categories.js — Single canonical source of truth for categories
// Loaded as a plain script (no ES module syntax required)
// Sets window.CATEGORY_MAP and window.normalizeCat
// ============================================================

window.CATEGORY_MAP = {
  barber: {
    emoji:     '✂️',
    label_en:  'Barber / Salon',
    label_ur:  'حجام / سیلون',
    plural_en: 'Barbers',
    aliases:   ['barber','salon','hair','stylist','scissor','gents','hairdress'],
  },
  clinic: {
    emoji:     '🏥',
    label_en:  'Clinic / Doctor',
    label_ur:  'کلینک / ڈاکٹر',
    plural_en: 'Clinics',
    aliases:   ['clinic','doctor','medical','physician','poly','specialist','dispensary'],
  },
  pharmacy: {
    emoji:     '💊',
    label_en:  'Pharmacy',
    label_ur:  'فارمیسی',
    plural_en: 'Pharmacies',
    aliases:   ['pharma','chemist','medicine','drug','medic'],
  },
  hospital: {
    emoji:     '🏨',
    label_en:  'Hospital',
    label_ur:  'ہسپتال',
    plural_en: 'Hospitals',
    aliases:   ['hospital'],
  },
  bank: {
    emoji:     '🏦',
    label_en:  'Bank / Finance',
    label_ur:  'بینک',
    plural_en: 'Banks',
    aliases:   ['bank','finance','microfinance','exchange','nadra','easypaisa','jazzcash'],
  },
  govt: {
    emoji:     '🏛️',
    label_en:  'Govt Office',
    label_ur:  'سرکاری دفتر',
    plural_en: 'Govt Offices',
    aliases:   ['govt','government','office','municipal','utility','passport'],
  },
  tailor: {
    emoji:     '🧵',
    label_en:  'Tailor / Workshop',
    label_ur:  'درزی',
    plural_en: 'Tailors',
    aliases:   ['tailor','boutique','stitching','workshop','alteration'],
  },
  other: {
    emoji:     '🏪',
    label_en:  'Other',
    label_ur:  'دیگر',
    plural_en: 'Other',
    aliases:   [], // explicit fallback — no aliases map here
  },
};

/**
 * Normalize a raw category string to a canonical key.
 * Tries exact match first, then alias match, falls back to 'other'.
 * Never throws.
 */
window.normalizeCat = function normalizeCat(raw) {
  if (!raw) return 'other';
  const lower = raw.toLowerCase().trim();

  // 1. Direct canonical key match
  if (window.CATEGORY_MAP[lower]) return lower;

  // 2. Alias match — strip emoji/special chars, then check
  const stripped = lower.replace(/[^\w\s]/g, '').trim();
  for (const [key, cfg] of Object.entries(window.CATEGORY_MAP)) {
    if (key === 'other') continue; // skip other in alias search
    if (cfg.aliases.some(a => stripped.includes(a))) return key;
  }

  return 'other';
};

/**
 * Get emoji for a canonical category key.
 * Safe: returns '🏪' for unknown values.
 */
window.catEmoji = function catEmoji(key) {
  return (window.CATEGORY_MAP[key] || window.CATEGORY_MAP.other).emoji;
};

/**
 * Get display label for a canonical category key.
 * lang: 'en' | 'ur' — defaults to 'en'
 */
window.catDisplay = function catDisplay(key, lang) {
  const entry = window.CATEGORY_MAP[key] || window.CATEGORY_MAP.other;
  return lang === 'ur' ? entry.label_ur : entry.label_en;
};
