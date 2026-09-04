/**
 * FR-29: Der Ablauf einer Zahlung, in der Reihenfolge, die das Risiko klein hält.
 *
 *   Relays verbinden → Proofs reservieren → beim Mint auf den Empfänger locken
 *   → signieren → publizieren → verbuchen
 *
 * Alles vor dem Mint-Swap ist umkehrbar: schlägt es fehl, werden die Proofs
 * freigegeben und das Guthaben steht vollständig wieder zur Verfügung
 * (US-06-AC-4). Nach dem Swap gehören die gelockten Proofs dem Empfänger — eine
 * Freigabe wäre eine Falschanzeige. Dann bleibt der Nutzap in der Warteschlange
 * und wird erneut publiziert.
 */
import { InsufficientFundsError, type ResolvedPaymentTarget } from '../contracts/index.js';
import { openDatabase, type PendingNutzapRecord } from '../db/database.js';
import { signEvent as signViaExtension, type SignedNostrEvent, type UnsignedNostrEvent } from '../identity/nip07.js';
import type { LocalWallet } from '../wallet/local-wallet.js';
import type { MintGateway } from '../wallet/mint-gateway.js';
import { recordPayment, updatePaymentStatus } from '../wallet/history.js';
import { NoRelayError, type NostrGateway } from './nostr-gateway.js';
import { buildNutzap, p2pkLockKey, type NutzapContext } from './nutzap.js';

export interface SendNutzapInput {
  target: ResolvedPaymentTarget;
  amount: number;
  kind: 'streaming' | 'boost';
  content?: string;
  feedTitle?: string;
  episodeTitle?: string;
  /** OQ-02: wandert als Tags an das kind:9321. */
  context?: NutzapContext;
}

export interface SendNutzapDeps {
  wallet: LocalWallet;
  mintGateway: MintGateway;
  nostr: NostrGateway;
  signEvent?: (event: UnsignedNostrEvent) => Promise<SignedNostrEvent>;
}

export interface SendNutzapResult {
  status: 'gesendet' | 'ausstehend';
  amount: number;
  historyId: string;
  acceptedBy: string[];
}

async function queue(
  event: SignedNostrEvent,
  relays: string[],
  historyId: string,
): Promise<void> {
  const record: PendingNutzapRecord = {
    id: crypto.randomUUID(),
    event,
    relays,
    historyId,
    createdAt: Date.now(),
    attempts: 1,
  };
  const db = await openDatabase();
  await db.put('pendingNutzaps', record);
}

export async function sendNutzap(
  input: SendNutzapInput,
  deps: SendNutzapDeps,
): Promise<SendNutzapResult> {
  const sign = deps.signEvent ?? signViaExtension;

  const historyId = await recordPayment({
    direction: 'out',
    amount: input.amount,
    kind: input.kind,
    status: 'ausstehend',
    feedTitle: input.feedTitle,
    episodeTitle: input.episodeTitle,
  });

  const fail = async (error: unknown): Promise<never> => {
    await updatePaymentStatus(
      historyId,
      'fehlgeschlagen',
      error instanceof Error ? error.message : String(error),
    );
    throw error;
  };

  // 1. Erst die Relays. Ohne sie ist die Zahlung sinnlos, und hier ist noch
  //    nichts passiert, was sich nicht zurücknehmen ließe.
  let relays: string[];
  try {
    relays = await deps.nostr.connect(input.target.relays);
    if (relays.length === 0) throw new NoRelayError();
  } catch (error) {
    return fail(error instanceof NoRelayError ? error : new NoRelayError());
  }

  // 2. Proofs reservieren — bei einem Mint, den der Empfänger akzeptiert.
  let bundle;
  let mintUrl = '';
  let lastError: unknown = new InsufficientFundsError(input.amount, 0);
  for (const candidate of input.target.mints) {
    try {
      bundle = await deps.wallet.reserve(input.amount, candidate);
      mintUrl = candidate;
      break;
    } catch (error) {
      lastError = error;
    }
  }
  if (!bundle) return fail(lastError);

  // 3. Der Swap beim Mint ist der unwiderrufliche Schritt.
  let locked;
  try {
    locked = await deps.mintGateway.send(
      mintUrl,
      input.amount,
      bundle.proofs,
      p2pkLockKey(input.target.p2pkPubkey),
    );
  } catch (error) {
    // TODO: Ein Netzfehler nach der Verarbeitung beim Mint ist von einem
    // Fehler davor nicht unterscheidbar. Die Freigabe ist die wahrscheinlich
    // richtige Annahme, aber nicht garantiert korrekt.
    await deps.wallet.release(bundle);
    return fail(error);
  }

  await deps.wallet.commit(bundle);
  await deps.wallet.addProofs(mintUrl, locked.keep);

  // 4. Signieren und publizieren. Ab hier ist das Geld unterwegs.
  const unsigned = buildNutzap({
    target: input.target,
    mintUrl,
    proofs: locked.send,
    content: input.content,
    context: input.context,
  });

  let signed: SignedNostrEvent;
  try {
    signed = await sign(unsigned);
  } catch {
    // Ohne Signatur lässt sich nichts publizieren, aber die Proofs sind weg.
    // Der Eintrag bleibt ausstehend; ein neuer Versuch braucht eine Signatur.
    await updatePaymentStatus(historyId, 'ausstehend', 'Signatur fehlgeschlagen.');
    return { status: 'ausstehend', amount: input.amount, historyId, acceptedBy: [] };
  }

  try {
    const published = await deps.nostr.publish(relays, signed);
    await updatePaymentStatus(historyId, 'gesendet');
    return {
      status: 'gesendet',
      amount: input.amount,
      historyId,
      acceptedBy: published.acceptedBy,
    };
  } catch (error) {
    await queue(signed, relays, historyId);
    await updatePaymentStatus(
      historyId,
      'ausstehend',
      error instanceof Error ? error.message : String(error),
    );
    return { status: 'ausstehend', amount: input.amount, historyId, acceptedBy: [] };
  }
}

/** FR-29: erneut publizieren, was beim ersten Versuch kein Relay bestätigt hat. */
export async function retryPendingNutzaps(deps: Pick<SendNutzapDeps, 'nostr'>): Promise<number> {
  const db = await openDatabase();
  const pending = await db.getAll('pendingNutzaps');
  let sent = 0;

  for (const record of pending) {
    try {
      await deps.nostr.publish(record.relays, record.event as SignedNostrEvent);
      await db.delete('pendingNutzaps', record.id);
      await updatePaymentStatus(record.historyId, 'gesendet');
      sent += 1;
    } catch {
      await db.put('pendingNutzaps', { ...record, attempts: record.attempts + 1 });
    }
  }

  return sent;
}
