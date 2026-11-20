import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildWelcomeStatusGreeting,
  buildWelcomeVoiceSequence,
  calibrateVoiceTone,
  isLikelyFemaleVoice,
  isNeuralOrNaturalVoice,
  scoreVoiceCandidate,
  selectBestVoiceForSegment,
  WELCOME_SESSION_STORAGE_KEY,
  WELCOME_STEP_1,
  WELCOME_STEP_2_ONLINE,
} from '../src/services/femaleVoiceCatalog.js';
import {
  detectSegmentSpeechLang,
  formatTextForSpeech,
  splitSpeechIntoBilingualSegments,
} from '../src/services/speechFormatter.js';

test('Two-Step Welcome Greeting uses exact required phrases and enforces honest backend health gate', () => {
  assert.equal(WELCOME_STEP_1, 'Hello Sir! Welcome to AM AI. How are you?');
  assert.equal(WELCOME_STEP_2_ONLINE, 'Sir, all systems are online. I am ready to assist you.');
  assert.ok(WELCOME_SESSION_STORAGE_KEY.length > 0);

  // Only announces "all systems are online" when BOTH backend health AND AI provider config succeeded
  const onlineSeq = buildWelcomeVoiceSequence({ backendOnline: true, aiConfigured: true });
  assert.equal(onlineSeq.length, 2);
  assert.equal(onlineSeq[0].text, 'Hello Sir! Welcome to AM AI. How are you?');
  assert.equal(onlineSeq[1].text, 'Sir, all systems are online. I am ready to assist you.');
  assert.ok(onlineSeq[0].pauseAfterMs > 0, 'Step 1 should include a natural pause before Step 2');

  // When backend is reachable but AI keys are missing, must NOT falsely claim all systems are online
  const unconfiguredStep2 = buildWelcomeStatusGreeting({ backendOnline: true, aiConfigured: false });
  assert.ok(!/all systems are online/i.test(unconfiguredStep2));
  assert.match(unconfiguredStep2, /not configured/i);

  // When backend is offline, must NOT falsely claim all systems are online
  const offlineStep2 = buildWelcomeStatusGreeting({ backendOnline: false, aiConfigured: false });
  assert.ok(!/all systems are online/i.test(offlineStep2));
  assert.match(offlineStep2, /offline|standby/i);
});

test('Premium Female Voice selector prioritizes soft natural female Hindi & English voices over male/robotic ones', () => {
  const mockVoices = [
    { name: 'eSpeak English', lang: 'en-US', voiceURI: 'espeak-en' },
    { name: 'Microsoft David Desktop', lang: 'en-US', voiceURI: 'ms-david' },
    { name: 'Microsoft Prabhat Online (Natural) - English (India)', lang: 'en-IN', voiceURI: 'ms-prabhat' },
    { name: 'Microsoft Neerja Online (Natural) - English (India)', lang: 'en-IN', voiceURI: 'ms-neerja' },
    { name: 'Microsoft Madhur Online (Natural) - Hindi (India)', lang: 'hi-IN', voiceURI: 'ms-madhur' },
    { name: 'Microsoft Swara Online (Natural) - Hindi (India)', lang: 'hi-IN', voiceURI: 'ms-swara' },
    { name: 'Samantha', lang: 'en-US', voiceURI: 'apple-samantha' },
  ];

  assert.equal(isLikelyFemaleVoice(mockVoices[3]), true);
  assert.equal(isLikelyFemaleVoice(mockVoices[5]), true);
  assert.equal(isLikelyFemaleVoice(mockVoices[2]), false);
  assert.equal(isLikelyFemaleVoice(mockVoices[4]), false);
  assert.equal(isNeuralOrNaturalVoice(mockVoices[3]), true);

  // English (en-IN) selects Neerja natural female over Prabhat male and eSpeak
  const bestEn = selectBestVoiceForSegment(mockVoices, {
    targetLang: 'en-IN',
    femaleVoiceEnabled: true,
  });
  assert.equal(bestEn.voiceURI, 'ms-neerja');

  // Hindi (hi-IN) selects Swara natural female over Madhur male
  const bestHi = selectBestVoiceForSegment(mockVoices, {
    targetLang: 'hi-IN',
    femaleVoiceEnabled: true,
  });
  assert.equal(bestHi.voiceURI, 'ms-swara');

  // Auto-detect switches smoothly to Hindi female voice on a Hindi segment even if user picked an English default
  const switchedHi = selectBestVoiceForSegment(mockVoices, {
    targetLang: 'hi-IN',
    explicitVoiceUri: 'apple-samantha',
    femaleVoiceEnabled: true,
    autoDetectLanguage: true,
  });
  assert.equal(switchedHi.voiceURI, 'ms-swara');

  // When auto-detect is OFF, strictly respects explicit user-selected voice
  const lockedVoice = selectBestVoiceForSegment(mockVoices, {
    targetLang: 'hi-IN',
    explicitVoiceUri: 'apple-samantha',
    femaleVoiceEnabled: true,
    autoDetectLanguage: false,
  });
  assert.equal(lockedVoice.voiceURI, 'apple-samantha');

  // Verify robotic voice always scores well below female natural voice
  const neerjaScore = scoreVoiceCandidate(mockVoices[3], { targetLang: 'en-IN', femaleVoiceEnabled: true });
  const espeakScore = scoreVoiceCandidate(mockVoices[0], { targetLang: 'en-IN', femaleVoiceEnabled: true });
  assert.ok(neerjaScore > espeakScore + 100);
});

