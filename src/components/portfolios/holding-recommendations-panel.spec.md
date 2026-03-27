# HoldingRecommendationsPanel — UX & Implementation Specification

**Target file:** `src/components/portfolios/holding-recommendations-panel.tsx`
**Placement:** Added to `src/app/(dashboard)/portfolios/page.tsx` immediately after `<HoldingsPanelsList />`, inside the existing `space-y-6` stack.

---

## 1. Component Tree

```
HoldingRecommendationsPanel            (root, "use client")
├── PanelHeader
│   ├── TitleRow
│   │   ├── title text "Portfolio Recommendations"
│   │   └── HoldingsCountBadge
│   ├── LastRefreshedTimestamp          (conditional)
│   └── ActionButtonRow
│       ├── RefreshPricesButton
│       └── GenerateRecommendationsButton
├── ErrorBanner                         (conditional, renders when error state is set)
├── FilterSortBar                       (conditional, renders when recommendations.length > 0)
│   ├── FilterChipList
│   │   └── FilterChip × N
│   └── SortDropdown
├── EmptyState                          (conditional, renders when no recs and not loading)
├── SkeletonList                        (conditional, renders while loading)
│   └── SkeletonCard × 3
└── RecommendationList                  (conditional, renders when recs exist after load)
    └── RecommendationCard × N
        ├── CollapsedContent            (always visible)
        │   ├── UrgencyBorder           (left border, part of card styling)
        │   ├── ActionBadge
        │   ├── SecurityLabel
        │   ├── ShortRationaleText
        │   ├── AlternativeLabel        (conditional: REPLACE or SELL with alternativeTicker)
        │   └── ExpandChevron
        └── ExpandedContent             (conditional: renders when card id matches expandedId)
            ├── FullRationaleParagraph
            ├── AlternativeRow          (conditional: REPLACE with alternativeTicker)
            └── CitationsSection
                ├── section header "Supporting Research"
                └── CitationBlock × N
                    ├── BookTitle + Author
                    ├── PrinciplePill
                    └── ExcerptBlockquote
```

---

## 2. State Variables

All state lives in `HoldingRecommendationsPanel`.

```typescript
// Fetched data
const [recommendations, setRecommendations] = useState<HoldingRecommendation[]>([]);
const [lastPriceRefresh, setLastPriceRefresh] = useState<Date | null>(null);

// Loading states — tracked independently so each button can spin without blocking the other
const [isRefreshingPrices, setIsRefreshingPrices] = useState(false);
const [isGenerating, setIsGenerating] = useState(false);

// Error state — one message at a time, cleared on retry
const [error, setError] = useState<string | null>(null);

// Expand/collapse — stores the holdingId of the currently expanded card (only one at a time)
const [expandedId, setExpandedId] = useState<string | null>(null);

// Filter — "all" plus each action value, plus "high" for urgency shortcut
type FilterValue = "all" | "high" | "INCREASE" | "DECREASE" | "REPLACE" | "SELL" | "HOLD";
const [activeFilter, setActiveFilter] = useState<FilterValue>("all");

// Sort
type SortValue = "urgency" | "action" | "name";
const [sortBy, setSortBy] = useState<SortValue>("urgency");
```

**Derived values (computed inline, not stored in state):**

- `filteredAndSorted`: the recommendations array after applying `activeFilter` and `sortBy`
- `holdingsCount`: `recommendations.length`

---

## 3. Visual Specifications — Tailwind v4 Class Patterns

### 3.1 Panel Wrapper

The outer panel matches the existing `portfolio-intelligence-panel` pattern exactly.

```
rounded-xl border border-gray-200 bg-white p-6 shadow-sm
```

### 3.2 Panel Header

**Outer header row** (title + buttons, stacks on mobile):
```
flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between mb-6
```

**Title row** (title + count badge inline):
```
flex items-center gap-2.5
```

**Title text:**
```
text-lg font-semibold text-slate-900
```

