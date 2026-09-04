/**
 * „Aktuelle Folge" aus Entwurf 5a und der Sticky-Streifen (SFR-07, SFR-23).
 *
 * Das Audio-Element hängt an dieser Komponente; die gehörte Zeit kommt als
 * ListeningTick nach oben, daran hängen die Streaming-Zahlungen. Der Streifen
 * gehört mit in diese Datei, weil er denselben Zustand zeigt — eine zweite
 * Komponente müsste ihn sich reichen lassen.
 *
 * Nur −15/+30, keine Titelsprünge: eine Sendung, eine Warteschlange.
 */
import { useEffect, useRef, useState } from 'preact/hooks';
import type { EpisodeRecord } from '../db/database.js';
import type { ListeningTick } from '../contracts/index.js';
import { ListeningTicker } from '../player/listening-ticker.js';
import { PositionPersister, loadPosition } from '../player/position-store.js';
import { setMediaSessionHandlers, updateMediaSession } from '../player/media-session.js';
import { PLAYBACK_RATES, PLAYBACK_RATE_DEFAULT } from '../config/build-config.js';
import { Icon } from './icons.js';

const SKIP_FORWARD_SECONDS = 30;
const SKIP_BACKWARD_SECONDS = 15;

export function formatClock(seconds: number): string {
  const total = Math.max(0, Math.floor(seconds));
  const pad = (value: number) => String(value).padStart(2, '0');
  const hours = Math.floor(total / 3600);
  const rest = `${pad(Math.floor((total % 3600) / 60))}:${pad(total % 60)}`;
  return hours > 0 ? `${hours}:${rest}` : rest;
}

/**
 * Der Feed nummeriert die Folgen im Titel („E289"), nicht in einem eigenen
 * Feld. Findet sich keine Nummer, entfällt die Angabe im Kicker.
 */
export function episodeNumber(title: string): string | undefined {
  return /\bE(\d{1,4})\b/.exec(title)?.[1];
}

export interface PlayerProps {
  episode?: EpisodeRecord;
  podcastTitle?: string;
  artworkUrl?: string;
  onTick?: (tick: ListeningTick) => void;
  onPositionChange?: (seconds: number) => void;
  /** SFR-20: die drei Zahlen der Sitzungszeile. */
  sessionSent: number;
  floatRemaining?: number;
  /** SFR-23: der Streaming-Satz, wie er im Ableser steht. */
  rate: number;
  /** Woraus gezahlt wird — „aus dem Float" oder „aus der lokalen Wallet". */
  sourceNote: string;
  /** SOQ-03: seit der Entnahme kein Wallet-Event gesehen. */
  floatNote?: string;
  onWriteBackFloat?: () => void;
  onBoost?: () => void;
  canBoost?: boolean;
}