test('Tone calibration keeps speaking speed and pitch natural and non-robotic', () => {
  const nativeFemale = calibrateVoiceTone({
    rate: 0.96,
    pitch: 1.04,
    femaleVoiceEnabled: true,
    voice: { name: 'Microsoft Swara Online (Natural)', lang: 'hi-IN' },
  });
  assert.equal(nativeFemale.rate, 0.96);
  assert.ok(nativeFemale.pitch >= 0.88 && nativeFemale.pitch <= 1.22);

  const fallbackLift = calibrateVoiceTone({
    rate: 1.0,
    pitch: 1.0,
    femaleVoiceEnabled: true,
    voice: { name: 'Generic System Voice', lang: 'en-US' },
  });
  assert.equal(fallbackLift.pitch, 1.08);
});

test('Bilingual speech formatter preserves AM AI, tech terms, numbers, and switches Hindi/English/Hinglish without translation', () => {
  const formattedBrand = formatTextForSpeech('**Hello Sir!** Welcome to `AM AI` version 3.8 on Vercel.');
  assert.match(formattedBrand, /Hello Sir!/);
  assert.match(formattedBrand, /A M A I/);
  assert.match(formattedBrand, /3\.8/);
  assert.match(formattedBrand, /Vercel/);
  assert.ok(!formattedBrand.includes('**'));
  assert.ok(!formattedBrand.includes('`'));

  // Pure Hindi text preserved intact (no translation) and detected as hi-IN
  const hindiText = 'नमस्ते सर! आपका AM AI सिस्टम पूरी तरह तैयार है।';
  const formattedHindi = formatTextForSpeech(hindiText);
  assert.ok(formattedHindi.includes('नमस्ते सर!'));
  assert.equal(detectSegmentSpeechLang(formattedHindi, 'en-IN', true), 'hi-IN');

  // Romanized Hinglish detected cleanly as en-IN without mutating words
  const hinglishText = 'Aapka React API bilkul theek kaam kar raha hai, shukriya!';
  assert.equal(detectSegmentSpeechLang(hinglishText, 'en-US', true), 'en-IN');

  // Mixed Hindi + English bilingual paragraph splits into language-tagged segments seamlessly
  const mixed = 'Hello Sir! Welcome to AM AI. नमस्ते सर, आज का मौसम बहुत अच्छा है। All 11 free providers are ready.';
  const segments = splitSpeechIntoBilingualSegments(mixed, {
    fallbackBcp47: 'en-US',
    autoDetect: true,
  });
  assert.ok(segments.length >= 3, `Expected at least 3 bilingual segments, got ${segments.length}`);
  assert.equal(segments[0].lang, 'en-US');
  assert.equal(segments[1].lang, 'hi-IN');
  assert.ok(segments[1].text.includes('नमस्ते सर'));
  assert.equal(segments[2].lang, 'en-US');
  assert.ok(segments[2].text.includes('11'));
});
