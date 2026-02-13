/**
 * Mock-Auth fuer die Entwicklung.
 * Wird spaeter durch echtes Supabase Auth ersetzt.
 */

const MOCK_USER_ID = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';

export function getCurrentUserId(): string {
  return MOCK_USER_ID;
}
