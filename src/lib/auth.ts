import type { Session, Subscription, User } from '@supabase/supabase-js';
import { supabase } from './supabase';

// ── Error Types ──────────────────────────────────────────────────────────────

export type AuthErrorCode =
  | 'invalid_credentials'
  | 'email_in_use'
  | 'weak_password'
  | 'network_error'
  | 'unknown';

export interface AuthError {
  code: AuthErrorCode;
  message: string;
}

export type AuthResult<T = void> =
  | { success: true; data: T }
  | { success: false; error: AuthError };

// ── Module-level user cache (for synchronous getCurrentUserId) ────────────────
// Gets populated by onAuthStateChange as soon as the session is known.
let _currentUser: User | null = null;

supabase.auth.onAuthStateChange((_event, session) => {
  _currentUser = session?.user ?? null;
});

// ── Internal error mapper ────────────────────────────────────────────────────

function mapError(error: unknown): AuthError {
  if (!error || typeof error !== 'object') {
    return { code: 'unknown', message: 'Ein unbekannter Fehler ist aufgetreten.' };
  }

  const e = error as { message?: string; status?: number };
  const msg = (e.message ?? '').toLowerCase();

  if (msg.includes('invalid login credentials') || msg.includes('invalid credentials')) {
    return { code: 'invalid_credentials', message: 'E-Mail oder Passwort ist falsch.' };
  }
  if (
    msg.includes('already registered') ||
    msg.includes('already been registered') ||
    msg.includes('user already exists')
  ) {
    return {
      code: 'email_in_use',
      message: 'Diese E-Mail-Adresse wird bereits verwendet.',
    };
  }
  if (msg.includes('password should be') || msg.includes('weak password')) {
    return {
      code: 'weak_password',
      message: 'Das Passwort ist zu schwach (mind. 8 Zeichen, 1 Zahl).',
    };
  }
  if (msg.includes('fetch') || msg.includes('network') || e.status === 0) {
    return {
      code: 'network_error',
      message: 'Keine Internetverbindung. Bitte erneut versuchen.',
    };
  }
  return { code: 'unknown', message: e.message ?? 'Ein Fehler ist aufgetreten.' };
}

// ── Auth Functions ────────────────────────────────────────────────────────────

/**
 * Registriert einen neuen Nutzer und legt ein Profil an.
 * Das Profil wird primaer ueber den DB-Trigger erstellt;
 * dieser Code ist ein Fallback fuer den Fall dass der Trigger fehlt.
 */
export async function signUp(
  email: string,
  password: string,
  username: string,
): Promise<AuthResult<User>> {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { username } },
  });

  if (error) return { success: false, error: mapError(error) };
  if (!data.user) {
    return { success: false, error: { code: 'unknown', message: 'Registrierung fehlgeschlagen.' } };
  }

  // Fallback: Profil anlegen falls der DB-Trigger nicht greift
  const { error: profileError } = await supabase
    .from('profiles')
    .upsert({ id: data.user.id, username }, { onConflict: 'id', ignoreDuplicates: true });

  if (profileError) {
    // Kein harter Fehler — der Trigger sollte es abgedeckt haben
    console.warn('[auth] Profil-Fallback fehlgeschlagen:', profileError.message);
  }

  return { success: true, data: data.user };
}

/** Meldet einen bestehenden Nutzer mit E-Mail und Passwort an. */
export async function signIn(
  email: string,
  password: string,
): Promise<AuthResult<User>> {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) return { success: false, error: mapError(error) };
  if (!data.user) {
    return { success: false, error: { code: 'unknown', message: 'Anmeldung fehlgeschlagen.' } };
  }

  return { success: true, data: data.user };
}

/** Meldet den aktuellen Nutzer ab. */
export async function signOut(): Promise<void> {
  await supabase.auth.signOut();
}

/** Sendet eine Passwort-Reset-E-Mail. */
export async function resetPassword(email: string): Promise<AuthResult> {
  const { error } = await supabase.auth.resetPasswordForEmail(email);
  if (error) return { success: false, error: mapError(error) };
  return { success: true, data: undefined };
}

/**
 * Gibt den aktuell eingeloggten Nutzer zurueck oder null.
 * Wird synchron aus dem Modul-Cache gelesen.
 */
export function getCurrentUser(): User | null {
  return _currentUser;
}

/**
 * Gibt die UUID des eingeloggten Nutzers zurueck.
 * Rueckwaertskompatibel mit dem Mock — gibt '' zurueck wenn kein Nutzer.
 * Da die App Auth-Guards hat, wird '' in der Praxis nie in geschuetzten Screens auftreten.
 */
export function getCurrentUserId(): string {
  return _currentUser?.id ?? '';
}

/** Registriert einen Listener fuer Auth-State-Aenderungen. */
export function onAuthStateChange(
  callback: (event: string, session: Session | null) => void,
): { data: { subscription: Subscription } } {
  return supabase.auth.onAuthStateChange(callback);
}
