# Spezifikation: Nodesignal-Player als Showcase (Ziel 1)

**Grundlage:** Call Jan-Paul / Thorsten, 04.09.2026 · baut auf `anforderungen-cashu-podcast-player-web-mvp.md` und dem bestehenden Repo `cashu-player`
**Zweck:** Nächste Implementierungsschritte, nicht der Hackathon-MVP
**Stand der Recherche:** 04.09.2026

---

## 1. Ziel

Ein öffentlich erreichbarer Podcast-Player auf der Nodesignal-Webseite, der zeigt, dass Value-for-Value mit Ecash funktioniert. Genau ein Podcast (Nodesignal), alles auf einer Seite, Anmeldung über nostr.

Der Hörer hat **zwei gleichrangige Zahlungsquellen** und wählt selbst:

- **NIP-60-Wallet** — er zahlt aus seiner bestehenden nostr-Wallet, ohne im Player Guthaben anzulegen. Neu gegenüber dem MVP-Dokument.
- **Lokale Wallet** — er hinterlegt einen Cashu-Token im Player, wie im MVP-Dokument beschrieben.

Keine der beiden ist der Notausgang der anderen. Wer eine nostr-Wallet hat, soll sie benutzen können; wer keine hat oder keine `nip44`-fähige Extension, zahlt per Token und bekommt denselben Funktionsumfang.

**Erfolg:** Ein Hörer öffnet `player.nodesignal.space`, meldet sich mit seiner Extension an, wählt eine Zahlungsquelle, startet eine Folge und sieht Sats laufen. Ohne Account, in beiden Fällen.

**Nicht das Ziel:** Feed-Verwaltung, mehrere Podcasts, Empfangen von Nutzaps, Lightning, PWA.

---

## 2. Entscheidung, die sich geändert hat

NR-09 des MVP-Dokuments verbietet jeden Schreibzugriff auf die NIP-60-Wallet des Nutzers. Für diesen Showcase wird das aufgehoben — aber nicht pauschal, sondern eng begrenzt: Der Player darf die Wallet des **angemeldeten** Nutzers lesen und Proof-Zustände fortschreiben, nichts anlegen, nichts fremdes löschen. Die Ersatzregeln stehen in Kapitel 5 als SNR-01 bis SNR-06.

Der Grund für die Grenzen: Bei NIP-60 liegt echtes Geld in Events auf Relays. Ein Fehler löscht kein Symbol, sondern Guthaben.

---

## 3. Architekturentscheidung: Session-Float

Dieses Kapitel betrifft ausschließlich die NIP-60-Quelle. Die lokale Wallet zahlt unverändert direkt pro Intervall, weil ihre Proofs schon im Browser liegen und kein Relay im Spiel ist.

Naiv umgesetzt bedeutet Streaming mit NIP-60 pro Minute: Token-Events lesen, `nip44` entschlüsseln, beim Mint swappen, neuen Zustand verschlüsseln, ein Deletion-Event und ein neues Token-Event publizieren. Zwölf Relay-Schreibvorgänge in einer Zwanzig-Minuten-Folge, jeder ein Rennen gegen jeden anderen Client, der dieselbe Wallet offen hat.

Deshalb arbeitet der Player mit einem **Session-Float**:

1. Beim ersten Zahlungswunsch einer Sitzung entnimmt der Player einen Betrag aus der NIP-60-Wallet (Vorgabe 500 Sat, einstellbar) und schreibt den Restzustand einmal zurück.
2. Streaming und Boosts laufen gegen diesen Float, vollständig lokal, ohne Relay-Schreibzugriff.
3. Beim Beenden der Folge, beim Verlassen der Seite oder auf Knopfdruck wandert der ungenutzte Rest zurück in die NIP-60-Wallet.

Das reduziert die Schreibzugriffe von einem pro Minute auf zwei pro Sitzung und macht die Nebenläufigkeit beherrschbar. Der Preis: Bricht der Browser mitten in einer Sitzung weg, liegt der Float-Rest bis zur nächsten Wiederherstellung außerhalb der Wallet-Events — er ist nicht verloren, aber vorübergehend nur lokal sichtbar. Deshalb SFR-14.

