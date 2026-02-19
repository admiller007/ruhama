import { buildSearchableRecipes, cleanIngredients, isLikelyInstructionLine } from '../normalize';

describe('normalize helpers', () => {
  it('detects numbered instruction lines', () => {
    expect(isLikelyInstructionLine('1. Mix well')).toBe(true);
    expect(isLikelyInstructionLine('1.5 teaspoons salt')).toBe(false);
  });

  it('removes likely instruction rows from ingredients', () => {
    const cleaned = cleanIngredients([
      '1 cup rice',
      '2. Stir for 5 minutes',
      '  ',
      '1.5 teaspoons turmeric'
    ]);

    expect(cleaned).toEqual(['1 cup rice', '1.5 teaspoons turmeric']);
  });

  it('builds searchable fields', () => {
    const [recipe] = buildSearchableRecipes([
      {
        name: 'Rice Bowl',
        ingredients: ['1 cup rice', '1. Stir']
      }
    ]);

    expect(recipe.normalizedName).toBe('rice bowl');
    expect(recipe.cleanIngredients).toEqual(['1 cup rice']);
    expect(recipe.normalizedIngredientText).toBe('1 cup rice');
  });
});
