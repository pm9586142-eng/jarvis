import test from 'node:test';
import assert from 'node:assert/strict';
import { parseReminderFallback, sanitizeParsedReminder } from '../src/services/reminderParser.js';

const BASE_NOW = new Date('2026-06-15T10:00:00.000Z').getTime();

test('parseReminderFallback parses relative minutes and hours accurately', () => {
  const in15 = parseReminderFallback('Remind me to check server logs in 15 minutes urgent', BASE_NOW);
  assert.equal(in15.triggerAtMillis, BASE_NOW + 15 * 60 * 1000);
  assert.equal(in15.priority, 'HIGH');
  assert.equal(in15.category, 'REMINDER');
  assert.match(in15.title, /check server logs/i);

  const in2h = parseReminderFallback('Remind me to call client in 2 hours', BASE_NOW);
  assert.equal(in2h.triggerAtMillis, BASE_NOW + 2 * 60 * 60 * 1000);
  assert.equal(in2h.category, 'SCHEDULE');
});

test('parseReminderFallback handles clock time and tomorrow keyword', () => {
  const res = parseReminderFallback('Schedule team meeting tomorrow at 5:30 pm', BASE_NOW);
  const dt = new Date(res.triggerAtMillis);
  const expectedBase = new Date(BASE_NOW);
  expectedBase.setDate(expectedBase.getDate() + 1);
  assert.equal(dt.getDate(), expectedBase.getDate());
  assert.equal(dt.getHours(), 17);
  assert.equal(dt.getMinutes(), 30);
  assert.equal(res.category, 'SCHEDULE');
});

test('parseReminderFallback falls back cleanly on blank input', () => {
  const empty = parseReminderFallback('   ', BASE_NOW);
  assert.equal(empty.title, 'Scheduled Reminder');
  assert.equal(empty.priority, 'MEDIUM');
  assert.equal(empty.triggerAtMillis, BASE_NOW + 60 * 60 * 1000);
});

test('sanitizeParsedReminder clamps invalid categories, priorities, and applies delayMinutes', () => {
  const sanitized = sanitizeParsedReminder(
    {
      title: 'Deploy Cloud Run build',
      description: 'Verify healthcheck',
      priority: 'EXTREME',
      category: 'UNKNOWN',
      delayMinutes: 20,
    },
    'Urgent deploy Cloud Run build',
    BASE_NOW
  );
  assert.equal(sanitized.title, 'Deploy Cloud Run build');
  assert.equal(sanitized.priority, 'HIGH');
  assert.equal(sanitized.category, 'REMINDER');
  assert.equal(sanitized.triggerAtMillis, BASE_NOW + 20 * 60 * 1000);
});