---

## 4. Funktionale Anforderungen

**Repo und Auslieferung**

| ID | Anforderung |
|---|---|
| SFR-01 | Neues Repo, abgeleitet aus `cashu-player`: `src/contracts`, `src/wallet`, `src/payments`, `src/player` und `tools/guardrails.ts` werden übernommen, Feed-Verwaltung, Proxy-Fallback und PWA-Teile entfallen. |
| SFR-02 | Auslieferung als statisches Bundle über GitHub Pages unter der eigenen Subdomain `player.nodesignal.space` per CNAME, ausschließlich HTTPS. |
| SFR-03 | Die Einbindung auf `nodesignal.space` erfolgt als Link oder Button, nicht als iframe; der Player läuft nie in einem fremden Origin-Kontext. |
| SFR-04 | Der Nodesignal-Feed, die erlaubten Mints und der Empfänger-npub stehen als Build-Konstanten in einer einzigen Datei. |

**Oberfläche**

| ID | Anforderung |
|---|---|
| SFR-05 | Eine einzige Seite ohne Routing mit vier Bereichen: Episodenliste, Player, Wallet, Einstellungen. |
| SFR-06 | Die Episodenliste zeigt die 20 neuesten Episoden mit Titel, Datum, Dauer und Beschreibung, absteigend nach Datum. |
| SFR-07 | Der Player unterstützt Play, Pause, +30 s, −15 s, Scrubbing und merkt die Hörposition pro Episode. |

**Feed**

| ID | Anforderung |
|---|---|
| SFR-08 | Der Feed wird zur Build-Zeit abgerufen, geparst und als JSON ins Bundle gelegt; ein täglicher CI-Lauf baut neu und veröffentlicht. |
| SFR-09 | Zur Laufzeit versucht die App zusätzlich einen direkten Feed-Abruf; schlägt er fehl, bleibt der Build-Stand sichtbar und ein Hinweis nennt das Datum des letzten Stands. |

**Identität**

| ID | Anforderung |
|---|---|
| SFR-10 | Login über `window.nostr.getPublicKey()`; die App prüft, ob die Extension `nip44.encrypt` und `nip44.decrypt` anbietet. |
| SFR-11 | Fehlt `nip44`, ist die Quelle „NIP-60" nicht wählbar; die App nennt den Grund und die Quelle „lokale Wallet" bleibt vollständig nutzbar. |
| SFR-12 | Ohne Login sind Episodenliste und Wiedergabe uneingeschränkt nutzbar, Zahlungen deaktiviert. |

**NIP-60-Wallet**

| ID | Anforderung |
|---|---|
| SFR-13 | Die App liest das `kind:17375`-Event des Nutzers, entschlüsselt es per `nip44` und entnimmt die Mint-Liste und den Wallet-Privkey; existiert kein solches Event, legt die App keines an, sondern erklärt die Lage und lässt die Quelle „NIP-60" ungewählt. |
| SFR-14 | Die App liest die `kind:7375`-Events des Nutzers, entschlüsselt sie und bildet daraus das Guthaben je Mint; die Zuordnung Event-ID zu Proofs wird lokal gehalten, damit ein abgebrochener Float wiederherstellbar ist. |
| SFR-15 | Nur Mints aus der Schnittmenge von `kind:17375`, eigener erlaubter Liste und `kind:10019` des Empfängers werden verwendet; ist die Schnittmenge leer, sind Zahlungen deaktiviert mit Nennung des fehlenden Mints. |
| SFR-16 | Float-Entnahme: Die App swappt den Float-Betrag beim Mint, publiziert ein `kind:5`-Deletion-Event auf die verbrauchten `kind:7375`-Events und ein neues `kind:7375` mit den Restproofs und dem `del`-Feld. |
| SFR-17 | Float-Rückgabe: Der ungenutzte Rest wird als neues `kind:7375` publiziert, bevor die Sitzung endet; der Vorgang wird bei `visibilitychange` und `pagehide` ausgelöst und ist idempotent. |
| SFR-18 | Der Float-Betrag ist einstellbar (Vorgabe 500 Sat, Bereich 100–10 000) und wird vor der ersten Entnahme einmal explizit bestätigt. |
| SFR-19 | Antwortet der Mint auf einen Swap mit „bereits ausgegeben", lädt die App den Wallet-Zustand neu, bevor sie erneut versucht, und zeigt den Konflikt an. |
| SFR-20 | Die Wallet-Ansicht zeigt getrennt: Guthaben in der NIP-60-Wallet, aktueller Float, in dieser Sitzung gesendeter Betrag. |
| SFR-21 | Ein Verlauf zeigt je Zahlung Richtung, Betrag, Zeitstempel, Episode und Status; das Schreiben von `kind:7376`-History-Events ist optional und standardmäßig aus. |

