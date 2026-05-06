// ============================================================
// lang.js — Global language utility (shared across all pages)
// Stores: sq_lang = 'en' | 'ur'
// ============================================================

export function getLang()   { return localStorage.getItem('sq_lang') || 'en'; }
export function isUrdu()    { return getLang() === 'ur'; }

export function setLang(lang) {
  localStorage.setItem('sq_lang', lang);
  applyDir();
}

export function toggleLang() {
  setLang(isUrdu() ? 'en' : 'ur');
  window.location.reload();
}

export function applyDir() {
  const ur = isUrdu();
  document.documentElement.lang = ur ? 'ur' : 'en';
  document.documentElement.dir  = ur ? 'rtl' : 'ltr';
}

/** Render a floating language toggle button anywhere */
export function renderLangToggle(containerId, style = '') {
  const el = document.getElementById(containerId);
  if (!el) return;
  const ur = isUrdu();
  el.innerHTML = `
    <button onclick="window.__toggleLang()" 
      style="display:inline-flex;align-items:center;gap:6px;padding:7px 14px;
             border:1px solid rgba(255,255,255,0.12);border-radius:100px;
             background:rgba(255,255,255,0.04);backdrop-filter:blur(12px);
             color:#94A3B8;font-family:'Sora',sans-serif;font-size:12px;
             font-weight:600;cursor:pointer;transition:all 0.2s;${style}"
      onmouseover="this.style.borderColor='#E8B84B';this.style.color='#E8B84B'"
      onmouseout="this.style.borderColor='rgba(255,255,255,0.12)';this.style.color='#94A3B8'">
      🌐 ${ur ? 'English' : 'اردو'}
    </button>`;
}

// Expose to window for onclick handlers
window.__toggleLang = toggleLang;
