/**
 * Empfängerauflösung (FR-21 bis FR-23): npub aus dem Feed → kind:10019 →
 * Schnittmenge der Mints. Jeder Fehlschlag nennt den konkret fehlenden Baustein.
 */
import { normalizeMintUrl } from '@cashu/cashu-ts';
import { decode } from 'nostr-tools/nip19';
import { ALLOWED_MINTS, WALLET_UNIT } from '../config/build-config.js';
import type { PaymentTarget, PaymentTargetFailure } from '../contracts/index.js';
import { fetchNutzapConfig } from './nutzap-config.js';
import type { NostrGateway } from './nostr-gateway.js';

export interface ResolveOptions {
  gateway: NostrGateway;
  allowedMints?: readonly string[];
  lookupRelays?: readonly string[];
  now?: () => number;
}

const MESSAGES: Record<PaymentTargetFailure, string> = {
  'no-npub': 'Der Feed enthält keine nostr-Identität. Ohne sie gibt es keinen Empfänger.',
  'no-nutzap-config':
    'Der Podcast hat keine Empfangs-Konfiguration veröffentlicht (kind:10019).',
  'no-common-mint':
    'Kein gemeinsamer Mint: Der Podcast nimmt nur Mints an, die nicht in der erlaubten Liste stehen.',
  'no-common-unit': `Kein gemeinsamer Mint für ${WALLET_UNIT === 'sat' ? 'Sat' : WALLET_UNIT}: Der Podcast nimmt die gemeinsamen Mints nur in anderen Einheiten an.`,
  'lookup-failed': 'Die Empfängerdaten waren gerade nicht abrufbar.',
};

function unresolved(
  reason: PaymentTargetFailure,
  fetchedAt: number,
  npub?: string,
): PaymentTarget {
  return { status: 'unresolved', reason, message: MESSAGES[reason], npub, fetchedAt };
}

function sameMint(a: string, b: string): boolean {
  try {
    return normalizeMintUrl(a) === normalizeMintUrl(b);
  } catch {
    return a === b;
  }
}

function toHex(npub: string): string | undefined {
  try {
    const decoded = decode(npub);
    return decoded.type === 'npub' ? (decoded.data as string) : undefined;
  } catch {
    return undefined;
  }
}

export async function resolvePaymentTarget(
  npub: string | undefined,
  options: ResolveOptions,
): Promise<PaymentTarget> {
  const now = options.now ?? Date.now;
  const fetchedAt = now();
  const allowedMints = options.allowedMints ?? ALLOWED_MINTS;

  if (!npub) return unresolved('no-npub', fetchedAt);

  const pubkeyHex = toHex(npub);
  if (!pubkeyHex) return unresolved('no-npub', fetchedAt);

  let config;
  try {
    config = await fetchNutzapConfig(pubkeyHex, {
      gateway: options.gateway,
      lookupRelays: options.lookupRelays,
      now,
    });
  } catch {
    // Ein Netzfehler ist kein fehlendes kind:10019 — der Unterschied ist für
    // den Nutzer wichtig, weil der eine Fall vorübergehend ist.
    return unresolved('lookup-failed', fetchedAt, npub);
  }

  if (!config) return unresolved('no-nutzap-config', fetchedAt, npub);

  // NR-07: nur Mints aus der Schnittmenge. Die Schreibweise bleibt die des
  // kind:10019, weil FR-27 sie exakt so in das `u`-Tag schreibt.
  const common = config.mints.filter((mint) =>
    allowedMints.some((allowed) => sameMint(allowed, mint)),
  );
  if (common.length === 0) return unresolved('no-common-mint', fetchedAt, npub);

  // NIP-61: Die Marker am `mint`-Tag nennen die unterstuetzten Basiseinheiten.
  // Ein Mint, der nur usd fuehrt, nimmt unsere Sat-Proofs womoeglich nie an —
  // der Empfaenger saehe sie nicht. Ohne Marker gilt keine Einschraenkung.
  const mints = common.filter((mint) => {
    const units = config.units?.[mint];
    return units === undefined || units.length === 0 || units.includes(WALLET_UNIT);
  });
  if (mints.length === 0) return unresolved('no-common-unit', fetchedAt, npub);

  return {
    status: 'resolved',
    npub,
    pubkeyHex,
    p2pkPubkey: config.p2pkPubkey,
    mints,
    relays: config.relays,
    fetchedAt,
  };
}
