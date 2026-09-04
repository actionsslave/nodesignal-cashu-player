/**
 * SFR-16, SFR-17: Entnahme und Rückgabe des Session-Floats.
 *
 * Die Planung steht in `float.ts` und ist ohne Netz prüfbar; hier stehen die
 * unwiderruflichen Schritte — Swap beim Mint, Verschlüsselung über die
 * Extension, Publikation auf den Relays.
 *
 * Zwei Grenzen bestimmen die Reihenfolge:
 *
 * - SNR-01: Das kind:17375 wird nie geschrieben. Diese Datei kennt seinen Kind
 *   nur, um ihn nicht zu verwenden.
 * - SNR-02: Ein Deletion-Event entsteht ausschließlich für kind:7375-Events,
 *   die diese App gelesen und deren Proofs sie gerade verbraucht hat. Deshalb
 *   kommen die verbrauchten IDs aus dem Plan, nie aus einer Filterabfrage.
 *
 * Und eine Reihenfolge aus Vorsicht: Erst geht das neue Token-Event mit dem
 * Wechselgeld raus, dann das Deletion-Event. Scheitert der zweite Schritt,
 * steht ein Event zu viel auf den Relays, dessen Proofs beim Mint ohnehin
 * ausgegeben sind. Andersherum wäre das Wechselgeld weg.
 */
import { WALLET_UNIT } from '../config/build-config.js';
import type { StoredProof } from '../contracts/index.js';
import { openDatabase } from '../db/database.js';
import type { SignedNostrEvent, UnsignedNostrEvent } from '../identity/nip07.js';
import type { NostrGateway } from '../payments/nostr-gateway.js';
import { recordPayment } from '../wallet/history.js';
import { LocalWallet } from '../wallet/local-wallet.js';
import type { MintGateway } from '../wallet/mint-gateway.js';
import { assertFloatAmount, planFloatTake, type TokenEventRef } from './float.js';
import { TOKEN_KIND, type TokenEventContent } from './wallet-event.js';

export class FloatUnavailableError extends Error {
  readonly name = 'FloatUnavailableError';
  constructor(
    readonly requested: number,
    readonly available: number,
  ) {
    super(
      `Bei diesem Mint liegen ${available.toLocaleString('de-DE')} Sat; für den Float ` +
        `werden ${requested.toLocaleString('de-DE')} Sat gebraucht.`,
    );
  }
}

export interface FloatServiceDeps {
  pubkeyHex: string;
  relays: string[];
  nostr: NostrGateway;
  mint: MintGateway;
  /** nip44 gegen den eigenen Pubkey — NIP-60 verschlüsselt an sich selbst. */
  encrypt: (pubkey: string, plaintext: string) => Promise<string>;
  signEvent: (event: UnsignedNostrEvent) => Promise<SignedNostrEvent>;
}

export interface TakeOptions {
  amount: number;
  mintUrl: string;
  /** Die gelesenen kind:7375 — nur aus ihnen darf entnommen werden. */
  events: TokenEventRef[];
}

export interface TakeResult {
  amount: number;
  change: number;
  mintUrl: string;
  consumedEventIds: string[];
}

export interface GiveBackResult {
  amount: number;
  mintUrl: string;
}

export class FloatService {
  private readonly deps: FloatServiceDeps;
  /** Der Float liegt lokal, gehört aber der nostr-Wallet (SNR-09). */
  private readonly wallet: LocalWallet;

  constructor(deps: FloatServiceDeps) {
    this.deps = deps;
    this.wallet = new LocalWallet({ gateway: deps.mint, source: 'nip60' });
  }

