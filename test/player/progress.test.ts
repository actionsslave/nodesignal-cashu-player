import { describe, expect, it } from 'vitest';
import {
  formatRemaining,
  isPlayed,
  remainingSeconds,
  unplayedCount,
} from '../../src/player/progress.js';

describe('Hörfortschritt je Episode', () => {
  it('rechnet die Restzeit aus Dauer und Position', () => {
    expect(remainingSeconds(3600, 1080)).toBe(2520);
  });

  it('liefert ohne Dauer keine Restzeit — der Feed nennt sie nicht immer', () => {
    expect(remainingSeconds(undefined, 1080)).toBeUndefined();
  });

  it('wird nie negativ, auch wenn die Position über die Dauer läuft', () => {
    expect(remainingSeconds(100, 120)).toBe(0);
  });

  it('gilt als gehört, wenn weniger als 30 s übrig sind', () => {
    expect(isPlayed(3600, 3580)).toBe(true);
    expect(isPlayed(3600, 3000)).toBe(false);
  });

  it('gilt ohne Position nicht als gehört', () => {
    expect(isPlayed(3600, undefined)).toBe(false);
  });

  it('gilt ohne Dauer nicht als gehört — sonst wäre jede Episode sofort fertig', () => {
    expect(isPlayed(undefined, 5000)).toBe(false);
  });

  it('formatiert die Restzeit in vollen Minuten', () => {
    expect(formatRemaining(2520)).toBe('42 Min. übrig');
  });

  it('nennt unter einer Minute die Sekunden nicht — das wäre Scheingenauigkeit', () => {
    expect(formatRemaining(20)).toBe('unter 1 Min. übrig');
  });

  it('zählt ungehörte Episoden eines Abos', () => {
    const episoden = [
      { durationSeconds: 3600 },
      { durationSeconds: 3600 },
      { durationSeconds: 3600 },
    ];
    const positionen = new Map([
      ['b', 3590],
      ['c', 100],
    ]);
    const mit = episoden.map((e, i) => ({ ...e, id: ['a', 'b', 'c'][i] }));

    // a nie geöffnet, b durchgehört, c angefangen → a und c sind ungehört.
    expect(unplayedCount(mit, positionen)).toBe(2);
  });
});
