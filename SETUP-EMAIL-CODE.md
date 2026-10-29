# Legacy email code instructions (optional fallback only)

For the normal v1.1.5 login use [PASSWORD-SETUP.md](PASSWORD-SETUP.md). This older OTP flow is only needed once if you must access an existing account to set a password.

# Grand Line Vault 1.1.4 — Email code login setup

## Why
Email magic links open a browser, which may have a different Supabase auth session from an installed Home Screen web app. This release uses Supabase email OTP codes: send a code and enter it inside the app. No deep links required.

## One-time Supabase email template change
1. Supabase Dashboard → your project → Authentication → Email Templates (sometimes Templates).
2. Open **Magic Link** (it may be labeled **Magic link or OTP**).
3. Replace the email body with:

```html
<h2>Grand Line Vault login code</h2>
<p>Enter this code in Grand Line Vault to sign in:</p>
<p style="font-size:28px;font-weight:bold;letter-spacing:4px">{{ .Token }}</p>
<p>If you didn't request this code, you can ignore this email.</p>
```

4. Save. If creating brand-new users, also include `{{ .Token }}` in the **Confirm signup** email template if Supabase sends that template to your new account.
5. Do **not** change URL Configuration, API keys, database SQL or `vault_members` for this update.

## Deploy
1. Back up each device's unique local inventory before installing.
2. Replace the files in the existing GitHub Pages repository root with this archive's extracted files. Keep repository `TheDubous/grand-line-vault`, branch `main`.
3. Wait for the GitHub Pages deployment and confirm the sidebar shows **Version 1.1.4** in Safari/Chrome.
4. On the Home Screen app, refresh/reopen it; don't clear data. If it stays on an older cached version, create a new Home Screen icon after verifying cloud backups.

## Sign in
1. Open **Cloud sync**. If your current installation is missing Supabase URL and publishable key, enter the same ones as the phone. Never use a secret/service_role key.
2. Enter the approved email address and click **Send login code**.
3. Read the code in your email (don't open a login link).
4. Return to the **same Grand Line Vault app**, enter the same email and code, click **Verify code & sign in**.
5. The app should display **Shared vault loaded** or a collection conflict choice. **If local data differs, download a JSON backup and do not overwrite the shared vault without reconciling entries.**
6. Repeat sign-in independently on each phone, Home Screen app, Chrome or desktop browser that you want to use. This does not sign out other devices.

### Important
- Supabase code lifetimes and request limits follow your Auth project settings.
- The template must include `{{ .Token }}` or there will be no code in the email.
- The email-OTP code is personal and must never be shared.
- The `shared_vault` cloud collection and GitHub Pages URL are unchanged; there is **no database migration**.
- Real Supabase email delivery and installed-phone behavior require testing with your devices.
