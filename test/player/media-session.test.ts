import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  setMediaSessionHandlers,
  updateMediaSession,
} from '../../src/player/media-session.js';

interface FakeSession {
  metadata: unknown;
  playbackState: string;
  setActionHandler: ReturnType<typeof vi.fn>;
  handlers: Map<string, () => void>;
}

function installMediaSession(): FakeSession {
  const handlers = new Map<string, () => void>();
  const session: FakeSession = {
    metadata: null,
    playbackState: 'none',
    handlers,
    setActionHandler: vi.fn((action: string, handler: (() => void) | null) => {
      if (handler) handlers.set(action, handler);
      else handlers.delete(action);
    }),
  };
  Object.defineProperty(navigator, 'mediaSession', { value: session, configurable: true });
  return session;
}

function removeMediaSession(): void {
  Object.defineProperty(navigator, 'mediaSession', { value: undefined, configurable: true });
}

let session: FakeSession;

beforeEach(() => {
  session = installMediaSession();
});

afterEach(() => {
  removeMediaSession();
});

describe('FR-13: Media Session', () => {
  it('US-03-AC-1: meldet Episodentitel, Podcast und Cover an die Systemsteuerung', () => {
    updateMediaSession({
      title: 'Folge 2',
      podcastTitle: 'Testpodcast',
      artworkUrl: 'https://example.com/cover.jpg',
      playbackState: 'playing',
    });

    expect(session.metadata).toMatchObject({ title: 'Folge 2', artist: 'Testpodcast' });
  });

  it('meldet den Wiedergabezustand', () => {
    updateMediaSession({ title: 'F', podcastTitle: 'P', playbackState: 'paused' });
    expect(session.playbackState).toBe('paused');
  });

  it('US-03-AC-3: verbindet die Medientasten mit Play und Pause der App', () => {
    const play = vi.fn();
    const pause = vi.fn();
    setMediaSessionHandlers({ play, pause, seekBackward: vi.fn(), seekForward: vi.fn() });

    session.handlers.get('play')?.();
    session.handlers.get('pause')?.();

    expect(play).toHaveBeenCalledTimes(1);
    expect(pause).toHaveBeenCalledTimes(1);
  });

  it('FR-12: verbindet Vor- und Zurückspringen', () => {
    const seekForward = vi.fn();
    const seekBackward = vi.fn();
    setMediaSessionHandlers({ play: vi.fn(), pause: vi.fn(), seekBackward, seekForward });

    session.handlers.get('seekforward')?.();
    session.handlers.get('seekbackward')?.();

    expect(seekForward).toHaveBeenCalledTimes(1);
    expect(seekBackward).toHaveBeenCalledTimes(1);
  });

  it('bleibt still, wenn der Browser die Media Session API nicht kennt', () => {
    removeMediaSession();
    expect(() => updateMediaSession({ title: 'F', podcastTitle: 'P', playbackState: 'playing' })).not.toThrow();
    expect(() =>
      setMediaSessionHandlers({ play: vi.fn(), pause: vi.fn(), seekBackward: vi.fn(), seekForward: vi.fn() }),
    ).not.toThrow();
  });
});
