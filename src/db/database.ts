/**
 * IndexedDB unter der App-Origin (NFR-04). Alles, was einen Neustart überleben
 * muss, liegt hier — auch die Session, weil localStorage für diese App gesperrt
 * ist (NR-04).
 */
import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import type { StoredProof } from '../contracts/index.js';

export const DB_NAME = 'nodesignal-cashu-player';
export const DB_VERSION = 3;

export const STORES = [
  'session',
  'settings',
  'positions',
  'proofs',
  'history',
  'nutzapConfigs',
  'pendingNutzaps',
  'tokenEvents',
  'floatState',
] as const;

/** Angemeldete Identität (SFR-10). Kein privater Schlüssel, nur der Pubkey. */
export interface SessionRecord {
  key: 'current';
  pubkeyHex: string;
  npub: string;
  loggedInAt: number;
}

export interface SettingRecord {
  key: string;
  value: unknown;
}

/**
 * Eine Episode aus dem Build-Snapshot (SFR-06, SFR-08). Sie liegt nicht in
 * IndexedDB — nur die Hörposition tut das.
 */
export interface EpisodeRecord {
  id: string;
  feedId: string;
  title: string;
  description: string;
  enclosureUrl: string;
  publishedAt: number;
  durationSeconds?: number;
  /** OQ-02: guid des Items aus dem Feed, ohne das Abo-Praefix aus `id`. */
  guid?: string;
}

/** Hörposition je Episode (FR-14). */
export interface PositionRecord {
  episodeId: string;
  positionSeconds: number;
  updatedAt: number;
}

/**
 * Ein Proof in der Wallet. `state` trägt die Reserve-Semantik aus FR-29:
 * reservierte Proofs zählen nicht zum verfügbaren Guthaben, sind aber noch da.
 */
export interface ProofRecord {
  /** Der Proof-Secret ist innerhalb eines Mints eindeutig. */
  secret: string;
  mintUrl: string;
  amount: number;
  state: 'available' | 'reserved';
  /** Gesetzt, solange state === 'reserved'. */
  bundleId?: string;
  proof: StoredProof;
}

/** Zahlungsverlauf (FR-19). */
export interface HistoryRecord {
  id: string;
  direction: 'in' | 'out';
  amount: number;
  at: number;
  status: 'gesendet' | 'ausstehend' | 'fehlgeschlagen' | 'empfangen';
  kind: 'streaming' | 'boost' | 'import' | 'export';
  feedTitle?: string;
  episodeTitle?: string;
  /** Grund bei status === 'fehlgeschlagen'. */
  error?: string;
}

/** Gecachtes kind:10019 des Empfängers (FR-22). */
export interface NutzapConfigRecord {
  pubkeyHex: string;
  p2pkPubkey: string;
  mints: string[];
  relays: string[];
  /**
   * NIP-61: die Marker an den `mint`-Tags, je Mint die unterstuetzten
   * Basiseinheiten. Optional, weil gecachte Eintraege aus aelteren Fassungen
   * sie nicht tragen — dort gilt dann, wie ohne Marker, keine Einschraenkung.
   */
  units?: Record<string, string[]>;
  fetchedAt: number;
}

/**
 * FR-29: Ein Nutzap, dessen Proofs beim Mint bereits auf den Empfänger gelockt
 * sind, dessen Event aber noch kein Relay bestätigt hat. Nach dem Swap gehören
 * die Proofs dem Empfänger — freigeben ginge nicht, also wird erneut publiziert.
 */
export interface PendingNutzapRecord {
  id: string;
  /** Das fertig signierte kind:9321; ein erneuter Versuch braucht keine neue Signatur. */
  event: { kind: number; created_at: number; tags: string[][]; content: string; id: string; pubkey: string; sig: string };
  relays: string[];
  /** Verweis auf den Verlaufseintrag, damit der Status nachgezogen werden kann. */
  historyId: string;
  createdAt: number;
  attempts: number;
}

/**
 * SFR-14: Welches kind:7375-Event welche Proofs traegt. Ohne diese Zuordnung
 * laesst sich ein abgebrochener Float nicht wiederherstellen — die Proofs
 * liegen dann lokal, aber niemand weiss, welche Events sie ersetzen.
 */
export interface TokenEventRecord {
  /** Event-ID des kind:7375. */
  id: string;
  mintUrl: string;
  /** Secrets der Proofs in diesem Event; die Proofs selbst liegen im proofs-Store. */
  secrets: string[];
  /** Wann gelesen, in epoch ms. */
  readAt: number;
}

/**
 * SFR-17, SOQ-03: Ein offener Float. Bricht der Browser weg, liegt der Rest
 * ausserhalb der Wallet-Events; beim naechsten Besuch bietet die App die
 * Rueckgabe an, statt sie stillschweigend zu erledigen.
 */
export interface FloatStateRecord {
  key: 'current';
  /** Entnommener Betrag in Sat. */
  amount: number;
  mintUrl: string;
  /** Event-IDs der kind:7375, die bei der Entnahme verbraucht wurden. */
  consumedEventIds: string[];
  openedAt: number;
}

export interface PlayerDb extends DBSchema {
  session: { key: string; value: SessionRecord };
  settings: { key: string; value: SettingRecord };
  positions: { key: string; value: PositionRecord };
  proofs: { key: string; value: ProofRecord; indexes: { state: string; mintUrl: string } };
  history: { key: string; value: HistoryRecord; indexes: { at: number } };
  nutzapConfigs: { key: string; value: NutzapConfigRecord };
  pendingNutzaps: { key: string; value: PendingNutzapRecord };
  tokenEvents: { key: string; value: TokenEventRecord };
  floatState: { key: string; value: FloatStateRecord };
}

let connection: Promise<IDBPDatabase<PlayerDb>> | undefined;

export function openDatabase(): Promise<IDBPDatabase<PlayerDb>> {
  connection ??= openDB<PlayerDb>(DB_NAME, DB_VERSION, {
    upgrade(db, oldVersion) {
      if (oldVersion < 1) {
      db.createObjectStore('session', { keyPath: 'key' });
      db.createObjectStore('settings', { keyPath: 'key' });
      db.createObjectStore('positions', { keyPath: 'episodeId' });
      const proofs = db.createObjectStore('proofs', { keyPath: 'secret' });
      proofs.createIndex('state', 'state');
      proofs.createIndex('mintUrl', 'mintUrl');
      const history = db.createObjectStore('history', { keyPath: 'id' });
      history.createIndex('at', 'at');
      db.createObjectStore('nutzapConfigs', { keyPath: 'pubkeyHex' });
      }
      if (oldVersion < 2) {
        db.createObjectStore('pendingNutzaps', { keyPath: 'id' });
      }
      if (oldVersion < 3) {
        db.createObjectStore('tokenEvents', { keyPath: 'id' });
        db.createObjectStore('floatState', { keyPath: 'key' });
      }
    },
  });
  return connection;
}

/** Schließt die Verbindung und wartet, bis sie wirklich zu ist. */
export async function closeDatabase(): Promise<void> {
  const pending = connection;
  connection = undefined;
  if (pending) (await pending).close();
}