**Zahlungen**

| ID | Anforderung |
|---|---|
| SFR-22 | Streaming und Boost bleiben unverändert Nutzaps nach NIP-61 gegen das `kind:10019` von Nodesignal, gespeist aus dem Float statt aus der lokalen Wallet. |
| SFR-23 | Das Streaming-Intervall beträgt 60 s gehörter Zeit; bei der Quelle NIP-60 wird nur der Float belastet, es entstehen keine Relay-Schreibzugriffe auf Wallet-Events. |

**Lokale Wallet**

| ID | Anforderung |
|---|---|
| SFR-24 | Die lokale Wallet lässt sich durch Einfügen eines Cashu-Tokens aufladen; ungültige, bei einem nicht erlaubten Mint ausgestellte oder bereits eingelöste Token werden mit konkretem Fehlertext abgelehnt. |
| SFR-25 | Die lokale Wallet lässt sich jederzeit vollständig als Cashu-Token exportieren (Text und QR-Code); vor der ersten Aufladung weist die App darauf hin, dass Löschen der Website-Daten das Guthaben vernichtet. |
| SFR-26 | Beim ersten Aufladen fordert die App über `navigator.storage.persist()` dauerhaften Speicher an und zeigt das Ergebnis als „dauerhaft" oder „best effort" an. |
| SFR-27 | Unterschreitet die lokale Wallet 10 Sat, stoppt die App laufende Streaming-Zahlungen aus dieser Quelle, zeigt einen Hinweis und setzt sie nach erfolgreicher Aufladung fort. |

**Quellenwahl**

| ID | Anforderung |
|---|---|
| SFR-28 | Die Wallet-Ansicht zeigt beide Quellen gleichrangig mit eigenem Guthaben und eigenem Zustand; genau eine Quelle ist aktiv, die Wahl wird lokal gespeichert und überlebt einen Reload. |
| SFR-29 | Ist nur eine Quelle verfügbar, wird sie vorausgewählt und die andere mit dem konkreten Grund ihrer Nichtverfügbarkeit angezeigt (kein `kind:17375`, kein `nip44`, kein Guthaben, keine Mint-Schnittmenge). |
| SFR-30 | Die Mint-Schnittmenge wird je Quelle getrennt gebildet — für NIP-60 aus `kind:17375`, erlaubter Liste und `kind:10019`, für die lokale Wallet aus erlaubter Liste und `kind:10019` — und je Quelle separat angezeigt. |
| SFR-31 | Ein Wechsel der Quelle während laufender Wiedergabe ist möglich; ein offener Float wird dabei zurückgeschrieben, bevor die neue Quelle aktiv wird, und der Sitzungszähler läuft quellenübergreifend weiter. |
| SFR-32 | Jeder Verlaufseintrag nennt die Quelle, aus der die Zahlung finanziert wurde. |

---

## 5. Negative Anforderungen

