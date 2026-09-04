/**
 * Abschnitt „Folgen" aus Entwurf 5a (SFR-06).
 *
 * Ein Podcast, eine Liste. Kein Show-Kicker über dem Titel — die Folge gehört
 * ohnehin zu diesem einen Podcast; der Kicker trägt stattdessen Datum, Dauer
 * und Zustand.
 */
import { EPISODES_VISIBLE } from '../config/build-config.js';
import type { EpisodeRecord } from '../db/database.js';
import { isPlayed, remainingSeconds } from '../player/progress.js';
import { Icon } from './icons.js';

/** Feed-Beschreibungen tragen rohes HTML; für eine Zeile reicht der Text. */
export function plainText(html: string): string {
  return html
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, ' ')
    .trim();
}

const datum = (ms: number) =>
  new Date(ms).toLocaleDateString('de-DE', { day: 'numeric', month: 'long', year: 'numeric' });

export function formatMinutes(seconds: number | undefined): string {
  if (!seconds) return '';
  return `${Math.round(seconds / 60)} min`;
}

/** hh:mm:ss ohne führende Stunde, wie „Fortsetzen bei 12:38". */
export function formatPosition(seconds: number): string {
  const total = Math.max(0, Math.floor(seconds));
  const pad = (value: number) => String(value).padStart(2, '0');
  const hours = Math.floor(total / 3600);
  const rest = `${pad(Math.floor((total % 3600) / 60))}:${pad(total % 60)}`;
  return hours > 0 ? `${hours}:${rest}` : rest;
}

/** Rechte Spalte der Zeile: Fortsetzen, Restdauer oder Gehört. */
export function rowStatus(
  episode: EpisodeRecord,
  position: number | undefined,
): string {
  if (isPlayed(episode.durationSeconds, position)) return 'Gehört';
  if (position !== undefined && position > 0) return `Fortsetzen bei ${formatPosition(position)}`;
  const rest = remainingSeconds(episode.durationSeconds, 0);
  return rest !== undefined ? formatMinutes(rest) : '';
}

export interface EpisodeListProps {
  episodes: EpisodeRecord[];
  positions: Map<string, number>;
  playingId?: string;
  onPlay: (episode: EpisodeRecord) => void;
}

/** Die Liste beginnt kurz; „Ältere Folgen anzeigen" klappt auf die 20 auf. */
const ANFANGS_SICHTBAR = 6;

export function EpisodeList({ episodes, positions, playingId, onPlay }: EpisodeListProps) {
  const alle = episodes.length <= ANFANGS_SICHTBAR;

  return (
    <section class="block" id="folgen">
      <div class="section-head">
        <h3>Folgen</h3>
        <span class="right">Die {EPISODES_VISIBLE} neuesten · absteigend nach Datum</span>
      </div>

      {episodes.slice(0, alle ? episodes.length : ANFANGS_SICHTBAR).map((episode) => {
        const position = positions.get(episode.id);
        const played = isPlayed(episode.durationSeconds, position);
        return (
          <div class="episode-row" key={episode.id}>
            <div>
              <span class="kicker">
                {datum(episode.publishedAt)}
                {episode.durationSeconds ? ` · ${formatMinutes(episode.durationSeconds)}` : ''}
                {episode.id === playingId ? ' · läuft' : ''}
              </span>
              <button type="button" class="title" onClick={() => onPlay(episode)}>
                {episode.title}
              </button>
              <p class="desc">{plainText(episode.description)}</p>
            </div>
            <span class="right">{rowStatus(episode, position)}</span>
            <button
              type="button"
              class={played ? 'btn btn-icon btn-ghost' : 'btn btn-icon btn-secondary'}
              aria-label={`${episode.title} abspielen`}
              onClick={() => onPlay(episode)}
            >
              <Icon name="play" size={17} />
            </button>
          </div>
        );
      })}
    </section>
  );
}