export function Player({
  episode,
  podcastTitle = '',
  artworkUrl,
  onTick,
  onPositionChange,
  sessionSent,
  floatRemaining,
  rate,
  sourceNote,
  floatNote,
  onWriteBackFloat,
  onBoost,
  canBoost,
}: PlayerProps) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [playing, setPlaying] = useState(false);
  const [position, setPosition] = useState(0);
  const [rateFactor, setRateFactor] = useState(PLAYBACK_RATE_DEFAULT);
  // Der Nodesignal-Feed nennt keine Dauer; sie kommt aus den Metadaten der Datei.
  const [duration, setDuration] = useState(0);

  const episodeId = episode?.id;

  function reportPosition(seconds: number): void {
    setPosition(seconds);
    onPositionChange?.(seconds);
  }

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !episode) return;

    let cancelled = false;
    setDuration(episode.durationSeconds ?? 0);
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
    if (audio) audio.playbackRate = rateFactor;
  }, [rateFactor, episodeId]);

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

  /** Klick auf den Balken: Anteil der Breite mal Dauer. */
  function scrubFromClick(event: MouseEvent): void {
    if (duration <= 0) return;
    const box = (event.currentTarget as HTMLElement).getBoundingClientRect();
    scrubTo(Math.max(0, Math.min(1, (event.clientX - box.left) / box.width)) * duration);
  }

  if (!episode) {
    return (
      <section class="block first" id="aktuell">
        <span class="kicker">Nichts in der Wiedergabe</span>
        <h2 style={{ fontSize: '30px', marginTop: '4px' }}>
          Wähl eine Folge, um zu hören.
        </h2>
      </section>
    );
  }

  const anteil = duration > 0 ? Math.min(1, position / duration) : 0;
  const nummer = episodeNumber(episode.title);
  const datum = new Date(episode.publishedAt).toLocaleDateString('de-DE', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  const bar = (
    <div class="bar" onClick={scrubFromClick} role="presentation">
      <div class="fill" style={{ width: `${anteil * 100}%` }} />
      <div class="knob" style={{ left: `${anteil * 100}%` }} />
    </div>
  );

  return (
    <>
      <section class="block first" id="aktuell">
        <div class="now">
          {artworkUrl ? (
            <img class="cover halftone" src={artworkUrl} alt="" width={168} height={168} />
          ) : (
            <span class="cover art-placeholder">Cover</span>
          )}

          <div class="centre">
            <span class="kicker kicker-12">
              {playing ? 'Läuft' : 'Pausiert'}
              {nummer ? ` · Folge ${nummer}` : ''} · {datum}
            </span>
            <h2>{episode.title}</h2>

            <audio
              ref={audioRef}
              src={episode.enclosureUrl}
              preload="metadata"
              onLoadedMetadata={(event) => {
                const wert = (event.currentTarget as HTMLAudioElement).duration;
                if (Number.isFinite(wert)) setDuration(wert);
              }}
              onTimeUpdate={(event) =>
                reportPosition((event.currentTarget as HTMLAudioElement).currentTime)
              }
              onPlay={() => setPlaying(true)}
              onPause={() => setPlaying(false)}
            />

            <div class="scrubber">
              <span class="time">{formatClock(position)}</span>
              {bar}
              <span class="time">
                {duration > 0 ? `−${formatClock(duration - position)}` : '—'}
              </span>
            </div>

            <div class="transport">
              <button
                type="button"
                class="btn btn-ghost"
                aria-label="15 Sekunden zurück"
                onClick={() => skip(-SKIP_BACKWARD_SECONDS)}
              >
                <Icon name="arrow-counter-clockwise" size={21} />
              </button>
              <button
                type="button"
                class="btn btn-ghost"
                style={{ color: 'var(--color-accent-700)', padding: 0 }}
                aria-label={playing ? 'Pause' : 'Abspielen'}
                onClick={() => (playing ? halt() : void start())}
              >
                <Icon name={playing ? 'pause-circle' : 'play'} size={52} />
              </button>
              <button
                type="button"
                class="btn btn-ghost"
                aria-label="30 Sekunden vor"
                onClick={() => skip(SKIP_FORWARD_SECONDS)}
              >
                <Icon name="arrow-clockwise" size={21} />
              </button>
              <span style={{ width: '8px' }} />
              <button
                type="button"
                class="btn btn-primary"
                style={{ padding: '9px 20px', fontSize: '15px' }}
                disabled={!canBoost}
                onClick={onBoost}
              >
                <Icon name="lightning" size={15} /> Boost
              </button>
              <span class="readout">
                Streaming {rate} Sat/Min · {sourceNote}
              </span>
              <select
                class="input"
                style={{ width: 'auto', marginLeft: 'auto' }}
                name="playback-rate"
                aria-label="Abspielgeschwindigkeit"
                value={String(rateFactor)}
                onChange={(event) =>
                  setRateFactor(Number((event.target as HTMLSelectElement).value))
                }
              >
                {PLAYBACK_RATES.map((option) => (
                  <option key={option} value={String(option)}>
                    {String(option).replace('.', ',')}×
                  </option>
                ))}
              </select>
            </div>

            <div class="session-line">
              <span>
                In dieser Sitzung gesendet <strong>{sessionSent.toLocaleString('de-DE')} Sat</strong>
              </span>
              {floatRemaining !== undefined && (
                <span class="muted">Float {floatRemaining.toLocaleString('de-DE')} Sat</span>
              )}
              {floatNote && <span class="muted">{floatNote}</span>}
              {onWriteBackFloat && (
                <button type="button" class="btn btn-ghost right" onClick={onWriteBackFloat}>
                  Float jetzt zurückschreiben
                </button>
              )}
            </div>
          </div>
        </div>
      </section>

      <div class="strip">
        <button
          type="button"
          class="btn btn-ghost"
          style={{ color: 'var(--color-accent-700)', padding: 0 }}
          aria-label={playing ? 'Pause' : 'Abspielen'}
          onClick={() => (playing ? halt() : void start())}
        >
          <Icon name={playing ? 'pause-circle' : 'play'} size={34} />
        </button>
        <div class="now-block">
          <p class="ep">{episode.title}</p>
          <span class="time">
            {formatClock(position)}
            {duration > 0 ? ` · −${formatClock(duration - position)}` : ''}
          </span>
        </div>
        {bar}
        <span class="readout">
          Streaming {rate} Sat/Min · Sitzung {sessionSent.toLocaleString('de-DE')} Sat
        </span>
        <button type="button" class="btn btn-primary" disabled={!canBoost} onClick={onBoost}>
          <Icon name="lightning" size={15} /> Boost
        </button>
      </div>
    </>
  );
}
