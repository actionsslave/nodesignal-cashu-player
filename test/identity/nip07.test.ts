import { afterEach, describe, expect, it, vi } from 'vitest';
import { detectSigner, signEvent } from '../../src/identity/nip07.js';
import type { Nip07Provider, UnsignedNostrEvent } from '../../src/identity/nip07.js';

const EVENT: UnsignedNostrEvent = { kind: 1, created_at: 0, tags: [], content: '' };

function install(provider: Partial<Nip07Provider> | undefined): void {
  if (provider) {
    (window as { nostr?: unknown }).nostr = provider;
  } else {
    delete (window as { nostr?: unknown }).nostr;
  }
}

afterEach(() => {
  install(undefined);
  vi.useRealTimers();
});

describe('FR-01: Extension erkennen', () => {
  it('US-01-AC-3: meldet fehlendes window.nostr und nennt zwei Extensions', () => {
    install(undefined);
    const result = detectSigner();
    expect(result.available).toBe(false);
    expect(result.suggestions).toHaveLength(2);
    expect(result.suggestions.map((s) => s.name)).toEqual(['nos2x', 'Alby']);
  });

  it('meldet ein vorhandenes window.nostr', () => {
    install({ getPublicKey: async () => 'ab', signEvent: async () => ({ ...EVENT, id: '', pubkey: '', sig: '' }) });
    expect(detectSigner().available).toBe(true);
  });
});

describe('FR-03: Events über die Extension signieren', () => {
  it('gibt das signierte Event zurück', async () => {
    const signed = { ...EVENT, id: 'id', pubkey: 'pk', sig: 'sig' };
    install({ signEvent: async () => signed });
    await expect(signEvent(EVENT)).resolves.toEqual(signed);
  });

  it('US-01-AC-4: nennt als Grund die Ablehnung durch den Nutzer', async () => {
    install({ signEvent: async () => { throw new Error('User rejected'); } });
    await expect(signEvent(EVENT)).rejects.toMatchObject({
      name: 'SignerError',
      reason: 'abgelehnt',
    });
  });

  it('bricht nach 30 s ohne Antwort der Extension ab und nennt den Grund', async () => {
    vi.useFakeTimers();
    install({ signEvent: () => new Promise(() => {}) });
    const pending = signEvent(EVENT);
    const assertion = expect(pending).rejects.toMatchObject({
      name: 'SignerError',
      reason: 'timeout',
    });
    await vi.advanceTimersByTimeAsync(30_000);
    await assertion;
  });

  it('antwortet die Extension vor dem Timeout, gibt es keinen Fehler', async () => {
    vi.useFakeTimers();
    const signed = { ...EVENT, id: 'id', pubkey: 'pk', sig: 'sig' };
    install({ signEvent: async () => signed });
    const pending = signEvent(EVENT);
    await vi.advanceTimersByTimeAsync(29_000);
    await expect(pending).resolves.toEqual(signed);
  });

  it('meldet eine fehlende Extension als eigenen Grund', async () => {
    install(undefined);
    await expect(signEvent(EVENT)).rejects.toMatchObject({
      name: 'SignerError',
      reason: 'keine-extension',
    });
  });

  it('SignerError trägt einen deutschen Text für die Oberfläche', async () => {
    install({ signEvent: async () => { throw new Error('User rejected'); } });
    await expect(signEvent(EVENT)).rejects.toThrow(/abgelehnt/i);
  });
});
