const test = require('node:test');
const assert = require('node:assert/strict');
const { detectMood } = require('../services/moodDetection');

test('detects the five requested mood categories', () => {
  assert.equal(detectMood('I am feeling great today'), 'Happy');
  assert.equal(detectMood('I feel very lonely'), 'Sad');
  assert.equal(detectMood('I am really angry'), 'Angry');
  assert.equal(detectMood('I have too much work and feel overwhelmed'), 'Stressed');
  assert.equal(detectMood('I will attend class tomorrow'), 'Neutral');
});

test('handles unclear and empty input with a neutral fallback', () => {
  assert.equal(detectMood(''), 'Neutral');
  assert.equal(detectMood('The meeting starts at 10'), 'Neutral');
});

test('resolves mixed emotions using a deterministic priority', () => {
  assert.equal(detectMood('I am happy but also furious'), 'Angry');
});

test('does not classify a negated positive word as happy', () => {
  assert.equal(detectMood('I am not happy about this'), 'Neutral');
  assert.equal(detectMood("I don't feel happy today"), 'Neutral');
});
