# Nodesignal — Cashu-Player

Ein Podcast-Player für genau einen Podcast, der zeigt, dass Value-for-Value mit
Ecash funktioniert. Der Hörer meldet sich mit nostr an, wählt eine
Zahlungsquelle und sendet beim Hören Nutzaps nach NIP-61.

Grundlage: [`docs/spezifikation-nodesignal-showcase.md`](docs/spezifikation-nodesignal-showcase.md).
Abgeleitet aus [`actionsslave/cashu-player`](https://github.com/actionsslave/cashu-player) (SFR-01).

## Zwei gleichrangige Zahlungsquellen

Keine ist der Notausgang der anderen:

- **NIP-60-Wallet** — der Hörer zahlt aus seiner bestehenden nostr-Wallet, ohne
  im Player Guthaben anzulegen.
- **Lokale Wallet** — er hinterlegt einen Cashu-Token im Player.

Wer eine nostr-Wallet hat, soll sie benutzen können; wer keine hat oder keine
`nip44`-fähige Extension, zahlt per Token und bekommt denselben Funktionsumfang.

## Session-Float

Streaming mit NIP-60 pro Minute hieße naiv zwölf Relay-Schreibvorgänge in einer
Zwanzig-Minuten-Folge, jeder ein Rennen gegen jeden anderen Client mit derselben
Wallet. Stattdessen entnimmt der Player einmal je Sitzung einen Betrag, zahlt
lokal dagegen und schreibt den Rest einmal zurück — zwei Schreibvorgänge statt
einem pro Minute.

Der Preis steht in `src/nip60/float.ts`: Bricht der Browser mitten in der
Sitzung weg, liegt der Rest bis zur Wiederherstellung außerhalb der
Wallet-Events. Er ist nicht verloren, aber vorübergehend nur lokal sichtbar.

## Stand

| Bereich | Stand |
|---|---|
| Repo abgeleitet, Build-Konstanten (SFR-01, SFR-04) | gebaut |
| Feed-Snapshot zur Bauzeit samt täglichem CI-Lauf (SFR-08) | gebaut |
| NIP-60 auswerten: `kind:17375`, `kind:7375`, Guthaben je Mint (SFR-13 bis SFR-15) | gebaut |
| Float planen: Entnahme, Rückgabe, Grenzen (SFR-16 bis SFR-18, SFR-20) | gebaut |
| Quellenwahl und Gründe je Quelle (SFR-28 bis SFR-30) | gebaut |
| Laufzeit-Abruf mit Rückfall auf den Build-Stand (SFR-09) | gebaut |
| Lokale Wallet, Nutzaps, Player-Kern | aus `cashu-player` übernommen |
| Oberfläche (SFR-05 bis SFR-07, SFR-20, SFR-28 bis SFR-30) | gebaut, **schmucklos — wartet auf das Design-Handoff** |
| Deployment auf `player.nodesignal.space` (SFR-02) | **offen — Origin einrichten** |

## Noch nicht verdrahtet

Die Oberfläche steht, aber zwei Stränge hängen noch nicht daran:

- **`kind:17375` und `kind:7375` lesen.** `src/nip60/wallet-event.ts` wertet
  beide aus und ist getestet; das Holen von den Relays und das Entschlüsseln
  über die Extension fehlen. Bis dahin meldet die NIP-60-Quelle
  „keine Wallet gefunden" — richtig im Ergebnis, aber aus dem falschen Grund.
- **Float-Entnahme und -Rückgabe.** `src/nip60/float.ts` plant beide und ist
  getestet; das Ausführen verlangt einen Mint-Swap, ein `kind:5` und ein neues
  `kind:7375`. Das ist der Schritt, der echtes Geld bewegt, und er gehört gegen
  einen echten Mint geprüft, nicht blind geschrieben.

## Vor dem ersten Deployment

Drei Dinge sind menschliche Arbeit und blockieren den Rest (Kapitel 11 der
Spezifikation):

1. **SA-03** — `kind:10019` für Nodesignal. **Bereits belegt:** Am 02.09.2026
   kam ein Nutzap bei Nodesignal an, also existiert es und ist auflösbar.
2. **SA-01** — `nip44`-Fähigkeit der Zielextensions prüfen. Ohne sie ist die
   NIP-60-Quelle im Browser nicht benutzbar.
3. **SOQ-02** — Mint-Kandidaten festlegen. Sie müssen browser-tauglich sein,
   NUT-11 und NUT-12 können **und** im `kind:10019` von Nodesignal stehen,
   sonst ist die Schnittmenge aus SFR-15 leer.

Dazu die Platzhalter in `src/config/build-config.ts`: `FEED_URL` und
`RECIPIENT_NPUB`. `hasPlaceholders()` macht sie zur Laufzeit sichtbar.

## Entwickeln

```bash
npm ci
npm run dev
```

Prüfungen — alle vier müssen grün sein:

```bash
npm test && npm run build && npm run lint && npx vitest run test/guardrails/
```

## Was diese App nicht tut

`SNR-01` bis `SNR-09` in der Spezifikation. Die wichtigsten: Sie legt keine
NIP-60-Wallet an und ändert das `kind:17375` des Nutzers nicht. Sie publiziert
Deletion-Events ausschließlich für `kind:7375`-Events, die sie selbst gelesen
und deren Proofs sie verbraucht hat. Sie empfängt und löst keine eingehenden
Nutzaps ein. Sie läuft nicht in einem iframe.

**Eine Lücke ist benannt, nicht übersehen:** In `cashu-player` verbot NR-09
jeden Schreibzugriff auf `kind:17375` und `kind:7375`, statisch erzwungen durch
den Guardrail-Scanner. Hier ist diese Regel entfernt — der Showcase muss beide
Ereignisarten anfassen. SNR-01 und SNR-02 treten an ihre Stelle und sind mit
keinem regulären Ausdruck prüfbar. Sie gehören in Code-Review und manuelle
Prüfung.
