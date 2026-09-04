/**
 * SNR-05: Läuft der Player in einem iframe, bleibt der Wallet-Betrieb aus.
 *
 * Die eingebettete Seite kann den Player nicht auslesen — same-origin schützt
 * davor. Sie kann ihn aber umrahmen, überlagern und den Klick des Nutzers in
 * einen anderen Zusammenhang stellen. Für Wiedergabe ist das hinnehmbar, für
 * Zahlungen nicht.
 */
export interface EmbeddingWindow {
  self: Window;
  readonly top: Window | null;
}

export function isEmbedded(view: EmbeddingWindow = window): boolean {
  try {
    return view.self !== view.top;
  } catch {
    // Der Zugriff auf `top` wirft nur bei fremdem Origin — also eingebettet.
    return true;
  }
}
