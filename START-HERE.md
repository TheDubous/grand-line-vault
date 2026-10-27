# Grand Line Vault v1.0.0 — START HERE

*Complete first-time installation, written for someone who has never used GitHub.*

## Before you start

You need a computer with a web browser, an email address, and a smartphone. You do **not** need to install Git or write code. We will:

1. Publish the app on GitHub Pages (public website code).
2. Create your **private** data store in Supabase.
3. Sign in on computer and phone, using the same email.
4. Test a card photo and deck plan.
5. Save a backup and learn safe updates.

**Important:** Do not upload your personal inventory backups or Supabase database password to GitHub. Never enter a Supabase `sb_secret_...` or `service_role` key in the web app. Only use a public `sb_publishable_...` key.

## A. Download and extract the application

1. Download `GrandLineVault-v1-GitHub.zip` from ChatGPT.
2. In Windows File Explorer, right-click the ZIP → **Extract All** → Extract.
3. Open the extracted folder. The website files should be at its top level: `index.html`, `app.js`, `styles.css`, `manifest.webmanifest`, `icon-192.png`, `icon-512.png`, `.nojekyll`, `README.md`, `START-HERE.md`, `supabase-schema.sql`, `VERSION.txt`.
4. **Do not** upload the ZIP file itself, and **do not** upload the whole folder as a nested directory. Upload its contents to the repository root. Windows may hide `.nojekyll`; it is optional if you cannot see it.

## B. Make the GitHub website

1. Open https://github.com and create an account (or sign in); verify your email address.
2. Click the **+** at top right → **New repository**.
3. Repository name: `grand-line-vault` (all lowercase, hyphens okay). This tutorial uses that exact name.
4. Visibility: **Public** (required for GitHub Free Pages). Your *website code* is public; it does **not** automatically publish your inventory or decks.
5. Leave **Add a README file** unchecked to make an empty repository; then choose **Create repository**.
6. On the empty repository screen, click **uploading an existing file** (if your repository already has files, go to **Add file → Upload files**).
7. Drag all files **from inside the extracted folder** into the upload area (not the ZIP, and not the folder itself). Look for `index.html` at the repository root.
8. Enter the commit message `Grand Line Vault 1.0.0` and click **Commit changes**.
9. In the repository, go to **Settings → Pages**. In **Build and deployment**, set **Source: Deploy from a branch**, **Branch: main**, **Folder: /(root)**, then **Save**.
10. GitHub builds the website. In **Settings → Pages**, click **Visit site** when the address appears. It may take up to 10 minutes for the initial deployment.
11. Your URL will look like `https://YOUR-GITHUB-USERNAME.github.io/grand-line-vault/` — **copy this full address, including the final slash**.
12. Open the address on your computer. You should see **Grand Line Vault** and menu items Dashboard, Card catalog, Scan cards, Deck builder, My inventory, Numbered boxes, Cloud sync.

Common mistakes: an HTTP 404 immediately after saving Pages can simply mean deployment is not finished; check **Actions** or **Settings → Pages**. A 404 that persists may mean `index.html` is nested in a folder or Pages is publishing from the wrong branch/folder.

Official documentation: https://docs.github.com/en/pages/quickstart

## C. Create the cloud database in Supabase

1. Open https://supabase.com and sign up / sign in. Prefer the **same email that you plan to use to sign into Grand Line Vault**; the default Supabase mail server only emails addresses authorized as project team members.
2. From the Supabase dashboard choose **New project**, select an organization, and name it `grand-line-vault`.
3. Choose a strong **database password** and keep it in a password manager. **This password is never entered into Grand Line Vault.** Choose a nearby region and create the project.
4. From the project dashboard open **SQL Editor** → **New query**.
5. Open `supabase-schema.sql` from the extracted ZIP in a text editor (Notepad is fine). Select all and copy the contents.
6. Paste into the Supabase SQL Editor and click **Run**. This creates the `public.user_vaults` table, row-level security (RLS) policies, and a `save_vault` function.
7. Confirm that SQL completed without error. Under **Database → Tables** (or Table Editor), `user_vaults` should be present, initially empty.
8. In Supabase open **Authentication → URL Configuration**. For **Site URL**, paste your **exact GitHub Pages URL**, e.g. `https://YOUR-GITHUB-USERNAME.github.io/grand-line-vault/`. Under **Redirect URLs**, add that same exact URL, then save.
9. Under **Authentication → Sign In / Providers**, check **Email** is enabled. The app uses an emailed magic sign-in link, not a password.
10. In your project's **Connect** dialog or **Project Settings → API Keys**, copy your **Project URL** (`https://...supabase.co`) and your **publishable key** (`sb_publishable_...`). These are the only two settings you will paste into the web app.

