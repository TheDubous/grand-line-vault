# Update to v1.1.3 — already using GitHub Pages + Supabase

**No SQL schema change is required.** Do not delete or reset your Supabase project.

1. Before deploying, open **every different device/browser** and export a JSON backup from Grand Line Vault. Use distinct filenames: `safari.json`, `homescreen.json`, `desktop.json`.
2. Extract this ZIP. On GitHub, open [TheDubous/grand-line-vault](https://github.com/TheDubous/grand-line-vault), select branch `main`, then upload the extracted **contents** to the repository root (not the ZIP or parent folder).
3. Commit the updated files. Verify `VERSION.txt` reads `Grand Line Vault 1.1.3` and GitHub Pages has completed publishing.
4. On desktop/Safari open https://thedubous.github.io/grand-line-vault/ and verify **Version 1.1.3**.
5. Open **Cloud sync → Check cloud counts / reconcile**. If the browser and cloud are different, **do not immediately overwrite the cloud**. Download the local backup and verify which cards/boxes differ. The application now warns and won't silently drop either side.
6. Once the cloud data is confirmed, use the same Supabase account on all devices. Bring the app to the foreground or use **Refresh from cloud**.
7. On iPhone Home Screen, cached code may stay older than Safari. Before re-adding the Home Screen shortcut verify cloud sync and backup. A fresh Home Screen app might have separate local storage settings.

**Scanner:** Open Scan cards → Start camera → present a card (or Capture card) → one popup with image, ID, copies, box → Add & next card. Press *No · scan again* if wrong. Open the optional correction section if needed.

**Known limitations:** Some card images may still be missing from upstream sites. The scanner uses OCR for the printed card number; it cannot reliably distinguish two artworks sharing that number. Foreground sync plus revision checks are not live simultaneous multi-user editing. Conflicting independent records should be merged carefully from backups; never sum duplicate records without reviewing whether they represent the same cards.
