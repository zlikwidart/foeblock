# STLtoday Foe Thread Filter

Hides topic rows on STLtoday's phpBB forum when the thread starter is on your foe list.

## Browser support

- Chrome / Edge / Brave / other Chromium browsers
- Firefox

This is a single Manifest V3 WebExtension codebase intended to work in both Chrome-based browsers and Firefox.

## What it does

- Runs on `https://interact.stltoday.com/forums/viewforum.php*`
- Tries to read your phpBB foe list automatically
- Lets you manually enter fallback usernames in the options page
- Hides matching thread rows from the forum listing

## Install locally

### Chrome / Edge
1. Download or clone this repo.
2. Open `chrome://extensions`.
3. Enable **Developer mode**.
4. Click **Load unpacked**.
5. Select this folder.

### Firefox
#### Temporary install
1. Download or clone this repo.
2. Open `about:debugging#/runtime/this-firefox`.
3. Click **Load Temporary Add-on**.
4. Select `manifest.json` in this folder.

#### Permanent install
For a normal one-click Firefox install, the extension would need to be packaged and signed through Mozilla Add-ons.

## Use

1. Log into STLtoday forums.
2. Open the extension options page if you want to add manual fallback names.
3. Visit a forum page such as:
   - `https://interact.stltoday.com/forums/viewforum.php?f=10`
4. Refresh the page.

## Repo layout

- `manifest.json`
- `content.js`
- `options.html`
- `options.js`

## Notes

- Firefox and Chrome share most WebExtension APIs, but there are still some cross-browser differences.
- This extension uses only packaged local code.
