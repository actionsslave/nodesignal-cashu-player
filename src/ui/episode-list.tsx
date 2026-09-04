/**
 * SFR-06: die 20 neuesten Episoden mit Titel, Datum, Dauer und Beschreibung,
 * absteigend nach Datum.
 *
 * Schmucklos: Das Design-Handoff stand beim Bauen nicht zur Verfügung. Die
 * Struktur folgt der Spezifikation, die Gestaltung kommt nach.
 */
import type { EpisodeRecord } from '../db/database.js';
import { formatRemaining, isPlayed, remainingSeconds } from '../player/progress.js';

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

export function formatDuration(seconds: number | undefined): string {
  if (!seconds) return '';
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const pad = (value: number) => String(value).padStart(2, '0');
  return hours > 0 ? `${hours}:${pad(minutes)}:${pad(seconds % 60)}` : `${minutes}:${pad(seconds % 60)}`;
}

export interface EpisodeListProps {
  episodes: EpisodeRecord[];
  positions: Map<string, number>;
  playingId?: string;
  onPlay: (episode: EpisodeRecord) => void;
}

export function EpisodeList({ episodes, positions, playingId, onPlay }: EpisodeListProps) {
  return (
    <ul class="episodes">
      {episodes.map((episode) => {
        const position = positions.get(episode.id);
        const played = isPlayed(episode.durationSeconds, position);
        const rest = remainingSeconds(episode.durationSeconds, position);
        return (
          <li key={episode.id} class={episode.id === playingId ? 'episode playing' : 'episode'}>
            <button type="button" class="episode-title" onClick={() => onPlay(episode)}>
              {episode.title}
            </button>
            <p class="episode-meta">
              {new Date(episode.publishedAt).toLocaleDateString('de-DE')}
              {episode.durationSeconds ? ` · ${formatDuration(episode.durationSeconds)}` : ''}
              {played ? ' · gehört' : rest !== undefined && position ? ` · ${formatRemaining(rest)}` : ''}
            </p>
            <p class="episode-description">{plainText(episode.description)}</p>
          </li>
        );
      })}
    </ul>
  );
}
