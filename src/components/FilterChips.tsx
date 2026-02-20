export interface FilterChipDef {
  label: string;
  terms: string[];
}

export const FILTER_CHIP_DEFS: FilterChipDef[] = [
  { label: 'Chicken', terms: ['chicken'] },
  { label: 'Beef', terms: ['beef'] },
  { label: 'Fish', terms: ['fish', 'salmon', 'tilapia'] },
  { label: 'Rice', terms: ['rice'] },
  { label: 'Potato', terms: ['potato'] },
  { label: 'Salad', terms: ['salad'] },
  { label: 'Soup', terms: ['soup'] },
  { label: 'Dessert', terms: ['cake', 'cookie', 'chocolate', 'brownie', 'halva', 'dessert'] },
  { label: 'Chickpeas', terms: ['chickpea'] },
  { label: 'One-Pan', terms: ['one-pan', 'one pan'] },
];

interface FilterChipsProps {
  activeFilters: string[];
  onToggle: (label: string) => void;
}

export function FilterChips({ activeFilters, onToggle }: FilterChipsProps) {
  return (
    <div className="filter-chips" role="group" aria-label="Quick filters">
      <div className="filter-chips-track">
        {FILTER_CHIP_DEFS.map((chip) => {
          const isActive = activeFilters.includes(chip.label);
          return (
            <button
              key={chip.label}
              type="button"
              className={`filter-chip${isActive ? ' is-active' : ''}`}
              onClick={() => onToggle(chip.label)}
              aria-pressed={isActive}
            >
              {chip.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
