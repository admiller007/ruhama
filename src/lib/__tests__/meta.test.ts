import { cardMeta, formatMacros, keyIngredients } from '../meta';

describe('card meta', () => {
  it('keeps a few distinctive ingredients and skips pantry staples', () => {
    expect(
      keyIngredients([
        '2 pounds chicken thighs',
        '1 teaspoon salt',
        '2 cups basmati rice',
        '1 onion, chopped',
        '1 teaspoon turmeric'
      ])
    ).toEqual(['chicken thighs', 'basmati rice', 'turmeric']);
  });

  it('puts ingredients that match the query first', () => {
    expect(keyIngredients(['2 cups basmati rice', '1 pound chicken thighs'], 'chicken')).toEqual([
      'chicken thighs',
      'basmati rice'
    ]);
  });

  it('formats numeric macros', () => {
    expect(formatMacros({ calories: 480, protein: 32 })).toBe('480 cal · 32g protein');
  });

  it('joins ingredients and macros onto one line', () => {
    expect(cardMeta(['1 pound chicken thighs'], { protein: 32 })).toBe('chicken thighs · 32g protein');
  });
});