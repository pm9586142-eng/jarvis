import test from 'node:test';
import assert from 'node:assert/strict';
import { formatTextForSpeech, splitSpeechIntoChunks } from '../src/services/speechFormatter.js';

test('formatTextForSpeech removes Markdown syntax, URLs, tables, and fenced code blocks', () => {
  const input = [
    '## Architecture Summary',
    '',
    'Hello **Sir**, check [the official docs](https://example.com/docs) and `buildConfig` below:',
    '',
    '```kotlin',
    'fun bootJarvis() { println("secret_symbol()") }',
    '```',
    '',
    '| Component | Status |',
    '| --- | --- |',
    '| Brain | Ready |',
    '',
    '- Step 1: Verify https://status.example.org/api/v1 health.',
  ].join('\n');

  const spoken = formatTextForSpeech(input);
  assert.doesNotMatch(spoken, /```|##|\*\*|https?:\/\//);
  assert.match(spoken, /kotlin code snippet is displayed on screen/i);
  assert.match(spoken, /the official docs/);
  assert.match(spoken, /buildConfig/);
  assert.match(spoken, /link on screen/);
});

test('formatTextForSpeech preserves Hindi Devanagari and English prose cleanly', () => {
  const input = '**नमस्ते सर**, आपका सिस्टम `100%` तैयार है। चलिए आगे बढ़ते हैं!';
  const spoken = formatTextForSpeech(input);
  assert.equal(spoken, 'नमस्ते सर, आपका सिस्टम 100% तैयार है। चलिए आगे बढ़ते हैं!');
});

test('splitSpeechIntoChunks splits long responses cleanly along sentence boundaries', () => {
  const longText = [
    'All tactical sensors are calibrated across every orbital telemetry node.',
    'Memory retrieval index has verified thirty-two stored project directives without conflict.',
    'Voice synthesis chunking ensures long briefings can pause and resume smoothly on Android and Web.',
    'Ready for your next engineering instruction, Sir.',
  ].join(' ');

  const chunks = splitSpeechIntoChunks(longText, 140);
  assert.ok(chunks.length >= 2);
  for (const chunk of chunks) {
    assert.ok(chunk.length <= 140, `Chunk exceeded max length: ${chunk.length}`);
  }
  assert.equal(chunks.join(' '), longText);
});