**HoldingsCountBadge** (e.g. "12 holdings"):
```
inline-flex items-center rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-600
```

**Last refreshed timestamp** (sits below title, above button row on mobile):
```
text-xs text-slate-400 mt-0.5
```
Format: "Prices last refreshed: Mar 26, 2026 at 2:14 PM" — use `toLocaleString()`.
Hide entirely when `lastPriceRefresh` is null.

**ActionButtonRow:**
```
flex items-center gap-2 flex-wrap
```

**RefreshPricesButton** — uses existing `Button` component:
```
variant="secondary" size="sm"
```
When `isRefreshingPrices` is true: show a spinner SVG (animate-spin, 14x14, same pattern as the Spinner in `portfolio-intelligence-panel.tsx`) prepended to the label, and pass `disabled`.

**GenerateRecommendationsButton** — uses existing `Button` component:
```
variant="primary" size="sm"
```
When `isGenerating` is true: spinner prepended to label, `disabled`.

### 3.3 ActionBadge (pill)

Base classes for all badges:
```
inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold uppercase tracking-wide
```

Per-action color classes (appended):

| Action    | Classes |
|-----------|---------|
| INCREASE  | `bg-green-100 text-green-800` |
| DECREASE  | `bg-amber-100 text-amber-800` |
| HOLD      | `bg-slate-100 text-slate-600` |
| REPLACE   | `bg-blue-100 text-blue-800` |
| SELL      | `bg-red-100 text-red-700` |

### 3.4 RecommendationCard

**Outer wrapper** — a `<button>` element (for full keyboard activation) wrapping the card content, or a `<div>` with `onClick`. See accessibility note in section 5. Use `<div>` with `role="button"` and `tabIndex={0}` to avoid nesting interactive children (citations have no interactivity, so a `<button>` wrapping is also fine if citations section is excluded from the click target).

Recommended approach: outer `<div>` as the card, with a dedicated toggle area (the collapsed row) being the clickable element.

**Card container:**
```
rounded-lg border border-slate-200 bg-white overflow-hidden transition-shadow hover:shadow-md
```

**Left urgency border** — implemented as a 3px left border on the card container by appending:

| Urgency | Extra class |
|---------|-------------|
| high    | `border-l-4 border-l-red-500` |
| medium  | `border-l-4 border-l-amber-400` |
| low     | (no extra border classes, default `border border-slate-200` applies) |

Because `border-l-4` overrides the shorthand `border` on the left side, add `border border-slate-200 border-l-4 border-l-red-500` for high urgency, and `border border-slate-200 border-l-4 border-l-amber-400` for medium. For low, use `border border-slate-200`.

**Collapsed row** (the clickable toggle area):
```
flex items-start gap-3 px-4 py-3 cursor-pointer select-none
```

**SecurityLabel** (name + ticker):
```
text-sm font-medium text-slate-900
```
Ticker rendered inline after name:
```
text-sm font-mono text-slate-500 ml-1
```
e.g.: `Vanguard Total Market (VTI)`

**ShortRationaleText:**
```
text-sm text-slate-500 line-clamp-2 mt-0.5
```
Apply `line-clamp-2` to enforce truncation in collapsed state.

**AlternativeLabel** (small secondary line, collapsed, for REPLACE/SELL with alternativeTicker):
```
text-xs text-slate-400 mt-1
```
Content: `→ Consider: SCHB — Schwab US Broad Market ETF`

**ExpandChevron** (right side, pushed with `ml-auto flex-shrink-0`):
```
h-4 w-4 text-slate-400 transition-transform duration-200
```
When expanded: `rotate-180` class added. Use an inline SVG chevron-down or a lucide-react `ChevronDown` icon if already in the project.

### 3.5 Expanded Content

**Expanded content wrapper:**
```
px-4 pb-4 border-t border-slate-100 pt-3 space-y-4
```

