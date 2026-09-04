/**
 * SFR-24, SFR-26, SFR-27: die fünf Fehlertexte des Handoffs, wörtlich.
 *
 * Sie stehen hier als Test, weil sie sonst beim nächsten Umbau still
 * umformuliert werden. Jeder nennt die konkrete Ursache — das ist die
 * Anforderung, nicht der Wortlaut allein.
 */
import { describe, expect, it } from 'vitest';
import {
  bereitsEingeloestText,
  mintNichtErlaubtText,
  speicherText,
  ungueltigText,
  untergrenzeText,
} from '../../src/wallet/messages.js';

describe('Fehlertexte', () => {
  it('nennt den Mint des Tokens und die erlaubten Mints', () => {
    expect(
      mintNichtErlaubtText('https://mint.example.cash', [
        'https://mint.minibits.cash/Bitcoin',
        'https://mint.macadamia.cash',
      ]),
    ).toBe(
      'Dieser Token stammt von mint.example.cash. Der Player nimmt nur Token von ' +
        'mint.minibits.cash/Bitcoin und mint.macadamia.cash, weil Nodesignal nur diese akzeptiert.',
    );
  });

  it('nennt bei einem einzigen erlaubten Mint kein „und"', () => {
    expect(mintNichtErlaubtText('https://mint.example.cash', ['https://mint.macadamia.cash'])).toContain(
      'nur Token von mint.macadamia.cash, weil',
    );
  });

  it('sagt bei bereits eingelösten Proofs, wo sie geblieben sind', () => {
    expect(bereitsEingeloestText()).toBe(
      'Der Mint kennt diese Proofs schon als ausgegeben. Der Token wurde bereits an einer ' +
        'anderen Stelle eingelöst.',
    );
  });

  it('sagt beim unlesbaren Token, was erwartet wird', () => {
    expect(ungueltigText()).toBe(
      'Das ist kein lesbarer Cashu-Token. Erwartet wird eine Zeichenkette, die mit cashuA ' +
        'oder cashuB beginnt.',
    );
  });

  it('nennt beim Speicher den Stand und den Ausweg', () => {
    expect(speicherText('best effort')).toBe(
      'Dauerhafter Speicher wurde vom Browser nicht zugesagt — Stand „best effort". ' +
        'Exportiere dein Guthaben, wenn du die Website-Daten löschst.',
    );
  });

  it('nennt an der Untergrenze den Betrag und was nach dem Aufladen passiert', () => {
    expect(untergrenzeText(10)).toBe(
      'Unter 10 Sat wurde das Streaming aus der lokalen Wallet angehalten. Nach dem ' +
        'Aufladen läuft es an derselben Stelle weiter.',
    );
  });
});
