# Grand Line Vault 1.1.3 — Fast scanner + safer cloud sync

One Piece TCG collection manager for GitHub Pages and Supabase. **This is an update for your existing app, not a new database or migration.** The `grand-line-vault-v1` browser data key and the shared `shared_vault` Supabase document remain unchanged.

## What's new

- One-step scan: camera or captured photo → **one dialog** with card image, name, ID, quantity and box → **Add & next card**.
- Re-take / wrong code available in the same dialog under *Wrong ID, artwork or name?*.
- A softer pastel interface (baby pink, warm beige, baby blue).
- An updated English One Piece card catalog (new maintained `optcg-data-limitless` dataset) with fallback to the previous catalog and fallback images. Card art requires an external image host and cannot be guaranteed for every printing. The scanner remains OCR-based, not full artwork recognition.
- A live **cloud sync indicator** showing local-only, saving, cloud-synced, or not synced.
- A **Check cloud counts / reconcile** action on the Cloud sync screen showing actual remote numbers (when signed in), plus local numbers.
- Synchronization improvements: every foreground return and once per minute while not scanning, check Supabase; pull cloud updates if local data have not changed; upload only if cloud is unchanged; raise a conflict when both changed. Does not silently delete either side's edits.
- Detailed confirmation before deliberately replacing the shared cloud document.

## Before updating: important if devices disagree

1. **Export a JSON backup on EVERY device with distinct data** — the Home Screen iPhone app, Safari, and desktop browser. Keep separate names, e.g. `iphone-homescreen.json`, `iphone-safari.json`, `computer.json`.
2. On the Supabase dashboard, do not delete any data/tables.
3. Note that saving local cards while not signed in does **not** sync them to friends.
4. A prior device may have a different local collection. On connection the app will ask which collection to use. **Do not click “Replace shared vault with local”** unless you intend to overwrite everyone's cloud collection. Download local backup and choose cloud only when you're happy that unique local changes are saved separately.
5. If each backup contains distinct cards, they should be examined and merged deliberately to avoid either losing cards or double-counting them. This version does not automatically merge conflicting quantities.

## Deploy to GitHub

1. Download and extract the ZIP.
2. Open your [repository](https://github.com/TheDubous/grand-line-vault) on the `main` branch.
3. In GitHub upload the **contents** of this folder into the repository root. Replace existing matching files. Keep `index.html`, `app.js` and `styles.css` at the root.
4. Commit and check **Actions / Pages** for successful publication.
5. Visit your existing [website](https://thedubous.github.io/grand-line-vault/), checking the sidebar reads **Version 1.1.3**.
6. On iPhone, first open the website in Safari and check version 1.1.3. Your Home Screen app may be cached separately. Avoid clearing browser site data without first confirming cloud sync and exporting JSON backups. If needed add a fresh Home Screen web app after verifying the original collection exists in Supabase.

No new SQL is required. Keep your existing Supabase URL, **publishable** key and shared-vault member list. Never publish a Supabase secret key.

## Verify cloud synchronization

1. Open **Cloud sync** and sign in.
2. Tap **Check cloud counts / reconcile**.
3. Inspect both *Local* and *Cloud* counts and the cloud revision number.
4. Ensure status says **Cloud synced** or **Shared vault loaded** before using another device.
5. Open the app on a second device. Bring it to the foreground or use **Refresh from cloud**. Compare counts.
6. If differences are found, export local backups and reconcile them explicitly. A warning is safer than silent data loss.

### Independent read-only Supabase check

Open the Supabase **SQL Editor** and execute `DIAGNOSE-CLOUD-READ-ONLY.sql`. The query only reads `public.shared_vault`; it does not change anything.

## Testing and limits

Passed local Node tests: existing inventory/deck compatibility; scanner ID parsing and frame cropping; single-step dialog fields; cloud pull/upload and two-sided conflict protection; saved filters, CSV import, reservations, and deck exports.

**Not tested on your actual iPhone or Supabase project.** This environment blocks browser-based network testing. Camera OCR accuracy and the availability of third-party images still need a real-device check. Cloud updates are **not** real-time; foreground / periodic checks and revision-protected saves are used.
