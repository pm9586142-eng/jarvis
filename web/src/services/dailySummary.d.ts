import { SecurityReport, TaskItem } from '../types/jarvis';

export function getTimeGreeting(hour?: number): string;
export function isWeatherSummaryAvailable(weatherSummary?: string | null): boolean;
export function formatWeatherForSpeech(weatherSummary?: string | null): string | null;
export function getPrioritizedPendingTasks(tasks?: TaskItem[]): TaskItem[];
export function buildTasksSpokenSummary(tasks?: TaskItem[]): string;
export function buildSecurityHudSummary(securityReport?: SecurityReport | null): string;
export function buildSecuritySpokenSummary(securityReport?: SecurityReport | null): string | null;
export function composeSpokenDailySummary(params?: {
  greeting?: string;
  hour?: number;
  tasks?: TaskItem[];
  weatherSummary?: string | null;
  securityReport?: SecurityReport | null;
  aiLine?: string | null;
  aiSource?: 'gemini' | 'fallback' | string;
  prefix?: string;
}): string;
