# Grand Line Vault 1.2.1 — Scanner alignment fix

## What's changed
- Pink card guide has the correct physical card shape regardless of phone viewport orientation.
- Blue region shows the EXACT primary OCR crop for the live camera. Camera and preview use the same object-fit:cover transform.
- If the primary OCR crop fails, the scanner tries larger crops.
- Card name OCR now reads the bottom name band, rather than the upper artwork.
- Both automatic and Capture scanning use the same guide. Uploaded images are searched separately.

## Update safely
1. Keep your existing Supabase project as-is. **Do not rerun any migration SQL.**
2. Export a backup of your collection.
3. Replace the GitHub Pages files with the contents of this ZIP, commit to `main`.
4. Verify version 1.2.1 at `https://thedubous.github.io/grand-line-vault/?v=1.2.1`.
5. Test on iPhone: align a single card in pink, ensure the printed ID is within blue, and try automatic scan and Capture. See OCR diagnostics if recognition fails.

### Important
This is a guide and crop-alignment correction. It does not guarantee that the phone will focus well enough to read every tiny ID. Real-world iPhone testing is still required.