| ID | Anforderung |
|---|---|
| SNR-01 | Die App legt keine NIP-60-Wallet an und ändert das `kind:17375` des Nutzers nicht. |
| SNR-02 | Die App publiziert Deletion-Events ausschließlich für `kind:7375`-Events, die sie selbst gelesen und deren Proofs sie verbraucht hat; niemals für andere Kinds und niemals für Events fremder Autoren. |
| SNR-03 | Der Wallet-Privkey aus `kind:17375` verlässt den Speicher der Seite nicht, steht nie in Logs, URLs oder `localStorage` und wird nicht an Mints übertragen. |
| SNR-04 | Die App empfängt und löst keine eingehenden Nutzaps ein — auch nicht die des angemeldeten Nutzers. |
| SNR-05 | Die App läuft nicht in einem iframe; erkennt sie eine Einbettung, verweigert sie den Wallet-Betrieb und verweist auf die eigene URL. |
| SNR-06 | Kein Backend, kein serverseitiger Zustand, keine Analytics, keine Zahlung ohne vorherige Bestätigung von Float-Betrag und Streaming-Satz. |
| SNR-07 | Die App verschiebt kein Guthaben zwischen den beiden Quellen, außer durch Float-Entnahme und Float-Rückgabe; insbesondere lädt sie die lokale Wallet nie automatisch aus der NIP-60-Wallet auf. |
| SNR-08 | Ist die lokale Wallet die aktive Quelle, publiziert und liest die App keine Wallet-Events des Nutzers und entschlüsselt nichts per `nip44`. |
| SNR-09 | Eine Zahlung wird immer aus genau einer Quelle finanziert; Proofs aus beiden Quellen werden nie in einem Nutzap zusammengeführt. |

---

## 6. Nicht-funktionale Anforderungen

| ID | Anforderung |
|---|---|
| SNFR-01 | Vom Login bis zum angezeigten NIP-60-Guthaben vergehen bei erreichbaren Relays höchstens 5 s. |
| SNFR-02 | Float-Entnahme und Float-Rückgabe sind je in unter 10 s abgeschlossen, gemessen gegen die Demo-Mints. |
| SNFR-03 | Bricht das Netz während einer Sitzung weg, bleiben Wiedergabe und Float-Zustand konsistent; nach Rückkehr wird der Rest zurückgeschrieben. |
| SNFR-04 | Chrome und Brave in aktueller Stable-Version verhalten sich identisch. |
| SNFR-05 | Jede Anforderung dieses Dokuments ist so formuliert, dass ein Coding-Agent sie ohne Rückfrage umsetzen kann. |

---

## 7. Abnahmekriterien (Auszug, Gherkin)

