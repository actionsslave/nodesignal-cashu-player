import { describe, expect, it, vi } from 'vitest';
import type { ListeningTick } from '../../src/contracts/index.js';
import { StreamingController, type StreamingState } from '../../src/payments/streaming.js';

function tick(listenedSeconds: number, positionSeconds = 0): ListeningTick {
  return { feedId: 'f', episodeId: 'e', listenedSeconds, positionSeconds, at: 0 };
}

type Send = ReturnType<typeof vi.fn<(amount: number) => Promise<'gesendet' | 'ausstehend'>>>;

interface Overrides {
  rate?: number;
  send?: Send;
  balance?: () => Promise<number>;
  onUpdate?: (state: StreamingState) => void;
  intervalSeconds?: number;
}

function controller(overrides: Overrides = {}) {
  const send: Send = overrides.send ?? vi.fn(async () => 'gesendet' as const);
  const instance = new StreamingController({
    rate: overrides.rate ?? 10,
    balance: overrides.balance ?? (async () => 1000),
    intervalSeconds: overrides.intervalSeconds,
    onUpdate: overrides.onUpdate,
    send,
  });
  return { instance, send };
}

async function listen(instance: StreamingController, seconds: number, step = 1): Promise<void> {
  for (let played = 0; played < seconds - 1e-9; played += step) {
    await instance.handleTick(tick(step, played + step));
  }
}

describe('FR-24, FR-25: Intervall-Zahlung', () => {
  it('US-05-AC-1: sendet nach 60 s gehörter Zeit den Minutenbetrag', async () => {
    const { instance, send } = controller();
    await listen(instance, 60);

    expect(send).toHaveBeenCalledTimes(1);
    expect(send.mock.calls[0][0]).toBe(10);
  });

  it('US-05-AC-1: zählt den gesendeten Betrag für die Sitzung mit', async () => {
    const { instance } = controller();
    await listen(instance, 120);
    expect(instance.state.sentSats).toBe(20);
  });

  it('US-05-AC-2: sendet nach 30 s nichts und hält 5 Sat als offenen Rest', async () => {
    const { instance, send } = controller();
    await listen(instance, 30);

    expect(send).not.toHaveBeenCalled();
    expect(instance.state.pendingSats).toBeCloseTo(5, 5);
  });

  it('FR-25: bleibt der Betrag unter 1 Sat, bleibt der Rest stehen', async () => {
    const { instance, send } = controller({ rate: 3, intervalSeconds: 10 });
    await listen(instance, 10);

    // 3 Sat/Minute über 10 s sind 0,5 Sat — zu wenig für einen Nutzap.
    expect(send).not.toHaveBeenCalled();
    expect(instance.state.pendingSats).toBeCloseTo(0.5, 5);
  });

  it('FR-25: der Rest wird im nächsten Intervall mitgesendet', async () => {
    const { instance, send } = controller({ rate: 3, intervalSeconds: 10 });

    await listen(instance, 10);
    expect(send).not.toHaveBeenCalled();

    // Zweites Intervall: 0,5 Sat von vorhin plus 0,5 Sat ergeben genau 1 Sat.
    await listen(instance, 10);
    expect(send).toHaveBeenCalledTimes(1);
    expect(send.mock.calls[0][0]).toBe(1);
  });

  it('sendet nur ganze Sat und behält den Bruchteil', async () => {
    const { instance, send } = controller({ rate: 7, intervalSeconds: 10 });
    await listen(instance, 10);

    expect(send.mock.calls[0][0]).toBe(1);
    expect(instance.state.pendingSats).toBeCloseTo(7 / 6 - 1, 5);
  });

  it('NR-06: ein Satz von 0 schaltet Streaming ab', async () => {
    const { instance, send } = controller({ rate: 0 });
    await listen(instance, 300);

    expect(send).not.toHaveBeenCalled();
    expect(instance.state.pendingSats).toBe(0);
  });
});

