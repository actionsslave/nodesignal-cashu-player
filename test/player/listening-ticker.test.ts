import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ListeningTicker } from '../../src/player/listening-ticker.js';
import type { ListeningTick } from '../../src/contracts/index.js';
import { FakeAudio } from '../helpers/audio.js';

let audio: FakeAudio;
let clock: { now: number };
let ticks: ListeningTick[];
let ticker: ListeningTicker;

function start() {
  ticker = new ListeningTicker({
    audio,
    feedId: 'feed-1',
    episodeId: 'episode-1',
    now: () => clock.now,
  });
  ticker.onTick((tick) => ticks.push(tick));
}

beforeEach(() => {
  audio = new FakeAudio();
  clock = { now: 1_000_000 };
  ticks = [];
  start();
});

describe('FR-24: Hörzeit aus currentTime ableiten', () => {
  it('meldet nach einer gehörten Sekunde einen Tick über eine Sekunde', () => {
    audio.play(1, clock);
    expect(ticks).toHaveLength(1);
    expect(ticks[0].listenedSeconds).toBeCloseTo(1, 5);
  });

  it('sammelt Bruchteile und meldet erst ab einer vollen Sekunde', () => {
    audio.play(0.75, clock);
    expect(ticks).toHaveLength(0);

    audio.play(0.25, clock);
    expect(ticks).toHaveLength(1);
    expect(ticks[0].listenedSeconds).toBeCloseTo(1, 5);
  });

  it('trägt Feed, Episode und die aktuelle Position', () => {
    audio.seekTo(100, clock);
    audio.play(1, clock);
    expect(ticks[0]).toMatchObject({ feedId: 'feed-1', episodeId: 'episode-1' });
    expect(ticks[0].positionSeconds).toBeCloseTo(101, 5);
  });

  it('US-05-AC-2: ein Sprung vorwärts zählt nicht als gehörte Zeit', () => {
    audio.play(0.5, clock);
    audio.seekTo(600, clock);
    audio.play(0.25, clock);

    expect(ticks).toHaveLength(0);
  });

  it('ein Sprung zurück zählt nicht als gehörte Zeit', () => {
    audio.play(0.5, clock);
    audio.seekTo(0, clock);
    audio.play(0.25, clock);

    expect(ticks).toHaveLength(0);
  });

  it('behält die vor einem Sprung gehörte Zeit als offenen Rest', () => {
    audio.play(0.5, clock);
    audio.seekTo(600, clock);
    audio.play(0.25, clock);
    expect(ticks).toHaveLength(0);

    audio.play(0.25, clock);
    expect(ticks).toHaveLength(1);
    // 0,5 s vor dem Sprung plus 0,5 s danach — der Sprung selbst zählt nicht.
    expect(ticks[0].listenedSeconds).toBeCloseTo(1, 5);
  });

  it('zählt nichts, während die Wiedergabe steht', () => {
    clock.now += 60_000;
    audio.emit('timeupdate');
    expect(ticks).toHaveLength(0);
  });

  it('zählt bei doppelter Geschwindigkeit die Medienzeit, nicht die Wanduhr', () => {
    audio.playbackRate = 2;
    for (let i = 0; i < 4; i++) {
      audio.currentTime += 0.5;
      clock.now += 250;
      audio.emit('timeupdate');
    }
    expect(ticks).toHaveLength(2);
  });
});

describe('ListeningTick-Vertrag', () => {
  it('onTick liefert eine Abmeldefunktion', () => {
    const handler = vi.fn();
    const unsubscribe = ticker.onTick(handler);
    audio.play(1, clock);
    expect(handler).toHaveBeenCalledTimes(1);

    unsubscribe();
    audio.play(1, clock);
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it('stop() meldet den Ticker vom Audio-Element ab', () => {
    ticker.stop();
    audio.play(5, clock);
    expect(ticks).toHaveLength(0);
  });
});
