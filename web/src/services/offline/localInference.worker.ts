import { env, pipeline } from '@huggingface/transformers';

// Allow browser Cache API persistence for explicit user-approved model downloads
env.allowLocalModels = false;
env.useBrowserCache = true;

type WorkerRequest =
  | {
      type: 'load';
      requestId: string;
      modelId: string;
      huggingfaceId: string;
      device: 'webgpu' | 'wasm';
      dtype: 'q4' | 'q8';
    }
  | {
      type: 'generate';
      requestId: string;
      messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>;
      maxNewTokens?: number;
      temperature?: number;
    }
  | {
      type: 'unload';
      requestId: string;
    };

let activeModelId: string | null = null;
let activeGenerator: ((
  input: Array<{ role: string; content: string }>,
  options: Record<string, unknown>
) => Promise<Array<{ generated_text?: Array<{ role?: string; content?: string }> | string }>>) | null = null;
let cancelledLoadId: string | null = null;

self.onmessage = async (event: MessageEvent<WorkerRequest>) => {
  const msg = event.data;
  if (!msg) return;

  if (msg.type === 'unload') {
    cancelledLoadId = msg.requestId;
    activeGenerator = null;
    activeModelId = null;
    self.postMessage({ type: 'unloaded', requestId: msg.requestId });
    return;
  }

  if (msg.type === 'load') {
    cancelledLoadId = null;
    try {
      const pipe = await pipeline('text-generation', msg.huggingfaceId, {
        device: msg.device,
        dtype: msg.dtype,
        progress_callback: (info: { status?: string; progress?: number; file?: string }) => {
          if (cancelledLoadId === msg.requestId) return;
          const pct = typeof info?.progress === 'number' ? Math.round(info.progress) : undefined;
          self.postMessage({
            type: 'progress',
            requestId: msg.requestId,
            modelId: msg.modelId,
            status: info?.status || 'downloading',
            progress: pct,
            file: info?.file,
          });
        },
      });

      if (cancelledLoadId === msg.requestId) {
        self.postMessage({ type: 'cancelled', requestId: msg.requestId, modelId: msg.modelId });
        return;
      }

      activeGenerator = pipe as unknown as typeof activeGenerator;
      activeModelId = msg.modelId;
      self.postMessage({
        type: 'loaded',
        requestId: msg.requestId,
        modelId: msg.modelId,
        device: msg.device,
      });
    } catch (err) {
      self.postMessage({
        type: 'error',
        requestId: msg.requestId,
        modelId: msg.modelId,
        error: err instanceof Error ? err.message : 'Failed to load local browser AI model.',
      });
    }
    return;
  }

  if (msg.type === 'generate') {
    if (!activeGenerator || !activeModelId) {
      self.postMessage({
        type: 'error',
        requestId: msg.requestId,
        error: 'No local PC model is loaded in memory.',
      });
      return;
    }
    try {
      const output = await activeGenerator(msg.messages, {
        max_new_tokens: msg.maxNewTokens ?? 220,
        temperature: msg.temperature ?? 0.4,
        do_sample: true,
      });
      const first = output?.[0]?.generated_text;
      let replyText = '';
      if (Array.isArray(first)) {
        const lastTurn = first[first.length - 1];
        replyText = String(lastTurn?.content || '').trim();
      } else if (typeof first === 'string') {
        replyText = first.trim();
      }
      self.postMessage({
        type: 'generated',
        requestId: msg.requestId,
        modelId: activeModelId,
        text: replyText || 'I have processed your offline request, Sir.',
      });
    } catch (err) {
      self.postMessage({
        type: 'error',
        requestId: msg.requestId,
        error: err instanceof Error ? err.message : 'Local browser inference failed.',
      });
    }
  }
};
