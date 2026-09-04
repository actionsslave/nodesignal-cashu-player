/**
 * Echte Anbindung an einen Mint über @cashu/cashu-ts (Kapitel 5.1).
 *
 * Diese Datei ist die einzige Stelle, an der die App mit einem Mint spricht
 * (NR-02). Sie ist bewusst dünn: alles Prüfbare steckt in LocalWallet, hier
 * bleibt nur der Netzverkehr, den erst die manuelle Prüfung A-02 belegt.
 */
import {
  CheckStateEnum,
  getDecodedToken,
  NetworkError,
  Wallet,
  type Proof,
} from '@cashu/cashu-ts';
import { WALLET_UNIT } from '../config/build-config.js';
import type { StoredProof } from '../contracts/index.js';
import { assertCanLockP2PK, MintUnreachableError, type MintGateway } from './mint-gateway.js';

function toStored(proofs: Proof[]): StoredProof[] {
  return proofs.map((proof) => ({ ...proof, amount: proof.amount.toNumber() }));
}

async function mapNetworkError<T>(mintUrl: string, work: () => Promise<T>): Promise<T> {
  try {
    return await work();
  } catch (cause) {
    if (cause instanceof NetworkError) throw new MintUnreachableError(mintUrl, { cause });
    throw cause;
  }
}

export class CashuMintGateway implements MintGateway {
  private readonly wallets = new Map<string, Promise<Wallet>>();

  /** Ein Wallet-Objekt je Mint; loadMint() muss vor jeder Nutzung gelaufen sein. */
  private walletFor(mintUrl: string): Promise<Wallet> {
    let pending = this.wallets.get(mintUrl);
    if (!pending) {
      pending = mapNetworkError(mintUrl, async () => {
        const wallet = new Wallet(mintUrl, { unit: WALLET_UNIT });
        await wallet.loadMint();
        return wallet;
      }).catch((error: unknown) => {
        // Ein fehlgeschlagener Ladeversuch darf nicht dauerhaft hängen bleiben.
        this.wallets.delete(mintUrl);
        throw error;
      });
      this.wallets.set(mintUrl, pending);
    }
    return pending;
  }

  /** NUT-07: Statusabfrage, damit FR-17 "bereits eingelöst" konkret melden kann. */
  async isTokenSpent(mintUrl: string, token: string): Promise<boolean> {
    const wallet = await this.walletFor(mintUrl);
    return mapNetworkError(mintUrl, async () => {
      const decoded = getDecodedToken(token, wallet.keyChain.getAllKeysetIds());
      const states = await wallet.checkProofsStates(decoded.proofs);
      return states.some((state) => state.state === CheckStateEnum.SPENT);
    });
  }

  async receive(mintUrl: string, token: string): Promise<StoredProof[]> {
    const wallet = await this.walletFor(mintUrl);
    return mapNetworkError(mintUrl, async () => toStored(await wallet.receive(token)));
  }

  async send(
    mintUrl: string,
    amount: number,
    proofs: StoredProof[],
    p2pkPubkey?: string,
  ): Promise<{ send: StoredProof[]; keep: StoredProof[] }> {
    const wallet = await this.walletFor(mintUrl);
    // NIP-61: Erst prüfen, ob der Mint P2PK überhaupt durchsetzt, dann swappen.
    // Danach ist der Swap unwiderruflich, und ein Nutzap ohne durchgesetztes
    // P2PK wäre für jeden ausgebbar, der das Event liest.
    if (p2pkPubkey) assertCanLockP2PK(mintUrl, wallet.getMintInfo());

    return mapNetworkError(mintUrl, async () => {
      // NUT-11: die abgespaltenen Proofs werden auf den Empfänger gelockt (FR-27).
      const outputConfig = p2pkPubkey
        ? ({ send: { type: 'p2pk', options: { pubkey: p2pkPubkey } } } as const)
        : undefined;
      const response = await wallet.send(amount, proofs, undefined, outputConfig);
      return { send: toStored(response.send), keep: toStored(response.keep) };
    });
  }
}
