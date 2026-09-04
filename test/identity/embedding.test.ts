/**
 * SNR-05: Im iframe bleibt die Wallet aus.
 *
 * Eine fremde Seite, die den Player einbettet, sieht zwar nicht in ihn hinein,
 * kann aber Klicks und Aussehen umrahmen. Geld gehört nicht in einen Rahmen,
 * über den der Nutzer nichts weiß.
 */
import { describe, expect, it } from 'vitest';
import { isEmbedded } from '../../src/identity/embedding.js';

describe('isEmbedded', () => {
  it('meldet keine Einbettung, wenn Fenster und oberstes Fenster dasselbe sind', () => {
    const fenster = {} as Window;
    expect(isEmbedded({ self: fenster, top: fenster })).toBe(false);
  });

  it('erkennt die Einbettung, wenn das oberste Fenster ein anderes ist', () => {
    expect(isEmbedded({ self: {} as Window, top: {} as Window })).toBe(true);
  });

  it('geht von einer Einbettung aus, wenn der Zugriff auf top scheitert', () => {
    // Cross-Origin wirft beim Lesen. Im Zweifel gilt: eingebettet.
    expect(
      isEmbedded({
        self: {} as Window,
        get top(): Window | null {
          throw new DOMException('blockiert');
        },
      }),
    ).toBe(true);
  });
})
