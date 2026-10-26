import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from './App';
import type { Recipe } from './lib/types';

beforeEach(() => {
  // jsdom does not implement scrollIntoView
  Element.prototype.scrollIntoView = vi.fn();
  window.history.replaceState(null, '', '/');
});

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

    expect(screen.getByRole('heading', { level: 2, name: 'Chickpea Rice' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { level: 2, name: 'Beef Stew' })).not.toBeInTheDocument();
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

  it('shares the open recipe and the search in the URL', async () => {
    render(<App initialRecipes={sampleData} debounceMs={0} />);

    await userEvent.type(screen.getByLabelText('Search recipes'), 'chickpeas');
    expect(window.location.search).toContain('q=chickpeas');

    await userEvent.click(screen.getByRole('heading', { level: 2, name: 'Chickpea Rice' }));
    expect(window.location.search).toContain('r=a1');
    expect(screen.getByText('Cook rice')).toBeVisible();

    window.history.back();
    await waitFor(() => {
      expect(screen.getByText('Cook rice')).not.toBeVisible();
    });
    expect(window.location.search).not.toContain('r=');
    expect(window.location.search).toContain('q=chickpeas');
  });

  it('opens a recipe from a shared link and offers browse chips', async () => {
    window.history.replaceState(null, '', '/?r=b2&q=beef');
    const withShabbat: Recipe[] = [
      ...sampleData,
      {
        name: 'Shabbat Chicken',
        shortcode: 'sh1',
        ingredients: ['chicken'],
        instructions: ['Roast for dinner']
      }
    ];
    render(<App initialRecipes={withShabbat} debounceMs={0} />);

    expect(screen.getByText('Simmer')).toBeVisible();
    expect(window.location.search).toContain('r=b2');

    window.history.back();
    await waitFor(() => {
      expect(screen.getByText('Simmer')).not.toBeVisible();
    });

    await userEvent.clear(screen.getByLabelText('Search recipes'));
    expect(screen.getByText('Newest from Ruhama')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Shabbat' }));
    expect(screen.getByRole('heading', { level: 2, name: 'Shabbat Chicken' })).toBeInTheDocument();
    expect(window.location.search).toContain('q=shabbat');
  });

  it('shows details when a recipe is expanded', async () => {
    render(<App initialRecipes={sampleData} debounceMs={0} />);

    const hiddenInstruction = screen.getByText('Cook rice');
    expect(hiddenInstruction).not.toBeVisible();

    await userEvent.click(screen.getByText('Chickpea Rice'));

    expect(screen.getByText('Cook rice')).toBeVisible();
  });

  it('navigates between cards with ArrowDown / ArrowUp', async () => {
    render(<App initialRecipes={sampleData} debounceMs={0} />);

    const summaries = document.querySelectorAll<HTMLElement>('.recipe-card details > summary');
    expect(summaries).toHaveLength(2);

    await userEvent.keyboard('{ArrowDown}');
    expect(summaries[0]).toHaveFocus();

    await userEvent.keyboard('{ArrowDown}');
    expect(summaries[1]).toHaveFocus();

    // ArrowDown at the last card stays on the last card
    await userEvent.keyboard('{ArrowDown}');
    expect(summaries[1]).toHaveFocus();

    await userEvent.keyboard('{ArrowUp}');
    expect(summaries[0]).toHaveFocus();
  });

  it('focuses the search input when / is pressed outside an input', async () => {
    render(<App initialRecipes={sampleData} debounceMs={0} />);

    await userEvent.keyboard('/');
    expect(screen.getByLabelText('Search recipes')).toHaveFocus();
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
