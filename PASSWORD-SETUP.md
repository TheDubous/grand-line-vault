# Grand Line Vault 1.1.5 — Password setup (existing users)

## A. You are still signed in on at least one device (recommended)
1. Upgrade the GitHub Pages files to v1.1.5. Keep the same site and Supabase project.
2. Open Grand Line Vault on the device where you still have an authenticated cloud session.
3. Go to **Cloud sync**. Under your logged-in email, find **Set or change your password**.
4. Enter a unique password (at least 12 characters) and confirm it. Click **Save my password**.
5. On your laptop or another phone, open Grand Line Vault → **Cloud sync** → **Sign in with email and password**. Use the same approved email address and your new password.
6. Verify **Cloud synced**, inspect cloud counts, and confirm that your physical cards/decks are the same. If a local/cloud conflict appears, export a backup and do not overwrite a shared collection without reviewing differences.
7. Sessions should remain signed in on each device until you sign out or the session is otherwise revoked/invalidated; clearing web/app data may log you out.

**Passwords live in Supabase Auth, not in your shared vault JSON or GitHub files.** Nothing in the app sends a login email when signing in with an existing password.

## B. You're signed out everywhere, without an existing password
You can't set a password for an existing account without proving you own it. In **Cloud sync**, expand **Existing account without a password? Use an email code once**, and authenticate once. Then use Step A.

If Supabase has reached its test-email limit, wait for the quota to reset or configure a custom SMTP provider; you do **not** need a paid Supabase plan just to enable password logins. Alternatively use a supported administrative password/account recovery flow from your Supabase project's Auth management tools. Do not create a second account using the same email or insert credentials into SQL.

## C. For trusted friends
Everyone should have their **own** account and password. First add them as members of `public.vault_members` with role `editor` using your SQL editor. Then create or invite their auth account using Supabase's supported admin/dashboard workflow. For an invitation/recovery email to be delivered beyond the default testing limits, configure SMTP. An alternative when supported by your dashboard is to create a verified user with an initial password there, then have the friend change the password inside Grand Line Vault. Use separate secure channels to communicate initial passwords; do not publish them.

Never disable **Confirm email** merely to avoid email delivery. This private app's shared-vault membership relies on verified email identities.

## D. Troubleshooting
- **Invalid login credentials** — the existing OTP account probably has no password yet, or the password/email differs. Use A/B.
- **Email not confirmed** — use an authenticated/verified account; do not disable email confirmation for the project.
- **Password update requires reauthentication** — a Supabase project security option may require recent login or another verification step. Follow the displayed error and Supabase's password security settings.
- **Local only** — this browser is not authenticated/connected. Check Cloud sync, then inspect cloud counts and beware of conflicting local inventory.
- **Desktop is signed in but phone is not** — sign in separately on the phone using the same email/password; they can stay active concurrently.
- **Old version in Home Screen app** — open the live GitHub Pages site in the browser to confirm it shows 1.1.5, then refresh/reopen the installed app. Avoid clearing local data before backing up and verifying cloud records.
