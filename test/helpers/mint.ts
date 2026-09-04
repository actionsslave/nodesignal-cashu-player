import { Amount, getEncodedToken } from '@cashu/cashu-ts';
import type { StoredProof } from '../../src/contracts/index.js';
import type { MintGateway } from '../../src/wallet/mint-gateway.js';
import { assertCanLockP2PK, MintUnreachableError } from '../../src/wallet/mint-gateway.js';

let counter = 0;

export function encodeToken(mintUrl: string, amounts: number[], unit = 'sat'): string {
  return getEncodedToken({
    mint: mintUrl,
    unit,
    proofs: amounts.map((amount) => {
      const secret = `token-secret-${(counter += 1)}`;
      return { id: '00ad268c4d1f5826', amount: Amount.from(amount), secret, C: '02'.padEnd(66, 'a') };
    }),
  });
}

export function freshProofs(_mintUrl: string, amounts: number[]): StoredProof[] {
  return amounts.map((amount) => {
    const secret = `fresh-secret-${(counter += 1)}`;
    return { id: '00ad268c4d1f5826', amount, secret, C: '02'.padEnd(66, 'b') };
  });
}

export interface FakeGatewayOptions {
  spent?: boolean;
  unreachable?: boolean;
  received?: StoredProof[];
  /** Mint ohne NUT-11: der Swap wird abgelehnt, bevor er stattfindet. */
  ohneP2pk?: boolean;
}

/** Ersetzt nur die Netzwerkschicht; die Wallet-Logik läuft echt. */
export function fakeGateway(options: FakeGatewayOptions = {}): MintGateway {
  return {
    async isTokenSpent(mintUrl) {
      if (options.unreachable) throw new MintUnreachableError(mintUrl);
      return options.spent ?? false;
    },
    async receive(mintUrl, token) {
      if (options.unreachable) throw new MintUnreachableError(mintUrl);
      return options.received ?? freshProofs(mintUrl, [Number(token.length % 7) + 1]);
    },
    async send(mintUrl, amount, proofs, p2pkPubkey) {
      if (options.unreachable) throw new MintUnreachableError(mintUrl);
      if (options.ohneP2pk && p2pkPubkey) {
        assertCanLockP2PK(mintUrl, { isSupported: () => ({ supported: false }) });
      }
      const total = proofs.reduce((s, p) => s + Number(p.amount), 0);
      return {
        send: freshProofs(mintUrl, [amount]),
        keep: total > amount ? freshProofs(mintUrl, [total - amount]) : [],
      };
    },
  };
}
