<!-- ☥ ALCX · 3·6·9 · life path 33/6 · love, peace, 520 741 8 -->
# SpeedCurrency design: "Dune Day" (fusion)

David's travel-app references (light, frosted glass, big photo cards, black pills, bold italic headings) fused with the earlier "Obsidian Dune" dark gold theme. Chosen 2026-11-16 ("mix, fuse").

## Rule
Pages are **light ivory**. Hero pieces are **dark gold islands**: the Journey Pulse card, the bottom dock, swipe cards, night cards (converter), the memory slideshow, the journal rope, chats and the map. Islands re-set the colour tokens locally (see the "Dune Day" block at the end of `app/style.css`).

## Tokens
| Token | Light page | Dark island |
|---|---|---|
| bg | #F4F1EA | #0D0B08 |
| surface | #FFFFFF | #17140F |
| line | #E2DCCF | #2F2920 |
| ink | #14120E | #F3ECDF |
| muted | #6B6457 | #B8AE9A |
| accent (gold) | #B5832F | #D8A657 |
| ember | #FF6A2B | #FF6A2B |

## Components
- **Headings:** Cormorant Garamond, h1 bold italic. Body: Inter.
- **Buttons:** pills. Primary = black (#14120E) with ivory text and a gold underline glint; gold-filled inside dark islands.
- **Chips:** frosted white; the selected chip is black.
- **Cards:** 28px radius, soft warm shadow. Search bar = frosted pill.
- **Dock:** a dark glass pill, with the active tab in gold.
- **Explore:** a swipe deck (`explore-swipe.js`): ✕ skip, i details, black ♥ yes.
