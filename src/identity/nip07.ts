/**
 * NIP-07: Zugriff auf das window.nostr-Objekt, das Signer-Extensions in die
 * Seite injizieren. Betrifft FR-01 und FR-03.
 */
import { SIGN_TIMEOUT_MS, SUGGESTED_EXTENSIONS } from '../config/build-config.js';

export interface UnsignedNostrEvent {
  kind: number;
  created_at: number;
  tags: string[][];
  content: string;
}

export interface SignedNostrEvent extends UnsignedNostrEvent {
  id: string;
  pubkey: string;
  sig: string;
}

/**
 * SFR-10: Die App braucht Pubkey und Signatur — und für NIP-60 zusätzlich
 * `nip44`. Fehlt es, bleibt die NIP-60-Quelle gesperrt (SFR-11); die lokale
 * Wallet funktioniert vollständig ohne.
 */
export interface Nip44 {
  encrypt(pubkey: string, plaintext: string): Promise<string>;
  decrypt(pubkey: string, ciphertext: string): Promise<string>;
}

export interface Nip07Provider {
  getPublicKey(): Promise<string>;
  signEvent(event: UnsignedNostrEvent): Promise<SignedNostrEvent>;
  nip44?: Nip44;
}

declare global {
  interface Window {
    nostr?: Nip07Provider;
  }
}

export type SignerFailure = 'keine-extension' | 'kein-nip44' | 'abgelehnt' | 'timeout';

const MESSAGES: Record<SignerFailure, string> = {
  'keine-extension': 'Keine nostr-Extension gefunden.',
  'kein-nip44': 'Die Extension unterstützt nip44 nicht. Die NIP-60-Wallet bleibt gesperrt.',
  abgelehnt: 'Die Anfrage wurde in der Extension abgelehnt.',
  timeout: `Die Extension hat binnen ${SIGN_TIMEOUT_MS / 1000} s nicht geantwortet.`,
};

export class SignerError extends Error {
  readonly name = 'SignerError';
  constructor(
    readonly reason: SignerFailure,
    options?: { cause?: unknown },
  ) {
    super(MESSAGES[reason], options);
  }
}

export interface SignerDetection {
  available: boolean;
  /** SFR-10: entscheidet, ob die Quelle NIP-60 überhaupt wählbar ist. */
  nip44: boolean;
  suggestions: readonly { name: string; url: string }[];
}

/** FR-01: Ist eine Extension da? Wenn nicht, welche zwei sind zu empfehlen? */
export function detectSigner(): SignerDetection {
  const provider = window.nostr;
  return {
    available: typeof provider?.signEvent === 'function',
    // Beide Richtungen zaehlen: Lesen braucht decrypt, Schreiben braucht encrypt.
    nip44:
      typeof provider?.nip44?.encrypt === 'function' &&
      typeof provider?.nip44?.decrypt === 'function',
    suggestions: SUGGESTED_EXTENSIONS,
  };
}

/** SFR-13, SFR-14: entschlüsselt einen Event-Inhalt über die Extension. */
export function nip44Decrypt(pubkey: string, ciphertext: string): Promise<string> {
  const nip44 = getProvider()?.nip44;
  if (!nip44) return Promise.reject(new SignerError('kein-nip44'));
  return withTimeout(nip44.decrypt(pubkey, ciphertext));
}

/** SFR-16, SFR-17: verschlüsselt einen Event-Inhalt über die Extension. */
export function nip44Encrypt(pubkey: string, plaintext: string): Promise<string> {
  const nip44 = getProvider()?.nip44;
  if (!nip44) return Promise.reject(new SignerError('kein-nip44'));
  return withTimeout(nip44.encrypt(pubkey, plaintext));
}

export function getProvider(): Nip07Provider | undefined {
  return window.nostr;
}

function withTimeout<T>(work: Promise<T>): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new SignerError('timeout')), SIGN_TIMEOUT_MS);
    work.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (cause: unknown) => {
        clearTimeout(timer);
        // TODO: NIP-07 legt kein Fehlerformat fest. Eine Ablehnung durch den Nutzer
        // ist von einem internen Extension-Fehler nicht unterscheidbar; beides
        // landet hier als 'abgelehnt'. Original bleibt als cause erhalten.
        reject(new SignerError('abgelehnt', { cause }));
      },
    );
  });
}

/** FR-03: Signieren mit Timeout und benanntem Abbruchgrund. */
export function signEvent(event: UnsignedNostrEvent): Promise<SignedNostrEvent> {
  const provider = getProvider();
  if (!provider) return Promise.reject(new SignerError('keine-extension'));
  return withTimeout(provider.signEvent(event));
}

/** FR-02: Pubkey der Extension holen, mit denselben Fehlergründen wie FR-03. */
export function getPublicKey(): Promise<string> {
  const provider = getProvider();
  if (!provider) return Promise.reject(new SignerError('keine-extension'));
  return withTimeout(provider.getPublicKey());
}