describe('FR-20: Guthaben-Untergrenze', () => {
  it('US-05-AC-4: stoppt bei 8 Sat Guthaben und nennt den Grund', async () => {
    const { instance, send } = controller({ balance: async () => 8 });
    await listen(instance, 60);

    expect(send).not.toHaveBeenCalled();
    expect(instance.state.stopped).toBe(true);
    expect(instance.state.reason).toMatch(/Guthaben zu niedrig/);
  });

  it('sendet nach dem Stopp nichts mehr, auch wenn weiter gehört wird', async () => {
    const { instance, send } = controller({ balance: async () => 8 });
    await listen(instance, 180);
    expect(send).not.toHaveBeenCalled();
  });

  it('nimmt die Zahlungen nach erfolgreicher Aufladung wieder auf', async () => {
    let guthaben = 8;
    const { instance, send } = controller({ balance: async () => guthaben });
    await listen(instance, 60);
    expect(instance.state.stopped).toBe(true);

    guthaben = 500;
    instance.resume();
    await listen(instance, 60);

    expect(send).toHaveBeenCalledTimes(1);
  });
});

describe('US-05-AC-5: Netzausfall', () => {
  it('bucht bei einem Fehler nichts ab und behält den Betrag als Rest', async () => {
    const send: Send = vi.fn(async () => {
      throw new Error('offline');
    });
    const { instance } = controller({ send });
    await listen(instance, 60);

    expect(instance.state.sentSats).toBe(0);
    expect(instance.state.pendingSats).toBeCloseTo(10, 5);
  });

  it('NR-06: nach der Rückkehr des Netzes wird höchstens die gehörte Zeit gesendet', async () => {
    let offline = true;
    const send: Send = vi.fn(async () => {
      if (offline) throw new Error('offline');
      return 'gesendet' as const;
    });
    const { instance } = controller({ send });

    await listen(instance, 60);
    offline = false;
    await listen(instance, 60);

    // Zwei Minuten gehört, also höchstens 20 Sat — in einem Nutzap nachgeholt.
    expect(send).toHaveBeenCalledTimes(2);
    expect(send.mock.calls[1][0]).toBe(20);
    expect(instance.state.sentSats).toBe(20);
  });

  it('ein ausstehender Nutzap gilt als gesendet und wird nicht erneut abgebucht', async () => {
    const send: Send = vi.fn(async () => 'ausstehend' as const);
    const { instance } = controller({ send });

    await listen(instance, 120);

    expect(send).toHaveBeenCalledTimes(2);
    expect(instance.state.sentSats).toBe(20);
  });
});

describe('FR-30: Rückmeldung', () => {
  it('meldet jede Änderung des Zustands', async () => {
    const updates: StreamingState[] = [];
    const { instance } = controller({ onUpdate: (state) => updates.push(state) });
    await listen(instance, 60);

    expect(updates.length).toBeGreaterThan(0);
    expect(updates.at(-1)).toMatchObject({ sentSats: 10 });
  });

  it('meldet den Fehlergrund einer gescheiterten Zahlung', async () => {
    const send: Send = vi.fn(async () => {
      throw new Error('Kein Relay erreichbar');
    });
    const { instance } = controller({ send });
    await listen(instance, 60);

    expect(instance.state.reason).toMatch(/Kein Relay erreichbar/);
  });
});

describe('FR-30: Anzahl der Nutzaps dieser Sitzung', () => {
  it('zaehlt jeden bestaetigten Versand', async () => {
    const controller = new StreamingController({
      rate: 60,
      send: async () => 'gesendet',
      balance: async () => 1000,
    });

    await controller.handleTick(tick(60));
    await controller.handleTick(tick(60));

    expect(controller.state).toMatchObject({ sentSats: 120, sentZaps: 2 });
  });

  it('zaehlt einen ausstehenden Versand mit — die Proofs sind weg', async () => {
    const controller = new StreamingController({
      rate: 60,
      send: async () => 'ausstehend',
      balance: async () => 1000,
    });

    await controller.handleTick(tick(60));

    expect(controller.state).toMatchObject({ sentSats: 60, sentZaps: 1 });
  });

  it('zaehlt einen gescheiterten Versuch nicht mit', async () => {
    const controller = new StreamingController({
      rate: 60,
      send: async () => {
        throw new Error('kein Relay');
      },
      balance: async () => 1000,
    });

    await controller.handleTick(tick(60));

    expect(controller.state).toMatchObject({ sentSats: 0, sentZaps: 0 });
  });
});
