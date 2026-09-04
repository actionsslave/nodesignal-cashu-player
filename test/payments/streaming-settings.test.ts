import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { closeDatabase } from '../../src/db/database.js';
import {
  confirmStreamingRate,
  getStreamingRate,
  isStreamingRateConfirmed,
  setStreamingRate,
  StreamingRateError,
} from '../../src/payments/streaming-settings.js';
import { resetDatabase } from '../helpers/db.js';

beforeEach(async () => {
  await resetDatabase();
});

afterEach(async () => {
  await closeDatabase();
});

describe('FR-26: Streaming-Satz konfigurieren', () => {
  it('hat als Vorgabe 10 Sat pro Minute', async () => {
    await expect(getStreamingRate()).resolves.toBe(10);
  });

  it('nimmt einen Satz im Bereich 0 bis 1000 an', async () => {
    await setStreamingRate(250);
    await expect(getStreamingRate()).resolves.toBe(250);
  });

  it('nimmt 0 an — das schaltet Streaming ab', async () => {
    await setStreamingRate(0);
    await expect(getStreamingRate()).resolves.toBe(0);
  });

  it('lehnt einen Satz über 1000 ab', async () => {
    await expect(setStreamingRate(1001)).rejects.toBeInstanceOf(StreamingRateError);
  });

  it('lehnt einen negativen Satz ab', async () => {
    await expect(setStreamingRate(-1)).rejects.toBeInstanceOf(StreamingRateError);
  });

  it('lehnt einen nicht ganzzahligen Satz ab', async () => {
    await expect(setStreamingRate(10.5)).rejects.toBeInstanceOf(StreamingRateError);
  });

  it('lässt einen abgelehnten Satz den gespeicherten Wert nicht verändern', async () => {
    await setStreamingRate(42);
    await setStreamingRate(5000).catch(() => undefined);
    await expect(getStreamingRate()).resolves.toBe(42);
  });
});

describe('US-05-AC-6: einmalige Bestätigung', () => {
  it('ist vor dem ersten Streaming-Start unbestätigt', async () => {
    await expect(isStreamingRateConfirmed()).resolves.toBe(false);
  });

  it('merkt sich die Bestätigung samt Satz', async () => {
    await confirmStreamingRate(21);
    await expect(isStreamingRateConfirmed()).resolves.toBe(true);
    await expect(getStreamingRate()).resolves.toBe(21);
  });

  it('bestätigt nichts, wenn der Satz ungültig ist', async () => {
    await expect(confirmStreamingRate(2000)).rejects.toBeInstanceOf(StreamingRateError);
    await expect(isStreamingRateConfirmed()).resolves.toBe(false);
  });

  it('eine spätere Änderung des Satzes hebt die Bestätigung nicht auf', async () => {
    await confirmStreamingRate(10);
    await setStreamingRate(20);
    await expect(isStreamingRateConfirmed()).resolves.toBe(true);
  });
});
