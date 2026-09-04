# Handoff: Nodesignal-Player (Showcase, Ziel 1)

## Overview

A public single-page podcast player for one podcast (Nodesignal), on
`player.nodesignal.space`, demonstrating value-for-value with Ecash. Login via a
nostr extension is identity only. The listener has **two equal-rank payment
sources** and picks one:

- **nostr-Wallet (NIP-60)** — pays out of the user's existing wallet, via a
  **Session-Float**: one withdrawal at the start of a session, spent locally, the
  remainder written back at the end.
- **Lokale Wallet** — a Cashu token pasted into the player, spent directly.

This design derives from `spezifikation-nodesignal-player-showcase.md`
(04.09.2026), which supersedes NR-09 of the MVP document under the narrow rules
SNR-01…SNR-06. Requirement IDs (SFR-/SNR-/SNFR-/SUS-) below refer to that
specification — it, not this document, is authoritative for behavior. This document
is authoritative for layout, copy and tokens.

Repository this was designed against: `08Cashu-player` (`actionsslave/cashu-player`);
the new repo is derived from it per SFR-01.

**Language: German throughout — final copy, use it verbatim.** Numbers in German
formatting (`1.500`, `10.000`), sats as `Sat`.

## What changed from the previous handoff

The earlier bundle (`design_handoff_cashu_player`, and turns 2–4 in the mockup) is
**reference only**. Concretely dropped and added:

| Dropped | Why |
| --- | --- |
| Library, show page, subscription grid, search | one podcast, one page (SFR-05) |
| Multi-show episode feed with show kickers | episodes belong to one show (SFR-06) |
| Full-screen player as a separate view | the player is a section plus a sticky strip |
| Single wallet balance, "Mints" table with keysets | replaced by two sources, each with its own mint intersection |
| Receiving address, nutzap inbox, redemption | never existed / SNR-04 |
| Value split across several recipients | one recipient: Nodesignal's `kind:10019` |

| Added | Requirement |
| --- | --- |
| Two source blocks, exactly one active, choice persisted | SFR-28 |
| Float: three numbers at once (Wallet / Float / Sitzung gesendet) | SFR-20 |
| Float withdrawal + return, with confirmation and one-time risk notice | SFR-16…SFR-18, SNR-06 |
| Per-source mint intersection, shown separately | SFR-30 |
| History typed by Streaming / Boost / Float-Entnahme / Float-Rückgabe / Aufgeladen / Exportiert, **naming the source** | SFR-21, SFR-32 |
| Per-source unavailability reasons, spelled out individually | SFR-11, SFR-29 |
| Conflict state ("bereits ausgegeben") | SFR-19 |
| Unreturned float from a broken-off session | SOQ-03 |
| Explainer section for visitors with no extension | SOQ-08 |
| Feed snapshot date and live-fetch fallback note | SFR-09 |
| Export with QR code, persistent-storage result, 10-Sat floor | SFR-25…SFR-27 |
| Settings: float amount, streaming rate, `kind:7376` off by default | SFR-18, SFR-21, SFR-23 |

## About the design files

`mockups/Podcast Nav.dc.html` is a **design reference created in HTML** — intended
look, hierarchy and states, not production code. Recreate it in the repo's existing
environment (React + TypeScript + Vite under `src/`), using its components and
state. Do not import the HTML, `support.js`, `image-slot.js` or the design-system
bundle into the app; read values out of them.

Open the file in a browser (everything needed is in `mockups/`, except the Phosphor
icon font and Google Fonts, which come from a CDN). It is one pan-and-zoom canvas,
newest at the top:

- **Turn 5 — build this.** `5a` the whole page (logged in, NIP-60 active, float
  open); `5b` nine states and dialogs.
- **Turns 4, 3, 2 — superseded.** Do not build. Useful only as a record of the
  earlier single-source wallet and the full-screen player treatment.

## Fidelity

