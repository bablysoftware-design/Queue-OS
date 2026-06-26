// ============================================================
// routes/voice_notes.js — Voice note upload + signed URL fetch
// Uses Supabase Storage (same credentials, no new infra)
// ============================================================
import { createClient }    from '../utils/db.js';
import { requireShopAuth } from '../utils/auth.js';
import { ok, badRequest, serverError, notFound } from '../utils/response.js';

const BUCKET      = 'voice-notes';
const MAX_BYTES   = 512 * 1024; // 512 KB — enough for 15s WebM opus
const MAX_SECS    = 15;
const ALLOWED_MIME = ['audio/webm', 'audio/ogg', 'audio/mp4', 'audio/mpeg'];

/** POST /public/voice-note — customer uploads voice note before token is issued */
export async function uploadVoiceNote(request, env) {
  try {
    const url       = env.SUPABASE_URL.trim();
    const key       = env.SUPABASE_KEY.trim();
    const ct        = request.headers.get('content-type') || '';

    // Validate MIME type
    const mime = ALLOWED_MIME.find(m => ct.includes(m.split('/')[1]));
    if (!mime) return badRequest('Only audio files allowed (webm/ogg/mp4)');

    // Read body and check size
    const buf = await request.arrayBuffer();
    if (buf.byteLength > MAX_BYTES) return badRequest(`File too large. Max ${MAX_BYTES/1024}KB`);
    if (buf.byteLength < 100)       return badRequest('File too small or empty');

    // Duration header sent by client (calculated via AudioContext)
    const duration = Math.min(parseInt(request.headers.get('x-audio-duration') || '0', 10), MAX_SECS);

    // Unique filename — no token ID yet (token created after upload)
    const ext       = mime === 'audio/mp4' ? 'mp4' : mime === 'audio/ogg' ? 'ogg' : 'webm';
    const filename  = `tmp_${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;
    const storagePath = `${BUCKET}/${filename}`;

    // Upload to Supabase Storage
    const uploadRes = await fetch(
      `${url}/storage/v1/object/${storagePath}`,
      {
        method:  'POST',
        headers: {
          'apikey':          key,
          'Authorization':   `Bearer ${key}`,
          'Content-Type':    mime,
          'x-upsert':        'true',
          'Cache-Control':   'max-age=3600',
        },
        body: buf,
      }
    );

    if (!uploadRes.ok) {
      const errText = await uploadRes.text();
      return serverError(`Storage upload failed: ${errText}`);
    }

    // Return the storage path — will be attached to token on join
    return ok({ path: filename, duration });
  } catch (err) { return serverError(err.message); }
}

/** GET /public/voice-note?path=xxx — get signed URL for playback (shop auth required) */
export async function getVoiceNoteUrl(request, env) {
  try {
    const auth = await requireShopAuth(request, env);
    if (auth instanceof Response) return auth;

    const url  = env.SUPABASE_URL.trim();
    const key  = env.SUPABASE_KEY.trim();
    const path = new URL(request.url).searchParams.get('path');
    if (!path || path.includes('..') || path.includes('/')) return badRequest('Invalid path');

    // Create signed URL valid for 5 minutes (just enough to play)
    const signRes = await fetch(
      `${url}/storage/v1/object/sign/${BUCKET}/${path}`,
      {
        method:  'POST',
        headers: {
          'apikey':        key,
          'Authorization': `Bearer ${key}`,
          'Content-Type':  'application/json',
        },
        body: JSON.stringify({ expiresIn: 300 }), // 5 min
      }
    );

    if (!signRes.ok) return notFound('Voice note not found or expired');
    const { signedURL } = await signRes.json();
    return ok({ url: `${url}/storage/v1${signedURL}` });
  } catch (err) { return serverError(err.message); }
}

/** DELETE /internal/voice-note — called internally when token is completed/cancelled */
export async function deleteVoiceNote(supabaseUrl, supabaseKey, path) {
  if (!path) return;
  try {
    await fetch(
      `${supabaseUrl}/storage/v1/object/${BUCKET}/${path}`,
      {
        method:  'DELETE',
        headers: {
          'apikey':        supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`,
        },
      }
    );
  } catch (e) { /* best-effort — don't break queue flow */ }
}