### Supabase email limitation

Supabase's built-in SMTP service is for testing: it currently sends to **project-team email addresses only**, with a project-wide **2 emails per hour** limit. If your desired login email is not a team member, use the account/team email for initial setup or configure custom SMTP in Supabase before attempting login with other email addresses. Avoid repeatedly clicking “Email me a sign-in link.” For broader use, set up a supported custom SMTP provider.

More: https://supabase.com/docs/guides/auth/auth-smtp

## D. Connect the app to Supabase on your computer

1. Open your published GitHub Pages URL (not the original HTML file downloaded to your PC).
2. Click **Cloud sync** in the left menu.
3. Paste the Supabase **project URL** into `Supabase project URL`.
4. Paste the **sb_publishable_... key** into `Supabase publishable (anon) key`. **Never use `sb_secret_...`, `service_role`, or your database password here.**
5. Click **Connect Supabase**. Then enter your login email and click **Email me a sign-in link**.
6. Check your email. Open the one-time link in the *same browser/device* you used to request it; it should return to your Grand Line Vault website.
7. Open **Cloud sync** again and confirm a status like **Cloud synced** or **Cloud loaded**. On the first sign-in, the app may create an empty cloud collection.
8. If you see **Two different collections detected**, download the local backup first. On a new empty device, choose **Use cloud collection**. Choose **Replace cloud with local** only if you intentionally want your local copy to become the master.
9. Refresh the page and confirm the application still loads.

## E. Sign in on the phone

1. Open the **same GitHub Pages URL** on your phone using Safari (iPhone) or Chrome (Android). Make sure it starts with `https://`.
2. Open **Cloud sync** and enter the **same Supabase Project URL and publishable key** (configuration is per browser/device).
3. Request a login link for the **same email address**. Open it on your phone in the browser used for the app. Do not use the magic link on a different device, since it is one-time.
4. If the phone asks which collection to use, choose **Use cloud collection** (unless you have separate phone data to preserve; back it up first).
5. You now have the same saved card/deck data available on both devices, subject to cloud sync status and manual refresh of other already-open devices.
6. Optional: on iPhone Safari, use **Share → Add to Home Screen**; on Android Chrome, use the browser menu → **Add to Home screen / Install app** (label varies). This adds a shortcut; it does not put your inventory into Apple/Google cloud.

### Working safely on two devices

Avoid making edits on both phone and PC at exactly the same time or while offline. v1 checks revision numbers and pauses on conflicts rather than silently merging changes. Refresh the other device's Cloud sync view when switching devices. If sync reports a conflict, export a JSON backup before choosing a master copy.

## F. First inventory test

1. Click **Numbered boxes**. The app starts with Box 1, Box 2, Box 3 and **Unsorted**. Press **Next numbered box** to make another.
2. On your phone open **Scan cards → Start rear camera**, grant permission, point at one English One Piece card, and tap **Capture & recognize**. Or tap **Take / upload photo**.
3. The app uses OCR to read the *printed card number*. Review the detected ID, and if the card has multiple printings, select the printing manually. Tap **Scan again** if unreadable. **Exact alternate-art detection from the photo is not automatic in v1.0.0.**
4. Choose `Box 1`, quantity `1`, and press **Save & next card**.
5. Open **My inventory**, find the card, check quantity and location. You can correct details, add/remove quantities and search by card ID/name/box.
6. On the computer, go to **Cloud sync → Refresh from cloud** to see changes from the phone.

## G. First deck-plan test

1. Open **Deck builder → New deck**, name it for example `Belo Betty Test`.
2. Choose a Leader, then search and add cards from the catalog. Filter by exact **cost** 0/1/2/3..., **traits** (`Straw Hat Crew`, `Whitebeard Pirates`), color, card type, counter, power, rarity, effect text, and trigger text.
3. In the effect search field try `On K.O.` or `rested DON!!`. Choose **Exact phrase**, **All words**, or **Any word** as needed.
4. Press **Save preset** to keep a filter combination (for example `2K counters`).
5. To import a deck from OPTCGSim, use **Import plan**. Example:

   ```text
   1xOP05-002
   4xOP05-015
   4xOP05-011
   ```

   This creates a **virtual** deck and does **not** add its cards to your physical collection.
