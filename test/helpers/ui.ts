/**
 * Preact plant Effekte über requestAnimationFrame; jsdom feuert das erst nach
 * ~16 ms. Kürzere Wartezeiten lassen useEffect nicht laufen.
 */
export async function flush(): Promise<void> {
  for (let i = 0; i < 3; i++) {
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
}

/**
 * Wartet, bis eine Bedingung haelt — statt auf eine feste Zeit zu hoffen.
 *
 * Feeds mit vielen Episoden brauchen mehr als die 60 ms von flush(): Parsen
 * und Schreiben in IndexedDB dauern unterschiedlich lang, und ein fester Wert
 * macht den Test von der Tagesform der Maschine abhaengig.
 */
export async function waitFor(
  condition: () => boolean,
  { timeoutMs = 2000, stepMs = 20 }: { timeoutMs?: number; stepMs?: number } = {},
): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (condition()) return;
    await new Promise((resolve) => setTimeout(resolve, stepMs));
  }
  if (!condition()) throw new Error(`Bedingung blieb ${timeoutMs} ms lang unerfuellt.`);
}

export async function clickButton(host: HTMLElement, label: string): Promise<void> {
  const button = [...host.querySelectorAll('button')].find((b) => b.textContent?.includes(label));
  if (!button) throw new Error(`Knopf "${label}" nicht gefunden in: ${host.textContent}`);
  button.click();
  await flush();
}

/** Klickt einen Knopf ueber sein aria-label — Icon-Knoepfe tragen keinen Text. */
export async function clickLabel(host: HTMLElement, label: string): Promise<void> {
  const button = host.querySelector<HTMLButtonElement>(`button[aria-label="${label}"]`);
  if (!button) {
    const vorhanden = [...host.querySelectorAll('button[aria-label]')]
      .map((b) => b.getAttribute('aria-label'))
      .join(', ');
    throw new Error(`Knopf mit aria-label "${label}" nicht gefunden. Vorhanden: ${vorhanden}`);
  }
  button.click();
  await flush();
}
