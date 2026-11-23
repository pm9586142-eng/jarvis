import test from 'node:test';
import assert from 'node:assert/strict';
import {
  getNextUltronShape,
  parseUltronVoiceCommand,
  ULTRON_SHAPE_ORDER,
} from '../src/services/ultronCommands.js';
import { detectWakeWordTrigger } from '../src/services/media/universalCommandRouter.js';

test('Wake word detection recognizes Hey Ultron alongside Hey AM and Hey JARVIS', () => {
  const bareUltron = detectWakeWordTrigger('Hey Ultron');
  assert.equal(bareUltron.triggered, true);
  assert.equal(bareUltron.wakeWordOnly, true);
  assert.equal(bareUltron.remainder, '');
  assert.equal(bareUltron.wakeTarget, 'ultron');

  const inlineUltron = detectWakeWordTrigger('Hey Ultron, activate energy mode');
  assert.equal(inlineUltron.triggered, true);
  assert.equal(inlineUltron.wakeWordOnly, false);
  assert.equal(inlineUltron.remainder, 'activate energy mode');
  assert.equal(inlineUltron.wakeTarget, 'ultron');

  const hindiUltron = detectWakeWordTrigger('हे अल्ट्रॉन क्वांटम क्या है');
  assert.equal(hindiUltron.triggered, true);
  assert.equal(hindiUltron.wakeTarget, 'ultron');
  assert.equal(hindiUltron.remainder, 'क्वांटम क्या है');

  const amHit = detectWakeWordTrigger('Hey AM open notes');
  assert.equal(amHit.triggered, true);
  assert.equal(amHit.wakeTarget, 'am');
  assert.equal(amHit.remainder, 'open notes');
});

test('parseUltronVoiceCommand parses all required ULTRON assistant and transformation commands', () => {
  assert.deepEqual(parseUltronVoiceCommand('Open assistant mode'), {
    type: 'OPEN_ASSISTANT_MODE',
  });
  assert.deepEqual(parseUltronVoiceCommand('Start listening'), {
    type: 'START_LISTENING',
  });
  assert.deepEqual(parseUltronVoiceCommand('Stop listening'), {
    type: 'STOP_LISTENING',
  });
  assert.deepEqual(parseUltronVoiceCommand('Change your shape'), {
    type: 'CYCLE_SHAPE',
  });
  assert.deepEqual(parseUltronVoiceCommand('Hey Ultron, shape badlo'), {
    type: 'CYCLE_SHAPE',
  });
  assert.deepEqual(parseUltronVoiceCommand('Activate hologram mode'), {
    type: 'SET_MODE',
    mode: 'hologram',
  });
  assert.deepEqual(parseUltronVoiceCommand('Energy mode'), {
    type: 'SET_MODE',
    mode: 'energy',
  });
  assert.deepEqual(parseUltronVoiceCommand('Enter thinking mode'), {
    type: 'SET_MODE',
    mode: 'thinking',
  });
  assert.deepEqual(parseUltronVoiceCommand('Return to normal mode'), {
    type: 'SET_MODE',
    mode: 'normal',
  });
  assert.deepEqual(parseUltronVoiceCommand('Switch to helix shape'), {
    type: 'SET_SHAPE',
    shape: 'helix',
  });

  // General conversational prompts must fall through to Gemini AI Brain
  assert.equal(parseUltronVoiceCommand('Explain photosynthesis in simple terms'), null);
  assert.equal(parseUltronVoiceCommand('Calculate 45 times 18'), null);
});

test('getNextUltronShape cycles cleanly through all 5 3D forms', () => {
  assert.deepEqual(ULTRON_SHAPE_ORDER, [
    'sphere',
    'icosahedron',
    'octahedron',
    'torus_knot',
    'helix',
  ]);

  let current = 'sphere';
  const visited = [current];
  for (let i = 0; i < ULTRON_SHAPE_ORDER.length; i++) {
    current = getNextUltronShape(current);
    visited.push(current);
  }
  assert.deepEqual(visited, [
    'sphere',
    'icosahedron',
    'octahedron',
    'torus_knot',
    'helix',
    'sphere',
  ]);
});
