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
