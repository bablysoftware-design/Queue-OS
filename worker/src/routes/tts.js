// ============================================================
// routes/tts.js — Text to Speech proxy
// Uses Microsoft Azure Neural TTS (ur-PK-UzmaNeural)
// Free tier: 500,000 chars/month
// Falls back to null if key not configured
// ============================================================

import { preflight } from '../utils/response.js';

const AZURE_REGION  = 'eastus'; // change if your Azure resource is in different region
const VOICE_UR      = 'ur-PK-UzmaNeural';   // Beautiful female Urdu voice
const VOICE_EN      = 'en-US-JennyNeural';   // Natural female English voice

/**
 * GET /tts?text=TEXT&lang=ur|en
 * Returns audio/mpeg stream
 */
export async function ttsHandler(request, env) {
  const url  = new URL(request.url);
  const text = url.searchParams.get('text')?.slice(0, 200); // max 200 chars
  const lang = url.searchParams.get('lang') || 'ur';

  if (!text) {
    return new Response('text required', { status: 400 });
  }

  if (!env.AZURE_TTS_KEY) {
    // Key not configured — return 204 so frontend falls back to Web Speech API
    return new Response(null, { status: 204, headers: corsHeaders() });
  }

  const voice = lang === 'ur' ? VOICE_UR : VOICE_EN;
  const rate  = lang === 'ur' ? '0.85'   : '0.9';   // slightly slower = clearer

  const ssml = `<speak version='1.0' xml:lang='${lang === 'ur' ? 'ur-PK' : 'en-US'}'>
    <voice name='${voice}'>
      <prosody rate='${rate}' pitch='0%'>${escapeXml(text)}</prosody>
    </voice>
  </speak>`;

  try {
    const endpoint = `https://${AZURE_REGION}.tts.speech.microsoft.com/cognitiveservices/v1`;
    const res = await fetch(endpoint, {
      method:  'POST',
      headers: {
        'Ocp-Apim-Subscription-Key': env.AZURE_TTS_KEY,
        'Content-Type':              'application/ssml+xml',
        'X-Microsoft-OutputFormat':  'audio-24khz-48kbitrate-mono-mp3',
        'User-Agent':                'WaitMate/1.0',
      },
      body: ssml,
    });

    if (!res.ok) {
      const err = await res.text();
      console.error('Azure TTS error:', res.status, err);
      return new Response(null, { status: 204, headers: corsHeaders() });
    }

    const audio = await res.arrayBuffer();
    return new Response(audio, {
      headers: {
        ...corsHeaders(),
        'Content-Type':  'audio/mpeg',
        'Cache-Control': 'public, max-age=86400', // cache 24h — same text = same audio
      },
    });
  } catch(err) {
    console.error('TTS fetch error:', err);
    return new Response(null, { status: 204, headers: corsHeaders() });
  }
}

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin':  '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
  };
}

function escapeXml(str) {
  return str.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&apos;');
}
