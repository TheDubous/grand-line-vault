# Grand Line Vault v1.2.3

Private shared One Piece TCG inventory for up to four approved members, with live Supabase collection, password sign-in, numbered boxes, advanced filters and virtual deck plans.

## New in v1.2.3: two OCR regions

- Pink **NAME** rectangle over the printed card name.
- Blue **ID** rectangle over the bottom-right printed card number.
- No misleading whole-card outline. The top of the card need not align with pink corners.
- OCR reads the number first for speed. If unsuccessful, it uses the name region. A shared name with multiple IDs prompts a manual choice rather than guessing.
- Automatic detection and manual Capture remain available; confirmation popup still allows quantity and box selection.

**Update from v1.2.2:** Back up cards and decks, upload the new website files to your existing GitHub Pages repository root and commit. Open `https://thedubous.github.io/grand-line-vault/?v=1.2.3` in Safari to verify. **No new SQL is needed. Do not rerun migration scripts** — the schema, existing cards, decks and accounts are unchanged.

Read [SCAN-GUIDE-v1.2.3.md](SCAN-GUIDE-v1.2.3.md) for the scanning workflow.

The scanner has passed automated parsing, crop alignment, and browser layout tests. Its actual recognition success rate on a physical iPhone has not been measured. If a card does not scan, open OCR diagnostics and share the recognized ID and name text to tune the crops.

The included SQL files are retained for new installation/reference only; **never rerun them on an already migrated v1.2 database.**
