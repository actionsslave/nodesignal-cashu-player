/**
 * SFR-07: Play, Pause, +30 s, −15 s, Scrubbing, Hörposition je Episode.
 *
 * Das Audio-Element hängt an dieser Komponente; die gehörte Zeit kommt als
 * ListeningTick nach oben, daran hängen die Streaming-Zahlungen.
 */
import { useEffect, useRef, useState } from 'preact/hooks';
import type { EpisodeRecord } from '../db/database.js';
import type { ListeningTick } from '../contracts/index.js';
import { ListeningTicker } from '../player/listening-ticker.js';
import { PositionPersister, loadPosition } from '../player/position-store.js';
import { setMediaSessionHandlers, updateMediaSession } from '../player/media-session.js';
import { PLAYBACK_RATES, PLAYBACK_RATE_DEFAULT } from '../config/build-config.js';

const SKIP_FORWARD_SECONDS = 30;
const SKIP_BACKWARD_SECONDS = 15;

export function formatClock(seconds: number): string {
  const total = Math.max(0, Math.floor(seconds));
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${pad(Math.floor(total / 3600))}:${pad(Math.floor((total % 3600) / 60))}:${pad(total % 60)}`;
}

export interface PlayerProps {
  episode?: EpisodeRecord;
  podcastTitle?: string;
  artworkUrl?: string;
  onTick?: (tick: ListeningTick) => void;
  onPositionChange?: (seconds: number) => void;
}

export function Player({ episode, podcastTitle = '', artworkUrl, onTick, onPositionChange }: PlayerProps) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [playing, setPlaying] = useState(false);
  const [position, setPosition] = useState(0);
  const [rate, setRate] = useState(PLAYBACK_RATE_DEFAULT);

  const episodeId = episode?.id;
  const duration = episode?.durationSeconds ?? 0;

  function reportPosition(seconds: number): void {
    setPosition(seconds);
    onPositionChange?.(seconds);
  }

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !episode) return;

    let cancelled = false;
    void loadPosition(episode.id).then((saved) => {
      if (cancelled || saved === undefined) return;
      audio.currentTime = saved;
      setPosition(saved);
    });

    const ticker = new ListeningTicker({ audio, feedId: episode.feedId, episodeId: episode.id });
    const unsubscribe = onTick ? ticker.onTick(onTick) : undefined;
    const persister = new PositionPersister({ audio, episodeId: episode.id });

    return () => {
      cancelled = true;
      unsubscribe?.();
      void persister.flush().finally(() => persister.stop());
      ticker.stop();
    };
  }, [episodeId, episode, onTick]);

  useEffect(() => {
    const audio = audioRef.current;
    if (audio) audio.playbackRate = rate;
  }, [rate, episodeId]);

  useEffect(() => {
    if (!episode) return;
    updateMediaSession({
      title: episode.title,
      podcastTitle,
      artworkUrl,
      playbackState: playing ? 'playing' : 'paused',
    });
    setMediaSessionHandlers({
      play: () => void start(),
      pause: () => halt(),
      seekBackward: () => skip(-SKIP_BACKWARD_SECONDS),
      seekForward: () => skip(SKIP_FORWARD_SECONDS),
    });
  }, [episode, podcastTitle, artworkUrl, playing]);

  async function start(): Promise<void> {
    const audio = audioRef.current;
    if (!audio) return;
    setPlaying(true);
    await Promise.resolve(audio.play()).catch(() => setPlaying(false));
  }

  function halt(): void {
    audioRef.current?.pause();
    setPlaying(false);
  }

  function skip(seconds: number): void {
    const audio = audioRef.current;
    if (!audio) return;
    const next = Math.max(0, audio.currentTime + seconds);
    audio.currentTime = duration > 0 ? Math.min(next, duration) : next;
    reportPosition(audio.currentTime);
  }

  function scrubTo(seconds: number): void {
    const audio = audioRef.current;
    if (!audio) return;
    audio.currentTime = seconds;
    reportPosition(seconds);
  }

  if (!episode) return <p class="player-empty">Keine Episode ausgewählt.</p>;

  return (
    <section class="player">
      <h3>{episode.title}</h3>
      <audio
        ref={audioRef}
        src={episode.enclosureUrl}
        preload="metadata"
        onTimeUpdate={(event) => reportPosition((event.currentTarget as HTMLAudioElement).currentTime)}
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
      />
      <div class="transport">
        <button type="button" onClick={() => skip(-SKIP_BACKWARD_SECONDS)}>
          −15 s
        </button>
        {playing ? (
          <button type="button" onClick={() => halt()}>
            Pause
          </button>
        ) : (
          <button type="button" onClick={() => void start()}>
            Abspielen
          </button>
        )}
        <button type="button" onClick={() => skip(SKIP_FORWARD_SECONDS)}>
          +30 s
        </button>
        <select
          name="playback-rate"
          aria-label="Abspielgeschwindigkeit"
          value={String(rate)}
          onChange={(event) => setRate(Number((event.target as HTMLSelectElement).value))}
        >
          {PLAYBACK_RATES.map((option) => (
            <option key={option} value={String(option)}>
              {String(option).replace('.', ',')}×
            </option>
          ))}
        </select>
        <span class="time">
          {formatClock(position)}
          {duration > 0 ? ` / ${formatClock(duration)}` : ''}
        </span>
      </div>
      <input
        type="range"
        class="progress"
        min={0}
        max={duration}
        step={1}
        value={position}
        aria-label="Fortschritt"
        onInput={(event) => scrubTo(Number((event.target as HTMLInputElement).value))}
      />
    </section>
  );
}
