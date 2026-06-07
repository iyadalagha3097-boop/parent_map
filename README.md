# Parent Learning Centre Locator - Static GitHub Pages Version

This version does not need Python, Flask, or a server. It can run on GitHub Pages, Netlify, or any static HTTPS hosting.

## Files

- `index.html` - parent-facing page
- `style.css` - mobile-friendly design
- `app.js` - GPS, map, filtering, and nearest-centre calculation
- `lcs.json` - public LC data used by the app
- `convert_excel_to_lcs_json.py` - optional helper to export LC data from `school_tracker.xlsx`

## Data shared publicly

The `lcs.json` file should include only approved public LC information:

- Learning Centre name
- GPS coordinates
- Directorate
- Grades available
- Address
- Optional approved capacity/enrolment data

No parent/child personal data is collected or stored.

## Privacy approach

The parent's GPS location is read by the browser after consent. Distance calculations happen inside the browser. The location is not sent to a backend server.

## Updating data

1. Put `school_tracker.xlsx` in the same folder.
2. Run:
   `python convert_excel_to_lcs_json.py`
3. Replace the old `lcs.json` on GitHub Pages with the new one.

## GitHub Pages deployment

1. Create a GitHub repository.
2. Upload these files to the repository root.
3. Go to Settings > Pages.
4. Select deploy from the main branch/root.
5. Use the published HTTPS link to generate the QR code.


Update note: The app now shows no LC results until the parent shares GPS location. After location is detected, it shows only the nearest centres that match the selected filters. Grade filters understand ranges such as KG2-G12, so selecting G1 will include an LC with grades KG2-G12.
