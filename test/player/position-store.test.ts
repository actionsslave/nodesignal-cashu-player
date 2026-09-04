import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { closeDatabase } from '../../src/db/database.js';
import {
  PositionPersister,
  loadPosition,
  savePosition,
} from '../../src/player/position-store.js';
import { resetDatabase } from '../helpers/db.js';
import { FakeAudio } from '../helpers/audio.js';

beforeEach(async () => {
  await resetDatabase();
});

afterEach(async () => {
  await closeDatabase();
});

describe('FR-14: Hörposition merken', () => {
  it('US-03-AC-2: liefert die gespeicherte Position beim erneuten Öffnen zurück', async () => {
    await savePosition('episode-1', 750);
    expect(await loadPosition('episode-1')).toBe(750);
  });

  it('kennt für eine unbekannte Episode keine Position', async () => {
    expect(await loadPosition('nie-gehoert')).toBeUndefined();
  });

  it('überschreibt die Position derselben Episode', async () => {
    await savePosition('episode-1', 10);
    await savePosition('episode-1', 20);
    expect(await loadPosition('episode-1')).toBe(20);
  });

  it('hält die Positionen verschiedener Episoden auseinander', async () => {
    await savePosition('episode-1', 10);
    await savePosition('episode-2', 20);
    expect(await loadPosition('episode-1')).toBe(10);
  });
});

describe('FR-14: Persistieren während der Wiedergabe', () => {
  it('schreibt spätestens nach 10 s gehörter Zeit', async () => {
    const audio = new FakeAudio();
    const clock = { now: 1_000_000 };
    const persister = new PositionPersister({
      audio,
      episodeId: 'episode-1',
      now: () => clock.now,
    });

    audio.play(9, clock, 1);
    await Promise.resolve();
    expect(await loadPosition('episode-1')).toBeUndefined();

    audio.play(2, clock, 1);
    await new Promise((resolve) => setTimeout(resolve, 0));
    // Geschrieben wird beim ersten timeupdate nach 10 s, also bei Sekunde 10.
    expect(await loadPosition('episode-1')).toBeCloseTo(10, 5);

    persister.stop();
  });

  it('schreibt nicht bei jedem timeupdate', async () => {
    const audio = new FakeAudio();
    const clock = { now: 1_000_000 };
    const persister = new PositionPersister({
      audio,
      episodeId: 'episode-1',
      now: () => clock.now,
    });

    audio.play(5, clock, 0.25);
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(await loadPosition('episode-1')).toBeUndefined();

    persister.stop();
  });

  it('flush() schreibt die aktuelle Position sofort — etwa beim Pausieren', async () => {
    const audio = new FakeAudio();
    const clock = { now: 1_000_000 };
    const persister = new PositionPersister({
      audio,
      episodeId: 'episode-1',
      now: () => clock.now,
    });

    audio.play(3, clock, 1);
    await persister.flush();

    expect(await loadPosition('episode-1')).toBeCloseTo(3, 5);
    persister.stop();
  });

  it('schreibt nach stop() nicht mehr', async () => {
    const audio = new FakeAudio();
    const clock = { now: 1_000_000 };
    const persister = new PositionPersister({
      audio,
      episodeId: 'episode-1',
      now: () => clock.now,
    });

    persister.stop();
    audio.play(30, clock, 1);
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(await loadPosition('episode-1')).toBeUndefined();
  });
});
