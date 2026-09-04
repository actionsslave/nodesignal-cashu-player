import { describe, expect, it } from 'vitest';
import { paymentCapability } from '../../src/payments/capability.js';
import type { PaymentTarget } from '../../src/contracts/index.js';

const ZIEL: PaymentTarget = {
  status: 'resolved',
  npub: 'npub1x',
  pubkeyHex: 'ab',
  p2pkPubkey: 'cd',
  mints: ['https://mint-a.example'],
  relays: ['wss://r1.example'],
  fetchedAt: 0,
};

const OHNE_NPUB: PaymentTarget = {
  status: 'unresolved',
  reason: 'no-npub',
  message: 'Der Feed enthält keine nostr-Identität.',
  fetchedAt: 0,
};

const SESSION = { pubkeyHex: 'ab', npub: 'npub1x', loggedInAt: 0 };
const GENUG = 1000;

describe('FR-05: Nutzung ohne Login', () => {
  it('sperrt Streaming und Boost ohne Anmeldung mit dem Hinweis "Login erforderlich"', () => {
    const capability = paymentCapability({ session: undefined, balance: GENUG, target: ZIEL });
    expect(capability.canStream).toBe(false);
    expect(capability.canBoost).toBe(false);
    expect(capability.reason).toBe('Login erforderlich');
  });

  it('lässt Abonnieren und Wiedergabe ohne Anmeldung uneingeschränkt zu', () => {
    const capability = paymentCapability({ session: undefined, balance: GENUG, target: ZIEL });
    expect(capability.canSubscribe).toBe(true);
    expect(capability.canPlay).toBe(true);
  });

  it('gibt Streaming und Boost nach der Anmeldung frei', () => {
    const capability = paymentCapability({ session: SESSION, balance: GENUG, target: ZIEL });
    expect(capability.canStream).toBe(true);
    expect(capability.canBoost).toBe(true);
    expect(capability.reason).toBeUndefined();
  });
});

describe('FR-20: Guthaben-Untergrenze', () => {
  it('US-05-AC-4: stoppt Streaming unter 10 Sat und verweist auf die Wallet', () => {
    const capability = paymentCapability({ session: SESSION, balance: 8, target: ZIEL });
    expect(capability.canStream).toBe(false);
    expect(capability.reason).toMatch(/Guthaben zu niedrig/);
    expect(capability.reason).toMatch(/Wallet/);
  });

  it('lässt Streaming bei genau 10 Sat noch zu', () => {
    expect(paymentCapability({ session: SESSION, balance: 10, target: ZIEL }).canStream).toBe(true);
  });

  it('gibt Streaming nach erfolgreicher Aufladung wieder frei', () => {
    expect(paymentCapability({ session: SESSION, balance: 8, target: ZIEL }).canStream).toBe(false);
    expect(paymentCapability({ session: SESSION, balance: 500, target: ZIEL }).canStream).toBe(true);
  });

  it('lässt Wiedergabe und Abonnieren auch bei leerer Wallet zu', () => {
    const capability = paymentCapability({ session: SESSION, balance: 0, target: ZIEL });
    expect(capability.canPlay).toBe(true);
    expect(capability.canSubscribe).toBe(true);
  });

  it('nennt den fehlenden Login vor dem zu niedrigen Guthaben', () => {
    const capability = paymentCapability({ session: undefined, balance: 0, target: ZIEL });
    expect(capability.reason).toBe('Login erforderlich');
  });
});

describe('FR-23: Zahlungen deaktivieren mit Grund', () => {
  it('US-07-AC-1: sperrt Streaming und Boost und nennt den Grund des Ziels', () => {
    const capability = paymentCapability({ session: SESSION, balance: GENUG, target: OHNE_NPUB });
    expect(capability.canStream).toBe(false);
    expect(capability.canBoost).toBe(false);
    expect(capability.reason).toBe(OHNE_NPUB.status === 'unresolved' ? OHNE_NPUB.message : '');
  });

  it('US-07-AC-3: die Wiedergabe bleibt uneingeschränkt', () => {
    const capability = paymentCapability({ session: SESSION, balance: GENUG, target: OHNE_NPUB });
    expect(capability.canPlay).toBe(true);
    expect(capability.canSubscribe).toBe(true);
  });

  it('nennt den fehlenden Login vor dem Grund des Ziels', () => {
    const capability = paymentCapability({ session: undefined, balance: GENUG, target: OHNE_NPUB });
    expect(capability.reason).toBe('Login erforderlich');
  });

  it('sperrt Zahlungen, solange der Empfänger noch nicht aufgelöst ist', () => {
    const capability = paymentCapability({ session: SESSION, balance: GENUG, target: undefined });
    expect(capability.canStream).toBe(false);
    expect(capability.reason).toMatch(/Empfänger/i);
  });
});
