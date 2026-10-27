# Grand Line Vault v1.0.1 — Shared with Friends

**Use this package if you want ONE collection for you and a small circle of approved friends.** It replaces the initial v1.0.0 cloud model of one vault per user. See `START-HERE.md` before uploading to GitHub.

## Features

- Phone camera OCR and card photo import; user correction if uncertain.
- Card catalog with English set data, individual cost/trait/counter/power/text search and saved filters.
- Numbered storage boxes, collection quantities, CSV imports and JSON backups.
- Virtual deck plans, OPTCGSim imports/exports, deck JSON, optional reservations with warnings.
- NEW: One shared cloud vault with RLS-protected allowlist of emails. Each friend signs in with their own email to access the same collection and decks.

## Security model and limitations

GitHub Pages publishes the app code as a public web site; **inventory and decks are not stored in the repo**. Supabase `shared_vault` is the persistent collection; `vault_members` is an allowlist editable by the Supabase administrator. RLS policies protect the database at the server even when the app's public publishable key is known. Friends should never be made Supabase *project team members* just to gain app access. Setup of a custom SMTP service is needed for sending login emails to ordinary friends.

The app also caches collection data in browser localStorage on signed-in devices, so choose trusted devices. It is NOT designed to protect the local cache on a shared computer, and revoking cloud permission cannot remotely erase downloaded copies. Concurrent edits to the JSON cloud snapshot are detected but not merged; refresh and reconcile after conflicts.

Exact alternate artwork photo matching, comprehensive banned-card checks and automated real-world camera accuracy testing are not available yet. Fan-made project not affiliated with Bandai. Base English card catalog: https://github.com/michalkiral/optcg-data.
