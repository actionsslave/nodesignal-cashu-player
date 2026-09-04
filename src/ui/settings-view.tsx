/**
 * SFR-18, SNR-06: Float-Betrag und Streaming-Satz — beide müssen vor der
 * ersten Zahlung einmal ausdrücklich bestätigt werden.
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
  onConfirmFloat: (amount: number) => Promise<void>;
  onConfirmRate: (rate: number) => Promise<void>;
}

export function SettingsView({
  floatAmount,
  floatConfirmed,
  rate,
  rateConfirmed,
  onConfirmFloat,
  onConfirmRate,
}: SettingsViewProps) {
  const [float, setFloat] = useState(floatAmount);
  const [satz, setSatz] = useState(rate);

  return (
    <section class="block settings" id="einstellungen">
      <h2>Einstellungen</h2>

      <div class="field">
        <label for="float">Float pro Sitzung in Sat</label>
        <input
          id="float"
          name="float"
          type="number"
          min={FLOAT_MIN_SATS}
          max={FLOAT_MAX_SATS}
          value={float}
          onInput={(event) => setFloat(Number((event.target as HTMLInputElement).value))}
        />
        <p class="hint">
          Bei der Quelle nostr-Wallet wird dieser Betrag einmal je Sitzung entnommen; Streaming und
          Boosts laufen dagegen, der Rest geht am Ende zurück. Das spart Schreibzugriffe auf deine
          Wallet-Events — statt einem pro Minute zwei pro Sitzung.
        </p>
        <button type="button" onClick={() => void onConfirmFloat(float)}>
          {floatConfirmed ? 'Float ändern' : 'Float bestätigen'}
        </button>
      </div>

      <div class="field">
        <label for="rate">Sat pro Minute</label>
        <input
          id="rate"
          name="rate"
          type="number"
          min={STREAMING_RATE_MIN}
          max={STREAMING_RATE_MAX}
          value={satz}
          onInput={(event) => setSatz(Number((event.target as HTMLInputElement).value))}
        />
        <p class="hint">0 schaltet Streaming ab.</p>
        <button type="button" onClick={() => void onConfirmRate(satz)}>
          {rateConfirmed ? 'Satz ändern' : 'Satz bestätigen'}
        </button>
      </div>

      <p class="hint">
        Wenn ein Relay ein kind:7375-Event verliert, sind die zugehörigen Proofs für Clients nicht
        mehr auffindbar. Das ist eine Eigenschaft von NIP-60, keine dieser App — aber du solltest es
        wissen, bevor du zum ersten Mal einen Float entnimmst.
      </p>
    </section>
  );
}