6. For exporting a deck, choose **OPTCGSim** (`.txt`) or **Plan JSON** to back up/reimport its editable deck record.
7. If you physically assemble a deck, enable **Reserve physical copies for this deck**. Reservations show which deck claims each card and warn about conflicts. They do not physically remove the cards from their box inventory.
8. Deck warnings are advisory. v1 does **not** fully check every special construction rule or current tournament bans/restrictions.

## H. Import an existing collection from another app

1. Export a collection CSV from the other app if supported.
2. The simplest format uses headers `card_id,qty,box,name` and rows such as:

   ```csv
   card_id,qty,box,name
   OP05-002,1,1,Belo Betty
   OP05-015,4,2,
   ```

3. Go to **My inventory → Import CSV**; choose the file and the default numbered box. CSV accepts commas or semicolons and a few common header synonyms.
4. CSV **adds physical copies** to inventory. If you re-import the same file, quantities may double. Export a backup first and check the totals afterwards.
5. If you only want a **deck plan**, use **Deck builder → Import plan** instead, not Inventory import.
6. Importing a different app's IDs, alternate-art variants or export format may require adjusting columns before import.

## I. Backups, upgrades, and troubleshooting

### Back up your full collection

- Press **Backup** at the top of the app. Save the resulting `grand-line-vault-YYYY-MM-DD.json` somewhere outside the browser (for example OneDrive or a USB drive). This includes boxes, quantities, saved decks, reservations and filter presets, **not** the app source code or an offline photo library.
- To restore, go to **Dashboard → Restore backup** and select the JSON file. **Restore replaces** the current saved collection: back up the current one first.
- For extra portability, go to **My inventory → Export CSV**, and export important decks as **Plan JSON** or **OPTCGSim**.

### Update in the future without losing decks

1. Back up your inventory/decks as JSON.
2. Download the next version (v1.1, etc.) and extract it.
3. In **your existing** GitHub repository upload/revise the website files, leaving the **same repository name and published URL**.
4. Keep using the same Supabase project and database table. **Do not rerun destructive SQL or reset the database** unless an upgrade explicitly instructs you to migrate it.
5. Refresh the website. Saved collection/decks are data, not code; the app's local storage key is intentionally stable and Cloud records are separate.
6. Verify a deck and box, and export another backup. Some future upgrades may need explicit schema migrations; always read their upgrade notes.

### What GitHub DOES NOT save

GitHub stores the HTML/CSS/JavaScript/README/SQL you upload. **It does not know the contents of your collection or decks** unless you manually publish those files (don't do that). Local browser storage can be cleared. Once cloud sync is configured, Supabase stores a private authenticated JSON document.

### Troubleshooting

- **Website 404** — check Settings → Pages → branch `main`, folder `/(root)`, and verify `index.html` is not nested. Give deployment several minutes.
- **Blank app / limited catalog** — reload, verify internet connection and that card-data CDN isn't blocked. Catalog is fetched from a third party.
- **Camera won't start** — use the HTTPS published site, allow camera in browser settings, or choose **Take / upload photo**.
- **OCR wrong ID** — improve lighting, avoid foil glare, focus the printed bottom card number, retry or correct manually. Exact-art recognition is not implemented.
- **No login email** — check spam, Supabase authorized email/team membership, Email provider enabled, configured redirect URL, and rate limit. Do not spam requests.
- **Cloud error** — verify database SQL succeeded; ensure you copied the publishable key (not secret), exact project URL, and signed in. Review Cloud sync status.
- **Data differs on two devices** — confirm both use the same Supabase project/email, and click **Refresh from cloud**. If you made conflicting edits, export JSON backups before choosing a version.
- **Free Supabase project paused** — open your Supabase project dashboard and resume it if needed; free projects can be paused after low activity.

### Useful links

- GitHub Pages setup: https://docs.github.com/en/pages/quickstart
- Upload files to GitHub: https://docs.github.com/en/repositories/working-with-files/managing-files/adding-a-file-to-a-repository
- Supabase email login: https://supabase.com/docs/guides/auth/auth-email-passwordless
- Supabase auth redirect URLs: https://supabase.com/docs/guides/auth/redirect-urls
- Supabase project API keys: https://supabase.com/docs/guides/getting-started/api-keys
- Supabase built-in email restrictions: https://supabase.com/docs/guides/auth/auth-smtp
- Supabase free project pausing: https://supabase.com/docs/guides/platform/free-project-pausing

---

**Release:** Grand Line Vault **v1.0.0**. Future releases will use straightforward version numbers (v1.1, v1.2, ...). Do not mistake the data storage key `grand-line-vault-v1` for an instruction to delete or reset it on upgrade.
