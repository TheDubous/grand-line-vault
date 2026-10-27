# v1.1.1 Scanner recognition fix

This update changes only OCR recognition and camera preview capture; inventory, deck plans, and Supabase schema are unchanged.

## Changes

- OCR receives the same **portrait crop** the user actually sees (`object-fit: cover`), not an often-landscape entire video frame.
- Examines magnified bottom-right card-number windows before scanning broader areas.
- Uses single-line OCR mode for printed codes.
- Tolerates certain common OCR substitutions and stray digits next to rarity icons, but always requires visual confirmation before saving.
- Diagnostics now include a snapshot of the region sent to OCR (kept only in browser memory).

## Upgrade via GitHub

1. Export a JSON backup from the existing app.
2. Unzip this package and replace all files in repository root, commit to main. Do not upload the zip directly.
3. In your phone browser reload the GitHub Pages URL, checking the bottom-left version label reads 1.1.1. If Safari caches the previous version, close all tabs and reload.
4. Start rear camera, point at a card, and observe auto detection. If no code is found, expand **Recognition diagnostics (show OCR crop)**.
5. If the cropped preview does not include a clear printed code, reposition the card closer and align its bottom-right edge with the highlight; if the code is clearly visible but still ignored, send the crop and recognized text.

No SQL migration or Supabase key changes needed. No claims of physical iPhone camera accuracy: only logic/synthetic tests performed. Exact print identification from image remains unimplemented.
