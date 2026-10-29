# Grand Line Vault v1.2.3 — Dual OCR targets

The camera now highlights **two independent text regions** instead of a misleading whole-card guide:

- **Pink / NAME:** Position the printed card name here.
- **Blue / ID:** Position the card number (usually bottom-right) here.

The whole card does **not** have to fit inside a frame. Positioning the two printed areas is enough. Both colored guides are tied to the exact areas the live scanner OCRs.

OCR checks the ID first for speed. If the ID cannot be read, it scans the name; if several cards share a name it offers matching card IDs rather than automatically selecting a potentially wrong card. You can continue using automatic detection or tap **Capture card**.

Real iPhone accuracy is not yet validated; screenshots and test crops are necessary to tune further.

## Upgrade from v1.2.2

Back up the collection, replace the GitHub Pages site files with those in the release ZIP, commit to `main`, then open `?v=1.2.3` in Safari. **Do not rerun SQL**; tables, passwords, inventory, boxes and decks remain unchanged.
