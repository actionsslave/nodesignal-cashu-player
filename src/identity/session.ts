/**
 * Session: Anmelden, Wiederherstellen, Abmelden (FR-02, FR-06).
 * Die Session liegt in IndexedDB, nicht in localStorage (NR-04), und überlebt
 * damit Reload und Browser-Neustart.
 */
import { npubEncode } from 'nostr-tools/nip19';
import { openDatabase, type SessionRecord } from '../db/database.js';
import { getPublicKey } from './nip07.js';

export interface Session {
  pubkeyHex: string;
  npub: string;
  loggedInAt: number;
}

function toSession(record: SessionRecord): Session {
  return { pubkeyHex: record.pubkeyHex, npub: record.npub, loggedInAt: record.loggedInAt };
}

/** FR-02: Pubkey über die Extension holen und die Session anlegen. */
export async function login(): Promise<Session> {
  const pubkeyHex = await getPublicKey();
  const session: Session = {
    pubkeyHex,
    npub: npubEncode(pubkeyHex),
    loggedInAt: Date.now(),
  };
  const db = await openDatabase();
  await db.put('session', { key: 'current', ...session });
  return session;
}

/** FR-02: Nach Reload und Browser-Neustart ohne erneute Freigabeabfrage. */
export async function restoreSession(): Promise<Session | undefined> {
  const db = await openDatabase();
  const record = await db.get('session', 'current');
  return record ? toSession(record) : undefined;
}

/** FR-06: Pubkey und Session löschen. Proofs bleiben liegen. */
export async function logout(): Promise<void> {
  const db = await openDatabase();
  await db.delete('session', 'current');
}

/** US-01-AC-1: npub in gekürzter Form für die Kopfzeile. */
export function shortNpub(npub: string): string {
  return `${npub.slice(0, 10)}…${npub.slice(-6)}`;
}
