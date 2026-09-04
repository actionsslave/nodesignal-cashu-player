# Paste into Claude Code

Read `design_handoff_podcast_nav/README.md` in full before writing any code, and
open `design_handoff_podcast_nav/mockups/Podcast Nav.dc.html` in a browser to see
the design it describes.

Implement **turn 5 only** — `5a` (the whole page) and `5b` (the nine states and
dialogs). Turns 4, 3 and 2 in that file are superseded; do not build them. The
older `design_handoff_cashu_player` bundle is also superseded.

Rules for this work:

- `spezifikation-nodesignal-player-showcase.md` is authoritative for behavior; the
  README is authoritative for layout, copy and tokens. Where they touch the same
  thing (float amounts, streaming interval, defaults), the specification wins.
- The HTML is a design reference, not code to port. Recreate it in this repo's
  React + TypeScript + Vite environment with the existing components and state.
  Do not import the mockup, `support.js`, `image-slot.js` or the design-system
  bundle into the app — read values out of them.
- All German copy in the README is final. Use it verbatim, including the five
  error texts and the one-time NIP-60 relay-loss notice.
- Take every color, size and spacing value from the tokens listed in the README's
  Design tokens section (source of truth: `mockups/_ds/broadsheet-…/styles.css`).
  No new colors, no sans-serif anywhere.
- Sample data in the mockup is fictional — episode numbers, titles, amounts, mint
  URLs, npub and dates. Use the real feed snapshot and the real allowed mints.
- Respect the negative requirements as hard constraints: never create or modify
  `kind:17375`, publish deletions only for `kind:7375` events this app read and
  spent, never move balance between the two sources except by float withdrawal and
  return, never mix proofs from both sources in one nutzap, no backend, no payment
  without explicit confirmation.

Work in the order of the README's Screen map, and stop for review after the
Zahlungsquelle section is on screen with real NIP-60 and local balances.
