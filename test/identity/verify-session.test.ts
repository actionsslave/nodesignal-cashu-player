/**
 * Die wiederhergestellte Session muss zur Extension passen.
 *
 * restoreSession glaubte dem gespeicherten Pubkey. Wechselt der Nutzer in
 * seiner Extension das Konto, blieb hier die alte Identität stehen — mit
 * ihrem npub in der Kopfzeile und ihrer Wallet in der Anzeige. Signiert hätte
 * dann das neue Konto. Zwei Identitäten in einer Sitzung, und Geld dazwischen.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { login, restoreSession, verifySession } from '../../src/identity/session.js';
import { resetDatabase } from '../helpers/db.js';

const ALT = '1490495f0d0a51c37b1a06c61392fbd1190384b78ab8319eade459784e5e7b3f';
const NEU = '9bdb965a3757e233699b5aabd8fc55bc0c1f48e39c4d5acac6d37b2f48f2161e';

describe('verifySession', () => {
  beforeEach(async () => {
    await resetDatabase();
    vi.stubGlobal('window', { nostr: { getPublicKey: async () => ALT } });
    await login();
  });

  it('behält die Session, wenn die Extension denselben Pubkey nennt', async () => {
    const session = await verifySession({ currentPubkey: async () => ALT });
    expect(session?.pubkeyHex).toBe(ALT);
    await expect(restoreSession()).resolves.toBeDefined();
  });

  it('verwirft die Session, wenn die Extension ein anderes Konto führt', async () => {
    await expect(verifySession({ currentPubkey: async () => NEU })).resolves.toBeUndefined();
    // Und zwar dauerhaft: Ein Reload darf die alte Identität nicht zurückholen.
    await expect(restoreSession()).resolves.toBeUndefined();
  });

  it('behält die Session, wenn die Extension nicht antwortet', async () => {
    // Keine Antwort heisst nicht „anderes Konto". Wer offline ist oder die
    // Freigabe noch nicht erteilt hat, soll nicht abgemeldet werden.
    const session = await verifySession({
      currentPubkey: async () => {
        throw new Error('keine Extension');
      },
    });
    expect(session?.pubkeyHex).toBe(ALT);
  });

  it('liefert nichts, wenn gar keine Session da ist', async () => {
    await resetDatabase();
    await expect(verifySession({ currentPubkey: async () => ALT })).resolves.toBeUndefined();
  });
});
