# Grand Line Vault v1.2.2 — install and safe upgrade

**This version is a TEST RELEASE for your existing shared Supabase project.**
It has been syntax-tested and simulated with 5,200+ rows, but **has not been tested against your live Supabase project or a physical phone camera**.
It changes the cloud schema, so **do not upload the website files first**.

## What's new

- One cloud source of truth; all four approved accounts use the same physical inventory.
- Online-only editing; offline devices show only a cached read-only collection.
- Atomic per-card quantity increments/decrements, with an idempotency request ID; no whole-collection overwrites.
- Live Supabase Realtime change notifications and refresh-on-focus fallback.
- Keeps the number of physical copies per numbered box; 5,000+ rows fetched in 1,000-record pages.
- Simple scanner: automatic detection OR Capture → **one popup** with English standard-art image, printed card ID, name, catalog color, copies, last used box → **Add & next** after cloud confirmation.
- Uses printed ID primarily and unique **exact card name OCR** as a fallback. Color is shown from the catalog, **not independently recognized from the photograph**. No special-art matching or print variants.
- Card catalog health summary in Card catalog (unique loaded IDs, image URLs, loading time). Completeness cannot be guaranteed.
- Keeps password login, deck import/export, reservations, filters, presets and pastel colors from previous versions.
- Scanned photos are processed temporarily and not uploaded/stored.
- Does not include activity history, undo or online-presence tracking (as requested).

## Phase 0 — Mandatory safety steps

1. **Stop making changes on every device** (laptop, Safari, and iPhone Home Screen app). Ask friends not to edit until your upgrade is finished.
2. On each device, open **Cloud sync**, sign in, and confirm it displays the same collection. If devices disagree on cards or boxes, **STOP**. Export a JSON backup from each device and reconcile the differences **before** migration. The SQL script copies the **Supabase shared_vault document only**, not unsynced local copies.
3. Save a full JSON backup from v1.1.5 (**Backup** button). Keep it somewhere safe outside the app.
4. In Supabase SQL Editor, run this read-only backup query and save/copy its result as an additional recovery snapshot:

```sql
select id, revision, updated_at, document
from public.shared_vault where id='main';
```

5. You should also use Supabase table export/database backup tools if available. Do NOT delete your old tables.

## Phase 1 — Create the v1.2 tables and migrate your existing cloud data

1. Open **Supabase Dashboard → your existing project → SQL Editor → New query**.
2. Open the included `01-CREATE-AND-MIGRATE.sql` file in Notepad. Copy the **entire contents**, then click **Run**.
3. The script creates four v1.2 tables, RLS policies, a secure database operation, and Realtime publication subscriptions.
4. It imports your current boxes, inventory copies, decks and filter presets **once** from the old `shared_vault` document.
5. The script checks migrated card quantities, box counts, deck counts and preset counts; if they disagree it throws an error and the transaction rolls back.
6. Compare the two lines returned by the final SELECT: **Old shared cloud** vs **New v1.2**. Totals (physical copies, boxes, decks) must match. Inventory row count can be lower only if duplicate positions were grouped.
7. If there is any error, **STOP and do not upload v1.2 yet**. Share the error text, without credentials.

**Important:** Do not paste API secret keys or the database password into your GitHub code or this chat.

## Phase 2 — Deploy the website

1. Download/extract the v1.2 ZIP. Open https://github.com/TheDubous/grand-line-vault.
2. Upload the **contents of this folder** (not the folder itself; not the ZIP) to the repository root on `main`. `index.html`, `app.js`, `styles.css`, `manifest.webmanifest`, icons and `VERSION.txt` must be at the root. You may leave the SQL and docs in the repo, but **do not publish anything containing private connection credentials**.
3. For GitHub web editing, press `.` on the repository page, replace root files with the new ones, then commit/push. Alternatively choose **Add file → Upload files**, replace matching names and commit.
4. In **Actions** or **Settings → Pages**, verify deployment succeeded.
5. Open https://thedubous.github.io/grand-line-vault/?v=1.2.2 on desktop Safari/Chrome and verify **Version 1.2.2** in the sidebar. Sign in if required. Then open **Cloud sync** and confirm **Live cloud ready**.
6. Open it in Safari on iPhone **before** opening the Home Screen app. Check the same inventory/boxes/decks. Refresh or reinstall the Home Screen shortcut only after backing up and verifying the new version in Safari.

## Phase 3 — Test before the group starts cataloguing

1. Compare totals for boxes, cards, and decks on laptop + phone. They should match the SQL counts.
2. In Box 1, add **one copy** of a known English card, such as `OP16-113`. Check it appears on the second device (live or on returning to the tab).
3. Using a second account, add another copy of the *same ID and same box* while the first account adds one; verify both copies are counted.
4. Move a small number of cards between Box 1 and Box 2 and verify totals are unchanged.
5. Use the phone camera with **auto mode**, then test **Capture** as backup. Test the same two earlier cards (`OP16-113` and `OP14-103`). Confirm the standard-art image, ID, name and box in the one-step popup.
6. Create/import a deck and export it to OPTCGSim; verify its leader, card quantities and reservation status.
7. Put the phone offline and attempt an edit; it should **refuse to save** and leave the cloud unchanged. Reconnect and refresh.
8. Export a fresh JSON backup and keep it.

## Phase 4 — Lock out old clients (only after the tests)

In Supabase SQL Editor run `02-LOCK-OLD-CLIENTS.sql`. This revokes the old whole-document write permission and prevents any lingering v1.1.x Home Screen instance from overwriting the previous cloud record. **It does not delete that record.** Keep the old document for recovery.

### Important limitations

- This release was tested with a **mocked Supabase**; the SQL migration and RLS have **not** been verified in your actual project yet. Treat the first deployment as a controlled test, not a verified production release.
- Printed-ID OCR can still fail with foil glare, blur or fingers covering the lower edge. Name OCR is an additional exact-name fallback, not full AI artwork matching.
- Third-party English catalog coverage and image links may be incomplete.
- There is **no automatic undo/history** and no per-user online indicator.
- Realtime is best-effort: if disconnected, the app checks again on focus and periodically.
- **The old browser cache is not an editable second collection**. Supabase is authoritative.
- Full JSON "replace the collection" is deliberately disabled in v1.2 to prevent accidental destruction; CSV import adds cards instead.
- Don't perform a simple rollback to v1.1.5 after writing new v1.2 records: those new records won't exist in the old shared JSON document. Export a v1.2 backup and plan a recovery migration if needed.
