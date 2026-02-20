export interface FilterChipDef {
  label: string;
  terms: string[];
}

export const FILTER_CHIP_DEFS: FilterChipDef[] = [
  { label: 'Chicken', terms: ['chicken'] },
  { label: 'Beef', terms: ['beef'] },
  { label: 'Lamb', terms: ['lamb'] },
  {
    label: 'Fish',
    terms: [
      'fish', 'salmon', 'tuna', 'tilapia', 'cod', 'trout',
      'shrimp', 'prawn', 'halibut', 'sea bass', 'sardine', 'anchovy',
    ],
  },
  {
    label: 'Pasta',
    terms: [
      'pasta', 'spaghetti', 'noodle', 'linguine', 'penne',
      'fettuccine', 'rigatoni', 'orzo', 'lasagna', 'tagliatelle',
    ],
  },
  { label: 'Rice', terms: ['rice'] },
  { label: 'Potato', terms: ['potato'] },
  {
    label: 'Bread',
    terms: ['bread', 'pita', 'flatbread', 'focaccia', 'loaf', 'baguette', 'naan'],
  },
  { label: 'Salad', terms: ['salad'] },
  {
    label: 'Soup',
    terms: ['soup', 'stew', 'broth', 'chowder', 'bisque'],
  },
  {
    label: 'Dessert',
    terms: [
      'cake', 'cookie', 'chocolate', 'brownie', 'halva', 'dessert',
      'pie', 'tart', 'pudding', 'fudge', 'mousse', 'sweet',
    ],
  },
  { label: 'Egg', terms: ['egg', 'omelette', 'frittata'] },
  { label: 'Chickpeas', terms: ['chickpea'] },
  {
    label: 'One-Pan',
    terms: ['one-pan', 'one pan', 'one-pot', 'one pot', 'one-skillet', 'sheet pan'],
  },
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
