/**
 * Die Dialoge aus 5b: was sie sagen und was der Hauptknopf verspricht.
 *
 * Geprüft wird das, was falsch werden kann, ohne dass es jemand merkt — der
 * einmalige NIP-60-Hinweis, der beim zweiten Mal nicht mehr erscheinen darf,
 * und der Betrag im Knopf, wenn die Quelle den Wunsch nicht deckt.
 */
import { render } from 'preact';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { BoostDialog, payableAmount } from '../../src/ui/boost-dialog.js';
import { FirstTakeDialog, NIP60_RISIKO_HINWEIS } from '../../src/ui/float-dialogs.js';
import { clickButton, flush } from '../helpers/ui.js';

let host: HTMLElement | undefined;

function mount(vnode: preact.ComponentChild): HTMLElement {
  host = document.createElement('div');
  document.body.appendChild(host);
  render(vnode as never, host);
  return host;
}

afterEach(() => {
  if (host) {
    render(null, host);
    host.remove();
    host = undefined;
  }
});

const MINT = 'https://mint.macadamia.cash';

describe('FirstTakeDialog', () => {
  it('SNR-06: der Hauptknopf nennt den Betrag, nicht „OK"', async () => {
    const host = mount(
      <FirstTakeDialog
        amount={500}
        mintUrl={MINT}
        showRiskNotice
        onConfirm={() => undefined}
        onCancel={() => undefined}
        onChangeAmount={() => undefined}
      />,
    );
    await flush();
    expect(host.textContent).toContain('500 Sat entnehmen');
    expect(host.textContent).toContain('mint.macadamia.cash');
  });

  it('SNR-06: zeigt den Risikohinweis nur beim ersten Mal', async () => {
    const host = mount(
      <FirstTakeDialog
        amount={500}
        mintUrl={MINT}
        showRiskNotice
        onConfirm={() => undefined}
        onCancel={() => undefined}
        onChangeAmount={() => undefined}
      />,
    );
    await flush();
    expect(host.textContent).toContain(NIP60_RISIKO_HINWEIS);

    render(
      <FirstTakeDialog
        amount={500}
        mintUrl={MINT}
        showRiskNotice={false}
        onConfirm={() => undefined}
        onCancel={() => undefined}
        onChangeAmount={() => undefined}
      />,
      host,
    );
    await flush();
    expect(host.textContent).not.toContain(NIP60_RISIKO_HINWEIS);
  });
});

describe('BoostDialog', () => {
  it('SFR-22: der Knopf nennt den zahlbaren Betrag, nicht den gewünschten', async () => {
    const host = mount(
      <BoostDialog
        episodeTitle="E289"
        timecode="14:12"
        podcastTitle="Nodesignal"
        sourceLabel="nostr-Wallet · Float"
        mintUrl={MINT}
        available={470}
        floatRemaining={470}
        onSend={() => undefined}
        onCancel={() => undefined}
      />,
    );
    await flush();
    // Vorgewählt sind 500 Sat, der Float deckt 470.
    expect(host.textContent).toContain('470 Sat senden');
    expect(host.textContent).toContain('Der Float deckt 500 Sat nicht mehr.');
    expect(host.textContent).toContain('−30 Sat');
  });

  it('sendet genau den Betrag, der im Knopf steht', async () => {
    const onSend = vi.fn();
    const host = mount(
      <BoostDialog
        episodeTitle="E289"
        timecode="14:12"
        podcastTitle="Nodesignal"
        sourceLabel="Lokale Wallet"
        mintUrl={MINT}
        available={470}
        onSend={onSend}
        onCancel={() => undefined}
      />,
    );
    await flush();
    await clickButton(host, 'Sat senden');
    expect(onSend).toHaveBeenCalledWith(470, '');
  });

  it('nennt keinen Fehlbetrag, wenn die Quelle deckt', async () => {
    const host = mount(
      <BoostDialog
        episodeTitle="E289"
        timecode="14:12"
        podcastTitle="Nodesignal"
        sourceLabel="Lokale Wallet"
        mintUrl={MINT}
        available={5000}
        onSend={() => undefined}
        onCancel={() => undefined}
      />,
    );
    await flush();
    expect(host.textContent).toContain('500 Sat senden');
    expect(host.textContent).not.toContain('nicht mehr');
  });
});

describe('payableAmount', () => {
  it('kappt den Wunsch am Verfügbaren', () => {
    expect(payableAmount(500, 470)).toBe(470);
    expect(payableAmount(100, 470)).toBe(100);
    expect(payableAmount(100, 0)).toBe(0);
  });
});
