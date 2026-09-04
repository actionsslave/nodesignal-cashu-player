/**
 * Netzwerkschicht zum Mint. Alles, was die Wallet über HTTPS beim Mint tut,
 * läuft über dieses Interface — die Wallet-Logik selbst bleibt dadurch ohne Netz
 * prüfbar, und NR-02 hat genau eine Stelle, an der sie durchgesetzt wird.
 */
import type { StoredProof } from '../contracts/index.js';

export interface MintGateway {
  /** NUT-07: Ist der Token beim Mint schon eingelöst? */
  isTokenSpent(mintUrl: string, token: string): Promise<boolean>;
  /** NUT-03: Token einlösen, frische Proofs für diese Wallet erhalten. */
  receive(mintUrl: string, token: string): Promise<StoredProof[]>;
  /**
   * NUT-03 und NUT-11: `amount` abspalten, Rest als Wechselgeld zurück.
   * Mit `p2pkPubkey` werden die abgespaltenen Proofs auf diesen Schlüssel gelockt.
   */
  send(
    mintUrl: string,
    amount: number,
    proofs: StoredProof[],
    p2pkPubkey?: string,
  ): Promise<{ send: StoredProof[]; keep: StoredProof[] }>;
}

/**
 * Der Ausschnitt der MintInfo, den die Faehigkeitspruefung braucht.
 *
 * Bewusst so schmal: `MintInfo` aus cashu-ts traegt ein Dutzend Ueberladungen
 * von `isSupported`, und die Pruefung soll ohne Netz und ohne Mint testbar sein.
 */
export interface MintCapabilities {
  isSupported(nut: number): { supported: boolean };
}

export class MintCapabilityError extends Error {
  readonly name = 'MintCapabilityError';
  constructor(
    readonly mintUrl: string,
    readonly reason: 'nut11-fehlt',
    message: string,
  ) {
    super(message);
  }
}

/**
 * NIP-61: Ein Nutzap ist nur dann kein Geschenk an die Allgemeinheit, wenn der
 * Mint die P2PK-Bedingung auch durchsetzt.
 *
 * Ein Mint ohne NUT-11 nimmt das P2PK-Secret als gewoehnliches Secret an. Der
 * Swap gelingt, das Event geht raus — und jeder, der es liest, kann die Proofs
 * ausgeben. Der Fehler faellt nirgends auf, deshalb wird hier abgebrochen,
 * bevor geswappt wird.
 *
 * NUT-12 (DLEQ) wird nicht verlangt: Die Verifikation ist Sache des
 * Empfaengers, und ein fehlendes DLEQ kostet den Sender nichts.
 */
export function assertCanLockP2PK(mintUrl: string, info: MintCapabilities): void {
  if (info.isSupported(11).supported) return;
  throw new MintCapabilityError(
    mintUrl,
    'nut11-fehlt',
    `Der Mint ${mintUrl} unterstützt NUT-11 (P2PK) nicht. Ohne P2PK wäre der Nutzap für jeden ausgebbar.`,
  );
}

export class MintUnreachableError extends Error {
  readonly name = 'MintUnreachableError';
  constructor(
    readonly mintUrl: string,
    options?: { cause?: unknown },
  ) {
    super(`Keine Verbindung zum Mint ${mintUrl}.`, options);
  }
}

export type TokenImportFailure =
  | 'ungueltig'
  | 'mint-nicht-erlaubt'
  | 'einheit-nicht-unterstuetzt'
  | 'bereits-eingeloest'
  | 'mint-nicht-erreichbar';

export class TokenImportError extends Error {
  readonly name = 'TokenImportError';
  constructor(
    readonly reason: TokenImportFailure,
    message: string,
    options?: { cause?: unknown },
  ) {
    super(message, options);
  }
}
