/**
 * FR-13: Titel, Cover und Wiedergabezustand an die Systemsteuerung melden und
 * die Medientasten der Tastatur mit der App verbinden.
 */

export interface MediaSessionInfo {
  title: string;
  podcastTitle: string;
  artworkUrl?: string;
  playbackState: 'playing' | 'paused' | 'none';
}

export interface MediaSessionHandlers {
  play: () => void;
  pause: () => void;
  seekBackward: () => void;
  seekForward: () => void;
}

function session(): MediaSession | undefined {
  return typeof navigator === 'undefined' ? undefined : navigator.mediaSession;
}

export function updateMediaSession(info: MediaSessionInfo): void {
  const current = session();
  if (!current) return;

  if (typeof MediaMetadata === 'function') {
    current.metadata = new MediaMetadata({
      title: info.title,
      artist: info.podcastTitle,
      artwork: info.artworkUrl ? [{ src: info.artworkUrl }] : [],
    });
  } else {
    // jsdom und ältere Browser kennen MediaMetadata nicht; die Felder reichen.
    current.metadata = { title: info.title, artist: info.podcastTitle } as MediaMetadata;
  }
  current.playbackState = info.playbackState;
}

export function setMediaSessionHandlers(handlers: MediaSessionHandlers): void {
  const current = session();
  if (!current) return;

  current.setActionHandler('play', handlers.play);
  current.setActionHandler('pause', handlers.pause);
  current.setActionHandler('seekbackward', handlers.seekBackward);
  current.setActionHandler('seekforward', handlers.seekForward);
}
