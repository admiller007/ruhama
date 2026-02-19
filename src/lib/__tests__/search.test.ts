import { searchRecipes } from '../search';
import type { SearchableRecipe } from '../types';

const recipes: SearchableRecipe[] = [
  {
    name: 'Apple Pie',
    ingredients: ['apple', 'flour'],
    cleanIngredients: ['apple', 'flour'],
    instructions: [],
    normalizedName: 'apple pie',
    normalizedIngredientText: 'apple flour'
  },
  {
    name: 'Pie Apple Crumble',
    ingredients: ['butter'],
    cleanIngredients: ['butter'],
    instructions: [],
    normalizedName: 'pie apple crumble',
    normalizedIngredientText: 'butter'
  },
  {
    name: 'Savory Bake',
    ingredients: ['green apple'],
    cleanIngredients: ['green apple'],
    instructions: [],
    normalizedName: 'savory bake',
    normalizedIngredientText: 'green apple'
  }
];

describe('searchRecipes', () => {
  it('returns leading records for empty query', () => {
    expect(searchRecipes(recipes, '', 2).map((r) => r.name)).toEqual([
      'Apple Pie',
      'Pie Apple Crumble'
    ]);
  });

  it('ranks starts-with before name-contains before ingredient-only', () => {
    expect(searchRecipes(recipes, 'apple').map((r) => r.name)).toEqual([
      'Apple Pie',
      'Pie Apple Crumble',
      'Savory Bake'
    ]);
  });

  it('respects result limits', () => {
    expect(searchRecipes(recipes, 'apple', 1)).toHaveLength(1);
  });
});
