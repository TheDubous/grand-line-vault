# Update to v1.1.2 automatic scanner

If your app is **already working in GitHub Pages and Supabase**, do not repeat the initial installation steps. Download a JSON backup, replace the GitHub repository files with this ZIP contents, and keep the same Supabase database. See `README.md` for precise updating steps.

# Grand Line Vault v1.0.1 — shared friends-only cloud setup

**This package replaces v1.0.0 if you want all friends to see ONE shared inventory and the SAME decks.** Use this ZIP for your first GitHub upload. The code is still Grand Line Vault version 1, not version 3.

## 1. Publish the website (GitHub)

1. Go to https://github.com and log in.
2. Create a repository called `grand-line-vault`, public if you use GitHub Free.
3. Extract the supplied ZIP on your PC.
4. Upload the **files inside the extracted folder** (including `index.html`, `app.js`, `styles.css`) to the repository root; commit.
5. Repository **Settings → Pages → Deploy from a branch → main → /(root) → Save**.
6. When published, copy its exact HTTPS address, e.g. `https://YOUR-GITHUB-USERNAME.github.io/grand-line-vault/` (including the final slash).

**Important:** GitHub Pages is usually a public website, even from a private repository on paid plans. Your collection is protected by Supabase row-level security, **not** by hiding the app URL.

## 2. Supabase: URL Configuration

At https://supabase.com/dashboard open your project → **Authentication → URL Configuration**.

- **Site URL:** `https://YOUR-GITHUB-USERNAME.github.io/grand-line-vault/`
- **Redirect URLs:** add the **same exact URL** and save.

Do not use the GitHub `github.com/user/repo` source URL, and do not paste a Supabase URL here. If you haven't published yet, finish step 1 first.

## 3. Create the shared, private database

1. Go to **Supabase → SQL Editor → New query**.
2. Open `supabase-schema.sql` from the ZIP in Notepad, copy all of it, paste in the SQL Editor, press **Run**.
3. This creates `public.shared_vault` (the **single collection**), `public.vault_members` (the **authorized login emails**) and a safe `save_shared_vault` function.
4. In **SQL Editor → New query**, approve your own app sign-in email, replacing the sample below:

```sql
insert into public.vault_members(email,role)
values (lower('YOUR_ACTUAL_EMAIL@example.com'), 'owner')
on conflict (email) do update set role = 'owner';
```

5. **Later**, approve each friend one at a time using their real email (do not give them access to Supabase dashboard):

```sql
insert into public.vault_members(email,role)
values (lower('friend@example.com'), 'editor')
on conflict (email) do nothing;
```

6. To revoke a friend (after you've discussed access with them):

```sql
delete from public.vault_members where email=lower('friend@example.com');
```

This only revokes *future cloud access*. It cannot erase backups or cards the member previously downloaded onto their own device.

**If you already ran v1.0.0's old `supabase-schema.sql`:** the earlier `user_vaults` table remains unused; there is no need to delete anything. Do not enter card data into the old personal vault. If you already created a personal collection, make a JSON backup and restore it carefully after switching to the shared app.

## 4. Get the Supabase connection details

Use your project dashboard **Connect** or **Settings → API Keys** to copy:

- **Project URL:** `https://your-project.supabase.co`
- **Publishable key:** begins `sb_publishable_` (or older public `anon` key)

Do NOT expose your `service_role`, `sb_secret_...`, database password or SMTP credentials in GitHub or the app.

## 5. Sign in to the app

1. Open your published GitHub Pages URL.
2. In **Cloud sync**, paste the Supabase project URL and public publishable key and click **Connect Supabase**.
3. Enter **the same approved email address** from step 3 and request the email magic link.
4. Follow the email sign-in link using the same browser. Return to **Cloud sync** and look for **Shared vault loaded**.
5. On another device, repeat the app connection and sign in using an approved email. A friend can use their **own** account, not yours.
6. New friend first login: their browser's empty local collection will load the shared cloud document.

If it says **No shared-vault access**, check the signed-in email exactly matches a row in `vault_members`. If an existing device has different local cards, **download a backup before choosing which copy replaces the other**.

### Very important: magic-link emails for friends

Supabase's default SMTP sends magic links ONLY to project-team addresses (currently a small test quota). **Do not add your friends to the Supabase project team just to get sign-in emails**; that can give them access to project administration. Instead, configure your own sender at **Supabase → Authentication → SMTP Settings** before inviting friends. See https://supabase.com/docs/guides/auth/auth-smtp . A custom SMTP provider (or another carefully configured authentication method) is required for normal sign-in by outside friends.

## 6. How sharing works

- All approved users see **the same physical cards, numbered boxes, deck plans, and reservations**.
- Each person has **their own email-based login**; membership is controlled by the database whitelist.
- Unauthorized visitors can view the public website interface, but RLS prevents them reading/updating the shared cloud collection.
- Each browser also keeps a local working copy for offline use, which means users with physical access to a previously logged-in device might see cached data. Only use trusted devices and clear website data when retiring or sharing one.
- **Not true live multiuser editing yet:** if two friends update from stale states, the revision check rejects later conflicting saves rather than silently overwriting them. Refresh from cloud and reconcile before continuing. Avoid simultaneous offline editing.
- Access revocation blocks cloud access; it does **not** remotely wipe someone else's device or previously exported JSON.
- Friends may edit the same deck plans; do not reserve the same physical copies without checking for conflicts.

## 7. Backup and updates

From Grand Line Vault use **Backup** to export JSON with collection, decks, presets and reservations. Backup before significant updates and group imports. Don't put these JSON backups into your public GitHub repository.

When updating v1.0.1 later, replace the GitHub website code but keep the same Supabase project, membership table, and shared vault data. Never run unrelated SQL that drops your vault tables.

## Known limitations

- Card photo recognition reads printed IDs (OCR). It does NOT automatically match every artwork or alternate printing; use retake/manual correction.
- The Supabase Auth flow and real multi-user database access need to be tested in your Supabase project; database SQL was prepared for secure member-based access but no live deployment has been confirmed in this environment.
- Email login currently requires delivery through Supabase's configured SMTP.
- JSON snapshot synchronization is safe against **silent** overwrites but does not merge simultaneous edits.
