# Design a Stitch UI for Poker Ledger

Design a modern, mobile-friendly UI for a “Stitch” feature in the Poker Ledger app. This feature should allow users to combine multiple game sessions, player histories, or transaction records into a single summary or export. The UI should:

- Support easy selection and reordering of sessions/records to be stitched
- Provide clear visual feedback for selected items (e.g., highlight, checkbox)
- Offer drag-and-drop or swipe gestures for reordering (mobile-first)
- Show a live preview of the stitched summary (e.g., combined stats, merged history)
- Include options for output format (table, CSV, PDF, etc.)9nm
- Use accessible colors, readable fonts, and intuitive icons
- Follow the project’s design system (TailwindCSS, glassmorphism, theme colors)
- Minimize steps and keep the workflow simple

Reference [src/App.jsx](src/App.jsx) and [src/App.css](src/App.css) for style and component patterns. Use localStorage keys and data structures as defined in the project.

---

**Example user story:**
“As a user, I want to select several past poker sessions and stitch them into a single report, so I can review or share my overall performance.”
