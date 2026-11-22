import { ScreenId } from '../../types/jarvis';

export type CanonicalOfflineIntent =
  | 'QUERY_TIME'
  | 'QUERY_DATE'
  | 'RUN_PROTOCOL'
  | 'CREATE_TASK'
  | 'LIST_TASKS'
  | 'CREATE_NOTE'
  | 'LIST_NOTES'
  | 'SAVE_MEMORY'
  | 'OPEN_SCREEN';

export interface CanonicalOfflineCommandResult {
  intent: CanonicalOfflineIntent;
  engine: 'Offline Command Engine';
  rawText: string;
  protocol?: 'GOOD_MORNING' | 'FOCUS' | 'DIAGNOSTICS' | 'STANDBY';
  title?: string;
  content?: string;
  screen?: ScreenId;
  section?: 'youtube' | 'browser';
  tab?: 'tasks' | 'notes';
}

export function parseCanonicalOfflineCommand(rawText: string): CanonicalOfflineCommandResult | null;
