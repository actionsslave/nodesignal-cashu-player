/**
 * Wann sind Streaming und Boost erlaubt und warum nicht?
 * Deckt FR-05 (Login), FR-20 (Guthaben-Untergrenze) und FR-23 (Empfänger) ab.
 *
 * Die Reihenfolge der Gründe ist bewusst: zuerst, was der Nutzer selbst ändern
 * kann (anmelden, aufladen), dann, was am Podcast liegt.
 */
import { MIN_BALANCE_SATS } from '../config/build-config.js';
import type { PaymentTarget } from '../contracts/index.js';
import type { Session } from '../identity/session.js';

export interface CapabilityInput {
  session: Session | undefined;
  /** Verfügbares Guthaben in Sat. */
  balance: number;
  /** Aufgelöster Empfänger des Abos; undefined, solange die Auflösung läuft. */
  target?: PaymentTarget;
}

export interface PaymentCapability {
  /** FR-05: Abonnieren ist nie gesperrt. */
  canSubscribe: boolean;
  /** FR-05, US-07-AC-3: Wiedergabe ist nie gesperrt. */
  canPlay: boolean;
  canStream: boolean;
  canBoost: boolean;
  /** Anzeigetext neben den deaktivierten Bedienelementen. */
  reason?: string;
}

const ALWAYS = { canSubscribe: true, canPlay: true } as const;

function blocked(reason: string, canBoost = false): PaymentCapability {
  return { ...ALWAYS, canStream: false, canBoost, reason };
}

export function paymentCapability({ session, balance, target }: CapabilityInput): PaymentCapability {
  if (!session) return blocked('Login erforderlich');

  if (balance < MIN_BALANCE_SATS) {
    // Boost bleibt möglich, solange überhaupt etwas da ist; die Untergrenze aus
    // FR-20 gilt den laufenden Streaming-Zahlungen.
    return blocked('Guthaben zu niedrig — in der Wallet aufladen', balance > 0);
  }

  if (!target) return blocked('Empfänger wird noch aufgelöst …');
  if (target.status !== 'resolved') return blocked(target.message);

  return { ...ALWAYS, canStream: true, canBoost: true };
}
