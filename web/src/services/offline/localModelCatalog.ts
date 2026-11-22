import { LocalModelCatalogEntry } from '../../types/jarvis';

export const PC_LOCAL_MODEL_CATALOG: LocalModelCatalogEntry[] = [
  {
    id: 'smollm2-135m',
    displayName: 'SmolLM2 135M Instruct (Compact)',
    huggingfaceId: 'HuggingFaceTB/SmolLM2-135M-Instruct',
    quantization: 'q4',
    approxSizeMb: 135,
    minRamGb: 2,
    recommendedTier: 'light',
    summary: 'Ultra-fast browser quantized model for 2–4 GB devices and quick offline replies.',
  },
  {
    id: 'smollm2-360m',
    displayName: 'SmolLM2 360M Instruct (Balanced)',
    huggingfaceId: 'HuggingFaceTB/SmolLM2-360M-Instruct',
    quantization: 'q4',
    approxSizeMb: 310,
    minRamGb: 4,
    recommendedTier: 'balanced',
    summary: 'Higher reasoning quality while staying compact for laptops with 4+ GB RAM.',
  },
  {
    id: 'qwen25-0.5b',
    displayName: 'Qwen 2.5 0.5B Instruct (Multilingual)',
    huggingfaceId: 'onnx-community/Qwen2.5-0.5B-Instruct',
    quantization: 'q4',
    approxSizeMb: 420,
    minRamGb: 4,
    recommendedTier: 'balanced',
    summary: 'Balanced offline assistant supporting English and multilingual prompts.',
  },
];

export function findLocalModelById(modelId?: string | null): LocalModelCatalogEntry | undefined {
  if (!modelId) return PC_LOCAL_MODEL_CATALOG[0];
  return PC_LOCAL_MODEL_CATALOG.find((m) => m.id === modelId) || PC_LOCAL_MODEL_CATALOG[0];
}
