/**
 * SFR-18, SFR-28: Was von einer Sitzung zur nächsten stehen bleibt — der
 * Float-Betrag, seine einmalige Bestätigung und die gewählte Quelle.
 *
 * In IndexedDB, nicht in localStorage (NR-04). Die Bestätigung ist bewusst ein
 * eigener Eintrag: SNR-06 verlangt, dass vor der ersten Entnahme gefragt wird,
 * und ein gesetzter Betrag allein wäre keine Zustimmung.
 */
import { FLOAT_DEFAULT_SATS } from '../config/build-config.js';
import { openDatabase } from '../db/database.js';
import type { ProofSource } from '../wallet/local-wallet.js';
import { assertFloatAmount } from './float.js';

const BETRAG_KEY = 'float.amount';
const BESTAETIGT_KEY = 'float.confirmed';
const QUELLE_KEY = 'source.active';

export async function getFloatAmount(): Promise<number> {
  const db = await openDatabase();
  const record = await db.get('settings', BETRAG_KEY);
  return (record?.value as number | undefined) ?? FLOAT_DEFAULT_SATS;
}

export async function setFloatAmount(amount: number): Promise<void> {
  assertFloatAmount(amount);
  const db = await openDatabase();
  await db.put('settings', { key: BETRAG_KEY, value: amount });
}

export async function isFloatConfirmed(): Promise<boolean> {
  const db = await openDatabase();
  return (await db.get('settings', BESTAETIGT_KEY)) !== undefined;
}

/** SNR-06: Der Betrag ist gesetzt und der Nutzer hat ihn einmal gesehen. */
export async function confirmFloatAmount(amount: number): Promise<void> {
  await setFloatAmount(amount);
  const db = await openDatabase();
  await db.put('settings', { key: BESTAETIGT_KEY, value: Date.now() });
}

/** SFR-28: Die Wahl überlebt den Reload. */
export async function readActiveSource(): Promise<ProofSource | undefined> {
  const db = await openDatabase();
  const record = await db.get('settings', QUELLE_KEY);
  const wert = record?.value;
  return wert === 'nip60' || wert === 'local' ? wert : undefined;
}

export async function writeActiveSource(source: ProofSource): Promise<void> {
  const db = await openDatabase();
  await db.put('settings', { key: QUELLE_KEY, value: source });
}

const VERLAUF_EVENTS_KEY = 'history.events';

/**
 * SFR-21: Optionale kind:7376-Events. Vorgabe aus.
 *
 * Der Verlauf dieser App liegt lokal und genügt der Anforderung. Ihn zusätzlich
 * auf die Relays zu schreiben heisst, jede Zahlung dauerhaft zu hinterlegen —
 * das ist eine Entscheidung des Nutzers, keine Vorgabe.
 */
export async function isHistoryEventsEnabled(): Promise<boolean> {
  const db = await openDatabase();
  const record = await db.get('settings', VERLAUF_EVENTS_KEY);
  return record?.value === true;
}

export async function setHistoryEventsEnabled(enabled: boolean): Promise<void> {
  const db = await openDatabase();
  await db.put('settings', { key: VERLAUF_EVENTS_KEY, value: enabled });
}
