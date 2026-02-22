import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { FilterChips, FILTER_CHIP_DEFS } from '../FilterChips';

const noop = () => {};
const zeroCounts = Object.fromEntries(FILTER_CHIP_DEFS.map((c) => [c.label, 0]));
const someCounts = { ...zeroCounts, Chicken: 5, Beef: 3 };

describe('FilterChips', () => {
  it('renders a button for every chip definition', () => {
    render(
      <FilterChips activeFilters={[]} onToggle={noop} onClearAll={noop} counts={zeroCounts} />
    );

    for (const chip of FILTER_CHIP_DEFS) {
      expect(screen.getByRole('button', { name: chip.label })).toBeInTheDocument();
    }
  });

  it('sets aria-pressed="true" on active chips and "false" on inactive chips', () => {
    render(
      <FilterChips
        activeFilters={['Chicken']}
        onToggle={noop}
        onClearAll={noop}
        counts={someCounts}
      />
    );

    expect(screen.getByRole('button', { name: 'Chicken' })).toHaveAttribute(
      'aria-pressed',
      'true'
    );
    expect(screen.getByRole('button', { name: 'Beef' })).toHaveAttribute('aria-pressed', 'false');
  });

  it('calls onToggle with the chip label when a chip is clicked', async () => {
    const onToggle = vi.fn();
    render(
      <FilterChips activeFilters={[]} onToggle={onToggle} onClearAll={noop} counts={someCounts} />
    );

    await userEvent.click(screen.getByRole('button', { name: 'Chicken' }));
    expect(onToggle).toHaveBeenCalledWith('Chicken');
  });

  it('does not render the clear button when no filters are active', () => {
    render(
      <FilterChips activeFilters={[]} onToggle={noop} onClearAll={noop} counts={zeroCounts} />
    );

    expect(screen.queryByRole('button', { name: 'Clear all filters' })).not.toBeInTheDocument();
  });

  it('renders the clear button when at least one filter is active', () => {
    render(
      <FilterChips
        activeFilters={['Chicken']}
        onToggle={noop}
        onClearAll={noop}
        counts={someCounts}
      />
    );

    expect(screen.getByRole('button', { name: 'Clear all filters' })).toBeInTheDocument();
  });

  it('calls onClearAll when the clear button is clicked', async () => {
    const onClearAll = vi.fn();
    render(
      <FilterChips
        activeFilters={['Chicken']}
        onToggle={noop}
        onClearAll={onClearAll}
        counts={someCounts}
      />
    );

    await userEvent.click(screen.getByRole('button', { name: 'Clear all filters' }));
    expect(onClearAll).toHaveBeenCalledTimes(1);
  });

  it('shows a count badge inside chips with a non-zero count', () => {
    render(
      <FilterChips activeFilters={[]} onToggle={noop} onClearAll={noop} counts={someCounts} />
    );

    expect(screen.getByRole('button', { name: 'Chicken' })).toHaveTextContent('5');
  });

  it('adds the is-empty class to chips with a count of 0 that are not active', () => {
    render(
      <FilterChips activeFilters={[]} onToggle={noop} onClearAll={noop} counts={zeroCounts} />
    );

    expect(screen.getByRole('button', { name: 'Chicken' })).toHaveClass('is-empty');
  });

  it('does not add is-empty to an active chip even when its count is 0', () => {
    render(
      <FilterChips
        activeFilters={['Chicken']}
        onToggle={noop}
        onClearAll={noop}
        counts={zeroCounts}
      />
    );

    expect(screen.getByRole('button', { name: 'Chicken' })).not.toHaveClass('is-empty');
  });
});
