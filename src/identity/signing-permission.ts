/**
 * FR-04: Vor dem ersten Streaming-Start eine Probe-Signatur ausführen, damit der
 * Nutzer die Freigabe in der Extension dauerhaft erteilen kann. Ohne dauerhafte
 * Freigabe erscheint sonst pro Minute ein Extension-Fenster (A-01).
 */
import { openDatabase } from '../db/database.js';
import { signEvent, type UnsignedNostrEvent } from './nip07.js';

const SETTING_KEY = 'signingPermissionConfirmedAt';

export interface ProbeResult {
  confirmedAt: number;
  /** Die Probe wird ausschließlich signiert, nie an ein Relay geschickt. */
  published: false;
}

/**
 * Die Probe trägt dieselbe Event-Art wie ein späterer Nutzap. Extensions vergeben
 * ihre Freigabe pro Art; eine Probe mit anderer Art würde das Streaming nicht abdecken.
 */
function probeEvent(): UnsignedNostrEvent {
  return {
    kind: 9321,
    created_at: Math.floor(Date.now() / 1000),
    tags: [],
    content: '',
  };
}

export async function hasConfirmedSigningPermission(): Promise<boolean> {
  const db = await openDatabase();
  return (await db.get('settings', SETTING_KEY)) !== undefined;
}

/** Führt die Probe aus, sofern sie noch aussteht, und merkt sich den Erfolg. */
export async function runSigningProbe(): Promise<ProbeResult> {
  const db = await openDatabase();
  const existing = await db.get('settings', SETTING_KEY);
  if (existing) {
    return { confirmedAt: existing.value as number, published: false };
  }

  await signEvent(probeEvent());

  const confirmedAt = Date.now();
  await db.put('settings', { key: SETTING_KEY, value: confirmedAt });
  return { confirmedAt, published: false };
}