**FullRationaleParagraph:**
```
text-sm text-slate-700 leading-relaxed
```

**AlternativeRow** (REPLACE only, expanded):
```
flex items-center gap-2 rounded-md bg-blue-50 border border-blue-100 px-3 py-2 text-sm
```
Label "Alternative:" in `font-medium text-blue-800`, then ticker in `font-mono font-semibold text-blue-900`, then em-dash, then name in `text-blue-700`.

**CitationsSection header:**
```
text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2
```
Content: "Supporting Research"

**CitationBlock** (one per citation, stacked with `space-y-3`):
```
space-y-1
```

**Book title:**
```
text-sm font-semibold text-slate-800
```

**Author** (inline after title, separated by em-dash):
```
text-sm text-slate-500
```

**PrinciplePill:**
```
inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600 mt-0.5
```

**ExcerptBlockquote:**
```
border-l-2 border-slate-200 pl-3 text-xs text-slate-500 italic leading-relaxed mt-1
```

### 3.6 FilterSortBar

**Outer bar:**
```
flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-4
```

**FilterChipList:**
```
flex flex-wrap gap-1.5
```

**FilterChip — inactive:**
```
inline-flex items-center rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-medium text-slate-600 cursor-pointer transition-colors hover:bg-slate-50 hover:border-slate-300
```

**FilterChip — active:**
```
inline-flex items-center rounded-full border border-indigo-200 bg-indigo-50 px-3 py-1 text-xs font-medium text-indigo-700 cursor-pointer
```

**SortDropdown** (`<select>` element):
```
rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer
```

### 3.7 EmptyState

**Wrapper:**
```
flex flex-col items-center justify-center py-16 text-center
```

**Illustration placeholder** (use an SVG icon — a bar-chart or sparkles icon works well, sized 48x48):
```
h-12 w-12 text-slate-300 mb-4
```

**Headline:**
```
text-base font-semibold text-slate-700 mb-1
```
Content: "No recommendations yet"

**Subtext:**
```
text-sm text-slate-400 max-w-sm mb-6
```
Content: "Refresh your prices and generate recommendations to see actionable insights for your portfolio."

**Primary CTA button** — uses existing `Button` component, `variant="primary"`:
```
Generate Recommendations
```
This button should call the same handler as `GenerateRecommendationsButton` in the header.

### 3.8 SkeletonList

Renders exactly 3 `SkeletonCard` components while loading.

**SkeletonCard outer:**
```
rounded-lg border border-slate-200 bg-white overflow-hidden animate-pulse
```

**Inner layout** (mimics collapsed card proportions):
```
flex items-start gap-3 px-4 py-3
```

Inside, use two `<div>` blocks:

Block 1 — badge placeholder:
```
h-5 w-16 rounded-full bg-slate-200
```

Block 2 — text lines (flex-col gap-2 flex-1):
```
h-4 w-48 rounded bg-slate-200   (name line)
h-3 w-72 rounded bg-slate-100   (rationale line 1)
h-3 w-56 rounded bg-slate-100   (rationale line 2)
```

Block 3 — chevron placeholder (ml-auto):
```
h-4 w-4 rounded bg-slate-200
```

### 3.9 ErrorBanner

```
flex items-start gap-3 rounded-lg bg-red-50 border border-red-200 px-4 py-3 mb-4
```

**Icon** (exclamation-circle, 16x16):
```
h-4 w-4 text-red-500 flex-shrink-0 mt-0.5
```

**Message text:**
```
text-sm text-red-700 flex-1
```

**"Try Again" button** — uses existing `Button` component:
```
variant="danger" size="sm"
```

---

## 4. Interaction Behavior

### 4.1 Expand / Collapse Cards

