# Hidden in My Heart Web App

Static web version of Isaac's Hidden in My Heart iPhone app.

## What It Does

- Saves Scripture verses, translations, categories, and journal entries in the browser.
- Imports the native iOS app backup JSON format.
- Exports the same backup structure for safekeeping.
- Includes library search/filtering, journal view, categories, and practice flashcards.
- Uses local browser storage only.
- Has no accounts, server, build step, or external dependencies.

## Files

- `index.html` is the app shell.
- `styles.css` contains the app styling.
- `app.js` contains the local data store and app behavior.
- `manifest.webmanifest`, `sw.js`, and icon files support Home Screen use and offline loading.

## GitHub Pages

The app is meant to run at:

`https://iowoyemi-blip.github.io/personal_apps/hidden-in-my-heart/`

Verse and journal data is saved per browser/device. It does not sync between devices.