**High-fidelity.** Colors, type sizes, spacing and copy are final and come from the
Broadsheet design system; every value is a token or an explicit px value stated
below. Deliberately not final: the episode cover is a grey drop-in placeholder
(`<image-slot>`) under a `.halftone` screen — real art comes from the feed's
`<itunes:image>`, keep the halftone treatment. All sample data (episode titles,
amounts, mint URLs, npub, keysets, dates) is fictional, **including the episode
numbering and titles** — take real ones from the feed snapshot.

## Page frame

The page is **1120 px wide** (content column; centre it in wider viewports) on the
paper ground `#f3f2f2`. It is an open broadsheet: **no cards, no boxed panels, no
section borders.** Structure comes from the serif scale and whitespace. Only these
rules print:

1. **Masthead rule** — `height: 3px; background: var(--color-text)`, full content
   width, `margin-top: 14px`.
2. **Dateline strip** — under it, `display: flex; justify-content: space-between;
   padding: 7px 0; font-size: 12px; text-transform: uppercase; letter-spacing: .1em`
   at 62% ink. Three items.
3. **Hairline** — `height: 1px; background: var(--color-divider)` closing the head.

Horizontal padding is **40px** throughout. Section blocks are `padding: 38px 40px 0`
(the first content block after the head is `30px 40px 0`). Row rules inside lists
and tables are `1px solid var(--color-divider)` and separate rows — they never wrap
anything in a box.

## 5a — The page, top to bottom

### Masthead

`display: flex; align-items: baseline; gap: 26px`: wordmark **Nodesignal**
(heading, 600, `26px`, `letter-spacing: -0.02em`), the word **Player** at `16px`
72% ink, then — pushed right — the four index links at `15px`
(**Folgen** · **Wallet** · **Einstellungen** · **Was ist das?**), the active one
heading 600 in `var(--color-accent-700)`, the rest 72%; then the truncated npub,
`14px` tabular at 70%.

The index links are in-page anchors (SFR-05 forbids routing, not anchors). The
active link follows the scroll position. Not logged in, the npub is replaced by a
`.btn.btn-primary` **Mit nostr anmelden**.

Dateline: `Value for Value mit Ecash` · `Feed-Stand 4. September 2026` ·
`Quelle: nostr-Wallet (NIP-60)`. The third item names the active source; the second
comes from the build snapshot (SFR-08) and, when the runtime fetch fails, is the
only place that says so (SFR-09).

### Aktuelle Folge (player, SFR-07)

`display: flex; gap: 28px; align-items: flex-start`.

- Cover `168 × 168`, `.halftone`.
- Kicker `Läuft · Folge 140 · 28. August 2026` at `12px` uppercase `.12em`, 55%.
- `<h2>` episode title, `30px`, `line-height: 1.15`, `max-width: 36ch`.
- Scrubber, `max-width: 720px; margin-top: 20px; gap: 16px`: elapsed `12:38`, a
  `2px` bar on `var(--color-neutral-300)` with the played part `var(--color-accent)`
  and a `10px` accent knob, remaining `−20:44`. Both `14px` tabular at 65%.
- Transport, `gap: 22px; margin-top: 14px`: `ph-arrow-counter-clockwise` `21px`
  (−15 s) · `ph-pause-circle` **`52px`** in `var(--color-accent-700)` ·
  `ph-arrow-clockwise` `21px` (+30 s) · an 8px spacer · `.btn.btn-primary`
  **Boost** (`ph-lightning`, `15px`, `padding: 9px 20px`) · the readout
  `Streaming 10 Sat/Min · aus dem Float` at `14px` tabular, 72%.
  Only −15/+30 exist; no skip-track buttons (one show, one queue).
