/**
 * SFR-28 bis SFR-30: die beiden Zahlungsquellen und ihre Verfügbarkeit.
 *
 * Keine der beiden ist der Notausgang der anderen. Wer eine nostr-Wallet hat,
 * soll sie benutzen können; wer keine hat oder keine nip44-fähige Extension,
 * zahlt per Token und bekommt denselben Funktionsumfang.
 *
 * Deshalb wird die Mint-Schnittmenge je Quelle getrennt gebildet: für NIP-60
 * aus kind:17375, erlaubter Liste und kind:10019 des Empfängers — für die
 * lokale Wallet aus erlaubter Liste und kind:10019. Eine Quelle kann zahlbar
 * sein, während die andere es nicht ist, und der Grund gehört je Quelle
 * einzeln genannt (SFR-29).
 */
import { normalizeMintUrl } from '@cashu/cashu-ts';
import type { WalletDescriptor } from '../nip60/wallet-event.js';

export type SourceId = 'nip60' | 'local';

export type SourceUnavailable =
  /** SFR-12: ohne Login ist gar nichts zahlbar. */
  | 'nicht-angemeldet'
  /** SFR-11: die Extension kann kein nip44. Betrifft nur NIP-60. */
  | 'kein-nip44'
  /** SFR-13: der Nutzer hat kein kind:17375. Betrifft nur NIP-60. */
  | 'keine-wallet'
  /** SFR-13: Es gibt ein kind:17375, aber es liess sich nicht entschluesseln. */
  | 'wallet-unlesbar'
  /** SFR-15, SFR-30: kein Mint, den alle Beteiligten akzeptieren. */
  | 'keine-mint-schnittmenge'
  /** Mints passen, aber bei keinem liegt Guthaben. */
  | 'kein-guthaben';

export interface SourceState {
  id: SourceId;
  available: boolean;
  reason?: SourceUnavailable;
  /** Guthaben, das über die Schnittmenge tatsächlich zahlbar ist. */
  balance: number;
  /** Die Mints der eigenen Schnittmenge, in der Schreibweise des Empfängers. */
  mints: string[];
}

export interface SourceInput {
  loggedIn: boolean;
  hasNip44: boolean;
  /** Aus kind:17375; undefined heißt: keine lesbare NIP-60-Wallet. */
  walletEvent?: WalletDescriptor;
  /** Unterscheidet „keine Wallet" von „Wallet unlesbar" (SFR-29). */
  walletUnreadable?: boolean;
  nip60BalanceByMint: Record<string, number>;
  localBalanceByMint: Record<string, number>;
  allowedMints: readonly string[];
  /** Mints aus dem kind:10019 des Empfängers, in dessen Schreibweise. */
  recipientMints: readonly string[];
}

export interface SourceEvaluation {
  nip60: SourceState;
  local: SourceState;
  /** SOQ-04: NIP-60, wenn beide gehen — sonst die, die geht. */
  preferred?: SourceId;
}

function canonical(url: string): string {
  try {
    return normalizeMintUrl(url);
  } catch {
    return url;
  }
}

/** Schnittmenge in der Schreibweise des Empfängers — die trägt das `u`-Tag. */
function intersect(recipient: readonly string[], ...listen: readonly string[][]): string[] {
  return recipient.filter((mint) => {
    const key = canonical(mint);
    return listen.every((liste) => liste.some((other) => canonical(other) === key));
  });
}

function sumOver(balances: Record<string, number>, mints: string[]): number {
  return mints.reduce((total, mint) => {
    const key = canonical(mint);
    for (const [url, amount] of Object.entries(balances)) {
      if (canonical(url) === key) return total + amount;
    }
    return total;
  }, 0);
}

function build(
  id: SourceId,
  blocker: SourceUnavailable | undefined,
  mints: string[],
  balances: Record<string, number>,
): SourceState {
  if (blocker) return { id, available: false, reason: blocker, balance: 0, mints };
  if (mints.length === 0) {
    return { id, available: false, reason: 'keine-mint-schnittmenge', balance: 0, mints };
  }
  const balance = sumOver(balances, mints);
  if (balance <= 0) return { id, available: false, reason: 'kein-guthaben', balance: 0, mints };
  return { id, available: true, balance, mints };
}

export function evaluateSources(input: SourceInput): SourceEvaluation {
  const nichtAngemeldet = input.loggedIn ? undefined : ('nicht-angemeldet' as const);

  /*
   * SFR-30: NIP-60 schneidet zusaetzlich mit den Mints aus kind:17375 — aber
   * nur, wenn das Event welche nennt.
   *
   * Eine leere Liste ist keine Angabe, kein Verbot. Sie als leere Schnittmenge
   * zu lesen machte eine funktionierende Wallet unbrauchbar, obwohl die Proofs
   * in den kind:7375 ihren Mint selbst nennen — und der ist die Tatsache, die
   * zaehlt. Nennt das Event Mints, bindet es wie bisher.
   */
  const nip60Mints = !input.walletEvent
    ? []
    : input.walletEvent.mints.length > 0
      ? intersect(input.recipientMints, [...input.allowedMints], input.walletEvent.mints)
      : intersect(input.recipientMints, [...input.allowedMints]);
  const localMints = intersect(input.recipientMints, [...input.allowedMints]);

  const nip60Blocker =
    nichtAngemeldet ??
    (!input.hasNip44 ? ('kein-nip44' as const) : undefined) ??
    (!input.walletEvent
      ? input.walletUnreadable
        ? ('wallet-unlesbar' as const)
        : ('keine-wallet' as const)
      : undefined);

  const nip60 = build('nip60', nip60Blocker, nip60Mints, input.nip60BalanceByMint);
  const local = build('local', nichtAngemeldet, localMints, input.localBalanceByMint);

  return {
    nip60,
    local,
    preferred: nip60.available ? 'nip60' : local.available ? 'local' : undefined,
  };
}
