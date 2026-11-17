import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildSecurityHudSummary,
  buildSecuritySpokenSummary,
  buildTasksSpokenSummary,
  composeSpokenDailySummary,
  formatWeatherForSpeech,
  getTimeGreeting,
  isWeatherSummaryAvailable,
} from '../src/services/dailySummary.js';

test('getTimeGreeting chooses appropriate morning, afternoon, and evening greetings', () => {
  assert.equal(getTimeGreeting(8), 'Good morning, Sir.');
  assert.equal(getTimeGreeting(14), 'Good afternoon, Sir.');
  assert.equal(getTimeGreeting(21), 'Good evening, Sir.');
  assert.equal(getTimeGreeting(2), 'Good evening, Sir.');
});

test('isWeatherSummaryAvailable filters out offline, standby, and HTTP error strings', () => {
  assert.equal(isWeatherSummaryAvailable('19°C, Clear sky • Wind 11 km/h (Local Telemetry)'), true);
  assert.equal(isWeatherSummaryAvailable('Checking weather...'), false);
  assert.equal(isWeatherSummaryAvailable('Weather unavailable (offline or blocked)'), false);
  assert.equal(isWeatherSummaryAvailable('Weather feed HTTP 503 (New York Grid)'), false);
  assert.equal(isWeatherSummaryAvailable('Weather data standby (Local Telemetry)'), false);
  assert.equal(isWeatherSummaryAvailable(''), false);
});

test('formatWeatherForSpeech produces natural voice phrasing without raw symbols or telemetry tags', () => {
  const spoken = formatWeatherForSpeech('22°C, Partly cloudy • Wind 14 km/h (Local Telemetry)');
  assert.equal(spoken, 'Current weather is 22 degrees Celsius, Partly cloudy, Wind 14 kilometers per hour.');
  assert.equal(formatWeatherForSpeech('Weather unavailable (offline or blocked)'), null);
});

test('buildTasksSpokenSummary prioritizes HIGH tasks and handles 0, 1, and multiple pending tasks', () => {
  assert.match(buildTasksSpokenSummary([]), /no pending tasks/i);
  assert.match(
    buildTasksSpokenSummary([{ id: '1', title: 'Done task', isCompleted: true, priority: 'HIGH' }]),
    /all scheduled objectives are complete/i
  );

  const single = buildTasksSpokenSummary([
    { id: '1', title: 'Review Arc Telemetry', dueTime: '14:00 Today', isCompleted: false, priority: 'HIGH' },
  ]);
  assert.match(single, /1 pending task, marked high priority/i);
  assert.match(single, /Review Arc Telemetry due 14:00 Today/);

  const multi = buildTasksSpokenSummary([
    { id: '1', title: 'Low priority cleanup', dueTime: 'Today', isCompleted: false, priority: 'LOW', createdAt: 1 },
    { id: '2', title: 'Board Briefing', dueTime: '16:30 Today', isCompleted: false, priority: 'HIGH', createdAt: 2 },
    { id: '3', title: 'Security Scan', dueTime: '19:00', isCompleted: false, priority: 'MEDIUM', createdAt: 3 },
    { id: '4', title: 'Completed item', dueTime: '09:00', isCompleted: true, priority: 'HIGH', createdAt: 0 },
  ]);
  assert.match(multi, /3 pending tasks, including 1 high priority/i);
  assert.match(multi, /Top priorities are Board Briefing due 16:30 Today, Security Scan, and Low priority cleanup\./);
});

test('buildSecuritySpokenSummary handles DEFCON 5 optimal, DEFCON 4 alerts, and DEFCON 1 lockdown', () => {
  const optimal = {
    score: 98,
    defconLevel: 5,
    threatStatus: 'DEFCON 5: OPTIMAL',
    alerts: ['All browser security heuristics are within nominal tolerances.'],
  };
  assert.equal(buildSecurityHudSummary(optimal), 'DEFCON 5 • 98/100 • Optimal');
  assert.match(buildSecuritySpokenSummary(optimal), /optimal at DEFCON 5 with a score of 98 out of 100/i);

  const warning = {
    score: 82,
    defconLevel: 4,
    threatStatus: 'DEFCON 4: ELEVATED',
    alerts: ['2 warning events detected in the security audit stream.'],
  };
  assert.match(buildSecuritySpokenSummary(warning), /DEFCON 4 with an integrity score of 82 out of 100/i);
  assert.match(buildSecuritySpokenSummary(warning), /2 warning events detected/i);

  const lockdown = {
    score: 64,
    defconLevel: 1,
    threatStatus: 'DEFCON 1: LOCKDOWN',
    alerts: ['ALERT: Emergency Defense Lockdown protocol is active.'],
  };
  assert.equal(buildSecurityHudSummary(lockdown), 'DEFCON 1 • LOCKDOWN (64/100)');
  assert.match(buildSecuritySpokenSummary(lockdown), /Emergency Defense Lockdown is active at DEFCON 1/i);
});

test('composeSpokenDailySummary combines greeting, pending tasks, weather when available, and security cleanly', () => {
  const fullSummary = composeSpokenDailySummary({
    hour: 9,
    tasks: [
      { id: 't1', title: '**Launch** Telemetry Audit', dueTime: '11:00', isCompleted: false, priority: 'HIGH', createdAt: 1 },
      { id: 't2', title: 'Sync Shield Array', dueTime: 'Today', isCompleted: false, priority: 'MEDIUM', createdAt: 2 },
    ],
    weatherSummary: '18°C, Clear sky • Wind 9 km/h (Local Telemetry)',
    securityReport: { score: 96, defconLevel: 5, alerts: ['All systems nominal.'] },
    aiLine: 'All core nodes are operating at peak efficiency, Sir.',
    aiSource: 'gemini',
  });

  assert.match(fullSummary, /^Good morning, Sir\./);
  assert.match(fullSummary, /2 pending tasks, including 1 high priority/);
  assert.match(fullSummary, /Launch Telemetry Audit due 11:00/);
  assert.match(fullSummary, /Current weather is 18 degrees Celsius, Clear sky, Wind 9 kilometers per hour\./);
  assert.match(fullSummary, /Security status is optimal at DEFCON 5 with a score of 96 out of 100/);
  assert.match(fullSummary, /peak efficiency, Sir\./);
  assert.doesNotMatch(fullSummary, /\*\*|•/);

  const offlineWeatherSummary = composeSpokenDailySummary({
    hour: 18,
    tasks: [],
    weatherSummary: 'Weather unavailable (offline or blocked)',
    securityReport: { score: 85, defconLevel: 4, alerts: ['1 warning event recorded.'] },
    aiLine: 'Fallback generic line should be omitted',
    aiSource: 'fallback',
  });

  assert.match(offlineWeatherSummary, /^Good evening, Sir\./);
  assert.match(offlineWeatherSummary, /no pending tasks/i);
  assert.doesNotMatch(offlineWeatherSummary, /weather|offline|blocked/i);
  assert.match(offlineWeatherSummary, /DEFCON 4 with an integrity score of 85 out of 100/);
  assert.doesNotMatch(offlineWeatherSummary, /Fallback generic line/);
});