- **Session line**, `margin-top: 24px; padding-top: 14px; border-top: 1px solid
  var(--color-divider); display: flex; gap: 44px`:
  `In dieser Sitzung gesendet **30 Sat**` · `Float 470 Sat` (72%) ·
  `Keine Wallet-Events seit der Entnahme` (72%), then right-aligned
  `.btn.btn-ghost` **Float jetzt zurückschreiben** (SFR-17, manual trigger).
  With the local source active, the line reads the local balance and drops the
  float items.

Playback position is remembered per episode and shown in the list as
`Fortsetzen bei 12:38`.

### Folgen (SFR-06)

`<h3>` **Folgen** at `25px` with `Die 20 neuesten · absteigend nach Datum` at
`14px` 62% right-aligned. Rows: `display: grid; grid-template-columns: minmax(0,1fr)
auto 44px; align-items: center; gap: 0 24px; padding: 16px 0; border-bottom: 1px
solid var(--color-divider)`.

- Kicker: `28. August 2026 · 33 min · läuft` — `11px` uppercase `.1em` at 62%.
- Title: heading, 600, `19px`, `margin-top: 3px`.
- Description: `14px` at 70%, single line, ellipsis.
- Right: `Fortsetzen bei 12:38` / `58 min` / `Gehört`, `14px` tabular at 70%.
- Play: `.btn.btn-icon.btn-secondary` with `ph-play` at `17px` — `.btn-ghost`
  when the episode is played.

Below: `.btn.btn-ghost` **Ältere Folgen anzeigen** (the list starts at 5–6 rows;
20 are available).

### Zahlungsquelle (SFR-28…SFR-32)

`<h3>` **Zahlungsquelle** with `Genau eine Quelle ist aktiv · die Wahl bleibt nach
einem Reload erhalten` at `14px` 62%. Intro at `15px/1.6`, `max-width: 84ch`, 78%:
“Beide Quellen können dasselbe. …”

Two equal columns: `display: grid; grid-template-columns: minmax(0,1fr)
minmax(0,1fr); gap: 52px`. **Neither column is visually privileged** — same
type sizes, same order of parts, no border between them. Per column:

1. Header: `.radio` (its `<input type="radio">` + `<span class="dot">`, one
   name for both columns) · `<h4>` source name, heading 600, `21px` · a status
   `.tag`: `.tag-accent` **Aktiv** for the active one, `.tag-neutral` **Bereit**
   for the available-but-inactive one, `.tag-accent-2` for an unavailable one
   (**Nicht wählbar**, **Kein Guthaben**).
2. Balance: heading 600 **`52px`**, `line-height: .9`, `letter-spacing: -0.03em`,
   tabular; `Sat` at `20px`; a qualifier at `14px` 62% — `in der Wallet` /
   `auf diesem Gerät`.
3. Two-column figure list, `gap: 6px 20px`, `15px` tabular:
   NIP-60 → `Float (lokal verfügbar) 470 Sat`, `In dieser Sitzung gesendet 30 Sat`.
   Local → `Speicher dauerhaft` (or `best effort`, SFR-26),
   `In dieser Sitzung gesendet 0 Sat`.
4. Mint intersection, `margin-top: 18px; padding-top: 14px; border-top: 1px solid
   var(--color-divider)`. Kicker naming the sets it is built from — **this wording
   is the requirement made visible**:
   `Nutzbare Mints — kind:17375 ∩ erlaubte Liste ∩ kind:10019` for NIP-60,
   `Nutzbare Mints — erlaubte Liste ∩ kind:10019` for the local wallet. Then one
   line per mint at `15px` with its balance at 60% ink. An empty intersection
   states the missing mint instead (SFR-15).
5. Actions. NIP-60: `Float-Betrag 500 Sat` at `15px` plus `.btn.btn-ghost`
   **Ändern**, then the note “Streaming und Boosts laufen gegen den Float. Auf die
   Relays wird zweimal je Sitzung geschrieben: bei der Entnahme und bei der
   Rückgabe.” at `14px/1.6` 68%. Local: a `.input` (placeholder `cashuA…`) with
   `.btn.btn-primary` **Aufladen** beside it, then `.btn.btn-secondary`
   **Als Token exportieren** and `.btn.btn-ghost` **Aus Zwischenablage**
   (`ph-clipboard`).

