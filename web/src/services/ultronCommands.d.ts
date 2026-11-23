import { UltronShapeForm, UltronVisualMode } from '../types/jarvis';

export const ULTRON_SHAPE_ORDER: readonly UltronShapeForm[];
export const ULTRON_SHAPE_LABELS: Record<UltronShapeForm, string>;

export type UltronCommandAction =
  | { type: 'OPEN_ASSISTANT_MODE' }
  | { type: 'START_LISTENING' }
  | { type: 'STOP_LISTENING' }
  | { type: 'CYCLE_SHAPE' }
  | { type: 'SET_SHAPE'; shape: UltronShapeForm }
  | { type: 'SET_MODE'; mode: UltronVisualMode };

export function getNextUltronShape(currentShape: UltronShapeForm): UltronShapeForm;
export function parseUltronVoiceCommand(rawText: string): UltronCommandAction | null;
