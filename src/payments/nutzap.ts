/**
 * FR-27: Aufbau des kind:9321-Events (Nutzap nach NIP-61).
 *
 * Tags: `proof` je Proof, `unit`, `u` (Mint-URL exakt wie im kind:10019) und
 * `p` (Empfänger). Signiert wird über die Extension, publiziert an die Relays
 * aus dem kind:10019 — beides passiert in pay.ts.
 */
import { WALLET_UNIT } from '../config/build-config.js';
import type { ResolvedPaymentTarget, StoredProof } from '../contracts/index.js';
import type { UnsignedNostrEvent } from '../identity/nip07.js';

export const NUTZAP_KIND = 9321;

/**
 * OQ-02: Podcast-, Episoden- und Zeitkontext maschinenlesbar.
 *
 * Auf dem Nutzap-Weg gibt es kein TLV-Feld wie blip-0010 es auf Lightning
 * kennt. Die Felder heissen deshalb wie dort — podcast, episode, ts — und
 * stehen als eigene Tags am kind:9321. Das ist ein Vorschlag, keine Konvention:
 * Bisher liest sie niemand, und Wallets zeigen nur `content`. Deshalb steht
 * derselbe Kontext zusaetzlich lesbar im content (siehe boost-dialog.tsx).
 */
export interface NutzapContext {
  podcastTitle?: string;
  episodeTitle?: string;
  /** `podcast:guid` aus dem Feed — stabil, anders als der Titel. */
  podcastGuid?: string;
  /** guid des Items aus dem Feed. */
  episodeGuid?: string;
  /** Hoerposition in Sekunden; wird als ganze Sekunde geschrieben. */
  positionSeconds?: number;
}

export interface NutzapInput {
  target: ResolvedPaymentTarget;
  /** Mint, bei dem die Proofs liegen — muss aus target.mints stammen. */
  mintUrl: string;
  proofs: StoredProof[];
  content?: string;
  context?: NutzapContext;
}

/** Nur Tags, zu denen es einen Wert gibt — ein leeres Tag sagt nichts. */
function contextTags(context: NutzapContext | undefined): string[][] {
  if (!context) return [];
  const tags: string[][] = [];
  const add = (name: string, value: string | undefined) => {
    if (value !== undefined && value !== '') tags.push([name, value]);
  };
  add('podcast', context.podcastTitle);
  add('episode', context.episodeTitle);
  add('podcast_guid', context.podcastGuid);
  add('episode_guid', context.episodeGuid);
  if (context.positionSeconds !== undefined) {
    add('ts', String(Math.max(0, Math.floor(context.positionSeconds))));
  }
  return tags;
}

/**
 * P2PK erwartet einen komprimierten Punkt (33 Byte). kind:10019 trägt den
 * Schlüssel meist x-only (32 Byte); dann bekommt er das `02` vorangestellt.
 * Ist er schon komprimiert, bleibt er, wie er ist.
 */
export function p2pkLockKey(pubkey: string): string {
  return pubkey.length === 64 ? `02${pubkey}` : pubkey;
}

export function buildNutzap(input: NutzapInput): UnsignedNostrEvent {
  return {
    kind: NUTZAP_KIND,
    created_at: Math.floor(Date.now() / 1000),
    tags: [
      ...input.proofs.map((proof) => ['proof', JSON.stringify(proof)]),
      ['unit', WALLET_UNIT],
      ['u', input.mintUrl],
      ['p', input.target.pubkeyHex],
      ...contextTags(input.context),
    ],
    content: input.content ?? '',
  };
}

/** FR-28: die Hörposition wird als hh:mm:ss an die Nachricht gehängt. */
export function formatTimecode(seconds: number): string {
  const total = Math.max(0, Math.floor(seconds));
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${pad(Math.floor(total / 3600))}:${pad(Math.floor((total % 3600) / 60))}:${pad(total % 60)}`;
}