Under both columns, two `14px` notes at 72%, `gap: 40px`:
“Eine Zahlung wird immer aus genau einer Quelle finanziert.” (SNR-09) and
“Beim Wechsel wird ein offener Float zurückgeschrieben, bevor die neue Quelle aktiv
wird.” (SFR-31).

### Verlauf (SFR-21, SFR-32)

`<h3>` **Verlauf** with type filters beside it (`gap: 20px`, then `gap: 8px`):
**Alle** selected — a `.tag` with `background: var(--color-accent); color:
var(--color-bg); border: 1px solid var(--color-accent)` — then `.tag.tag-outline`
**Streaming**, **Boost**, **Float**, **Wallet**.

Table: `grid-template-columns: 110px 110px 160px 170px minmax(0,1fr) 130px;
gap: 0 22px`. Header `12px` uppercase `.12em` at 55% with a bottom hairline; rows
`15px`, `padding: 11px 0`, bottom hairline except the last. Columns:
**Betrag** (tabular, signed) · **Wann** (65%) · **Art** · **Quelle** (72%) ·
**Folge** (72%, `—` when not tied to one) · **Status**.

Six `Art` values, and only these: `Streaming`, `Boost`, `Float-Entnahme`,
`Float-Rückgabe`, `Aufgeladen`, `Exportiert`. `Quelle` reads
`nostr-Wallet · Float` for payments financed from the float, `nostr-Wallet` for the
float operations themselves, `Lokale Wallet` for the local source. `Status` is
`Gesendet` in `var(--color-accent-700)` for payments; for float operations it names
the events written (`kind:7375 · kind:5`) at 65% ink.

### Einstellungen

`<h3>` plus “Gilt für dieses Gerät. Vor der ersten Zahlung werden Float-Betrag und
Streaming-Satz einmal bestätigt.” Rows: `grid-template-columns: 280px 200px
minmax(0,1fr); gap: 0 24px; padding: 12px 0; border-top: 1px solid
var(--color-divider)` (last row also `border-bottom`), `15px`; third column is the
explanation at 65%.

| Label | Value | Explanation |
| --- | --- | --- |
| Float-Betrag | `500 Sat` | `Bereich 100–10.000 · wird bei der ersten Entnahme bestätigt` |
| Streaming-Satz | `10 Sat / Minute` | `Abgerechnet je 60 s gehörter Zeit` |
| Boost-Vorgaben | `100 · 500 · 2.100` | `Frei wählbar beim Senden` |
| History-Events (kind:7376) | `.seg` **Ein** / **Aus**, **Aus** checked | `Standardmäßig aus. Der Verlauf bleibt lokal.` |
| Feed | `4. September 2026` | `Stand aus dem Build · Live-Abruf war erfolgreich` |

### Was ist das? (SOQ-08)

`<h3>` plus “Für Besucher ohne nostr-Extension und ohne Wallet.” Three columns,
`gap: 44px`, each a `11px` uppercase kicker (**Value for Value** · **Was du
brauchst** · **Ohne alles**) over `16px/1.6` body at 84%. Copy verbatim from the
mockup.

### Sticky player strip

`height: 74px; padding: 0 40px; border-top: 1px solid var(--color-divider);
background: var(--color-neutral-100); display: flex; align-items: center; gap: 26px`.
Pins to the bottom of the viewport once the Aktuelle-Folge section scrolls out;
audio never restarts. Contents: `ph-pause-circle` `32px` accent · a `300px` block
with the show kicker over the episode title (heading 600, `15px`, ellipsis) ·
the scrubber (`13px` timestamps, `2px` bar) · `10 Sat/Min · Float 470` at `13px`
tabular 72% · `.btn.btn-primary` **Boost** (`padding: 7px 16px`).

