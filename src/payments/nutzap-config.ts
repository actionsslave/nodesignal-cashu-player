/**
 * FR-22: kind:10019 des Empfängers laden (Mints, Relays, P2PK-Pubkey) und
 * 24 Stunden cachen. Das Event ist replaceable — ein zu alter Cache führte zu
 * Zahlungen an einen Mint, den der Empfänger nicht mehr benutzt.
 */
import { DEMO_RELAYS, NUTZAP_CONFIG_CACHE_MS } from '../config/build-config.js';
import { openDatabase, type NutzapConfigRecord } from '../db/database.js';
import type { SignedNostrEvent } from '../identity/nip07.js';
import type { NostrGateway } from './nostr-gateway.js';

export const NUTZAP_INFO_KIND = 10019;

export interface FetchNutzapConfigOptions {
  gateway: NostrGateway;
  /** Relays, auf denen nach dem kind:10019 gesucht wird. */
  lookupRelays?: readonly string[];
  now?: () => number;
}

function tagValues(event: SignedNostrEvent, name: string): string[] {
  return event.tags.filter((tag) => tag[0] === name && tag[1]).map((tag) => tag[1]);
}

export function parseNutzapConfig(event: SignedNostrEvent): NutzapConfigRecord | undefined {
  const p2pkPubkey = tagValues(event, 'pubkey')[0];
  // Ohne P2PK-Pubkey wäre der Token für jeden ausgebbar — dann lieber gar nicht.
  if (!p2pkPubkey) return undefined;

  // NIP-61: `[ "mint", "<url>", "usd", "sat" ]` — ab Position 2 stehen die
  // unterstuetzten Basiseinheiten. Ohne Marker bleibt der Mint ohne Eintrag;
  // die Spezifikation nennt sie "additional markers", Schweigen ist keine Absage.
  const units: Record<string, string[]> = {};
  for (const tag of event.tags) {
    if (tag[0] !== 'mint' || !tag[1]) continue;
    const marker = tag.slice(2).filter(Boolean);
    if (marker.length > 0) units[tag[1]] = marker;
  }

  return {
    pubkeyHex: event.pubkey,
    p2pkPubkey,
    mints: tagValues(event, 'mint'),
    relays: tagValues(event, 'relay'),
    units,
    fetchedAt: 0,
  };
}

export async function fetchNutzapConfig(
  pubkeyHex: string,
  options: FetchNutzapConfigOptions,
): Promise<NutzapConfigRecord | undefined> {
  const now = options.now ?? Date.now;
  const db = await openDatabase();

  const cached = await db.get('nutzapConfigs', pubkeyHex);
  if (cached && now() - cached.fetchedAt < NUTZAP_CONFIG_CACHE_MS) return cached;

  const relays = [...(options.lookupRelays ?? DEMO_RELAYS)];
  const event = await options.gateway.fetchEvent(relays, {
    kinds: [NUTZAP_INFO_KIND],
    authors: [pubkeyHex],
  });
  if (!event) return undefined;

  const parsed = parseNutzapConfig(event);
  if (!parsed) return undefined;

  const record: NutzapConfigRecord = { ...parsed, fetchedAt: now() };
  await db.put('nutzapConfigs', record);
  return record;
}
