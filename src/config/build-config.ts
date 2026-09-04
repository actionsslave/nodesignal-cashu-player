/**
 * SFR-04: Feed, erlaubte Mints und Empfänger-npub stehen an genau einer Stelle.
 *
 * Werte mit PLACEHOLDER_MARKER sind noch nicht bestätigt und müssen vor dem
 * Deployment durch echte Werte ersetzt werden. hasPlaceholders() macht das zur
 * Laufzeit sichtbar.
 */

export const PLACEHOLDER_MARKER = 'PLATZHALTER';

/** SFR-04, SFR-08: Der Feed, aus dem der Build-Snapshot entsteht. */
export const FEED_URL = `https://feed.${PLACEHOLDER_MARKER}.example/nodesignal.xml`;

/**
 * SFR-04: Der Empfänger. Sein kind:10019 nennt Mints, Relays und P2PK-Pubkey.
 * SA-03 ist belegt: Am 02.09.2026 kam ein Nutzap bei Nodesignal an.
 * TODO: den echten npub eintragen.
 */
export const RECIPIENT_NPUB = `npub1${PLACEHOLDER_MARKER.toLowerCase()}`;

/**
 * Erlaubte Mints (SFR-15, SFR-30, SOQ-02).
 *
 * Die Liste ist eine Vertrauensentscheidung: Ein Mint ist ein Verwahrer. Jeder
 * Eintrag muss vor dem Bau auf CORS aus dem Browser sowie NUT-11 und NUT-12
 * geprüft sein — und laut SOQ-02 auch im kind:10019 von Nodesignal stehen,
 * sonst ist die Schnittmenge aus SFR-15 leer.
 */
export const ALLOWED_MINTS: readonly string[] = [
  'https://mint.minibits.cash/Bitcoin',
  'https://mint.macadamia.cash',
];

/** Relays, auf denen nach dem kind:10019 des Empfängers gesucht wird. */
export const DEMO_RELAYS: readonly string[] = [
  'wss://relay.damus.io',
  'wss://relay.primal.net',
  'wss://nos.lol',
];

/**
 * Die einzige Einheit, die die App führt. Guthaben, Export und das `unit`-Tag
 * des Nutzaps hängen daran; beim Import wird sie geprüft.
 */
export const WALLET_UNIT: string = 'sat';

/** SFR-18: Float-Betrag — Vorgabe und Grenzen. */
export const FLOAT_DEFAULT_SATS = 500;
export const FLOAT_MIN_SATS = 100;
export const FLOAT_MAX_SATS = 10_000;

/** Streaming-Satz (Vorgabe 10 Sat/Minute). */
export const STREAMING_RATE_DEFAULT_SATS_PER_MINUTE = 10;
export const STREAMING_RATE_MIN = 0;
export const STREAMING_RATE_MAX = 1000;

/** SFR-23: Streaming-Intervall in Sekunden gehörter Zeit. */
export const STREAMING_INTERVAL_SECONDS = 60;

/** SFR-27: Untergrenze der lokalen Wallet. */
export const MIN_BALANCE_SATS = 10;

/** Boost-Vorgabebeträge in Sat. */
export const BOOST_PRESETS_SATS: readonly number[] = [210, 2100, 4200, 21000];

/** Maximale Länge der Boost-Nachricht. */
export const BOOST_MESSAGE_MAX_LENGTH = 280;

/** Cache-Dauer für kind:10019 in Millisekunden. */
export const NUTZAP_CONFIG_CACHE_MS = 24 * 60 * 60 * 1000;

/** Timeout für Signaturanfragen an die Extension in Millisekunden. */
export const SIGN_TIMEOUT_MS = 30_000;

/** SFR-08: Wie viele Episoden der Build-Snapshot behält. */
export const EPISODES_PER_FEED = 50;

/** SFR-06: Anzahl Episoden in der Liste. */
export const EPISODES_VISIBLE = 20;

/** Persistenzintervall der Hörposition in Millisekunden. */
export const POSITION_PERSIST_INTERVAL_MS = 10_000;

/** Wählbare Abspielgeschwindigkeiten (SFR-07). */
export const PLAYBACK_RATES: readonly number[] = [0.8, 1, 1.2, 1.5, 1.8, 2, 2.1];
export const PLAYBACK_RATE_DEFAULT = 1;

/** Empfohlene NIP-07-Extensions, falls keine vorhanden ist. */
export const SUGGESTED_EXTENSIONS: readonly { name: string; url: string }[] = [
  { name: 'nos2x', url: 'https://github.com/fiatjaf/nos2x' },
  { name: 'Alby', url: 'https://getalby.com' },
];

/** True, solange irgendein Wert oben noch ein Platzhalter ist. */
export function hasPlaceholders(): boolean {
  const values = [...ALLOWED_MINTS, ...DEMO_RELAYS, FEED_URL, RECIPIENT_NPUB];
  return values.some((value) => value.toLowerCase().includes(PLACEHOLDER_MARKER.toLowerCase()));
}