## 5b — States and dialogs

Dialogs are `.dialog`, `width: 540px; padding: 26px 28px; background:
var(--color-bg); box-shadow: var(--shadow-lg)`, over a `.dialog-backdrop`. Every
one follows the same skeleton: a `12px` uppercase kicker, an `<h3>` at `25px`
stating the amount or the fact, a `15px/1.6` explanation at 78%, a
`grid-template-columns: 170–190px minmax(0,1fr); gap: 8px 22px` detail list fenced
by hairlines, then actions at `gap: 14px`. The primary action **names the amount**
(`500 Sat entnehmen`, `470 Sat senden`) rather than saying “OK”.

1. **Erste Entnahme · Bestätigung** (SFR-18, SNR-06) — details: Float-Betrag with
   its range, Streaming-Satz, Mint. Then the **one-time NIP-60 risk notice**
   (relay loss of `kind:7375`, “eine Eigenschaft von NIP-60, keine dieses
   Players”) — shown once, before the first float, not repeated.
   Actions: **500 Sat entnehmen** · **Abbrechen** · ghost **Betrag ändern**.
2. **Boost senden** (SFR-22, SFR-32) — amount chips `100 / 500 / 2.100 / 10.000`
   (selected chip filled accent, the rest `.tag-outline`) + `Sat · frei wählbar`;
   a `.input` for the public comment; details Quelle / Mint / Float danach. When
   the chip exceeds the float, `Float danach` goes negative, a note offers
   **Float aufstocken**, and the button falls back to the payable amount
   (`470 Sat senden`) — compute the label from what the source can actually fund.
3. **Quellenwechsel im Betrieb** (SFR-31, SNR-07) — details: Float-Rückgabe
   `470 Sat → kind:7375`, the new source with its balance, and
   `Sitzungszähler läuft weiter bei 30 Sat`. Action
   **Zurückschreiben und wechseln**.
4. **Konflikt** (SFR-19, SUS-01-AC-7) — kicker `Konflikt` in
   `var(--color-accent-2-700)`; states that the state was reloaded and that **no**
   deletion event was published; details name the affected event count, the new
   balance and the unchanged float. Actions **Erneut versuchen** ·
   **Auf lokale Wallet wechseln**.
5. **Beide Quellen nicht verfügbar** (SFR-29, SUS-02-AC-4) — an in-page block, not
   a dialog. `<h3>` **Zahlungen sind deaktiviert** + “Hören funktioniert
   uneingeschränkt weiter.” Then one hairline-separated block per source: a
   disabled `.radio` at `opacity: .45`, the name at `19px` in 60% ink, a
   `.tag-accent-2` reason tag, and a `15px` sentence naming exactly what is
   missing — indented `28px` to align under the name. The local block keeps its
   Aufladen field. A closing `14px` note at 68% lists the other reasons that
   appear in the same place (no `nip44`, empty mint intersection).
6. **Rest aus der letzten Sitzung** (SOQ-03) — in-page block on load: `248 Sat aus
   der letzten Sitzung liegen noch lokal`, details Rest / Mint / Seit, actions
   **Jetzt zurückschreiben** and ghost **Als Float weiterverwenden**. Offered
   automatically, executed on click.
7. **Lokale Wallet exportieren** (SFR-25) — the QR at `118 × 118` with a `1px`
   divider border beside a `.input` holding the token string (`13px`,
   `word-break: break-all`, 78%), then **Kopieren** (`ph-copy`) and ghost
   **Als Datei speichern**; closing note that the balance stays at the mint until
   redeemed and that clearing site data destroys only the local copy.
8. **Fehlertexte, wörtlich** (SFR-24, SFR-26, SFR-27) — five hairline-separated
   blocks, each an `11px` uppercase kicker in `var(--color-accent-2-700)`
   (`Speicher` is neutral) over the message at `15px/1.6`: Nicht erlaubter Mint /
   Bereits eingelöst / Ungültig / Speicher / Untergrenze erreicht. **Use these
   strings verbatim** — each names the concrete cause, per SFR-24.
