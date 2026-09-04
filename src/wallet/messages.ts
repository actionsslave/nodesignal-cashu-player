/**
 * Die Fehlertexte aus dem Handoff, wörtlich (SFR-24, SFR-26, SFR-27).
 *
 * Sie stehen an einer Stelle, weil jeder von ihnen die konkrete Ursache nennen
 * muss — den Mint, aus dem der Token stammt, die erlaubte Liste, den Betrag der
 * Untergrenze. Ein Text, der nur „fehlgeschlagen" sagt, erfüllt SFR-24 nicht.
 */
import { MIN_BALANCE_SATS } from '../config/build-config.js';
import type { StorageMode } from './persistence.js';

/** Ohne Protokoll — so steht ein Mint im Entwurf. */
export function mintLabel(url: string): string {
  return url.replace(/^https?:\/\//, '').replace(/\/$/, '');
}

/** Aufzählung in deutscher Reihenfolge: a, b und c. */
function aufzaehlung(werte: string[]): string {
  if (werte.length <= 1) return werte[0] ?? '';
  return `${werte.slice(0, -1).join(', ')} und ${werte[werte.length - 1]}`;
}

export function mintNichtErlaubtText(mintUrl: string, allowedMints: readonly string[]): string {
  return (
    `Dieser Token stammt von ${mintLabel(mintUrl)}. Der Player nimmt nur Token von ` +
    `${aufzaehlung(allowedMints.map(mintLabel))}, weil Nodesignal nur diese akzeptiert.`
  );
}

export function bereitsEingeloestText(): string {
  return (
    'Der Mint kennt diese Proofs schon als ausgegeben. Der Token wurde bereits an einer ' +
    'anderen Stelle eingelöst.'
  );
}

export function ungueltigText(): string {
  return (
    'Das ist kein lesbarer Cashu-Token. Erwartet wird eine Zeichenkette, die mit cashuA ' +
    'oder cashuB beginnt.'
  );
}

/** SFR-26: nur zu zeigen, wenn der Browser dauerhaften Speicher nicht zusagt. */
export function speicherText(mode: StorageMode): string {
  return (
    `Dauerhafter Speicher wurde vom Browser nicht zugesagt — Stand „${mode}". ` +
    'Exportiere dein Guthaben, wenn du die Website-Daten löschst.'
  );
}

export function untergrenzeText(min: number = MIN_BALANCE_SATS): string {
  return (
    `Unter ${min} Sat wurde das Streaming aus der lokalen Wallet angehalten. Nach dem ` +
    'Aufladen läuft es an derselben Stelle weiter.'
  );
}
