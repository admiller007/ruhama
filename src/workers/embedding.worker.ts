/**
 * Web Worker: embeds a query string using all-MiniLM-L6-v2.
 * The model (~23MB) is downloaded once and cached by the browser.
 * Runs off the main thread to avoid freezing the UI.
 */

import { pipeline, env, type FeatureExtractionPipeline } from '@huggingface/transformers';

// Only load from HuggingFace hub, not local files
env.allowLocalModels = false;

const MODEL = 'Xenova/all-MiniLM-L6-v2';

// Cast to a simple callable to avoid TypeScript's overly-complex overload union
type PipelineFn = (task: string, model: string, opts?: object) => Promise<FeatureExtractionPipeline>;
const loadPipeline = pipeline as unknown as PipelineFn;

let extractor: FeatureExtractionPipeline | null = null;

async function getExtractor(): Promise<FeatureExtractionPipeline> {
  if (!extractor) {
    extractor = await loadPipeline('feature-extraction', MODEL, { dtype: 'fp32' });
  }
  return extractor;
}

interface WorkerRequest {
  id: number;
  query: string;
}

interface WorkerResponse {
  id: number;
  embedding?: number[];
  error?: string;
}

self.addEventListener('message', async (event: MessageEvent<WorkerRequest>) => {
  const { id, query } = event.data;

  try {
    const ext = await getExtractor();
    const output = await ext(query, { pooling: 'mean', normalize: true });

    // Cast through unknown to access the Float32Array data from the Tensor
    const tensor = output as unknown as { data: Float32Array };
    const embedding = Array.from(tensor.data);

    const response: WorkerResponse = { id, embedding };
    self.postMessage(response);
  } catch (err) {
    const response: WorkerResponse = { id, error: String(err) };
    self.postMessage(response);
  }
});
