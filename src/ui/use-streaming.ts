/**
 * SFR-23: Der Streaming-Zähler, an die Oberfläche gehängt.
 *
 * Der Controller muss eine Sitzung lang stehen bleiben — er zählt die gehörten
 * Sekunden, und die sind sein ganzer Zustand. Genau das ging schief: Er hing an
 * einem Effekt, dessen Abhängigkeiten die Hörposition einschlossen. Bei jedem
 * `timeupdate`, also viermal je Sekunde, entstand ein frischer Controller mit
 * null gehörten Sekunden. Die sechzig kamen nie zusammen, im Verlauf stand
 * nichts, und nichts deutete auf einen Fehler hin.
 *
 * Deshalb hier die Trennung: Der Controller wird nur neu gebaut, wenn sich
 * Satz, Bestätigung oder Quelle ändern. Die Callbacks laufen über Refs — sie
 * dürfen sich bei jedem Render ändern, ohne den Zähler zurückzusetzen.
 */
import { useCallback, useEffect, useRef } from 'preact/hooks';
import type { ListeningTick } from '../contracts/index.js';
import { StreamingController, type SendOutcome } from '../payments/streaming.js';
import type { SourceId } from '../payments/source.js';

export interface UseStreamingOptions {
  /** Sat pro Minute; 0 schaltet Streaming ab (SFR-23). */
  rate: number;
  /** SNR-06: ohne Bestätigung des Satzes wird nichts abgebucht. */
  confirmed: boolean;
  source?: SourceId;
  send: (amount: number) => Promise<SendOutcome>;
  balance: () => Promise<number>;
  /** SFR-27: die Untergrenze ist erreicht, das Streaming steht. */
  onStopped: (stopped: boolean) => void;
}

export interface StreamingHandle {
  onTick: (tick: ListeningTick) => void;
  /** SFR-27: Nach einer gelungenen Aufladung geht es an derselben Stelle weiter. */
  resume: () => void;
}

export function useStreamingController(options: UseStreamingOptions): StreamingHandle {
  const { rate, confirmed, source } = options;

  const aktuell = useRef(options);
  aktuell.current = options;

  const controller = useRef<StreamingController | undefined>(undefined);

  useEffect(() => {
    if (rate <= 0 || !confirmed || !source) {
      controller.current = undefined;
      return;
    }
    controller.current = new StreamingController({
      rate,
      send: (amount) => aktuell.current.send(amount),
      balance: () => aktuell.current.balance(),
      onUpdate: (state) => aktuell.current.onStopped(state.stopped),
    });
  }, [rate, confirmed, source]);

  const onTick = useCallback((tick: ListeningTick) => {
    void controller.current?.handleTick(tick);
  }, []);

  const resume = useCallback(() => controller.current?.resume(), []);

  return { onTick, resume };
}
