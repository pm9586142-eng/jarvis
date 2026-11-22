import { LocalModelCatalogEntry, WebGpuHardwareCapabilities } from '../../types/jarvis';
import { isSpeechRecognitionSupported, isSpeechSynthesisSupported } from '../voice';

export async function detectWebHardwareCapabilities(): Promise<WebGpuHardwareCapabilities> {
  let webGpuAvailable = false;
  if (typeof navigator !== 'undefined' && 'gpu' in navigator) {
    try {
      const gpuApi = (navigator as unknown as { gpu?: { requestAdapter: () => Promise<unknown | null> } }).gpu;
      const adapter = await gpuApi?.requestAdapter();
      webGpuAvailable = Boolean(adapter);
    } catch {
      webGpuAvailable = false;
    }
  }

  const wasmAvailable = typeof WebAssembly === 'object' && typeof WebAssembly.instantiate === 'function';

  const nav = typeof navigator !== 'undefined'
    ? (navigator as unknown as { deviceMemory?: number; hardwareConcurrency?: number })
    : undefined;
  const deviceMemoryGb =
    typeof nav?.deviceMemory === 'number' && Number.isFinite(nav.deviceMemory)
      ? nav.deviceMemory
      : null;
  const cpuCores = typeof nav?.hardwareConcurrency === 'number' ? nav.hardwareConcurrency : 4;

  let storageQuotaMb: number | null = null;
  let storageUsedMb: number | null = null;
  let storageFreeMb: number | null = null;
  if (typeof navigator !== 'undefined' && navigator.storage?.estimate) {
    try {
      const est = await navigator.storage.estimate();
      if (typeof est.quota === 'number') {
        storageQuotaMb = Math.round(est.quota / (1024 * 1024));
      }
      if (typeof est.usage === 'number') {
        storageUsedMb = Math.round(est.usage / (1024 * 1024));
      }
      if (storageQuotaMb !== null && storageUsedMb !== null) {
        storageFreeMb = Math.max(0, storageQuotaMb - storageUsedMb);
      }
    } catch {
      // Honest null when quota API blocked
    }
  }

  const speechRecognitionAvailable = isSpeechRecognitionSupported();
  const speechRecognitionOfflineCaveat = speechRecognitionAvailable
    ? 'Browser SpeechRecognition relies on your browser vendor speech service when offline and may pause without internet; text commands & local AI remain active.'
    : 'Browser SpeechRecognition is unavailable; use text input or local keyboard commands.';

  let localTtsVoicesCount = 0;
  if (isSpeechSynthesisSupported()) {
    try {
      localTtsVoicesCount = (window.speechSynthesis.getVoices() || []).filter((v) => v.localService).length;
    } catch {
      localTtsVoicesCount = 0;
    }
  }

  return {
    webGpuAvailable,
    wasmAvailable,
    deviceMemoryGb,
    cpuCores,
    storageQuotaMb,
    storageUsedMb,
    storageFreeMb,
    speechRecognitionAvailable,
    speechRecognitionOfflineCaveat,
    localTtsVoicesCount,
    checkedAt: Date.now(),
  };
}

export function evaluateModelCompatibility(
  model: LocalModelCatalogEntry,
  caps: WebGpuHardwareCapabilities | null
): { compatible: boolean; warning: string | null } {
  if (!caps) {
    return { compatible: true, warning: null };
  }
  if (!caps.webGpuAvailable && !caps.wasmAvailable) {
    return {
      compatible: false,
      warning: 'Neither WebGPU nor WebAssembly is available in this browser environment.',
    };
  }
  if (caps.storageFreeMb !== null && caps.storageFreeMb < model.approxSizeMb + 150) {
    return {
      compatible: false,
      warning: `Insufficient browser storage (${caps.storageFreeMb} MB free; needs ~${model.approxSizeMb + 150} MB).`,
    };
  }
  if (caps.deviceMemoryGb !== null && caps.deviceMemoryGb < model.minRamGb) {
    return {
      compatible: true,
      warning: `Device reports ~${caps.deviceMemoryGb} GB RAM; ${model.displayName} prefers ${model.minRamGb}+ GB and may run slowly.`,
    };
  }
  if (!caps.webGpuAvailable) {
    return {
      compatible: true,
      warning: 'WebGPU unavailable — inference will run on WASM/CPU fallback.',
    };
  }
  return { compatible: true, warning: null };
}