```gherkin
SUS-01-AC-1 — Guthaben aus der nostr-Wallet
Angenommen ich habe eine NIP-60-Wallet mit 2 000 Sat und eine nip44-fähige Extension
Wenn ich mich im Player anmelde
Dann zeigt die Wallet-Ansicht 2 000 Sat als NIP-60-Guthaben
Und der Float steht auf 0

SUS-01-AC-2 — Float-Entnahme
Angenommen ich bin angemeldet und der Float-Betrag steht auf 500 Sat
Wenn ich eine Episode starte und die Entnahme bestätige
Dann sinkt das NIP-60-Guthaben um 500 Sat
Und der Float zeigt 500 Sat
Und genau ein neues kind:7375 sowie ein kind:5 wurden publiziert

SUS-01-AC-3 — Streaming ohne Relay-Schreibzugriff
Angenommen der Float steht auf 500 Sat und der Satz auf 10 Sat pro Minute
Wenn ich drei Minuten höre
Dann wurden drei Nutzaps gesendet
Und der Float zeigt 470 Sat
Und es wurde kein weiteres Wallet-Event publiziert

SUS-01-AC-4 — Float-Rückgabe
Angenommen der Float steht auf 470 Sat
Wenn ich die Wiedergabe beende und die Seite verlasse
Dann wird ein kind:7375 über 470 Sat publiziert
Und das NIP-60-Guthaben entspricht wieder dem Ausgangswert minus des gesendeten Betrags

SUS-01-AC-5 — Keine Wallet vorhanden
Angenommen mein npub hat kein kind:17375
Wenn ich mich anmelde
Dann legt die App keine Wallet an
Und sie erklärt, dass keine nostr-Wallet gefunden wurde
Und die lokale Wallet steht als Alternative bereit

SUS-01-AC-6 — Extension ohne nip44
Angenommen meine Extension bietet kein nip44 an
Wenn ich mich anmelde
Dann bleibt die NIP-60-Wallet deaktiviert
Und die App nennt die fehlende nip44-Unterstützung als Grund

SUS-02-AC-1 — Beide Quellen verfügbar
Angenommen ich habe eine NIP-60-Wallet mit 2 000 Sat und eine lokale Wallet mit 300 Sat
Wenn ich die Wallet-Ansicht öffne
Dann sehe ich beide Quellen mit ihrem jeweiligen Guthaben
Und genau eine davon ist als aktiv markiert

SUS-02-AC-2 — Zahlung aus der lokalen Quelle
Angenommen die lokale Wallet ist die aktive Quelle
Wenn ich 60 Sekunden höre
Dann wurde ein Nutzap aus der lokalen Wallet gesendet
Und es wurde kein Wallet-Event gelesen oder publiziert
Und der Verlaufseintrag nennt die lokale Wallet als Quelle

SUS-02-AC-3 — Quellenwechsel während der Wiedergabe
Angenommen die Quelle NIP-60 ist aktiv und ein Float von 470 Sat ist offen
Wenn ich während laufender Wiedergabe auf die lokale Wallet umschalte
Dann werden die 470 Sat zurückgeschrieben, bevor die neue Quelle aktiv wird
Und der Sitzungszähler zeigt weiterhin den bisher gesendeten Gesamtbetrag

SUS-02-AC-4 — Nur eine Quelle nutzbar
Angenommen ich habe kein kind:17375 und meine lokale Wallet ist leer
Wenn ich eine Episode öffne
Dann sind Zahlungen deaktiviert
Und die App nennt für jede Quelle einzeln den Grund
Aber die Wiedergabe funktioniert uneingeschränkt

SUS-01-AC-7 — Konflikt mit einem anderen Client
Angenommen ich habe dieselbe Wallet parallel in einem anderen Client geöffnet
Wenn der Mint meinen Swap mit "bereits ausgegeben" ablehnt
Dann lädt die App den Wallet-Zustand neu
Und sie zeigt den Konflikt an, statt still weiterzumachen
Und es wird kein Deletion-Event für die betroffenen Events publiziert
```

---

## 8. Technische Hinweise

**Referenzimplementierung.** Amethyst ist Kotlin und für einen TypeScript-Player nur als Verhaltensvorlage nützlich. Näher liegt `@nostr-dev-kit/ndk-wallet` (MIT, TypeScript): Das Paket implementiert NIP-60 als `NDKCashuWallet`, dazu einen Nutzap-Monitor und einen NWC-Client für NIP-47. Damit ist die Frage „selbst bauen oder einziehen" eine echte Abwägung und keine Notlösung — siehe SOQ-01.

**NIP-60 in Kürze.** `kind:17375` ist das replaceable Wallet-Event; sein Inhalt ist `nip44`-verschlüsselt und enthält den Wallet-Privkey und die Mint-Liste. Der Privkey ist ein eigener Cashu-P2PK-Schlüssel, getrennt von der nostr-Identität. `kind:7375`-Events halten die unverbrauchten Proofs, ebenfalls `nip44`-verschlüsselt, mit `mint`, `unit` und `proofs`; wird ausgegeben, publiziert der Client ein neues `kind:7375` mit den Restproofs und einem `del`-Feld auf die ersetzten Event-IDs und löscht die alten per NIP-09. `kind:7376` ist optionale Historie, `kind:7374` optionale Mint-Quotes.

