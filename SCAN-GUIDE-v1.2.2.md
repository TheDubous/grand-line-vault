# Scanner alignment: v1.2.2

The previous pink frame was too small relative to the actual card, and the blue ID target was too large.

## New guide
- Pink guide: 90% of the camera preview height, physical card aspect ratio, subtle corner markers.
- Blue guide: small bottom-right printed-ID target positioned inside the pink card guide.
- Camera OCR reads the actual on-screen blue guide using measured DOM coordinates. It also retries larger bottom-right crops and the lower portion of the card.
- A legend and concise distance hint are displayed below the camera, not over the card art.
- On phones Capture is visually primary, with auto/flip below.

## Upgrade
1. Back up the current collection for safety.
2. Replace website files in the existing GitHub repo with these files and commit to main.
3. No SQL changes. Use your existing Supabase and passwords.
4. Verify version 1.2.2. If Home Screen app stays old, open website in Safari first and check sync before installing a new icon.

## Limitations
This is an alignment/UI improvement, not guaranteed OCR accuracy. Test with several cards on an actual iPhone.