  /** SFR-16: einmal je Sitzung, nie beim Laden der Seite (SNR-06). */
  async take({ amount, mintUrl, events }: TakeOptions): Promise<TakeResult> {
    assertFloatAmount(amount);

    const plan = planFloatTake(events, amount, mintUrl);
    if (!plan) {
      const vorhanden = events
        .filter((event) => event.content.unit === WALLET_UNIT)
        .reduce(
          (total, event) =>
            total + event.content.proofs.reduce((s, proof) => s + Number(proof.amount), 0),
          0,
        );
      throw new FloatUnavailableError(amount, vorhanden);
    }

    // Erst die Verbindungen, dann der Swap: Ein Swap, dessen Ergebnis niemand
    // publizieren kann, hat die alten Proofs schon entwertet.
    await this.deps.nostr.connect(this.deps.relays);

    const { send, keep } = await this.deps.mint.send(mintUrl, amount, plan.proofs);

    const ownEventIds: string[] = [];
    if (keep.length > 0) {
      ownEventIds.push(await this.publishTokenEvent(mintUrl, keep, plan.consumedEventIds));
    }
    if (plan.consumedEventIds.length > 0) {
      ownEventIds.push(await this.publishDeletion(plan.consumedEventIds));
    }

    await this.wallet.addProofs(mintUrl, send);

    const db = await openDatabase();
    await db.put('floatState', {
      key: 'current',
      amount,
      mintUrl,
      consumedEventIds: plan.consumedEventIds,
      ownEventIds,
      openedAt: Date.now(),
    });

    // SFR-21: Die Entnahme ist keine Zahlung, gehoert aber in den Verlauf —
    // sie ist der Vorgang, der die Relays beschreibt.
    await recordPayment({
      direction: 'out',
      amount,
      kind: 'float_out',
      status: 'gesendet',
      source: 'nip60',
    });

    return { amount, change: plan.change, mintUrl, consumedEventIds: plan.consumedEventIds };
  }

  /**
   * SFR-17: Der Rest geht zurück. Idempotent — ist nichts mehr da, entsteht
   * kein Event. Die Rückgabe wird von mehreren Stellen ausgelöst
   * (visibilitychange, pagehide, Ende der Wiedergabe, Knopf), und ein
   * doppelter Auslöser darf kein zweites Event schreiben.
   */
  async giveBack(): Promise<GiveBackResult | undefined> {
    const db = await openDatabase();
    const state = await db.get('floatState', 'current');
    if (!state) return undefined;

    const rest = await this.wallet.balance();
    if (rest === 0) {
      await db.delete('floatState', 'current');
      return undefined;
    }

    const bundle = await this.wallet.reserve(rest, state.mintUrl);
    try {
      await this.deps.nostr.connect(this.deps.relays);
      // Frische Proofs: Die lokalen liegen seit der Entnahme im Browser; was
      // zurück in die Wallet geht, soll aus einem aktuellen Swap stammen.
      const { send } = await this.deps.mint.send(state.mintUrl, bundle.amount, bundle.proofs);
      await this.publishTokenEvent(state.mintUrl, send, []);
    } catch (cause) {
      // Nichts ist verloren: Der Float bleibt lokal liegen und wird beim
      // nächsten Besuch angeboten (SOQ-03).
      await this.wallet.release(bundle);
      throw cause;
    }

    await this.wallet.commit(bundle);
    await db.delete('floatState', 'current');
    await recordPayment({
      direction: 'in',
      amount: bundle.amount,
      kind: 'float_in',
      status: 'empfangen',
      source: 'nip60',
    });
    return { amount: bundle.amount, mintUrl: state.mintUrl };
  }

  /** Liefert die ID des geschriebenen Events — SOQ-03 braucht sie. */
  private async publishTokenEvent(
    mintUrl: string,
    proofs: StoredProof[],
    del: string[],
  ): Promise<string> {
    const content: TokenEventContent = { mint: mintUrl, unit: WALLET_UNIT, proofs, del };
    const signed = await this.deps.signEvent({
      kind: TOKEN_KIND,
      created_at: Math.floor(Date.now() / 1000),
      tags: [],
      content: await this.deps.encrypt(this.deps.pubkeyHex, JSON.stringify(content)),
    });
    await this.deps.nostr.publish(this.deps.relays, signed);
    return signed.id;
  }

  /** SNR-02: nur die IDs aus dem Plan, nie eine Auswahl aus einer Abfrage. */
  private async publishDeletion(eventIds: string[]): Promise<string> {
    const signed = await this.deps.signEvent({
      kind: 5,
      created_at: Math.floor(Date.now() / 1000),
      tags: [...eventIds.map((id) => ['e', id]), ['k', String(TOKEN_KIND)]],
      content: '',
    });
    await this.deps.nostr.publish(this.deps.relays, signed);
    return signed.id;
  }
}