9. **Ohne Anmeldung · im iframe** (SFR-12, SNR-05) — the masthead with
   **Mit nostr anmelden** in place of the npub, dateline `Nicht angemeldet` ·
   `Wiedergabe frei` · `Zahlungen aus`, and the iframe refusal as a hairline block:
   the wallet is off, open `player.nodesignal.space` directly, with
   **Im eigenen Fenster öffnen**.

## Interactions & behavior

- **Index links** scroll to sections; the active one tracks scroll position. No
  router (SFR-05).
- **Source radio** switches the funding source. While playback runs, it opens
  dialog 3 first and writes back an open float before the new source becomes
  active (SFR-31). The choice persists across reloads (SFR-28).
- **Float withdrawal** happens at the first payment intent of a session, never on
  page load, and only after dialog 1 has been confirmed (SNR-06). It is confirmed
  once; later sessions withdraw without asking again, but the amount stays visible
  and changeable.
- **Float return** fires on `visibilitychange` and `pagehide`, on ending playback,
  and on the ghost button — idempotent, so a double fire writes one event (SFR-17).
- **Streaming** bills every 60 s of *listened* time (SFR-23); with NIP-60 it only
  reduces the float and writes nothing to relays. The session counter carries
  across a source switch.
- **Local floor** — below 10 Sat, streaming from the local source stops with the
  notice from block 8 and resumes at the same point after a successful top-up
  (SFR-27).
- **Login** — `window.nostr.getPublicKey()`, then a `nip44` capability check. No
  `nip44` → the NIP-60 source is not selectable and says why; the local wallet
  stays fully usable (SFR-10, SFR-11).
- **No login** — episode list and playback unrestricted, payments off (SFR-12).
- **Never** create or modify `kind:17375`, never publish deletions for anything
  other than `kind:7375` events this app itself read and spent, never move balance
  between the two sources except by float withdrawal and return, never mix proofs
  from both sources in one nutzap (SNR-01, SNR-02, SNR-07, SNR-09).
- **Hover / focus** come from the design system; don't restyle them. Focus is
  `2px solid var(--color-accent)`, `outline-offset: 2px`.

## State

- `activeSource: 'nip60' | 'local'` — persisted locally; `sourceAvailability` per
  source with a reason code (`no_wallet_event` | `no_nip44` | `no_balance` |
  `no_mint_intersection`).
- `nip60: { walletBalanceBySat, mints[], privkeyInMemoryOnly, eventIdsToProofs }` —
  the event-id → proofs map is kept locally so an aborted float is recoverable
  (SFR-14).
- `float: { amount, remaining, mint, openedAt, returnedAt }`, `floatSetting`
  (default 500, range 100–10 000), `floatConfirmed: boolean`.
- `local: { balance, mints[], storagePersisted: boolean }`.
- `session: { sentTotal }` — source-independent, survives a source switch.
- `playback: { episodeId, position, rate }`, per-episode `positionSeconds`.
- `history[] { art: 'streaming' | 'boost' | 'float_out' | 'float_in' | 'topup' |
  'export', amount, timestamp, source, episodeId?, status, eventKinds? }`.
- `settings: { streamingRate, boostPresets, writeHistoryEvents: false }`.
- `feed: { snapshotDate, liveFetchOk }`.

## Design tokens

From `mockups/_ds/broadsheet-…/styles.css` — take them from there if this list ever
disagrees.