- Clicking anywhere on the collapsed row (`px-4 py-3` div) toggles the card.
- `setExpandedId(id)` if the card is collapsed, `setExpandedId(null)` if it is already expanded — this ensures only one card is open at a time.
- The chevron icon rotates 180 degrees using `transition-transform duration-200` and the `rotate-180` class toggled by expanded state.
- The expanded content can be mounted conditionally (`expandedId === rec.holdingId`) with no animation required, or wrapped in a simple `max-h` transition for a smooth open effect:
  - Collapsed: `max-h-0 overflow-hidden`
  - Expanded: `max-h-[1000px] overflow-hidden transition-[max-height] duration-300 ease-in-out`
  - Note: `max-h` transitions require a concrete upper bound; 1000px is a safe ceiling for citation-heavy cards.

### 4.2 Filter Chips

- Clicking a chip calls `setActiveFilter(value)` and resets `setExpandedId(null)` (so no card stays open across filter changes).
- The "All" chip is selected by default and shows the total count in parentheses: "All (12)".
- Other chips show their label only (no counts needed, but counts can be added as a nice-to-have: "INCREASE (3)").
- Filtering logic:
  - `"all"` → no filter
  - `"high"` → `rec.urgency === "high"`
  - `"INCREASE"` | `"DECREASE"` | `"REPLACE"` | `"SELL"` | `"HOLD"` → `rec.action === value`

### 4.3 Sort Dropdown

- `"urgency"`: sort by urgency with order `high → medium → low`, then by `securityName` alphabetically as a tiebreaker.
- `"action"`: sort by action type alphabetically (`DECREASE, HOLD, INCREASE, REPLACE, SELL`).
- `"name"`: sort by `securityName` alphabetically.
- Changing sort does not reset `expandedId`.

### 4.4 Refresh Prices Button

1. Set `isRefreshingPrices = true`, clear `error`.
2. Call the tRPC mutation (e.g., `trpc.portfolios.refreshHoldingPrices.useMutation()`).
3. On success: set `lastPriceRefresh = new Date()`, set `isRefreshingPrices = false`.
4. On error: set `error = "Failed to refresh prices. Please try again."`, set `isRefreshingPrices = false`.

### 4.5 Generate Recommendations Button

1. Set `isGenerating = true`, clear `error`, reset `expandedId = null`, reset `activeFilter = "all"`.
2. Call the tRPC mutation (e.g., `trpc.portfolios.generateHoldingRecommendations.useMutation()`).
3. On success: call `setRecommendations(data)`, set `isGenerating = false`.
4. On error: set `error = "Failed to generate recommendations. Please try again."`, set `isGenerating = false`.

---

## 5. Accessibility

### aria-expanded on Cards

The clickable collapsed row should be a `<button>` or have `role="button"`:
```
aria-expanded={expandedId === rec.holdingId}
aria-controls={`rec-body-${rec.holdingId}`}
```
The expanded content `<div>` should have:
```
id={`rec-body-${rec.holdingId}`}
```

### Filter Chips

Render filter chips as `<button>` elements. The active chip gets:
```
aria-pressed={activeFilter === value}
```

### Sort Dropdown

Standard `<select>` with `<label>` (visually hidden is fine):
```html
<label htmlFor="rec-sort" className="sr-only">Sort recommendations by</label>
<select id="rec-sort" ...>
```

### Keyboard Navigation

- Tab moves through filter chips, sort dropdown, action buttons, and card toggle rows in DOM order.
- Enter and Space activate the card toggle row (handled automatically if it is a `<button>`; if using `role="button"` on a `<div>`, add `onKeyDown` that calls the toggle on Enter/Space).
- The citation text within expanded cards is read-only, so no interactive elements need special handling there.

### Screen Reader Hints

- The spinner button label should include screen-reader text: "Refreshing prices…" (visible label changes) or an `aria-label` that reflects loading state.
- The chevron icon should have `aria-hidden="true"` since the expanded state is communicated via `aria-expanded`.
- The urgency left border is a visual-only indicator. Add a visually hidden `<span className="sr-only">` inside the card header with text like "High urgency" / "Medium urgency" / "Low urgency".

