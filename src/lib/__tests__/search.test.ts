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

describe('searchRecipes relevance', () => {
  const catalog: SearchableRecipe[] = [
    {
      name: 'Schnitzel Friday',
      cleanIngredients: ['chicken cutlets'],
      instructions: ['Bread and bake'],
      normalizedName: 'schnitzel friday',
      normalizedIngredientText: 'chicken cutlets'
    },
    {
      name: 'Potato Casserole',
      cleanIngredients: ['russet potato'],
      instructions: ['Slice and bake'],
      normalizedName: 'potato casserole',
      normalizedIngredientText: 'russet potato'
    },
    {
      name: 'One-Pan Ground Beef and Rice',
      cleanIngredients: ['ground beef', 'basmati rice'],
      instructions: ['Simmer'],
      normalizedName: 'one-pan ground beef and rice',
      normalizedIngredientText: 'ground beef basmati rice'
    },
    {
      name: 'Beef Kebab',
      cleanIngredients: ['ground beef', 'parsley'],
      instructions: ['Grill'],
      normalizedName: 'beef kebab',
      normalizedIngredientText: 'ground beef parsley'
    },
    {
      name: 'Amba Chicken and Rice',
      cleanIngredients: ['chicken thighs', 'basmati rice'],
      instructions: ['Bake'],
      normalizedName: 'amba chicken and rice',
      normalizedIngredientText: 'chicken thighs basmati rice',
      caption_snippet: 'A one-pan chicken and rice dinner'
    },
    {
      name: 'Chicken Meatballs and Rice Noodles',
      cleanIngredients: ['chicken', 'rice noodles'],
      instructions: ['Simmer'],
      normalizedName: 'chicken meatballs and rice noodles',
      normalizedIngredientText: 'chicken rice noodles'
    },
    {
      name: 'Fluffy Egg Bites',
      cleanIngredients: ['eggs'],
      instructions: ['Bake'],
      normalizedName: 'fluffy egg bites',
      caption_snippet: 'Simple, high protein, gluten free breakfast',
      normalizedIngredientText: 'eggs'
    }
  ];

  it('corrects a one-edit dish typo', () => {
    expect(searchRecipes(catalog, 'shnitzel').map((recipe) => recipe.name)).toEqual([
      'Schnitzel Friday'
    ]);
  });

  it('matches a plural query to a singular title', () => {
    expect(searchRecipes(catalog, 'potatoes')[0]?.name).toBe('Potato Casserole');
  });

  it('ranks a title that contains every term above an ingredient-only match', () => {
    expect(searchRecipes(catalog, 'ground beef')[0]?.name).toBe('One-Pan Ground Beef and Rice');
  });

  it('prefers chicken and rice over chicken with rice noodles', () => {
    expect(searchRecipes(catalog, 'what can I make with chicken and rice')[0]?.name).toBe(
      'Amba Chicken and Rice'
    );
  });

  it('treats side dish as a phrase instead of the word side', () => {
    const sides: SearchableRecipe[] = [
      {
        name: 'Iraqi Potato Salad',
        cleanIngredients: ['fingerling potatoes cut on the long side'],
        instructions: ['Roast'],
        normalizedName: 'iraqi potato salad',
        normalizedIngredientText: 'fingerling potatoes cut on the long side',
        caption_snippet: 'A roasted potato and egg salad'
      },
      {
        name: 'Smashed Potatoes',
        cleanIngredients: ['potatoes'],
        instructions: ['Smash and roast'],
        normalizedName: 'smashed potatoes',
        normalizedIngredientText: 'potatoes',
        caption_snippet: 'This potato dish can be a perfect side dish for any meal'
      }
    ];
    expect(searchRecipes(sides, 'side dish')[0]?.name).toBe('Smashed Potatoes');
  });

  it('finds a high-protein note in the caption', () => {
    expect(searchRecipes(catalog, 'high protein')[0]?.name).toBe('Fluffy Egg Bites');
    expect(searchRecipes(catalog, 'high protein')[0]?.matchLabel).toBe('In the post');
  });
});
