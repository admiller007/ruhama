import { cardMeta, formatMacros, ingredientLabel, keyIngredients } from '../meta';

describe('ingredient labels', () => {
  const cases: Array<[string, string | null]> = [
    ['1 green cabbage, halved and thinly sliced', 'green cabbage'],
    ['1/2 teaspoon flaky salt', null],
    ['2 tablespoons olive oil, or avocado oil spray', null],
    ['1 package orzo, 16 oz (454 g)', 'orzo'],
    ['1 heaping teaspoon turmeric', 'turmeric'],
    ['2.5 pounds beef stew meat, cubed and patted dry with paper towels', 'beef stew meat'],
    ['2 large sweet onions, sliced', 'sweet onions'],
    ['8 whole garlic cloves', null],
    ['2 packages precooked cannellini beans, drained (13.4oz / 380g each)', 'cannellini beans'],
    ['8 small Yukon Gold potatoes, peeled and cut into cubes', 'yukon gold potatoes'],
    ['8 bone-in, skinless chicken thighs', 'chicken thighs'],
    ['4 chicken drumsticks', 'chicken drumsticks'],
    ['Salt and black pepper, to season the chicken', null],
    ['1 red onion, thinly sliced', 'red onion'],
    ['2 pounds ground beef', 'ground beef'],
    ['1 small onion, finely diced', null],
    ['1 carrot, peeled and finely diced', 'carrot'],
    ['1/2 red cabbage, thinly sliced (preferably with a mandoline)', 'red cabbage'],
    ['1 English cucumber, thinly sliced', 'english cucumber'],
    ['A handful of dill leaves, chopped', 'dill'],
    ['1/2 teaspoon of cumin', 'cumin'],
    ['1 cup unsweetened shredded coconut', 'unsweetened coconut'],
    ['1.5 cups almond flour', 'almond flour'],
    ['2 pounds of thin chicken cutlets', 'chicken cutlets'],
    ['1 teaspoon lemon pepper', 'lemon pepper'],
    ['3 eggs', 'eggs'],
    ['2 large zucchinis or 4 small zucchinis, shredded', 'zucchinis'],
    ['2 leeks, just the white part sliced', 'leeks'],
    ['1 English cucumber or 4 small cucumbers, thinly sliced', 'english cucumber'],
    ['6 chicken leg quarters, or any chicken pieces you like', 'chicken leg quarters'],
    ['1 package (24oz / 680g) of fingerling potatoes, cut in half lengthwise', 'fingerling potatoes'],
    ['1 head cauliflower, sliced lengthwise through the core', 'cauliflower'],
    ['1 package (2.2lb/1kg) thawed @tnuvausa Maadanot rolled puff pastry', 'maadanot puff pastry'],
    ['#birthdaypancakes #birthdaycake #pancakes', null]
  ];

  it.each(cases)('labels %s', (line, expected) => {
    expect(ingredientLabel(line)).toBe(expected);
  });
});

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
    ).toEqual(['chicken thighs', 'basmati rice']);
  });

  it('keeps three labels when they still fit the line', () => {
    expect(keyIngredients(['1 teaspoon turmeric', 'A handful of dill', '1/2 teaspoon cumin'])).toEqual([
      'turmeric',
      'dill',
      'cumin'
    ]);
  });

  it('puts ingredients that match the query first', () => {
    expect(keyIngredients(['2 cups basmati rice', '1 pound chicken thighs'], 'chicken')).toEqual([
      'chicken thighs',
      'basmati rice'
    ]);
  });

  it('drops later items instead of building a line that cannot fit', () => {
    expect(
      keyIngredients([
        '8 bone-in, skinless chicken thighs',
        '2 cups basmati rice',
        '1 red cabbage, thinly sliced',
        '1 English cucumber'
      ])
    ).toEqual(['chicken thighs', 'basmati rice']);
  });

  it('formats numeric macros', () => {
    expect(formatMacros({ calories: 480, protein: 32 })).toBe('480 cal · 32g protein');
  });

  it('joins ingredients and macros onto one line', () => {
    expect(cardMeta(['1 pound chicken thighs'], { protein: 32 })).toBe('chicken thighs · 32g protein');
  });
});
