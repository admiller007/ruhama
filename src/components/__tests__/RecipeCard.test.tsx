import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { RecipeCard } from '../RecipeCard';
import type { SearchableRecipe } from '../../lib/types';

function makeRecipe(overrides: Partial<SearchableRecipe> = {}): SearchableRecipe {
  return {
    name: 'Test Recipe',
    shortcode: 'test-1',
    cleanIngredients: ['salt', 'pepper'],
    normalizedName: 'test recipe',
    normalizedIngredientText: 'salt pepper',
    instructions: ['Mix well'],
    ...overrides
  };
}

describe('RecipeCard – ingredient preview', () => {
  it('shows "No ingredients listed" when there are no clean ingredients', () => {
    const recipe = makeRecipe({ cleanIngredients: [], normalizedIngredientText: '' });
    render(<RecipeCard recipe={recipe} />);
    expect(screen.getByText('No ingredients listed')).toBeInTheDocument();
  });

  it('shows all ingredients joined with " | " when there are 4 or fewer', () => {
    const recipe = makeRecipe({ cleanIngredients: ['a', 'b', 'c', 'd'] });
    render(<RecipeCard recipe={recipe} />);
    expect(screen.getByText('a | b | c | d')).toBeInTheDocument();
  });

  it('shows the first 4 ingredients with "+N more" when there are more than 4', () => {
    const recipe = makeRecipe({ cleanIngredients: ['a', 'b', 'c', 'd', 'e'] });
    render(<RecipeCard recipe={recipe} />);
    expect(screen.getByText('a | b | c | d | +1 more')).toBeInTheDocument();
  });
});

describe('RecipeCard – ingredient count badge', () => {
  it('uses the singular form for exactly 1 ingredient', () => {
    const recipe = makeRecipe({ cleanIngredients: ['flour'] });
    render(<RecipeCard recipe={recipe} />);
    expect(screen.getByText('1 ingredient')).toBeInTheDocument();
  });

  it('uses the plural form for more than 1 ingredient', () => {
    const recipe = makeRecipe({ cleanIngredients: ['flour', 'sugar'] });
    render(<RecipeCard recipe={recipe} />);
    expect(screen.getByText('2 ingredients')).toBeInTheDocument();
  });

  it('omits the badge when there are no ingredients', () => {
    const recipe = makeRecipe({ cleanIngredients: [], normalizedIngredientText: '' });
    render(<RecipeCard recipe={recipe} />);
    expect(screen.queryByText(/\d+ ingredients?/)).not.toBeInTheDocument();
  });
});

describe('RecipeCard – expanded details', () => {
  it('shows "No ingredients listed." when cleanIngredients is empty', async () => {
    const recipe = makeRecipe({ cleanIngredients: [], normalizedIngredientText: '' });
    render(<RecipeCard recipe={recipe} />);
    await userEvent.click(screen.getByText('Test Recipe'));
    expect(screen.getByText('No ingredients listed.')).toBeVisible();
  });

  it('shows "No instructions listed." when instructions is empty', async () => {
    const recipe = makeRecipe({ instructions: [] });
    render(<RecipeCard recipe={recipe} />);
    await userEvent.click(screen.getByText('Test Recipe'));
    expect(screen.getByText('No instructions listed.')).toBeVisible();
  });
});

describe('RecipeCard – source link', () => {
  it('renders a "View on Instagram" link when url is present', () => {
    const recipe = makeRecipe({ url: 'https://instagram.com/p/abc' });
    render(<RecipeCard recipe={recipe} />);
    expect(screen.getByText('View on Instagram')).toBeInTheDocument();
  });

  it('does not render a source link when url is absent', () => {
    const recipe = makeRecipe({ url: undefined });
    render(<RecipeCard recipe={recipe} />);
    expect(screen.queryByText('View on Instagram')).not.toBeInTheDocument();
  });
});

describe('RecipeCard – animation', () => {
  it('applies the animationDelay prop as a CSS transition-delay', () => {
    const recipe = makeRecipe();
    const { container } = render(<RecipeCard recipe={recipe} animationDelay={120} />);
    const article = container.querySelector('article');
    expect(article).toHaveStyle({ transitionDelay: '120ms' });
  });
});
