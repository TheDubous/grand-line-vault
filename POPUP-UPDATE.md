# Grand Line Vault v1.1.2 — Card confirmation popup

This update builds on **v1.1.1 scanner fixes** and keeps the same shared Supabase database, inventory, decks, and storage settings.

## New scanner flow
1. Open **Scan cards** and start the rear camera. Automatic OCR remains on.
2. When an ID is repeatedly recognized, a centered **Is this your card?** dialog appears over the camera, showing the reference image, English name, and printed ID. OCR pauses while the dialog is open.
3. Tap **No, scan again** to dismiss the popup and resume OCR, or **Yes, this card** to enter copies and select a numbered box *in the popup*.
4. Tap **Save & next card**. The popup closes, the card is saved to local storage and the configured Supabase vault, and automatic scanning resumes. You need to remove the just-saved card from view before scanning it again.
5. If an ID is incorrect, tap **Wrong ID? Correct it manually**.

Artwork comes from the English card catalog; OCR alone **cannot distinguish alternate-art variants sharing an ID**. If the art does not match, use the printing selector during the save step. If an image cannot load, the popup displays a placeholder.

## Upgrade the GitHub Pages app
1. **Back up the collection** from your app.
2. Download and extract the v1.1.2 ZIP.
3. Upload the files from the extracted folder to the **repository root** of `TheDubous/grand-line-vault`, replacing `index.html`, `app.js`, `styles.css` and other same-named files; commit to `main`.
4. Open `https://thedubous.github.io/grand-line-vault/` and refresh. The sidebar should say **Version 1.1.2**.
5. Test a recognized card, **No**, **Yes**, and **Save**, and check that the box and cloud remain correct.

No new SQL and no Supabase reconfiguration is required.

*Limitations: This update changes presentation, not the accuracy of underlying OCR. Real-device recognition still requires testing.*