**Relay-Wahl für Wallet-Events.** Wallet- und Token-Events müssen auf die Relays des Nutzers, nicht auf eine eigene Liste; die App liest dafür dessen `kind:10002`. Publiziert sie zu schmal, verliert der Nutzer den Zustand in anderen Clients — publiziert sie zu breit, liegen verschlüsselte Geldbeträge auf mehr Relays als nötig.

**Verlustrisiko benennen.** Wenn ein Relay `kind:7375`-Events verliert oder löscht, sind die Proofs für Clients nicht mehr auffindbar. Das ist eine Eigenschaft von NIP-60, keine der App — der Player soll es beim ersten Float einmal sagen und nicht verschweigen.

**Feed.** Der Build-Zeit-Snapshot aus SFR-08 löst den CORS-Fall vollständig: Zur Bauzeit gibt es keine Same-Origin-Policy. Für einen einzigen, eigenen Podcast ist das die einfachere Lösung als ein Proxy.

---

## 9. Annahmen

| ID | Annahme | Konsequenz, wenn falsch |
|---|---|---|
| SA-01 | Die Zielextensions bieten `nip44.encrypt` und `nip44.decrypt` und geben nach einmaliger Freigabe wiederholt ohne Interaktion frei. | NIP-60 ist im Browser nicht benutzbar; der Showcase fällt auf die lokale Wallet zurück. An Tag 1 mit beiden Extensions prüfen. |
| SA-02 | Ein Teil der Hörer hat eine NIP-60-Wallet, der größere Teil nicht. | Genau deshalb sind beide Quellen gleichrangig. Fällt die Annahme in die eine oder andere Richtung aus, ändert das nur, welche Quelle häufiger benutzt wird, nicht den Umfang. |
| SA-03 | Nodesignal hat ein `kind:10019` mit Mints, Relays und P2PK-Pubkey publiziert. | Ohne das kann niemand zahlen. Muss vor allem anderen stehen. |
| SA-04 | Es gibt mindestens einen Mint, der in typischen NIP-60-Wallets vorkommt, browser-tauglich ist und NUT-11/NUT-12 unterstützt. | Die Schnittmenge aus SFR-15 ist regelmäßig leer und Zahlungen bleiben deaktiviert. |
| SA-05 | GitHub Pages erlaubt eine eigene Subdomain per CNAME mit HTTPS. | Alternative: statisches Hosting bei einem anderen Anbieter; die Origin muss so oder so früh feststehen. |
| SA-06 | Der Feed von podhome.fm ist zur Build-Zeit ohne Authentifizierung abrufbar. | Der Snapshot muss manuell erzeugt werden. |

---

## 10. Offene Fragen

| ID | Frage | Vorschlag als Default |
|---|---|---|
| SOQ-01 | `@nostr-dev-kit/ndk-wallet` einziehen oder NIP-60 selbst implementieren? | Einziehen. Der Korrektheitsgewinn bei Deletion-Semantik und `del`-Verkettung wiegt mehr als die zusätzliche Abhängigkeit — aber Bundle-Größe und Transitive vorher ansehen. |
| SOQ-02 | Welche Mints kommen in die erlaubte Liste? | Zwei, beide vorab auf CORS, NUT-11 und NUT-12 geprüft, beide in Nodesignals `kind:10019`. |
| SOQ-03 | Float-Rückgabe bei Abbruch: automatisch beim nächsten Besuch oder auf Knopfdruck? | Automatisch anbieten, mit Anzeige „nicht zurückgeschriebener Rest aus letzter Sitzung", Ausführung auf Knopfdruck. |
| SOQ-04 | Welche Quelle ist vorausgewählt, wenn beide verfügbar sind? | NIP-60, weil sie die Geschichte erzählt, die den Showcase interessant macht — aber sichtbar umschaltbar und ohne automatische Float-Entnahme vor der ersten Bestätigung. |
| SOQ-05 | Wofür NWC — Wallet aufladen oder Boosts direkt per Lightning zahlen? | Offen, im Call nicht entschieden. Bis zur Entscheidung nicht spezifizieren; `ndk-wallet` bringt einen NWC-Client mit, falls es später Aufladung werden soll. |
| SOQ-06 | Was passiert mit NUT-18 (Payment Requests)? | Zurückgestellt. Sinnvoll wäre es als Aufladeweg für die lokale Wallet, nicht für Nutzaps. |
| SOQ-07 | „No Solutions" als zweiter Feed, sobald mehr als ein Podcast geht? | Ja, aber erst nach Ziel 1 und gemeinsam mit der Frage, wie ein nostr-native veröffentlichter Podcast überhaupt in den Player kommt. |
| SOQ-08 | Braucht der Showcase eine Erklärseite für Besucher ohne Extension und ohne Wallet? | Ja, eine kurze Sektion auf derselben Seite. Ohne sie ist der Showcase für die Mehrheit der Besucher eine Sackgasse. |

