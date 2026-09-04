/**
 * FR-19: Zahlungsverlauf. Richtung, Betrag in Sat, Zeitstempel, Podcast und
 * Episode sowie Status je Zahlung.
 */
import { openDatabase, type HistoryRecord } from '../db/database.js';

export type PaymentStatus = HistoryRecord['status'];

export interface NewPayment {
  direction: HistoryRecord['direction'];
  amount: number;
  kind: HistoryRecord['kind'];
  status: PaymentStatus;
  feedTitle?: string;
  episodeTitle?: string;
  /** Nur für Tests und Nacherfassung; sonst jetzt. */
  at?: number;
}

export async function recordPayment(payment: NewPayment): Promise<string> {
  const db = await openDatabase();
  const id = crypto.randomUUID();
  await db.put('history', {
    id,
    direction: payment.direction,
    amount: payment.amount,
    kind: payment.kind,
    status: payment.status,
    feedTitle: payment.feedTitle,
    episodeTitle: payment.episodeTitle,
    at: payment.at ?? Date.now(),
  });
  return id;
}

/** FR-29: aus `ausstehend` wird `gesendet` oder `fehlgeschlagen`. */
export async function updatePaymentStatus(
  id: string,
  status: PaymentStatus,
  error?: string,
): Promise<void> {
  const db = await openDatabase();
  const record = await db.get('history', id);
  if (!record) return;
  await db.put('history', { ...record, status, error });
}

export async function listHistory(limit?: number): Promise<HistoryRecord[]> {
  const db = await openDatabase();
  const entries = await db.getAllFromIndex('history', 'at');
  entries.reverse();
  return limit === undefined ? entries : entries.slice(0, limit);
}
