import test from 'node:test';
import assert from 'node:assert/strict';
import {
  filterUniqueMemories,
  isNearDuplicateMemory,
  jaccardSimilarity,
  normalizeMemoryText,
} from '../src/services/memoryDedupe.js';

test('normalizeMemoryText strips punctuation and normalizes whitespace', () => {
  assert.equal(
    normalizeMemoryText('  Primary Stack: Kotlin, Jetpack Compose! '),
    'primary stack kotlin jetpack compose'
  );
});

test('jaccardSimilarity computes overlap for related phrases', () => {
  const sim = jaccardSimilarity(
    'Prefers dark cosmic cyan interface',
    'User prefers dark cyan cosmic theme'
  );
  assert.ok(sim >= 0.4);
  assert.equal(jaccardSimilarity('', 'hello world'), 0);
});

test('isNearDuplicateMemory detects exact, substring, and same-key near duplicates', () => {
  const existing = [
    { key: 'Language', category: 'PREFERENCE', content: 'User prefers Hinglish explanations for technical topics', importance: 4 },
  ];

  assert.equal(
    isNearDuplicateMemory(
      { key: 'Language', content: 'User prefers Hinglish explanations for technical topics' },
      existing
    ),
    true
  );

  assert.equal(
    isNearDuplicateMemory(
      { key: 'Role', content: 'Works as a full stack Android and React developer' },
      existing
    ),
    false
  );
});

test('filterUniqueMemories deduplicates within batch and caps at 3', () => {
  const existing = [
    { key: 'Editor', category: 'PREFERENCE', content: 'Uses Android Studio for Kotlin work', importance: 3 },
  ];
  const candidates = [
    { key: 'Editor', category: 'PREFERENCE', content: 'Uses Android Studio for Kotlin work', importance: 3 },
    { key: 'Backend', category: 'PROJECT', content: 'Deploys Express backend to Google Cloud Run', importance: 5 },
    { key: 'Backend', category: 'PROJECT', content: 'Deploys Express backend to Google Cloud Run', importance: 5 },
    { key: 'Goal', category: 'FACT', content: 'Building JARVIS AI voice assistant', importance: 4 },
    { key: 'Timezone', category: 'FACT', content: 'Operates in Asia/Kolkata timezone', importance: 3 },
    { key: 'Extra', category: 'INVALID', content: 'Fourth candidate should be capped at 3 max', importance: 99 },
  ];

  const accepted = filterUniqueMemories(candidates, existing);
  assert.equal(accepted.length, 3);
  assert.equal(accepted[0].key, 'Backend');
  assert.equal(accepted[1].key, 'Goal');
  assert.equal(accepted[2].key, 'Timezone');
});
