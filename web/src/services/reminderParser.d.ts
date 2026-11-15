export interface ParsedReminderResult {
  title: string;
  description: string;
  dueTime: string;
  triggerAtMillis: number;
  priority: 'HIGH' | 'MEDIUM' | 'LOW';
  category: 'REMINDER' | 'TASK' | 'SCHEDULE' | 'NOTE';
}

export function parseReminderFallback(input: string, nowMs?: number): ParsedReminderResult;

export function sanitizeParsedReminder(
  rawObj: unknown,
  fallbackInput: string,
  nowMs?: number
): ParsedReminderResult;
