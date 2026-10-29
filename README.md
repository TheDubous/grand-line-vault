# Grand Line Vault v1.2.0

The One Piece TCG collection website for four approved friends.

**Start with [START-HERE.md](START-HERE.md).** Do not overwrite the website before running the SQL migration in the original Supabase project and verifying the data counts.

Features: cloud-first online-only editing, real-time updates, atomic inventory quantity operations, numbered boxes, advanced English catalog filters, virtual deck planner, reservations, OPTCGSim import/export, password authentication, auto/manual phone OCR with name fallback, a single card confirmation popup, and standard English card images. All scanned photos are temporary.

Security: existing `vault_members` access control plus new row-level-security policies. Never put Supabase secret keys into the public GitHub repository.

**Testing status:** Node automated tests passed with 5,200+ rows and simulated operation responses. Actual live SQL execution, Supabase RLS, photo recognition and GitHub Pages deployment must be verified by the user.
