import { ActiveEngineAttribution, AiRoutingMode, ConnectionState } from '../../types/jarvis';

export interface NetworkSnapshot {
  browserOnline: boolean;
  backendReachable: boolean;
  cloudAiConfigured: boolean;
  localModelInstalled: boolean;
  ollamaEnabled: boolean;
}

export interface RoutingDecision {
  target: 'cloud' | 'ollama' | 'local_pc' | 'offline_guidance';
  attribution: ActiveEngineAttribution;
  reason: string;
  allowFallbackToLocal: boolean;
}

export function resolveAiProviderPlan(mode: AiRoutingMode, net: NetworkSnapshot): RoutingDecision;

export function deriveNetworkSnapshot(params: {
  browserOnline: boolean;
  connectionState: ConnectionState;
  localModelInstalled: boolean;
  ollamaEnabled: boolean;
}): NetworkSnapshot;
