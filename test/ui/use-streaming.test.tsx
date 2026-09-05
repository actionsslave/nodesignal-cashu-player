/**
 * SFR-23: Der Streaming-Zähler muss über Renderrunden hinweg weiterzählen.
 *
 * Der Fehler, den dieser Test festhält: Der Controller hing an einem Effekt,
 * dessen Abhängigkeiten sich bei jedem `timeupdate` änderten — die Hörposition
 * steckte in einer der Callback-Identitäten. Vier Mal je Sekunde entstand ein
 * frischer Controller mit null gehörten Sekunden, und die sechzig kamen nie
 * zusammen. Im Verlauf stand deshalb nichts, obwohl eine Stunde lief.
 */
import { render } from 'preact';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useStreamingController } from '../../src/ui/use-streaming.js';
import type { ListeningTick } from '../../src/contracts/index.js';
import { flush } from '../helpers/ui.js';

let host: HTMLElement | undefined;

afterEach(() => {
  if (host) {
    render(null, host);
    host.remove();
    host = undefined;
  }
});

function tick(seconds: number): ListeningTick {
  return {
    feedId: 'nodesignal',
    episodeId: 'e291',
    positionSeconds: seconds,
    listenedSeconds: seconds,
    at: Date.now(),
  };
}

describe('useStreamingController', () => {
  it('zählt weiter, obwohl sich die Callbacks bei jedem Render ändern', async () => {
    const send = vi.fn(async (_amount: number, _position?: number) => 'gesendet' as const);
    let feed: ((t: ListeningTick) => void) | undefined;

    function Harness({ position }: { position: number }) {
      // Genau wie in der App: eine neue Pfeilfunktion je Render, weil sie die
      // Hörposition einschliesst.
      const { onTick } = useStreamingController({
        rate: 1,
        confirmed: true,
        source: 'local',
        send: (amount) => send(amount, position),
        balance: async () => 1000,
        onStopped: () => undefined,
      });
      feed = onTick;
      return null;
    }

    host = document.createElement('div');
    document.body.appendChild(host);

    // Sechs Sekunden Wiedergabe, dazwischen zehn Renderrunden — so oft, wie
    // ein timeupdate feuert.
    for (let i = 0; i < 10; i++) {
      render(<Harness position={i} />, host);
      await flush();
      feed?.(tick(6));
    }
    await flush();

    // 60 gehörte Sekunden bei 1 Sat/Minute: genau eine Abbuchung über 1 Sat.
    expect(send).toHaveBeenCalledTimes(1);
    expect(send.mock.calls[0][0]).toBe(1);
  });

  it('sieht die aktuelle Hörposition, obwohl der Controller stehen bleibt', async () => {
    const send = vi.fn(async (_amount: number, _position?: number) => 'gesendet' as const);
    let feed: ((t: ListeningTick) => void) | undefined;

    function Harness({ position }: { position: number }) {
      const { onTick } = useStreamingController({
        rate: 1,
        confirmed: true,
        source: 'local',
        send: (amount) => send(amount, position),
        balance: async () => 1000,
        onStopped: () => undefined,
      });
      feed = onTick;
      return null;
    }

    host = document.createElement('div');
    document.body.appendChild(host);
    for (let i = 0; i < 10; i++) {
      render(<Harness position={i} />, host);
      await flush();
      feed?.(tick(6));
    }
    await flush();

    // Der zweite Parameter ist die Position aus dem letzten Render, nicht die
    // aus dem ersten — der Controller bleibt, die Callbacks sind aktuell.
    expect(send.mock.calls[0][1]).toBe(9);
  });

  it('bucht nichts ab, solange der Satz nicht bestätigt ist', async () => {
    const send = vi.fn(async (_amount: number, _position?: number) => 'gesendet' as const);
    let feed: ((t: ListeningTick) => void) | undefined;

    function Harness() {
      feed = useStreamingController({
        rate: 1,
        confirmed: false,
        source: 'local',
        send,
        balance: async () => 1000,
        onStopped: () => undefined,
      }).onTick;
      return null;
    }

    host = document.createElement('div');
    document.body.appendChild(host);
    render(<Harness />, host);
    await flush();
    for (let i = 0; i < 10; i++) feed?.(tick(10));
    await flush();

    expect(send).not.toHaveBeenCalled();
  });
});
