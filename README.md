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
