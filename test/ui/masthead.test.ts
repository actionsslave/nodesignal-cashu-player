/**
 * SFR-09: Die Datumszeile trägt den Stand des Feeds.
 *
 * „Nicht erreichbar" gehört nur dort hin, wo es dem Leser etwas sagt. Der
 * Nodesignal-Feed schickt keinen CORS-Header; der Laufzeit-Abruf scheitert
 * deshalb dauerhaft, auch wenn der Bauzeit-Snapshot von heute stammt. Stünde
 * dort dann „nicht erreichbar", wäre die Warnung immer an — und damit nutzlos.
 */
import { describe, expect, it } from 'vitest';
import { datelineFeed } from '../../src/ui/masthead.js';

const HEUTE = new Date('2026-09-04T20:00:00.000Z');

describe('datelineFeed', () => {
  it('nennt nur den Stand, wenn der Snapshot von heute ist', () => {
    expect(datelineFeed('2026-09-04T06:00:00.000Z', true, HEUTE)).toBe(
      'Feed-Stand 4. September 2026',
    );
  });

  it('nennt nur den Stand, wenn der Abruf gelungen ist', () => {
    expect(datelineFeed('2026-08-01T06:00:00.000Z', false, HEUTE)).toBe(
      'Feed-Stand 1. August 2026',
    );
  });

  it('warnt, wenn der Abruf scheitert und der Stand aelter ist', () => {
    // Mittags, damit die Zeitzone den Kalendertag nicht verschiebt.
    expect(datelineFeed('2026-09-02T12:00:00.000Z', true, HEUTE)).toBe(
      'Feed nicht erreichbar — Stand 2. September 2026',
    );
  });
});
