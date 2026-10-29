# Grand Line Vault 1.1.5 — email + password login

This is a full replacement package for the existing GitHub Pages website. **It is an update to your current shared collection, NOT a new Supabase project.** No SQL migrations are required.

## What's new
- **Email + password sign in** using Supabase Auth. No OTP/email is required for normal logins.
- **Set/change password** while signed in (suitable for existing verified users who previously used OTP).
- **Remember login** across restarts via Supabase's persisted, auto-refreshed sessions (unless revoked, expired/invalidated, or local site data is cleared).
- **Sign out of this device** without purposely ending sessions on other devices.
- Old email-code login remains hidden under a fallback disclosure for migrating old accounts. It no longer auto-creates unknown accounts.

The same scanner, pastel UI, card catalog, numbered boxes, local data key (`grand-line-vault-v1`), decks, and shared `shared_vault` Supabase row are preserved. No password is stored in your custom app database or included in JSON exports. Password authentication uses Supabase Auth.

## Before deploying

Because your phone, Safari and laptop previously had divergent local inventories, **download a JSON backup on each device first**, especially where any unique cards/decks exist. Do not clear browser data, delete tables, or select “Replace shared vault with local” casually.

## Upgrade via GitHub
1. Download and extract the ZIP; upload **the contents** to the root of your existing [GitHub repository](https://github.com/TheDubous/grand-line-vault) on `main`, replacing the files (`index.html`, `app.js`, `styles.css`, etc.). Don't upload a folder enclosing `index.html`.
2. Commit your changes. Wait for GitHub Actions / Pages to finish deployment successfully.
3. Open `https://thedubous.github.io/grand-line-vault/?v=1.1.5` directly in your browser. Sidebar should say `Version 1.1.5 · Password login`.
4. Open **Cloud sync**; Supabase URL and public key should still be there on devices where you already configured them.
5. Follow [PASSWORD-SETUP.md](PASSWORD-SETUP.md) to establish a password for an existing account, and sign in on other devices.

No Supabase SQL changes, no new GitHub repository, and no paid Supabase plan are needed just to use email+password authentication.

## Important security notes
- Keep the **email confirmation requirement enabled**: membership in the shared vault is associated with approved email identities. Allowing unverified email signups could compromise the membership model.
- Only authorized emails in `public.vault_members` may use the shared inventory (see existing RLS policies).
- Don't put `sb_secret_...`, `service_role`, any password, or a database password into `index.html`, GitHub or the publicly accessible site.
- For new friends: provision/authenticate their own individual Supabase Auth accounts and authorize their emails as `editor` in `vault_members`. Inviting/recovery email flows can require custom SMTP. Never share your owner account credentials.
- Browser-local copies and conflict handling remain as in v1.1.4: **this is not a full real-time multiuser collaboration engine**. Check cloud counts and back up before merging different local copies.

## Verification
Run `node --check app.js` and `node tests/*.cjs` individually in Node.js. Existing suite and new password-auth checks run with mocked Supabase, not against a production Supabase project. Real email/password login must be tested with your own project.