| Token | Value | Used for |
| --- | --- | --- |
| `--color-bg` | `#f3f2f2` | page ground |
| `--color-text` | `#201e1d` | all text, masthead rule |
| `--color-accent` | `#0088b0` | selected radio/chip, progress bar, filter fill |
| `--color-accent-700` | `#006786` | accent text and icons, `Gesendet`, active index link |
| `--color-accent-600` | `#1186ac` | link hover |
| `--color-accent-2-700` | `#aa0b56` | every failure/blocked wording |
| `--color-neutral-100` | `#f8f4f4` | sticky strip ground |
| `--color-neutral-300` | `#d7d3d3` | unplayed part of progress bars |
| `--color-divider` | `#201e1d` at 16% | every hairline |
| `--shadow-md` / `--shadow-lg` | see stylesheet | mockup frames / dialogs |
| `--font-heading` / `--font-body` | `"Source Serif 4"` | everything — no sans anywhere |

Magenta (`--color-accent-2`) is reserved: in this design it marks only failure and
unavailability. Cyan marks everything interactive and everything succeeded.

Muted text is `color-mix(in srgb, var(--color-text) N%, transparent)` with
N = 84 (explainer body), 78 (explanations), 72, 70, 68, 65, 62, 60, 55 (faintest
kickers). Map to the app's own scale if it has one.

Type scale in use: `52` (source balance) · `30` (episode title in the player) ·
`26` (wordmark) · `25` (h3) · `21` (h4, source name) · `19` (episode row title) ·
`16` (explainer body) · `15` (rows, tables, notes) · `14` (meta, buttons) ·
`13` (strip, token string) · `12` (dateline, kickers, uppercase `.12em`) ·
`11` (row kickers, uppercase `.1em`).

Everything numeric that sits in a column or changes live uses
`font-variant-numeric: tabular-nums`.

## Icons

Phosphor, **duotone only** (`ph-duotone ph-*`): `pause-circle`, `play`,
`arrow-counter-clockwise` (−15 s), `arrow-clockwise` (+30 s), `lightning` (Boost),
`clipboard`, `copy`.

## Assets

No bitmap assets. The episode cover is a placeholder; keep the `.halftone`
treatment (a 3px dot screen at `mix-blend-mode: multiply` over
`grayscale(0.35) contrast(1.15)`). `image-slot.js` is prototype-only — do not port
it. The QR in dialog 7 is drawn as a placeholder; generate a real one from the
token string.

## Files

- `mockups/Podcast Nav.dc.html` — all screens. Search by `data-screen-label`:
  `5a Seite`, `5b Quellen gesperrt`, `5b Float-Wiederherstellung`,
  `5b Fehlerzustaende`, `5b Ohne Login`; superseded: `4a Wallet`, `3a Player`,
  `2a …`, `2b …`.
- `mockups/_ds/broadsheet-…/styles.css` — tokens and component classes
  (`.btn`, `.tag`, `.seg`, `.radio`, `.input`, `.dialog`, `.halftone`).
- `mockups/_ds/broadsheet-…/readme.md` — the design system's own guide.
- `mockups/support.js`, `mockups/image-slot.js` — prototype runtime, reference only.

## Screen map

| Section / state | Requirements | Build in |
| --- | --- | --- |
| Masthead, index, dateline | SFR-05, SFR-09, SFR-12 | app shell |
| Aktuelle Folge + sticky strip | SFR-07, SFR-23 | `src/player/` |
| Folgen | SFR-06, SFR-08 | `src/player/` + feed snapshot |
| Zahlungsquelle | SFR-13…SFR-15, SFR-20, SFR-28…SFR-30 | `src/wallet/` |
| Float dialogs, conflict | SFR-16…SFR-19, SNR-01…SNR-03 | `src/wallet/` |
| Boost / Streaming | SFR-22, SFR-23, SNR-09 | `src/payments/` |
| Lokale Wallet: Aufladen, Export, Speicher, Untergrenze | SFR-24…SFR-27 | `src/wallet/` (exists in `cashu-player`) |
| Verlauf | SFR-21, SFR-32 | `src/wallet/` |
| Einstellungen | SFR-18, SFR-21, SFR-23 | app shell |
| Was ist das? | SOQ-08, SFR-11 | app shell |
