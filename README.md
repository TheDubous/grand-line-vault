# Grand Line Vault v1.4.0 — Deck Intelligence (proposed)

A new Deck Intelligence page matches 50-card tournament/source references against the shared Supabase inventory. No physical cards or reservations are modified.

## Provenance and automatic source refresh
- The GitHub Actions workflow .github/workflows/sync-decks.yml can be launched manually after merge and is scheduled Monday and Thursday. It reads the documented Limitless One Piece tournament API (game OP) and recent standings.
- Only valid 50-card main decks with a Leader and at most four copies per card are retained, along with tournament name, date, player, placing, and source URL.
- No data is fabricated. The initial feed is empty until a successful API refresh; empty or failed refreshes do not overwrite it.
- Reddit/community decks can be pasted into the manual import form with an optional URL; manually imported lists are never labeled tournament-verified. No automatic Reddit scraping.

## Collection-aware recommendations
- Count exact owned quantities across all boxes and filter lists by owned Leaders and missing main-deck copies.
- Infer card roles from printed effects and suggest physically owned replacements with matching Leader colors, category, traits, DON cost, counters, and roles.
- Every suggestion includes concrete reasons and a heuristic fit score, never a fabricated win rate.
- Create owned or experimental variants; if enough suitable cards are unavailable, show missing slots instead of inventing a 50-card deck.
- Try individual one-for-one swaps with guardrails and export a valid 50-card list to OPTCGSim or save as a new virtual deck.

## Legality / limitations
- Preliminary checks include 50 main cards, four copies per ID, Leader color compatibility, and a known November 27, 2026 restricted pair. This is NOT a complete current legality service. Confirm official bans, pairs, released card sets and event formats before tournament use.
- Tournament evidence is historical. Reddit/other sites provide ideas but cannot prove a card upgrade increases win rate.
- The recommender does not require a Supabase migration or change collection/deck storage.

## Rollout
- Review and merge PR into main. Run the GitHub Actions Refresh One Piece tournament decklists workflow once; it then refreshes on schedule. If no public decks are returned, inspect workflow logs.
- Test with node tests/intelligence-v140.cjs; the existing CI workflow tests scanner, cloud, password and other deck workflows.

## Grand Line Vault v1.3.0 — Card Explorer + Deck Studio (proposed)

- Card art in the English catalog, inventory and deck builder supports desktop hover zoom, keyboard Enter/Space and tap/click for a full card-detail window.
- The common detail shows card text, stats, traits, physical box/slot locations, owned/reserved/free counts, and shortcuts to add copies, open inventory or add to a deck.
- Catalog and deck builder filters support **multiple color chips simultaneously** (matches any selected color). Saved filter presets retain this selection; older one-color presets still load.
- Two-pane deck studio on wide screens, browse/deck tabs on narrow screens, a DON!! cost curve, and **All / Only owned / Only free** deck-pool filters with an optional Leader-color compatibility filter.
- **Prepare deck** creates a read-only picking checklist grouped by box and slot, including the Leader and missing card copies. Ticking a card changes only temporary UI state; it does not subtract, reserve or move collection cards.
- The optional storage-management ideas (QR box labels, box gallery, global command search) are deliberately **not** included.
- Frontend only. No new Supabase SQL, migrations, table changes or account changes. Existing cards, decks, reservations and number boxes are preserved.
- Before trying any future batch modifications, back up the shared inventory. Test the new UI on both desktop and iPhone before merging into main.


## v1.2.6 — scanner and bulk inventory (review release)

- Wider NAME target: 88% of preview, unchanged fixed ID target.
- Automatic scan is a real on/off button, remembered locally; manual Capture works when off.
- One-frame corroboration uses a second ID OCR crop when a candidate appears, aiming to reduce repeated attempts. It may take longer per attempt on older iPhones; timing must be measured on the actual device.
- Catalog: select multiple card IDs, add them to a chosen box, or move/delete ALL owned copies of those IDs after a clear warning.
- Inventory: select specific records, select up to 100 filtered records, move to another numbered box or delete with explicit DELETE confirmation.
- Every bulk write goes through existing cloud-first Supabase RPC batches. Limit is 100 affected inventory records (maximum 200 delta operations) per bulk action.
- Deletion has no undo: export a JSON backup before testing.
- No Supabase schema or SQL changes, no changes to decks, reservations, authentication or existing stored cards.

## v1.2.5 automatic scanner improvement (proposed)

- Fixed NAME and ID target positions are unchanged.
- Auto OCR first reads the focused ID area; if necessary, it tries the wider high-contrast ID crop, then two name crops.
- Two matching **successful** readings within 8 seconds now confirm a candidate even if an intervening frame was unreadable. A different detected ID resets the candidate immediately.
- No card is saved automatically: the same confirmation popup with box and quantity is required.
- Manual Capture and the existing Supabase inventory/decks/login remain unchanged. No database migration.
- On real devices, recognition time depends on OCR processing and camera focus. Please test against cards that previously needed multiple Capture taps.

# Grand Line Vault v1.2.4 — Fixed Scanner + Automatic Recognition

This is an **incremental website update** for an existing v1.2.x installation of Grand Line Vault. It preserves password sign-in, Supabase shared inventory, numbered boxes, deck plans and the cloud database format.

## Changes

- **Fixed target windows, calibrated to the supplied iPhone recording**: NAME at 22% left / 75% top / 57% width / 8% height; ID at 71% left / 83% top / 25% width / 6.5% height. Measurements are relative to the visible preview, not the full camera sensor.
- **One automatic mode**: always enabled while the camera runs, without a fast/reliable switch. **Capture card** stays as a manual fallback.
- Automatic OCR reads the ID crop, then a slightly wider crop if necessary; if ID is unclear, it tries one focused name crop. Two consistent readings are required before the confirmation popup.
- The existing popup still lets you verify the card, quantity and remembered box. **Nothing saves until you press Add & next card and Supabase confirms.**
- Keeps anti-duplicate behavior after saving the same card.

**Expected latency:** targeting approximately 1–2 seconds for a clear card after the OCR engine has loaded. This is a target, **not a measured guarantee**; slower iPhones and difficult text can take longer.

## Updating GitHub Pages

1. **Back up** your shared collection in Grand Line Vault. Check cloud sync is ready.
2. Extract `GrandLineVault-v1.2.4-GitHub.zip` and upload its contents to the root of `TheDubous/grand-line-vault`, replacing existing website files. Commit to branch `main`.
3. Wait for GitHub Pages deployment, then open `https://thedubous.github.io/grand-line-vault/?v=1.2.4` in Safari and check the sidebar version.
4. If the iPhone Home Screen app remains on an old version, reopen it and check again. **Do not clear website data** without verifying cloud sync and backups. If needed, add a fresh Home Screen shortcut from the updated Safari page.

**Do not rerun SQL migrations or change Supabase settings.** No schema migration is required from v1.2.3.

## Tests

The included Node tests cover crop coordinates, two-read confirmation, OCR parsing, ambiguous names, password sessions, and database contract simulations. The crop positions were overlaid on a frame from the supplied iPhone recording. Full live iPhone OCR speed/accuracy and production Supabase behavior have not been verified in this build.
