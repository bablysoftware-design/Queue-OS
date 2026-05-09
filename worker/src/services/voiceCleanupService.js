// ── Voice Note Cleanup Service ────────────────────────────────
// Runs in the daily cron. Deletes orphaned/abandoned voice note files:
//   1. Voice notes in payment_requests with status=rejected and voice_note_path set
//   2. Voice notes in payment_requests older than 48h with status=pending (abandoned)
// NEVER deletes:
//   - voice notes attached to active (waiting/called) tokens — tokenService handles those
//   - voice notes attached to approved payment requests (token owns them now)

import { deleteVoiceNote } from '../routes/voice_notes.js';

/**
 * Sweep orphaned voice notes from storage.
 * Called daily from the scheduled() cron handler.
 */
export async function sweepOrphanVoiceNotes(db, env) {
  if (!env?.SUPABASE_URL || !env?.SUPABASE_KEY) return;
  const url = env.SUPABASE_URL.trim();
  const key = env.SUPABASE_KEY.trim();

  try {
    // 1. Rejected payment requests with voice notes still attached
    const rejected = await db.select('payment_requests',
      `select=id,voice_note_path&status=eq.rejected&voice_note_path=not.is.null&limit=50`
    );

    // 2. Abandoned pending requests older than 48 hours
    const cutoff   = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();
    const abandoned = await db.select('payment_requests',
      `select=id,voice_note_path&status=eq.pending&voice_note_path=not.is.null&created_at=lt.${cutoff}&limit=50`
    );

    const toDelete = [...(rejected || []), ...(abandoned || [])]
      .filter(r => r.voice_note_path);

    // Delete each file and clear the column — best effort, never throws
    for (const row of toDelete) {
      try {
        await deleteVoiceNote(url, key, row.voice_note_path);
        // Clear the path so we don't attempt deletion again
        await db.update('payment_requests', `id=eq.${row.id}`, { voice_note_path: null });
      } catch (_) { /* best effort */ }
    }

    if (toDelete.length > 0) {
      console.log(`[SWEEP] Deleted ${toDelete.length} orphan voice notes`);
    }
  } catch (e) {
    // Never break the cron — log and continue
    console.error('[SWEEP] voiceCleanupService error:', e.message);
  }
}
