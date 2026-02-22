/**
 * api.ts
 *
 * Safe Supabase call wrapper with:
 *   - Offline detection (German error message)
 *   - 10-second timeout (German error message)
 *   - Supabase error → friendly German message mapping
 *   - Catch-all for unexpected JS errors
 *
 * Usage:
 *   const { data, error } = await safeSupabaseCall(async () =>
 *     supabase.from('cars').select('*').eq('user_id', userId)
 *   );
 *   if (error) { showToast({ type: 'error', message: error }); return; }
 */

import { type PostgrestError } from '@supabase/supabase-js';
import { isOnline } from './network';

const TIMEOUT_MS = 10_000;

// Map PostgreSQL/PostgREST error codes to user-friendly German messages
const POSTGRES_ERROR_MAP: Record<string, string> = {
  '23505': 'Dieser Eintrag existiert bereits.',
  '23503': 'Verknüpfte Daten konnten nicht gefunden werden.',
  '42501': 'Du hast keine Berechtigung für diese Aktion.',
  PGRST116: 'Kein Ergebnis gefunden.',
  PGRST301: 'Sitzung abgelaufen. Bitte erneut anmelden.',
};

function mapSupabaseError(error: PostgrestError): string {
  if (error.code && error.code in POSTGRES_ERROR_MAP) {
    return POSTGRES_ERROR_MAP[error.code];
  }
  const msg = error.message.toLowerCase();
  if (msg.includes('network') || msg.includes('fetch')) {
    return 'Netzwerkfehler. Bitte prüfe deine Verbindung.';
  }
  return 'Ein Datenbankfehler ist aufgetreten.';
}

/**
 * Wraps any Supabase operation with offline detection, timeout, and error mapping.
 *
 * @param operation - An async function that performs the Supabase call and returns
 *                    `{ data: T | null; error: PostgrestError | null }`.
 * @returns `{ data, error }` where `error` is a human-readable German string or null.
 */
export async function safeSupabaseCall<T>(
  operation: () => PromiseLike<{ data: T | null; error: PostgrestError | null }>,
): Promise<{ data: T | null; error: string | null }> {
  // 1. Network check
  const online = await isOnline();
  if (!online) {
    return {
      data: null,
      error: 'Keine Internetverbindung. Bitte versuche es später erneut.',
    };
  }

  // 2. Race between the actual operation and a timeout
  const timeoutPromise = new Promise<{ data: null; error: string }>((resolve) => {
    setTimeout(
      () =>
        resolve({
          data: null,
          error: 'Zeitüberschreitung. Bitte prüfe deine Verbindung.',
        }),
      TIMEOUT_MS,
    );
  });

  const operationPromise: Promise<{ data: T | null; error: string | null }> = (async () => {
    try {
      const { data, error } = await operation();
      if (error) {
        return { data: null, error: mapSupabaseError(error) };
      }
      return { data, error: null };
    } catch {
      return { data: null, error: 'Ein unerwarteter Fehler ist aufgetreten.' };
    }
  })();

  return Promise.race([operationPromise, timeoutPromise]);
}
