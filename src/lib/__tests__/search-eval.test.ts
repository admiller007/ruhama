import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { evaluateSearch } from '../../../scripts/search_eval';
import type { Recipe } from '../types';

describe('search eval', () => {
  it('puts the expected recipe first for every case', () => {
    const recipes = JSON.parse(
      readFileSync(resolve('src/data/recipes.json'), 'utf8')
    ) as Recipe[];
    const report = evaluateSearch(recipes);

    expect(report.failures).toEqual([]);
    expect(report.passed).toBe(report.caseCount);
  });

  it('keeps both recipe files identical and free of numbered ingredient steps', () => {
    const primary = readFileSync(resolve('src/data/recipes.json'), 'utf8');
    const mirror = readFileSync(resolve('ruhamasfood_recipes.json'), 'utf8');
    expect(mirror).toBe(primary);
    const recipes = JSON.parse(primary) as Recipe[];
    const numbered = recipes.filter((recipe) =>
      (recipe.ingredients ?? []).some((line) => /^\s*\d+[.)]\s+/.test(line))
    );
    expect(numbered).toEqual([]);
    expect(primary).not.toMatch(/\bof of\b/i);
  });
});