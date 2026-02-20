/**
 * Build-time script to pre-compute embeddings for all 960 recipes.
 * Run with: npm run generate:embeddings
 * Output: src/data/embeddings.json
 *
 * Only needs to be re-run if recipes.json changes.
 */

import { pipeline } from '@huggingface/transformers';
import { writeFileSync } from 'fs';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const recipes = require('../src/data/recipes.json');

const MODEL = 'Xenova/all-MiniLM-L6-v2';
const BATCH_SIZE = 32;
const OUTPUT_PATH = 'src/data/embeddings.json';

interface Recipe {
  name: string;
  ingredients?: string[];
  instructions?: string[];
  caption_snippet?: string;
}

function recipeToText(recipe: Recipe): string {
  const parts: string[] = [recipe.name];
  if (recipe.ingredients?.length) {
    parts.push(recipe.ingredients.slice(0, 12).join(' '));
  }
  if (recipe.instructions?.length) {
    parts.push(recipe.instructions.slice(0, 2).join(' '));
  } else if (recipe.caption_snippet) {
    parts.push(recipe.caption_snippet);
  }
  return parts.join('. ').slice(0, 512);
}

async function main() {
  console.log('Loading embedding model (downloads ~23MB on first run)...');
  const extractor = await pipeline('feature-extraction', MODEL, { dtype: 'fp32' });

  console.log(`Generating embeddings for ${recipes.length} recipes...`);
  const allEmbeddings: number[][] = [];

  for (let i = 0; i < recipes.length; i += BATCH_SIZE) {
    const batch = (recipes as Recipe[]).slice(i, i + BATCH_SIZE);
    const texts = batch.map(recipeToText);

    const output = await extractor(texts, { pooling: 'mean', normalize: true });

    for (let j = 0; j < batch.length; j++) {
      // Round to 6 decimal places to reduce file size
      const vec = Array.from(output[j].data as Float32Array).map(
        (v: number) => Math.round(v * 1e6) / 1e6
      );
      allEmbeddings.push(vec);
    }

    const done = Math.min(i + BATCH_SIZE, recipes.length);
    process.stdout.write(`\r  ${done}/${recipes.length} recipes processed`);
  }

  console.log('\nSaving embeddings...');
  writeFileSync(OUTPUT_PATH, JSON.stringify(allEmbeddings));

  const fileSizeKB = Math.round(
    JSON.stringify(allEmbeddings).length / 1024
  );
  console.log(`Done! Saved ${allEmbeddings.length} embeddings to ${OUTPUT_PATH} (${fileSizeKB}KB)`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