---

## 6. Animation and Transition Recommendations

| Element | Recommendation |
|---|---|
| Card expand/collapse | `max-h` transition: `transition-[max-height] duration-300 ease-in-out` between `max-h-0` and `max-h-[1000px]` |
| Chevron rotation | `transition-transform duration-200` with `rotate-180` toggled |
| Skeleton shimmer | `animate-pulse` (built-in Tailwind) on each skeleton card |
| Button loading state | `animate-spin` on the spinner SVG prepended to the button label |
| Error banner appearance | Optional: `animate-in fade-in duration-200` (requires `tailwindcss-animate` if already in project; otherwise omit) |
| Filter chip active state | `transition-colors duration-150` on each chip |
| Panel-level entry | No animation needed; the panel is always present in the DOM once the page loads |

---

## 7. tRPC Endpoint Assumptions

The spec assumes these tRPC procedures will be added to the portfolios router:

| Procedure | Type | Purpose |
|---|---|---|
| `portfolios.refreshHoldingPrices` | mutation | Calls Yahoo Finance for all holdings in the user's portfolios, updates prices in DB, returns `{ refreshedAt: Date }` |
| `portfolios.generateHoldingRecommendations` | mutation | Calls Claude with user's holdings context, returns `HoldingRecommendation[]` |
| `portfolios.getHoldingRecommendations` | query | Returns cached `HoldingRecommendation[]` for the current user (for hydration on page load) |

On mount, `HoldingRecommendationsPanel` should call `portfolios.getHoldingRecommendations` to hydrate any previously generated recommendations, so the user does not see an empty state after navigating away and back.

---

## 8. File Structure

```
src/components/portfolios/
├── holding-recommendations-panel.tsx   ← new root component ("use client")
├── recommendation-card.tsx             ← new sub-component for a single card
└── (existing files unchanged)
```

Splitting `RecommendationCard` into its own file is recommended because it carries meaningful local state (the expand/collapse toggle behavior can alternatively be lifted to the parent via `expandedId` prop) and citation rendering logic, keeping the root panel file focused on data fetching and filter/sort logic.

If the developer prefers a single-file approach, all sub-components can be defined as local functions in `holding-recommendations-panel.tsx` following the pattern used in `portfolio-intelligence-panel.tsx`.

---

## 9. Integration into portfolios/page.tsx

Add one import and one JSX line:

**Import:**
```
import { HoldingRecommendationsPanel } from "@/components/portfolios/holding-recommendations-panel";
```

**Placement** — after `<HoldingsPanelsList />` in the `space-y-6` div:
```
<HoldingsPanelsList />
<HoldingRecommendationsPanel />
```

No props are required on the panel; it fetches its own data internally via tRPC hooks, consistent with every other component on this page.

---

## 10. Summary Checklist for Developer

- [ ] Create `holding-recommendations-panel.tsx` with `"use client"` directive
- [ ] Implement 7 state variables as listed in section 2
- [ ] Build `PanelHeader` with independent loading states on each button
- [ ] Build `ErrorBanner` with "Try Again" wired to the appropriate mutation retry
- [ ] Build `FilterSortBar` with 7 filter chips and 3-option sort dropdown
- [ ] Build `EmptyState` with CTA wired to the generate handler
- [ ] Build `SkeletonList` with 3 shimmer cards for loading state
- [ ] Build `RecommendationCard` with left urgency border, action badge, expand/collapse, citations
- [ ] Apply all Tailwind class patterns from section 3
- [ ] Add `aria-expanded`, `aria-controls`, `id`, `aria-pressed`, `sr-only` urgency text per section 5
- [ ] Add tRPC procedures to portfolios router (`refreshHoldingPrices`, `generateHoldingRecommendations`, `getHoldingRecommendations`)
- [ ] Wire initial hydration query on mount
- [ ] Register component in `portfolios/page.tsx`
