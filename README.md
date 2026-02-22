# My Mind Maps

Browser-based React app for building mind maps with local autosave and markdown outline support.

## Features

- Interactive node + edge editing with `@xyflow/react`
- Keyboard-first topic editing (no popup prompts)
- Add child/sibling topics and rename/delete topics via shortcuts
- Branch-style mind map rendering by default
- Organize command for clean map layout
- Markdown outline panel with one-click copy
- PNG export of the current mind map view
- Auto-saved browser-local storage for multiple mind maps

## Architecture

```mermaid
graph TD
    subgraph UI["UI Components"]
        App["App Shell"]
        VaultPanel["Vault Panel"]
        Editor["Mind Map Editor"]
        OutlinePanel["Outline Panel"]
        
        App --> VaultPanel
        App --> Editor
        App --> OutlinePanel
    end

    subgraph Hooks["Custom Hooks (State)"]
        useVault["useVault (Map Lifecycle)"]
        useAutosave["useAutosave (Persistence)"]
        useOutline["useOutline (Sync Graph & MD)"]
        
        App --> useVault
        App --> useAutosave
        App --> useOutline
    end

    subgraph Libs["Domain Logic & Libraries"]
        ReactFlow["@xyflow/react"]
        LocalStore["localStore.ts (LocalStorage API)"]
        Layout["layout.ts (Graph Layout Math)"]
        Export["export.ts (PNG/MD Export)"]
        OutlineSync["outlineSync.ts (MD Parsing)"]

        Editor --> ReactFlow
        useVault --> LocalStore
        useAutosave --> LocalStore
        Editor --> Layout
        App --> Export
        useOutline --> OutlineSync
    end
```

## Keyboard Shortcuts

- `Enter`: add child topic and focus text edit immediately
- `Tab`: add sibling topic and focus text edit immediately
- `F2` or `Ctrl/Cmd+E`: rename selected topic inline
- `Delete` / `Backspace`: delete selected node (root is protected)
- `ArrowUp` / `ArrowDown`: move selection across topics
- `Ctrl/Cmd+S`: export PNG
- `Ctrl/Cmd+N`: create a new map
- `Ctrl/Cmd+L`: organize map layout

## Quick Start

1. Install dependencies:

```bash
npm install
```

2. Run the app:

```bash
npm run dev
```

## Testing

```bash
npm test
```

## License

MIT. See `LICENSE`.
