# Gemini Developer Conventions & Best Practices

This document outlines the coding standards, architecture, and best practices observed in this repository. When contributing to this project, adhere to these guidelines to ensure consistency and maintainability.

## 🛠 Tech Stack
- **Framework:** React 18
- **Build Tool:** Vite
- **Language:** TypeScript
- **Styling:** Vanilla CSS (No utility frameworks like Tailwind or CSS-in-JS)
- **Graph/Canvas:** `@xyflow/react` (React Flow)
- **Local Persistence:** LocalStorage API

## 📁 Architecture & Project Structure
- `src/components/`: Contains UI components. These should be functional React components.
- `src/lib/`: Contains utility functions separated by domain logic (e.g., `layout.ts` for graph layout math, `outline.ts` for markdown parsing, `localStore.ts` for persistence, `export.ts` for file exporting). Keep these pure and decoupled from React where possible.
- `src/types.ts`: Central location for shared TypeScript type definitions.
- State is managed locally using React hooks (`useState`, `useReducer`, `useRef`). No global state management libraries (like Redux, Zustand) are used; rely on prop drilling and callback functions.

## 💻 TypeScript Conventions
- **Types over Interfaces:** Prefer using `type` for defining shapes and props over `interface` (e.g., `type MindNodeData = { ... }`).
- **Type Imports:** Strictly use type-only imports for types and interfaces to optimize bundle size and clarify intent (e.g., `import type { Edge, Node } from '@xyflow/react';`).
- **Strict Typing:** Ensure rigorous typing. Avoid `any`. Use generics where appropriate (e.g., `Node<MindNodeData, 'mind'>`).
- **Nullish Coalescing & Optional Chaining:** Use `??` for default values and `?.` for safe property access instead of verbose boolean checks.

## ⚛️ React & Component Standards
- **Component Declaration:** Use functional components declared with the `export default function ComponentName()` syntax.
- **Hook Usage:**
  - Liberally use standard hooks (`useState`, `useEffect`, `useCallback`, `useMemo`, `useRef`).
  - Use functional state updates when next state depends on the previous state (e.g., `setNodes((current) => ...)`).
  - Wrap stable callback functions passed as props in `useCallback` to prevent unnecessary re-renders.
  - Wrap derived or expensive data transformations in `useMemo`.
- **Event Handlers:** Prefix event handler functions with `handle` (e.g., `handleExportPng`, `handleOutlineChange`) or use descriptive verb phrases (e.g., `commitEdit`, `updateLabel`).
- **Memoization:** Wrap heavily reused child components in `memo()` (e.g., `MindMapNode`) to improve performance, especially important when dealing with graph visualizations.

## 🎨 Styling
- **Vanilla CSS:** Use plain CSS with semantic class names (e.g., `.app-shell`, `.workspace-3col`, `.side-panel`).
- **No Tailwind:** Do not use Tailwind CSS utility classes.
- **Dynamic Styles:** Use inline styles for highly dynamic properties that change frequently (like graph node positions or dynamic widths), and CSS classes for everything else.

## ✨ General Coding Best Practices
- **Naming Conventions:**
  - `PascalCase` for React components.
  - `camelCase` for variables, functions, and properties.
  - `UPPER_SNAKE_CASE` for global constants (e.g., `BRANCH_COLORS`).
- **Immutability:** Always treat state and complex objects as immutable. Use spread syntax `...` or array methods like `.map()` and `.filter()` to create updated copies.
- **Early Returns:** Prefer early returns to avoid deep nesting and to clarify function preconditions.