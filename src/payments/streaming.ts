/**
 * FR-24, FR-25, FR-20, FR-30: Aus gehörter Zeit werden Nutzaps.
 *
 * Der Controller kennt keine Uhr. Er verarbeitet ListeningTicks, die der Player
 * aus `currentTime` ableitet — Pause und Seek erzeugen keine Ticks und
 * akkumulieren deshalb auch nichts (Kapitel 5.6).
 *
 * Gerechnet wird immer aus der Summe der gehörten Sekunden, nicht durch
 * Aufsummieren von Sat-Bruchteilen. Sonst schleicht sich Fließkomma-Drift ein
 * und aus 60 Sekunden zu 10 Sat/Minute werden 9 Sat.
 */
import { MIN_BALANCE_SATS, STREAMING_INTERVAL_SECONDS } from '../config/build-config.js';
import type { ListeningTick } from '../contracts/index.js';

export type SendOutcome = 'gesendet' | 'ausstehend';

export interface StreamingState {
  /** In dieser Sitzung gesendete Sat (FR-30). */
  sentSats: number;
  /** Anzahl der Nutzaps dieser Sitzung (FR-30). Ausstehende zaehlen mit —
   *  ihre Proofs sind beim Mint bereits gelockt. */
  sentZaps: number;
  /** Noch nicht gesendeter Rest in Sat, inklusive Bruchteilen (FR-25). */
  pendingSats: number;
  /** Insgesamt gehörte Sekunden dieser Sitzung. */
  totalListenedSeconds: number;
  stopped: boolean;
  reason?: string;
}

export interface StreamingControllerOptions {
  /** Sat pro Minute; 0 schaltet Streaming ab (FR-26). */
  rate: number;
  send: (amount: number) => Promise<SendOutcome>;
  balance: () => Promise<number>;
  onUpdate?: (state: StreamingState) => void;
  intervalSeconds?: number;
  minBalance?: number;
}

export class StreamingController {
  private readonly options: StreamingControllerOptions;
  private readonly intervalSeconds: number;
  private readonly minBalance: number;

  private totalListenedSeconds = 0;
  private secondsSinceFlush = 0;
  private sentSats = 0;
  private sentZaps = 0;
  private stopped = false;
  private reason: string | undefined;

  constructor(options: StreamingControllerOptions) {
    this.options = options;
    this.intervalSeconds = options.intervalSeconds ?? STREAMING_INTERVAL_SECONDS;
    this.minBalance = options.minBalance ?? MIN_BALANCE_SATS;
  }

  /** Was die gehörte Zeit insgesamt wert ist, abzüglich des schon Gesendeten. */
  private get pendingSats(): number {
    return (this.totalListenedSeconds * this.options.rate) / 60 - this.sentSats;
  }

  get state(): StreamingState {
    return {
      sentSats: this.sentSats,
      sentZaps: this.sentZaps,
      pendingSats: this.pendingSats,
      totalListenedSeconds: this.totalListenedSeconds,
      stopped: this.stopped,
      reason: this.reason,
    };
  }

  /** FR-20: nach erfolgreicher Aufladung geht es weiter. */
  resume(): void {
    this.stopped = false;
    this.reason = undefined;
    this.options.onUpdate?.(this.state);
  }

  async handleTick(tick: ListeningTick): Promise<void> {
    if (this.stopped || this.options.rate <= 0) return;

    this.totalListenedSeconds += tick.listenedSeconds;
    this.secondsSinceFlush += tick.listenedSeconds;
    this.options.onUpdate?.(this.state);

    if (this.secondsSinceFlush + 1e-9 < this.intervalSeconds) return;
    await this.flush();
  }

  /** Sendet den aufgelaufenen Betrag, sofern er mindestens 1 Sat ergibt. */
  async flush(): Promise<void> {
    this.secondsSinceFlush = 0;

    const payable = Math.floor(this.pendingSats + 1e-9);
    // FR-25: weniger als 1 Sat bleibt stehen und geht im nächsten Intervall mit.
    if (payable < 1) return;

    // FR-20: unter der Untergrenze wird nichts mehr gesendet.
    if ((await this.options.balance()) < this.minBalance) {
      this.stopped = true;
      this.reason = 'Guthaben zu niedrig — in der Wallet aufladen';
      this.options.onUpdate?.(this.state);
      return;
    }

    try {
      const outcome = await this.options.send(payable);
      // 'ausstehend' heißt: die Proofs sind beim Mint schon gelockt. Der Betrag
      // darf nicht zurück in den Rest, sonst ginge er ein zweites Mal raus.
      this.sentSats += payable;
      this.sentZaps += 1;
      this.reason = outcome === 'ausstehend' ? 'Noch kein Relay hat bestätigt.' : undefined;
    } catch (error) {
      // US-05-AC-5: nichts abgebucht, der Betrag bleibt als Rest stehen und
      // wird im nächsten Intervall mitgesendet — nie mehr als die gehörte Zeit.
      this.reason = error instanceof Error ? error.message : String(error);
    }
    this.options.onUpdate?.(this.state);
  }
}
