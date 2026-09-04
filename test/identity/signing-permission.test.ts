import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { closeDatabase } from '../../src/db/database.js';
import { resetDatabase } from '../helpers/db.js';
import {
  hasConfirmedSigningPermission,
  runSigningProbe,
} from '../../src/identity/signing-permission.js';
import type { UnsignedNostrEvent } from '../../src/identity/nip07.js';

const signed = (event: UnsignedNostrEvent) => ({ ...event, id: 'i', pubkey: 'p', sig: 's' });

beforeEach(async () => {
  await resetDatabase();
});

afterEach(async () => {
  delete (window as { nostr?: unknown }).nostr;
  await closeDatabase();
});

describe('FR-04: Dauerfreigabe erklären und prüfen', () => {
  it('meldet vor dem ersten Streaming-Start, dass die Freigabe noch aussteht', async () => {
    await expect(hasConfirmedSigningPermission()).resolves.toBe(false);
  });

  it('signiert die Probe mit derselben Event-Art wie ein Nutzap, damit die Freigabe passt', async () => {
    const signEvent = vi.fn(async (event: UnsignedNostrEvent) => signed(event));
    (window as { nostr?: unknown }).nostr = { signEvent };

    await runSigningProbe();

    expect(signEvent).toHaveBeenCalledTimes(1);
    expect(signEvent.mock.calls[0][0].kind).toBe(9321);
  });

  it('merkt sich die erfolgreiche Probe und signiert beim zweiten Mal nicht erneut', async () => {
    const signEvent = vi.fn(async (event: UnsignedNostrEvent) => signed(event));
    (window as { nostr?: unknown }).nostr = { signEvent };

    await runSigningProbe();
    await expect(hasConfirmedSigningPermission()).resolves.toBe(true);
    await runSigningProbe();

    expect(signEvent).toHaveBeenCalledTimes(1);
  });

  it('speichert nichts, wenn die Probe abgelehnt wird, und nennt den Grund', async () => {
    (window as { nostr?: unknown }).nostr = {
      signEvent: async () => {
        throw new Error('rejected');
      },
    };

    await expect(runSigningProbe()).rejects.toMatchObject({ reason: 'abgelehnt' });
    await expect(hasConfirmedSigningPermission()).resolves.toBe(false);
  });

  it('die Probe wird nie publiziert, sondern nur signiert', async () => {
    const signEvent = vi.fn(async (event: UnsignedNostrEvent) => signed(event));
    (window as { nostr?: unknown }).nostr = { signEvent };

    const result = await runSigningProbe();

    expect(result.published).toBe(false);
  });
});