/** DELETE /public/voice-note?path=xxx — client calls this to clean up orphaned upload if join fails */
export async function deleteVoiceNotePublic(request, env) {
  try {
    const path = new URL(request.url).searchParams.get('path');
    // Same strict validation as GET endpoint
    if (!path || path.includes('..') || path.includes('/') || !/^[a-zA-Z0-9_.-]+$/.test(path)) {
      return ok({}); // silently succeed — best-effort cleanup
    }
    await deleteVoiceNote(env.SUPABASE_URL?.trim(), env.SUPABASE_KEY?.trim(), path);
    return ok({});
  } catch (e) { return ok({}); } // always 200 — client doesn't retry on failure
}

/**
 * POST /internal/cleanup-voices
 * Sweeps orphaned tmp_ voice notes older than 2 hours.
 * Called manually or by a scheduled trigger (Cloudflare Cron).
 * NEVER deletes files referenced in active tokens (waiting/called).
 * Admin-secret protected.
 */
export async function cleanupOrphanVoiceNotes(request, env) {
  const secret = request.headers.get('x-admin-secret');
  if (!secret || secret !== env.ADMIN_SECRET) {
    return unauthorized('Unauthorized');
  }

  try {
    const url = env.SUPABASE_URL.trim();
    const key = env.SUPABASE_KEY.trim();

    // 1. List all files in the voice-notes bucket
    const listRes = await fetch(`${url}/storage/v1/object/list/${BUCKET}`, {
      method: 'POST',
      headers: {
        'apikey':        key,
        'Authorization': `Bearer ${key}`,
        'Content-Type':  'application/json',
      },
      body: JSON.stringify({ prefix: 'tmp_', limit: 200 }),
    });
    if (!listRes.ok) throw new Error('Failed to list storage objects');
    const objects = await listRes.json();

    // 2. Get all voice_note_url values from active tokens (waiting + called)
    //    These files MUST NOT be deleted.
    const activeRes = await fetch(
      `${url}/rest/v1/tokens?status=in.(waiting,called)&select=voice_note_url`,
      {
        headers: {
          'apikey':        key,
          'Authorization': `Bearer ${key}`,
          'Prefer':        'return=representation',
        },
      }
    );
    const activeTokens = activeRes.ok ? await activeRes.json() : [];
    const protectedPaths = new Set(
      activeTokens.map(t => t.voice_note_url).filter(Boolean)
    );

    // 3. Also protect files from pending payment_requests
    const prRes = await fetch(
      `${url}/rest/v1/payment_requests?status=eq.pending&select=voice_note_path`,
      {
        headers: {
          'apikey':        key,
          'Authorization': `Bearer ${key}`,
          'Prefer':        'return=representation',
        },
      }
    );
    const pendingPRs = prRes.ok ? await prRes.json() : [];
    pendingPRs.forEach(pr => { if (pr.voice_note_path) protectedPaths.add(pr.voice_note_path); });

    // 4. Delete tmp_ files older than 2 hours that aren't protected
    const cutoff   = Date.now() - (2 * 60 * 60 * 1000); // 2 hours ago
    const toDelete = (objects || []).filter(obj => {
      const name      = obj.name || '';
      const createdAt = new Date(obj.created_at || 0).getTime();
      return name.startsWith('tmp_') &&
             createdAt < cutoff &&
             !protectedPaths.has(name);
    });

    let deleted = 0;
    for (const obj of toDelete) {
      try {
        await fetch(`${url}/storage/v1/object/${BUCKET}/${obj.name}`, {
          method:  'DELETE',
          headers: { 'apikey': key, 'Authorization': `Bearer ${key}` },
        });
        deleted++;
      } catch (e) { /* best-effort — continue */ }
    }

    return ok({ scanned: objects?.length || 0, protected: protectedPaths.size, deleted });

  } catch (err) {
    return serverError(err.message);
  }
}
