/**
 * Einstellungen aus 5a (SFR-18, SFR-21, SFR-23).
 *
 * Drei Zeilen, jede aus Bezeichnung, Feld und Erklärung. Float-Betrag und
 * Streaming-Satz müssen vor der ersten Zahlung einmal ausdrücklich bestätigt
 * werden (SNR-06) — deshalb heisst der Knopf beim ersten Mal „bestätigen" und
 * danach „ändern".
 */
import { useState } from 'preact/hooks';
import {
  FLOAT_MAX_SATS,
  FLOAT_MIN_SATS,
  STREAMING_RATE_MAX,
  STREAMING_RATE_MIN,
} from '../config/build-config.js';

export interface SettingsViewProps {
  floatAmount: number;
  floatConfirmed: boolean;
  rate: number;
  rateConfirmed: boolean;
  /** SFR-21: kind:7376 auf die Relays schreiben. Vorgabe aus. */
  historyEvents: boolean;
  onConfirmFloat: (amount: number) => Promise<void>;
  onConfirmRate: (rate: number) => Promise<void>;
  onToggleHistoryEvents: (enabled: boolean) => void;
}

export function SettingsView({
  floatAmount,
  floatConfirmed,
  rate,
  rateConfirmed,
  historyEvents,
  onConfirmFloat,
  onConfirmRate,
  onToggleHistoryEvents,
}: SettingsViewProps) {
  const [float, setFloat] = useState(floatAmount);
  const [satz, setSatz] = useState(rate);

  return (
    <section class="block settings" id="einstellungen">
      <div class="section-head">
        <h3>Einstellungen</h3>
        <span class="right">
          Gilt für dieses Gerät. Vor der ersten Zahlung werden Float-Betrag und Streaming-Satz
          einmal bestätigt.
        </span>
      </div>

      <div class="setting-row">
        <label for="float">Float pro Sitzung in Sat</label>
        <span class="control">
          <input
            id="float"
            class="input"
            name="float"
            type="number"
            min={FLOAT_MIN_SATS}
            max={FLOAT_MAX_SATS}
            value={float}
            onInput={(event) => setFloat(Number((event.target as HTMLInputElement).value))}
          />
          <button type="button" class="btn btn-ghost" onClick={() => void onConfirmFloat(float)}>
            {floatConfirmed ? 'Ändern' : 'Bestätigen'}
          </button>
        </span>
        <span class="explain">
          Bei der Quelle nostr-Wallet wird dieser Betrag einmal je Sitzung entnommen; Streaming und
          Boosts laufen dagegen, der Rest geht am Ende zurück. Das spart Schreibzugriffe auf deine
          Wallet-Events — statt einem pro Minute zwei pro Sitzung.
        </span>
      </div>

      <div class="setting-row">
        <label for="rate">Sat pro Minute</label>
        <span class="control">
          <input
            id="rate"
            class="input"
            name="rate"
            type="number"
            min={STREAMING_RATE_MIN}
            max={STREAMING_RATE_MAX}
            value={satz}
            onInput={(event) => setSatz(Number((event.target as HTMLInputElement).value))}
          />
          <button type="button" class="btn btn-ghost" onClick={() => void onConfirmRate(satz)}>
            {rateConfirmed ? 'Ändern' : 'Bestätigen'}
          </button>
        </span>
        <span class="explain">
          Abgerechnet wird je 60 Sekunden gehörter Zeit; Pause und Sprünge zählen nicht mit. 0
          schaltet Streaming ab.
        </span>
      </div>

      <div class="setting-row last">
        <label for="history-events">Verlauf als kind:7376 schreiben</label>
        <span class="control">
          <label class="radio">
            <input
              id="history-events"
              type="checkbox"
              checked={historyEvents}
              onChange={(event) =>
                onToggleHistoryEvents((event.target as HTMLInputElement).checked)
              }
            />
            <span class="dot" />
            {historyEvents ? 'an' : 'aus'}
          </label>
        </span>
        <span class="explain">
          Aus. Der Verlauf liegt lokal und genügt damit. Eingeschaltet läge jede Zahlung zusätzlich
          verschlüsselt auf deinen Relays — dauerhaft.
        </span>
      </div>
    </section>
  );
}
