interface SearchBarProps {
  query: string;
  onChange: (nextQuery: string) => void;
  onClear: () => void;
}

export function SearchBar({ query, onChange, onClear }: SearchBarProps) {
  return (
    <div className="search-bar">
      <input
        type="search"
        value={query}
        onChange={(event) => onChange(event.target.value)}
        placeholder="Search by recipe or ingredient..."
        aria-label="Search recipes"
      />
      <button type="button" onClick={onClear} disabled={!query.trim()}>
        Clear
      </button>
    </div>
  );
}
