// ============================================================
// routes/tts.js — Text to Speech proxy
// Uses Google Translate TTS (free, no API key needed)
// Proxied through Worker to avoid CORS issues
// ============================================================

export async function ttsHandler(request, env) {
  const url  = new URL(request.url);
  const text = (url.searchParams.get('text') || '').slice(0, 200);
  const lang = url.searchParams.get('lang') || 'ur';

  if (!text) {
    return new Response('text required', { status: 400, headers: cors() });
  }

  // Map lang codes to Google TTS language codes
  const langMap = { ur: 'ur', en: 'en' };
  const ttsLang = langMap[lang] || 'ur';

  // Google Translate TTS — free, no key, good quality
  const ttsUrl = `https://translate.google.com/translate_tts?ie=UTF-8&q=${encodeURIComponent(text)}&tl=${ttsLang}&client=tw-ob&ttsspeed=0.9`;

  try {
    const res = await fetch(ttsUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; WaitMate/1.0)',
        'Referer':    'https://translate.google.com/',
      }
    });

    if (!res.ok) {
      return new Response(null, { status: 204, headers: cors() });
    }

    const audio = await res.arrayBuffer();
    return new Response(audio, {
      headers: {
        ...cors(),
        'Content-Type':  'audio/mpeg',
        'Cache-Control': 'public, max-age=86400',
      }
    });
  } catch(err) {
    return new Response(null, { status: 204, headers: cors() });
  }
}

function cors() {
  return {
    'Access-Control-Allow-Origin':  '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
  };
}
