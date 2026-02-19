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
});
