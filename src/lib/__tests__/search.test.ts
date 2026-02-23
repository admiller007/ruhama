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

  it('matches multiple tokens across name and ingredients', () => {
    // "apple flour" should match Apple Pie (name has "apple", ingredients have "flour")
    // but not Pie Apple Crumble (no "flour") or Savory Bake (no "flour")
    expect(searchRecipes(recipes, 'apple flour').map((r) => r.name)).toEqual([
      'Apple Pie'
    ]);
  });

  it('requires all tokens to match somewhere', () => {
    // "apple butter" should only match Pie Apple Crumble (name has "apple", ingredients have "butter")
    expect(searchRecipes(recipes, 'apple butter').map((r) => r.name)).toEqual([
      'Pie Apple Crumble'
    ]);
  });

  it('returns no results when a token matches nothing', () => {
    expect(searchRecipes(recipes, 'apple mango')).toEqual([]);
  });
});
