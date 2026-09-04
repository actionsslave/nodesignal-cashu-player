import { openDatabase, type ProofRecord } from '../../src/db/database.js';

/** Gültige v1-Keyset-ID; cashu-ts weist Legacy-IDs beim Kodieren ab. */
export const KEYSET_ID = '00ad268c4d1f5826';

export const MINT_A = 'https://mint-a.example';
export const MINT_B = 'https://mint-b.example';

let counter = 0;

export function makeProof(amount: number, mintUrl = MINT_A): ProofRecord {
  const secret = `secret-${(counter += 1)}`;
  return {
    secret,
    mintUrl,
    amount,
    state: 'available',
    proof: { id: KEYSET_ID, amount, secret, C: `02${counter.toString(16).padStart(64, '0')}` },
  };
}

/** Legt Proofs direkt im Store ab — der Weg über den Mint wird hier nicht geprüft. */
export async function seedProofs(amounts: number[], mintUrl = MINT_A): Promise<ProofRecord[]> {
  const db = await openDatabase();
  const records = amounts.map((amount) => makeProof(amount, mintUrl));
  const tx = db.transaction('proofs', 'readwrite');
  await Promise.all(records.map((record) => tx.store.put(record)));
  await tx.done;
  return records;
}
