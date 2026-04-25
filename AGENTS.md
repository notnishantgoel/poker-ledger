# Project Guidelines

## Code Style
- **Language**: JavaScript (React JSX, no TypeScript)
- **Formatting**: Follow patterns in [src/App.jsx](src/App.jsx) and [src/App.css](src/App.css)
- **Styling**: TailwindCSS v4, custom theme colors via CSS variables (`--th-300` to `--th-600`), glassmorphism classes (`.glass-panel`, `.glass-card`)
- **Linting**: Run `npm run lint` (enforces React Hooks rules, allows uppercase unused constants)

## Architecture
- **Single main component**: [src/App.jsx](src/App.jsx) contains all UI, state, and game logic
- **State**: Managed via React state, localStorage, and optional Firebase sync ([src/firebase.js](src/firebase.js))
- **Mobile-first**: Responsive, touch-optimized, with custom haptics and input focus management
- **Dual targets**: Web (GitHub Pages) and Android (Capacitor)

## Build and Test
- **Install**: `npm install`
- **Dev server**: `npm run dev`
- **Production build**: `npm run build`
- **Android build**: `npm run build:android`
- **Preview**: `npm run preview`
- **Lint**: `npm run lint`
- **Testing**: No automated tests configured (add if needed)

## Conventions
- **LocalStorage keys**: `poker-ledger-game`, `poker-ledger-names`, `poker-ledger-history`, `poker-ledger-upi`
- **Currency**: Indian Rupee (₹) hardcoded
- **Component patterns**: Memoized components, custom hooks for input syncing, utility functions for currency rounding
- **Firebase**: Credentials are hardcoded; see [src/firebase.js](src/firebase.js). Migrate to environment variables for production security.
- **No TypeScript**: Use plain JSX; type-checking is optional via `// @ts-check` comments

---
For more details, see [README.md](README.md) and source files referenced above.
