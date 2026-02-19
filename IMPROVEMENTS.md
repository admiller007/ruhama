# UI Improvement Ideas

## Visual Polish & Atmosphere

- [x] **Background grain/noise texture** — Vintage parchment paper texture for aged cookbook feel
- [ ] **Ornamental dividers** — Replace simple header decoration with expressive editorial flourishes (botanical SVGs, typographic ornaments, hand-drawn rules). Add dividers between card batches.
- [ ] **Richer empty state** — Illustration or warm message like "Nothing here yet — try searching for 'chicken' or 'pasta'" with suggested search chips.

## Interactions & Motion

- [x] **Scroll-triggered card reveals** — Use `IntersectionObserver` to animate cards as they scroll into view instead of all at once on page load.
- [ ] **Search term highlighting** — Bold/highlight matched query text in recipe names and ingredient previews.
- [ ] **Scroll-to-top button** — Floating "back to top" button that fades in after scrolling down.
- [ ] **Skeleton loading state** — Placeholder card shapes during initial data load/search transitions.

## Functional Enhancements

- [ ] **Quick filter chips** — Tappable tags below search bar for common ingredients ("Chicken", "Pasta", "Salmon") or dietary categories.
- [ ] **Show macros/servings** — Display serving count and key macros (calories, protein) on the card.
- [ ] **Keyboard navigation** — Arrow keys to move between cards, Enter to expand/collapse.

## Typography & Layout

- [ ] **Pull-quote style recipe names** — Drop cap, decorative quotes, or thin left-border accent for longer recipe names.
- [ ] **Sticky search bar** — Pin search bar to the top on scroll so users can refine without scrolling back up.

## Polish

- [ ] **Dark mode toggle** — CSS variable system is already set up for this. Small sun/moon toggle in header.
- [ ] **Footer** — Minimal footer with attribution ("Recipes from @ruhamas_food").
