/**
 * FR-26: Der Streaming-Satz ist global einstellbar (Vorgabe 10 Sat/Minute,
 * Bereich 0–1000, 0 schaltet Streaming ab) und wird vor dem ersten
 * Streaming-Start einmal explizit bestätigt (US-05-AC-6, NR-06).
 */
import {
  STREAMING_RATE_DEFAULT_SATS_PER_MINUTE,
  STREAMING_RATE_MAX,
  STREAMING_RATE_MIN,
} from '../config/build-config.js';
import { openDatabase } from '../db/database.js';

const RATE_KEY = 'streamingRateSatsPerMinute';
const CONFIRMED_KEY = 'streamingRateConfirmedAt';

export class StreamingRateError extends Error {
  readonly name = 'StreamingRateError';
  constructor(readonly value: number) {
    super(
      `Der Streaming-Satz muss eine ganze Zahl zwischen ${STREAMING_RATE_MIN} und ${STREAMING_RATE_MAX} sein.`,
    );
  }
}

function assertValid(rate: number): void {
  if (!Number.isInteger(rate) || rate < STREAMING_RATE_MIN || rate > STREAMING_RATE_MAX) {
    throw new StreamingRateError(rate);
  }
}

export async function getStreamingRate(): Promise<number> {
  const db = await openDatabase();
  const record = await db.get('settings', RATE_KEY);
  return (record?.value as number | undefined) ?? STREAMING_RATE_DEFAULT_SATS_PER_MINUTE;
}

export async function setStreamingRate(rate: number): Promise<void> {
  assertValid(rate);
  const db = await openDatabase();
  await db.put('settings', { key: RATE_KEY, value: rate });
}

export async function isStreamingRateConfirmed(): Promise<boolean> {
  const db = await openDatabase();
  return (await db.get('settings', CONFIRMED_KEY)) !== undefined;
}

/** Setzt den Satz und hält fest, dass der Nutzer ihn gesehen hat. */
export async function confirmStreamingRate(rate: number): Promise<void> {
  assertValid(rate);
  await setStreamingRate(rate);
  const db = await openDatabase();
  await db.put('settings', { key: CONFIRMED_KEY, value: Date.now() });
}