---

## 11. Reihenfolge der Umsetzung

1. `kind:10019` für Nodesignal publizieren und prüfen (SA-03). Blockiert alles.
2. `nip44`-Fähigkeit der Extensions prüfen (SA-01), Ergebnis in `docs/manuelle-tests.md`.
3. Mint-Kandidaten festlegen (SOQ-02), CORS und NUT-11/12 prüfen.
4. Repo ableiten, Origin festlegen, leeres Deployment auf `player.nodesignal.space`.
5. Feed-Snapshot samt CI-Lauf (SFR-08, SFR-09).
6. Einzelseiten-Oberfläche mit Player und Episodenliste (SFR-05 bis SFR-07).
7. NIP-60 lesen: `kind:17375` und `kind:7375`, Guthabenanzeige (SFR-13 bis SFR-15).
8. Float-Entnahme und -Rückgabe inklusive Konfliktbehandlung (SFR-16 bis SFR-19).
9. Lokale Quelle übernehmen: Import, Export, dauerhafter Speicher, Untergrenze (SFR-24 bis SFR-27). Der Code existiert bereits in `cashu-player`.
10. Zahlungen an beide Quellen anschließen (SFR-22, SFR-23).
11. Quellenwahl samt Wechsel und getrennter Mint-Schnittmenge (SFR-28 bis SFR-32).
12. Erklärsektion und Begründungstexte für nicht verfügbare Quellen (SFR-11, SFR-29, SOQ-08).

Schritte 1 bis 3 sind menschliche Arbeit und nicht delegierbar. Ab Schritt 4 ist alles agententauglich, mit Ausnahme der Prüfungen gegen echte Extensions und echtes Ecash.

---

## 12. Traceability

