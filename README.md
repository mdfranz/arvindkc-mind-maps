# My Mind Maps

Browser-based React app for creating a simple mind map and exporting it as:
- a PNG image
- a Google Doc that includes the image and a bullet outline

## Features

- Interactive node + edge editing with `@xyflow/react`
- Keyboard-first topic editing (no popup prompts)
- Add child/sibling topics and rename/delete topics via shortcuts
- Two visual styles: `Boxed` and `Branch` (node-to-edge style)
- Growth direction toggle: add new branches to the left or right
- Live outline preview generated from graph structure
- PNG export of the current mind map view
- Google Docs export with:
  - map image embedded in the document
  - nested bullet outline
- Encrypted browser-local storage for multiple mind maps (passphrase-protected)

## Keyboard Shortcuts

- Use the `?` button in the editor toolbar to view shortcuts in-app.
- `Enter`: add child topic and focus text edit immediately
- `Tab`: add sibling topic and focus text edit immediately
- `F2` or `Ctrl/Cmd+E`: rename selected topic inline
- `Delete` / `Backspace`: delete selected node (root is protected)
- `ArrowUp` / `ArrowDown`: move selection across topics
- `Ctrl/Cmd+S`: export PNG
- `Ctrl/Cmd+Shift+S`: export Google Doc
- `Ctrl/Cmd+N`: create a new mind map
- `Ctrl/Cmd+L`: organize map layout

## Quick Start

1. Install dependencies:

```bash
npm install
```

2. Create env file:

```bash
cp .env.example .env.local
```

3. Fill `.env.local`:

```bash
VITE_GOOGLE_CLIENT_ID=your-google-oauth-client-id.apps.googleusercontent.com
VITE_GOOGLE_API_KEY=your-google-api-key
```

4. Run the app:

```bash
npm run dev
```

## Google Cloud Setup

1. Create/select a Google Cloud project.
2. Enable APIs:
- Google Docs API
- Google Drive API
3. Create credentials:
- OAuth Client ID (Web application)
- API key
4. In OAuth client settings, add your local origin, for example:
- `http://localhost:5173`
5. Add the credentials to `.env.local`.

## Notes

- Google Docs image insertion needs a URL that Google can fetch.
- The app uploads the exported PNG to your Drive, sets it to anyone-readable, and inserts that URL into the doc.
- Nested bullets are derived from the mind map parent-child depth.
