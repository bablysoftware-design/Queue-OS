/**
 * Queue OS — i18n Utility
 * Lightweight language toggle for pages that don't use the full i18n.js
 */

export function getLang() {
  return localStorage.getItem('sq_lang') || 'en';
}

export function setLang(lang) {
  localStorage.setItem('sq_lang', lang);
}

export function toggleLang() {
  setLang(getLang() === 'en' ? 'ur' : 'en');
}

export function applyDir(htmlEl) {
  const isUr = getLang() === 'ur';
  htmlEl.setAttribute('lang', isUr ? 'ur' : 'en');
  htmlEl.setAttribute('dir',  isUr ? 'rtl' : 'ltr');
  document.body.classList.toggle('rtl-mode', isUr);
  return isUr;
}

/**
 * Translate a key using a translations object
 * @param {object} T  — { en: {...}, ur: {...} }
 * @param {string} key
 * @param {object} vars — named replacements e.g. { name: 'Ali' }
 */
export function t(T, key, vars = {}) {
  const lang = getLang();
  let str = T[lang]?.[key] || T.en?.[key] || key;
  for (const [k, v] of Object.entries(vars)) {
    str = str.replace(`{${k}}`, v);
  }
  return str;
}
