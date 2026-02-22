import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from './App';
import type { Recipe } from './lib/types';

const sampleData: Recipe[] = [
  {
    name: 'Chickpea Rice',
    shortcode: 'a1',
    ingredients: ['1 cup rice', '1 can chickpeas'],
    instructions: ['Cook rice']
  },
  {
    name: 'Beef Stew',
    shortcode: 'b2',
    ingredients: ['1 lb beef'],
    instructions: ['Simmer']
  }
];

describe('App', () => {
  it('filters recipes from query text', async () => {
    render(<App initialRecipes={sampleData} debounceMs={0} />);

    const search = screen.getByLabelText('Search recipes');
    await userEvent.type(search, 'chickpeas');

    expect(screen.getByText('Chickpea Rice')).toBeInTheDocument();
    expect(screen.queryByText('Beef Stew')).not.toBeInTheDocument();
  });

  it('highlights query matches in recipe names and ingredient previews', async () => {
    render(<App initialRecipes={sampleData} debounceMs={0} />);

    const search = screen.getByLabelText('Search recipes');
    await userEvent.type(search, 'chick');

    const highlights = screen.getAllByText(/chick/i, {
      selector: 'mark.search-highlight'
    });

    expect(highlights).toHaveLength(2);
  });

  it('renders the search bar inside a sticky container', () => {
    render(<App initialRecipes={sampleData} debounceMs={0} />);

    const search = screen.getByLabelText('Search recipes');
    const stickyContainer = search.closest('.search-bar-sticky');

    expect(stickyContainer).toBeInTheDocument();
  });

  it('shows details when a recipe is expanded', async () => {
    render(<App initialRecipes={sampleData} debounceMs={0} />);

    const hiddenInstruction = screen.getByText('Cook rice');
    expect(hiddenInstruction).not.toBeVisible();

    await userEvent.click(screen.getByText('Chickpea Rice'));

    expect(screen.getByText('Cook rice')).toBeVisible();
  });

  it('shows 100 recipes first and loads more on demand', async () => {
    const largeData: Recipe[] = Array.from({ length: 120 }, (_, index) => ({
      name: `Recipe ${index + 1}`,
      shortcode: `recipe-${index + 1}`,
      ingredients: ['salt'],
      instructions: ['mix']
    }));

    render(<App initialRecipes={largeData} debounceMs={0} />);

    expect(screen.getAllByRole('heading', { level: 2 })).toHaveLength(100);
    await userEvent.click(screen.getByRole('button', { name: 'Load more' }));
    expect(screen.getAllByRole('heading', { level: 2 })).toHaveLength(120);
    expect(screen.queryByRole('button', { name: 'Load more' })).not.toBeInTheDocument();
  });

  it('shows empty state message when no recipes match the query', async () => {
    render(<App initialRecipes={sampleData} debounceMs={0} />);
    await userEvent.type(screen.getByLabelText('Search recipes'), 'zzznomatch');
    expect(screen.getByText('No recipes matched your search.')).toBeInTheDocument();
  });

  it('displays correct "Showing X of Y" count in the header', () => {
    render(<App initialRecipes={sampleData} debounceMs={0} />);
    expect(screen.getByText('Showing 2 of 2 recipes')).toBeInTheDocument();
  });

  it('filters recipes when a filter chip is activated', async () => {
    render(<App initialRecipes={sampleData} debounceMs={0} />);
    await userEvent.click(screen.getByRole('button', { name: 'Beef' }));
    expect(screen.getByText('Beef Stew')).toBeInTheDocument();
    expect(screen.queryByText('Chickpea Rice')).not.toBeInTheDocument();
  });

  it('applies AND logic when multiple filter chips are active', async () => {
    const multiData: Recipe[] = [
      { name: 'Chicken Rice', shortcode: 'cr1', ingredients: ['chicken', 'rice'], instructions: [] },
      { name: 'Chicken Pasta', shortcode: 'cp1', ingredients: ['chicken', 'pasta'], instructions: [] },
      { name: 'Beef Rice', shortcode: 'br1', ingredients: ['beef', 'rice'], instructions: [] }
    ];

    render(<App initialRecipes={multiData} debounceMs={0} />);

    await userEvent.click(screen.getByRole('button', { name: 'Chicken' }));
    await userEvent.click(screen.getByRole('button', { name: 'Rice' }));

    expect(screen.getByText('Chicken Rice')).toBeInTheDocument();
    expect(screen.queryByText('Chicken Pasta')).not.toBeInTheDocument();
    expect(screen.queryByText('Beef Rice')).not.toBeInTheDocument();
  });

  it('restores all results when active filters are cleared', async () => {
    render(<App initialRecipes={sampleData} debounceMs={0} />);

    await userEvent.click(screen.getByRole('button', { name: 'Beef' }));
    expect(screen.queryByText('Chickpea Rice')).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Clear all filters' }));

    expect(screen.getByText('Chickpea Rice')).toBeInTheDocument();
    expect(screen.getByText('Beef Stew')).toBeInTheDocument();
  });
});
