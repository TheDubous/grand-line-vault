# Grand Line Vault v1.0.0 — One Piece TCG

**First official release.** Ignore previous prototype labels; future releases will be numbered v1.1, v1.2, v2.0, etc. The app's internal browser storage key remains stable so updates can preserve data.

## Open `START-HERE.md` for the full setup tutorial

This is a static web app published through GitHub Pages and optionally synced to a private Supabase database. No local development tools or terminal are needed.

### Features in v1.0.0

- English card catalog with detailed filters: individual DON!! costs, colors, power, counters, traits/crews, rarity, attributes, effects, triggers, exact phrases, ownership, and saved filter presets.
- Mobile camera/photo **OCR reads printed card IDs**. Retake or manually choose a printing if needed. **Automatic exact-artwork recognition has not been implemented.**
- Physical card inventory grouped into numbered boxes (Box 1, 2, 3, ...), with quantities and optional notes.
- Multiple virtual decks, OPTCGSim text import/export, Grand Line Vault deck JSON import/export, optional physical copy reservations and conflict warnings.
- Collection import/export CSV (card_id, qty, box, name), and full JSON backups with deck plans and presets.
- Optional Supabase email sign-in with local-first cloud synchronization and revision conflict detection.

### Save locations and future upgrades

- **GitHub** holds only the app code, not the cards you scan or your decks.
- Your browser saves the working copy in localStorage under `grand-line-vault-v1`.
- Once you configure and sign into **Supabase**, a private cloud copy can synchronize between phone and PC.
- A complete JSON backup includes the collection, boxes, saved decks, reservations, and filter presets. Export one before every update.
- Keep using the same GitHub Pages website URL and Supabase project when updating app code. Do not delete Supabase tables.

### Current limitations

- OCR confidence is not established with real phones; glare, foils, and sleeves can reduce accuracy. Photographing **exact alternate artwork automatically** is still a future enhancement.
- The English catalog, card art, OCR assets, and cloud SDK load over the internet from external services.
- Reservations are virtual, not physical transfers. Banned/restricted cards and special construction rules are **not** checked automatically; deck legality warnings are advisory.
- Supabase live sign-in/sync and physical camera usage must be tested with your own accounts and phone. The release has local code-level tests, not a confirmed production deployment.
- Cloud conflict resolution is manual; avoid editing at the same time on two offline devices.
- The Supabase Free plan may pause inactive projects and built-in email has strict delivery restrictions. See `START-HERE.md`.

Fan-made project, not affiliated with Bandai. The card data/image source is a third-party English catalog: https://github.com/michalkiral/optcg-data. Images remain the property of their owners.
