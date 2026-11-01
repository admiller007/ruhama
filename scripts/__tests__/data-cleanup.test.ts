import { describe, expect, it } from "vitest";
// @ts-expect-error plain .mjs script without type declarations
import { dropEmptyPosts, mergeRenamedReposts } from "../clean_recipes.mjs";
// @ts-expect-error plain .mjs script without type declarations
import { tagRecipe } from "../tag_kosher.mjs";

const ingredients = [
  "2 pounds of chicken thighs",
  "1 large onion, sliced",
  "2 tablespoons of olive oil",
  "1 teaspoon of turmeric"
];
const method = ["Preheat the oven to 400F.", "Roast the chicken over the onions until golden."];

describe("mergeRenamedReposts", () => {
  it("merges a repost under a promo title into the copy named for the dish", () => {
    const recipes = [
      { name: "MY MOST VIRAL RECIPE OF 2025", shortcode: "new", ingredients, instructions: method },
      { name: "TURMERIC CHICKEN AND ONIONS!", shortcode: "old", ingredients, instructions: method }
    ];
    const { dropped, merges } = mergeRenamedReposts(recipes);
    expect([...dropped]).toEqual([0]);
    expect(merges[0].kept.shortcode).toBe("old");
  });

  it("prefers the copy that names a holiday when both titles name the dish", () => {
    const recipes = [
      { name: "HOLIDAY BRISKET!", shortcode: "a", ingredients, instructions: method },
      { name: "ROSH HASHANAH BRISKET!", shortcode: "b", ingredients, instructions: method }
    ];
    expect(mergeRenamedReposts(recipes).merges[0].kept.shortcode).toBe("b");
  });

  it("keeps both copies when the ingredients match but the method does not", () => {
    const recipes = [
      { name: "CHICKEN ONE", shortcode: "a", ingredients, instructions: method },
      {
        name: "CHICKEN TWO",
        shortcode: "b",
        ingredients,
        instructions: ["Grill skewers over charcoal, brushing glaze generously between turns."]
      }
    ];
    const { dropped, leftForReview } = mergeRenamedReposts(recipes);
    expect(dropped.size).toBe(0);
    expect(leftForReview).toHaveLength(1);
  });

  it("ignores short ingredient lists that many dishes share", () => {
    const short = ["1 egg", "salt", "pepper"];
    const recipes = [
      { name: "A", ingredients: short, instructions: method },
      { name: "B", ingredients: short, instructions: method }
    ];
    expect(mergeRenamedReposts(recipes).dropped.size).toBe(0);
  });
});

describe("dropEmptyPosts", () => {
  it("removes posts with no ingredients and no steps", () => {
    const { recipes, removed } = dropEmptyPosts([
      { name: "Shabbat Shalom", ingredients: [], instructions: [] },
      { name: "Soup", ingredients: [], instructions: ["Simmer it."] }
    ]);
    expect(recipes.map((recipe: { name: string }) => recipe.name)).toEqual(["Soup"]);
    expect(removed).toHaveLength(1);
  });
});

describe("tagRecipe", () => {
  it("tags meat, dairy and pareve from the ingredient lines", () => {
    expect(tagRecipe({ name: "Chicken", ingredients }).tag).toBe("meat");
    expect(tagRecipe({ name: "Salad", ingredients: ["1 cup of feta cheese", "2 cucumbers"] }).tag).toBe("dairy");
    expect(tagRecipe({ name: "Salad", ingredients: ["2 cucumbers", "1 lemon"] }).tag).toBe("pareve");
  });

  it("does not read nut butters, coconut milk or butternut squash as dairy", () => {
    const lines = ["2 tablespoons of almond butter", "1 can of coconut milk", "1 butternut squash"];
    expect(tagRecipe({ name: "Soup", ingredients: lines }).tag).toBe("pareve");
  });

  it("asks for a check instead of guessing on mixed or unclear cases", () => {
    expect(tagRecipe({ name: "Odd", ingredients: ["chicken breast", "1 cup of milk"] }).tag).toBe("check");
    expect(tagRecipe({ name: "Rice", ingredients: ["1 tablespoon of chicken-flavored consommé", "2 cups of rice"] }).tag).toBe("check");
    expect(tagRecipe({ name: "Tomatoes", ingredients: ["4 tomatoes", "basil"], instructions: ["Top with feta."] }).tag).toBe("check");
  });

  it("marks fish and never marks a guess as confirmed", () => {
    const entry = tagRecipe({ name: "Salmon", ingredients: ["2 salmon fillets", "1 lemon"] });
    expect(entry.tag).toBe("pareve");
    expect(entry.fish).toBe(true);
    expect(entry.confirmed).toBe(false);
  });
});
