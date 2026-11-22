export interface PwaRegistrationState {
  supported: boolean;
  registered: boolean;
  updateAvailable: boolean;
  installPromptAvailable: boolean;
}

let deferredInstallPrompt: { prompt: () => Promise<{ outcome: 'accepted' | 'dismissed' }> } | null =
  null;

export function captureInstallPromptListener(onAvailable: (available: boolean) => void): () => void {
  if (typeof window === 'undefined') return () => {};
  const onBeforeInstall = (e: Event) => {
    e.preventDefault();
    deferredInstallPrompt = e as unknown as {
      prompt: () => Promise<{ outcome: 'accepted' | 'dismissed' }>;
    };
    onAvailable(true);
  };
  const onInstalled = () => {
    deferredInstallPrompt = null;
    onAvailable(false);
  };
  window.addEventListener('beforeinstallprompt', onBeforeInstall);
  window.addEventListener('appinstalled', onInstalled);
  return () => {
    window.removeEventListener('beforeinstallprompt', onBeforeInstall);
    window.removeEventListener('appinstalled', onInstalled);
  };
}

export async function triggerPwaInstallPrompt(): Promise<'accepted' | 'dismissed' | 'unavailable'> {
  if (!deferredInstallPrompt) return 'unavailable';
  try {
    const res = await deferredInstallPrompt.prompt();
    if (res.outcome === 'accepted') {
      deferredInstallPrompt = null;
    }
    return res.outcome;
  } catch {
    return 'unavailable';
  }
}

export async function registerAmServiceWorker(): Promise<{
  supported: boolean;
  registered: boolean;
  error?: string;
}> {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
    return { supported: false, registered: false };
  }
  try {
    const reg = await navigator.serviceWorker.register('/sw.js', { scope: '/' });
    return { supported: true, registered: Boolean(reg) };
  } catch (err) {
    return {
      supported: true,
      registered: false,
      error: err instanceof Error ? err.message : 'Service worker registration failed.',
    };
  }
}