| Anforderung | Kurztitel | Abnahmekriterien | Priorität | Engpass |
|---|---|---|---|---|
| SFR-01 | Repo ableiten | — | Muss | KI-tauglich |
| SFR-02 | GitHub Pages, eigene Subdomain | — | Muss | Menschliche Verifikation |
| SFR-03 | Einbindung als Link, kein iframe | — | Muss | Menschliche Verifikation |
| SFR-04 | Build-Konstanten an einer Stelle | — | Muss | KI-tauglich |
| SFR-05 | Einzelseiten-Layout | — | Muss | KI-tauglich |
| SFR-06 | Episodenliste | — | Muss | KI-tauglich |
| SFR-07 | Player und Hörposition | — | Muss | KI-tauglich |
| SFR-08 | Feed-Snapshot zur Build-Zeit | — | Muss | KI-tauglich |
| SFR-09 | Laufzeit-Abruf mit Rückfall | — | Soll | KI-tauglich |
| SFR-10 | Login und nip44-Prüfung | SUS-01-AC-6 | Muss | Menschliche Verifikation |
| SFR-11 | Rückfall ohne nip44 | SUS-01-AC-6 | Muss | KI-tauglich |
| SFR-12 | Nutzung ohne Login | — | Soll | KI-tauglich |
| SFR-13 | kind:17375 lesen | SUS-01-AC-1, SUS-01-AC-5 | Muss | Menschliche Verifikation |
| SFR-14 | kind:7375 lesen und zuordnen | SUS-01-AC-1 | Muss | Menschliche Verifikation |
| SFR-15 | Mint-Schnittmenge erzwingen | — | Muss | KI-tauglich |
| SFR-16 | Float-Entnahme | SUS-01-AC-2 | Muss | Menschliche Verifikation |
| SFR-17 | Float-Rückgabe | SUS-01-AC-4 | Muss | Menschliche Verifikation |
| SFR-18 | Float-Betrag einstellbar | SUS-01-AC-2 | Muss | KI-tauglich |
| SFR-19 | Konfliktbehandlung | SUS-01-AC-7 | Muss | Menschliche Verifikation |
| SFR-20 | Getrennte Guthabenanzeige | SUS-01-AC-1, SUS-01-AC-3 | Soll | KI-tauglich |
| SFR-21 | Verlauf, History optional | — | Soll | KI-tauglich |
| SFR-22 | Nutzaps aus dem Float | SUS-01-AC-3 | Muss | Menschliche Verifikation |
| SFR-23 | Streaming-Intervall 60 s | SUS-01-AC-3 | Muss | KI-tauglich |
| SFR-24 | Lokale Wallet aufladen | SUS-02-AC-1 | Muss | Menschliche Verifikation |
| SFR-25 | Lokale Wallet exportieren | — | Muss | Menschliche Verifikation |
| SFR-26 | Dauerhaften Speicher anfordern | — | Soll | Menschliche Verifikation |
| SFR-27 | Untergrenze lokale Wallet | — | Muss | KI-tauglich |
| SFR-28 | Beide Quellen gleichrangig, eine aktiv | SUS-02-AC-1 | Muss | KI-tauglich |
| SFR-29 | Gründe für nicht verfügbare Quellen | SUS-02-AC-4 | Muss | KI-tauglich |
| SFR-30 | Mint-Schnittmenge je Quelle | SUS-02-AC-4 | Muss | KI-tauglich |
| SFR-31 | Quellenwechsel im Betrieb | SUS-02-AC-3 | Soll | Menschliche Verifikation |
| SFR-32 | Quelle im Verlauf | SUS-02-AC-2 | Soll | KI-tauglich |
| SNR-01 | Keine Wallet anlegen | SUS-01-AC-5 | Muss | KI-tauglich |
| SNR-02 | Deletion nur für eigene verbrauchte Events | SUS-01-AC-7 | Muss | Menschliche Verifikation |
| SNR-03 | Wallet-Privkey bleibt im Speicher | — | Muss | Menschliche Verifikation |
| SNR-04 | Kein Empfangen von Nutzaps | — | Muss | KI-tauglich |
| SNR-05 | Kein iframe-Betrieb | — | Muss | KI-tauglich |
| SNR-06 | Kein Backend, keine Zahlung ohne Bestätigung | SUS-01-AC-2 | Muss | KI-tauglich |
| SNR-07 | Kein Verschieben zwischen den Quellen | SUS-02-AC-3 | Muss | Menschliche Verifikation |
| SNR-08 | Lokale Quelle ohne Wallet-Events | SUS-02-AC-2 | Muss | Menschliche Verifikation |
| SNR-09 | Eine Quelle pro Zahlung | SUS-02-AC-2 | Muss | KI-tauglich |
| SNFR-01 | Guthaben in unter 5 s | — | Soll | Menschliche Verifikation |
| SNFR-02 | Float-Vorgänge in unter 10 s | — | Soll | Menschliche Verifikation |
| SNFR-03 | Verhalten bei Netzausfall | — | Muss | Menschliche Verifikation |
| SNFR-04 | Chrome und Brave gleichwertig | — | Muss | Menschliche Verifikation |
| SNFR-05 | Agentenfeste Formulierung | — | Soll | Menschliche Verifikation |
