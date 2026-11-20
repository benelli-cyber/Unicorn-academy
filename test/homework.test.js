'use strict';
// Run with: npm test
const test = require('node:test');
const assert = require('node:assert/strict');
const { HomeworkReader, HomeworkError, buildPrompt, parseReply, checkImages } = require('../server/homework');

const PHOTO = { mediaType: 'image/jpeg', data: Buffer.from('fake jpeg').toString('base64') };

/** A stand-in for the Anthropic client that records the request and returns `reply`. */
function fakeClient(reply) {
  const calls = [];
  return {
    calls,
    beta: { messages: { create: async (req) => { calls.push(req); return reply; } } },
  };
}

test('without an API key the feature is off', async () => {
  const reader = new HomeworkReader({ apiKey: '', model: 'claude-opus-5-5' });
  assert.equal(reader.enabled, false);
  await assert.rejects(reader.read({ images: [PHOTO] }), { code: 'not_configured' });
});

test('sends the photos and the class plan, and parses the JSON reply', async () => {
  const client = fakeClient({
    stop_reason: 'end_turn',
    content: [{ type: 'text', text: 'Here you go:\n{"ok": true, "title": "Factors", "problems": [], "warmups": []}' }],
  });
  const reader = new HomeworkReader({ apiKey: '', model: 'claude-opus-5-5', client });
  const data = await reader.read({ images: [PHOTO, PHOTO], plan: { program: 'Bridges in Mathematics', where: 'Unit 2, Module 3', note: 'Ratio tables' } });
  assert.deepEqual(data, { ok: true, title: 'Factors', problems: [], warmups: [] });
  const req = client.calls[0];
  assert.equal(req.model, 'claude-opus-5-5');
  assert.equal(req.fallbacks, 'default');
  const content = req.messages[0].content;
  assert.equal(content.filter((b) => b.type === 'image').length, 2);
  assert.equal(content[0].source.media_type, 'image/jpeg');
  assert.match(content.at(-1).text, /Bridges in Mathematics, currently Unit 2, Module 3/);
  assert.match(content.at(-1).text, /Hints must NEVER state the final answer/);
});

test('a refusal becomes a "refused" error', async () => {
  const reader = new HomeworkReader({ apiKey: '', model: 'm', client: fakeClient({ stop_reason: 'refusal', content: [] }) });
  await assert.rejects(reader.read({ images: [PHOTO] }), { code: 'refused' });
});

test('photos are checked before anything is sent', () => {
  assert.throws(() => checkImages([]), { code: 'no_images' });
  assert.throws(() => checkImages(Array(5).fill(PHOTO)), { code: 'too_many_images' });
  assert.throws(() => checkImages([{ mediaType: 'image/heic', data: PHOTO.data }]), { code: 'image_rejected' });
  assert.throws(() => checkImages([{ mediaType: 'image/jpeg', data: 'not base64!' }]), { code: 'image_rejected' });
  assert.equal(checkImages([PHOTO]).length, 1);
});

test('replies without JSON are reported', () => {
  assert.throws(() => parseReply('Sorry, no JSON here'), HomeworkError);
  assert.deepEqual(parseReply('{"ok": false, "reason": "blurry"}'), { ok: false, reason: 'blurry' });
});

test('the prompt clips long class notes', () => {
  const prompt = buildPrompt({ note: 'x'.repeat(5000) });
  assert.ok(prompt.length < 6000);
  assert.match(prompt, /a standard math program/);
});
