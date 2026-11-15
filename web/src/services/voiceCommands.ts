export type LocalVoiceCommand =
  | 'OPEN_SECURITY'
  | 'TOGGLE_LOCKDOWN'
  | 'CHECK_BATTERY'
  | 'STOP'
  | 'NEW_CHAT';

export function parseLocalVoiceCommand(rawText: string): LocalVoiceCommand | null {
  const normalized = rawText
    .toLowerCase()
    .trim()
    .replace(/[^\w\s']/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  if (!normalized) return null;

  if (
    normalized === 'stop' ||
    normalized === 'stop listening' ||
    normalized === 'stop voice' ||
    normalized === 'exit voice' ||
    normalized === 'exit hands free' ||
    normalized === 'exit hands-free'
  ) {
    return 'STOP';
  }

  if (
    normalized.includes('open security') ||
    normalized.includes('show security') ||
    normalized.includes('go to security')
  ) {
    return 'OPEN_SECURITY';
  }

  if (
    normalized.includes('toggle lockdown') ||
    normalized.includes('emergency lockdown') ||
    normalized === 'lockdown'
  ) {
    return 'TOGGLE_LOCKDOWN';
  }

  if (
    normalized.includes("what's my battery") ||
    normalized.includes('whats my battery') ||
    normalized.includes('what is my battery') ||
    normalized.includes('battery status') ||
    normalized.includes('battery level')
  ) {
    return 'CHECK_BATTERY';
  }

  if (
    normalized === 'new chat' ||
    normalized.includes('start a new chat') ||
    normalized.includes('start new chat') ||
    normalized.includes('create new chat')
  ) {
    return 'NEW_CHAT';
  }

  return null;
}
