export interface FilterChipDef {
  label: string;
  terms: string[];
  /** Pre-compiled word-boundary patterns for each term (avoids false substring hits). */
  patterns: RegExp[];
}

function buildPattern(term: string): RegExp {
  const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`\\b${escaped}\\b`);
}

function defineChip(label: string, terms: string[]): FilterChipDef {
  return { label, terms, patterns: terms.map(buildPattern) };
}

export const FILTER_CHIP_DEFS: FilterChipDef[] = [
  defineChip('Chicken', ['chicken']),
  defineChip('Beef', ['beef']),
  defineChip('Lamb', ['lamb']),
  defineChip('Fish', [
    'fish', 'salmon', 'tuna', 'tilapia', 'cod', 'trout',
    'shrimp', 'prawn', 'halibut', 'sea bass', 'sardine', 'anchovy',
  ]),
  defineChip('Pasta', [
    'pasta', 'spaghetti', 'noodle', 'linguine', 'penne',
    'fettuccine', 'rigatoni', 'orzo', 'lasagna', 'tagliatelle',
  ]),
  defineChip('Rice', ['rice']),
  defineChip('Potato', ['potato']),
  defineChip('Bread', ['bread', 'pita', 'flatbread', 'focaccia', 'loaf', 'baguette', 'naan']),
  defineChip('Salad', ['salad']),
  defineChip('Soup', ['soup', 'stew', 'broth', 'chowder', 'bisque']),
  defineChip('Dessert', [
    'cake', 'cookie', 'chocolate', 'brownie', 'halva', 'dessert',
    'pie', 'tart', 'pudding', 'fudge', 'mousse',
  ]),
  defineChip('Egg', ['egg', 'omelette', 'frittata']),
  defineChip('Chickpeas', ['chickpea']),
  defineChip('One-Pan', ['one-pan', 'one pan', 'one-pot', 'one pot', 'one-skillet', 'sheet pan']),
];

interface FilterChipsProps {
  activeFilters: string[];
  onToggle: (label: string) => void;
  onClearAll: () => void;
  counts: Record<string, number>;
}

export function FilterChips({ activeFilters, onToggle, onClearAll, counts }: FilterChipsProps) {
  return (
    <div className="filter-chips" role="group" aria-label="Quick filters">
      <div className="filter-chips-track">
        {FILTER_CHIP_DEFS.map((chip) => {
          const isActive = activeFilters.includes(chip.label);
          const count = counts[chip.label] ?? 0;
          return (
            <button
              key={chip.label}
              type="button"
              className={`filter-chip${isActive ? ' is-active' : ''}${count === 0 && !isActive ? ' is-empty' : ''}`}
              onClick={() => onToggle(chip.label)}
              aria-pressed={isActive}
            >
              {chip.label}
              {count > 0 && (
                <span className="filter-chip-count" aria-hidden="true">
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>
      {activeFilters.length > 0 && (
        <button
          type="button"
          className="filter-chips-clear"
          onClick={onClearAll}
          aria-label="Clear all filters"
        >
          Clear filters
        </button>
      )}
    </div>
  );
}
