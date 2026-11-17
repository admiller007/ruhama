# Ruhama's Recipe Search

Searchable archive of recipes from [@ruhamasfood](https://www.instagram.com/ruhamasfood/). Records live in `src/data/recipes.json`, with the same file at `ruhamasfood_recipes.json`.

## Updating recipes

`scripts/update_recipes.py` fetches captions from Instagram's public oEmbed endpoint and prepends new records. Profile discovery is often blocked from a server, so pass shortcodes (newest first):

```bash
python3 scripts/update_recipes.py \
  --existing src/data/recipes.json \
  --out src/data/recipes.json \
  --shortcodes CODE1,CODE2
```

`--shortcodes-file codes.txt` reads whitespace-separated shortcodes. The script skips codes already present, posts that are not full recipes, and posts whose author is not ruhamasfood. Write the merged JSON to both recipe paths, then refresh `ruhamasfood_recipes.md` in the same entry format.

## Cleaning a local copy

`scripts/clean_recipes.mjs` rewrites both JSON files in place. It drops reposts when the normalized title and ingredient lists clearly match, moves numbered steps out of the ingredient list, splits an instruction that is clearly labeled Ingredients and Method, strips emoji clutter from those lines, and collapses accidental doubled words (`of of`). Run `node scripts/clean_recipes.mjs --dry-run` to preview. The merge log is `scripts/cleanup-report.json`.

It also merges a repost that kept the ingredient list word for word under a new title ("MY MOST VIRAL RECIPE OF 2025"), keeping the copy whose title names the dish, and removes posts with no ingredients and no steps. Copies with the same ingredients but a different method are kept and listed under `renamedReposts.leftForReview` in the report.

## Meat, dairy or pareve (draft)

`npm run tag:kosher` writes `kosher_tags_draft.json`: a meat, dairy, pareve or check tag for each recipe, read from its ingredient lines, with the words that decided it. These are guesses for Ruhama to confirm (`confirmed: false`), not a kashrut ruling, and the site does not show them. Mixed or unclear cases, like a pareve list whose method adds feta, are tagged `check`. Re-run it after the recipe file changes.

## Search eval

`npm run eval:search` scores the original queries (dish names, ingredients, typos, plurals, and “what can I make with…”). `npm run eval:search:hard` scores a second set of holiday, diet, and leftover questions. The baseline files next to those scripts are the scores from before the ranking work.

A search is `/?q=chicken+rice`. An open recipe is `/?r=<shortcode>`. Both survive a reload, and the back button closes the recipe.
