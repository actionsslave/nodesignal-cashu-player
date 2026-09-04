/**
 * Kapitel 3 der Spezifikation: der Session-Float.
 *
 * Streaming mit NIP-60 pro Minute hieße naiv: Token-Events lesen, entschlüsseln,
 * beim Mint swappen, neu verschlüsseln, ein Deletion-Event und ein neues
 * Token-Event publizieren — zwölf Relay-Schreibvorgänge in einer
 * Zwanzig-Minuten-Folge, jeder ein Rennen gegen jeden anderen Client, der
 * dieselbe Wallet offen hat.
 *
 * Stattdessen entnimmt der Player einmal je Sitzung einen Betrag, zahlt lokal
 * dagegen und schreibt den Rest einmal zurück. Zwei Schreibvorgänge statt einem
 * pro Minute.
 *
 * Hier steht ausschließlich die Planung — welche Events verbraucht werden, was
 * an Wechselgeld zurückgeht, wie viel noch übrig ist. Swap, Verschlüsselung und
 * Publikation stehen anderswo, damit diese Rechnung ohne Mint, ohne Extension
 * und ohne Relay prüfbar ist.
 */
import { normalizeMintUrl } from '@cashu/cashu-ts';
import { FLOAT_MAX_SATS, FLOAT_MIN_SATS, WALLET_UNIT } from '../config/build-config.js';
import type { TokenEventContent } from './wallet-event.js';

export class FloatAmountError extends Error {
  readonly name = 'FloatAmountError';
  constructor(readonly value: number) {
    super(
      `Der Float muss eine ganze Zahl zwischen ${FLOAT_MIN_SATS.toLocaleString('de-DE')} und ` +
        `${FLOAT_MAX_SATS.toLocaleString('de-DE')} Sat sein.`,
    );
  }
}

/** SFR-18: Grenzen prüfen, bevor irgendetwas beim Mint passiert. */
export function assertFloatAmount(value: number): void {
  if (!Number.isInteger(value) || value < FLOAT_MIN_SATS || value > FLOAT_MAX_SATS) {
    throw new FloatAmountError(value);
  }
}

export interface TokenEventRef {
  id: string;
  content: TokenEventContent;
}

export interface FloatTakePlan {
  mintUrl: string;
  /** Angefragter Float-Betrag. */
  amount: number;
  /** Summe der Proofs in den verbrauchten Events. */
  available: number;
  /** Was als neues kind:7375 zurückgeht: available minus amount. */
  change: number;
  /** SFR-16: für diese Events wird ein kind:5 publiziert. */
  consumedEventIds: string[];
  /** Die Proofs, die geswappt werden. */
  proofs: TokenEventContent['proofs'];
}

function canonical(url: string): string {
  try {
    return normalizeMintUrl(url);
  } catch {
    return url;
  }
}

/**
 * SFR-16: Welche Events reichen für den Float?
 *
 * Es werden ganze Events verbraucht, keine Teile: NIP-60 ersetzt Events, es
 * bearbeitet sie nicht. Deshalb entsteht fast immer Wechselgeld, das als neues
 * kind:7375 zurückgeht.
 *
 * Liefert nichts, wenn das Guthaben bei diesem Mint nicht reicht — dann darf
 * auch kein Deletion-Event entstehen.
 */
export function planFloatTake(
  events: TokenEventRef[],
  amount: number,
  mintUrl: string,
): FloatTakePlan | undefined {
  const ziel = canonical(mintUrl);
  const passend = events.filter(
    (event) => canonical(event.content.mint) === ziel && event.content.unit === WALLET_UNIT,
  );

  const consumedEventIds: string[] = [];
  const proofs: TokenEventContent['proofs'] = [];
  let available = 0;

  // Groesste Events zuerst: das haelt die Zahl der Deletion-Events klein.
  const summe = (event: TokenEventRef) =>
    event.content.proofs.reduce((total, proof) => total + Number(proof.amount), 0);

  for (const event of [...passend].sort((a, b) => summe(b) - summe(a))) {
    if (available >= amount) break;
    consumedEventIds.push(event.id);
    proofs.push(...event.content.proofs);
    available += summe(event);
  }

  if (available < amount) return undefined;

  return { mintUrl, amount, available, change: available - amount, consumedEventIds, proofs };
}

export interface FloatState {
  /** Entnommener Betrag. */
  amount: number;
  /** Davon in dieser Sitzung ausgegeben. */
  spent: number;
}

/** SFR-20: Was vom Float noch da ist. */
export function remainingFloat(state: FloatState): number {
  return Math.max(0, state.amount - state.spent);
}

export interface FloatReturnPlan {
  amount: number;
}

/**
 * SFR-17: Was beim Beenden zurückgeschrieben wird.
 *
 * Liefert nichts, wenn nichts übrig ist — dann entsteht auch kein Event. Das
 * macht den Vorgang idempotent: Ein zweiter Aufruf nach erfolgter Rückgabe
 * publiziert nicht noch einmal.
 */
export function planFloatReturn(state: FloatState): FloatReturnPlan | undefined {
  const rest = remainingFloat(state);
  return rest > 0 ? { amount: rest } : undefined;
}
