# Grand Line Vault v1.2.1

The One Piece TCG collection website for four approved friends.

**Start with [START-HERE.md](START-HERE.md).** Do not overwrite the website before running the SQL migration in the original Supabase project and verifying the data counts.

Features: cloud-first online-only editing, real-time updates, atomic inventory quantity operations, numbered boxes, advanced English catalog filters, virtual deck planner, reservations, OPTCGSim import/export, password authentication, auto/manual phone OCR with name fallback, a single card confirmation popup, and standard English card images. All scanned photos are temporary.

Security: existing `vault_members` access control plus new row-level-security policies. Never put Supabase secret keys into the public GitHub repository.

**Testing status:** Node automated tests passed with 5,200+ rows and simulated operation responses. Actual live SQL execution, Supabase RLS, photo recognition and GitHub Pages deployment must be verified by the user.

## v1.2.1 — Camera guide correction

The pink outline now matches the aspect ratio of a physical card. The blue dashed rectangle marks the primary OCR target **exactly** on the live preview; if that fails, the scanner expands the search area. Manual capture and auto scanning both use the same guide. OCR name fallback now scans the lower name area, rather than the top art. Photo uploads continue to use their own crop presets.

### Updating from v1.2.0

No SQL changes. Keep existing Supabase tables. Back up your inventory before deployment. Replace the website files on GitHub and commit to main. The old migration scripts are included only for documentation and **must not be rerun** on existing migrated data.
