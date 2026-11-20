'use strict';
/**
 * Homework Helper: reads photos of a worksheet with Claude and returns
 * problems, step-by-step hints (never the answers) and a short warm-up.
 *
 * Needs an Anthropic API key in config.json. Without one, enabled is false and
 * the app only offers "pick the topic". The photos go to Anthropic's API and
 * nowhere else; nothing is stored on disk.
 */
const Anthropic = require('@anthropic-ai/sdk');

const MAX_IMAGES = 4;
const MAX_IMAGE_BYTES = 5 * 1024 * 1024; // per photo, after the browser shrinks it
const MEDIA_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

/** Error with a short code the page turns into a kind message. */
class HomeworkError extends Error {
  constructor(status, code, message) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

const clip = (value, max) => (typeof value === 'string' ? value.slice(0, max) : '');

/** The instructions sent with the photos. `plan` is what the class is working on. */
function buildPrompt(plan = {}) {
  const program = clip(plan.program, 80) || 'a standard math program';
  const where = clip(plan.where, 80);
  const note = clip(plan.note, 1200) || 'none';
  return `You are a patient math tutor for a 4th grade student in New York State (Next Generation Math Learning Standards). The attached image(s) are photos of the student's math homework worksheet.
Her class uses ${program}${where ? ', currently ' + where : ''}. Notes from her teacher: ${note}
Use the same methods and words as her class in your hints (for example: base ten pieces, area models, dimensions, partial products, ratio tables).

Reply with ONLY one JSON object, no other text, in exactly this shape:
{
 "ok": true,
 "title": "short topic name, like 'Multiplying 2-digit numbers'",
 "parentNote": "one sentence for the parent describing the skills this homework practices and the strategies the worksheet uses (e.g. area model, partial products, tape diagram)",
 "skills": ["any of: pvr, pvf, m10, rt, fp, mfacts, dfacts, m1d, m2d, div, wpc, wpm, wpr, other"],
 "problems": [ { "label": "1", "text": "the problem exactly as written", "answer": "the correct final answer as a short string, or null if the problem needs a drawing or written explanation", "hints": ["hint 1", "hint 2", "hint 3"] } ],
 "warmups": [ { "text": "a NEW practice problem on the same skill with different numbers", "answer": 123, "remainder": null, "hints": ["hint 1", "hint 2"], "solution": "short worked solution" } ]
}

Rules:
- Skill ids: pvr = reading and writing numbers (standard form, word form), pvf = number forms and place value (expanded form, unit form, value of a digit, base ten pieces), m10 = multiplying with tens and hundreds (like 70 × 10 or 20 × 30), rt = ratio tables (find the amount for 1, then build up), fp = factors, factor pairs, multiples, and prime or composite numbers, mfacts = multiplication facts, dfacts = division facts, m1d = multi-digit times 1-digit, m2d = 2-digit times 2-digit, div = division with remainders, wpc = "times as many" comparison word problems, wpm = multi-step word problems, wpr = interpreting remainders in word problems.
- When a worksheet row has two parts (like "list the factors" and "prime or composite"), make each part its own problem, labeled like "16a" and "16b".
- If a teacher wrote a note on a page (for example "We will do this"), mention it in parentNote.
- When the worksheet asks for an estimate, make the estimate its own problem with answer null, and put a rounding hint in it.
- Write answers so a child can type them: a factor list as "1, 2, 4, 8, 16"; prime or composite as "P" or "C".
- Include at most 12 problems. If the worksheet has more, keep the first 12.
- Hints guide one step at a time, written for a 9-year-old in short, kind sentences. Use the strategies the worksheet itself uses when you can see them. Otherwise use place-value strategies: area models, partial products, partial quotients, bar models.
- Hints must NEVER state the final answer.
- Give exactly 3 warmups. Each warmup answer must be a whole number. For division with a remainder, put the quotient in "answer" and the remainder in "remainder".
- If the image is not a math worksheet or cannot be read, reply {"ok": false, "reason": "short kind explanation"}.`;
}

/** Pull the JSON object out of Claude's reply (tolerates stray text around it). */
function parseReply(text) {
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start < 0 || end <= start) throw new HomeworkError(502, 'bad_reply', 'No JSON in the reply');
  try {
    return JSON.parse(text.slice(start, end + 1));
  } catch {
    throw new HomeworkError(502, 'bad_reply', 'Reply was not valid JSON');
  }
}

/** Check the photos the browser sent: [{ mediaType, data (base64) }]. */
function checkImages(images) {
  if (!Array.isArray(images) || !images.length) throw new HomeworkError(400, 'no_images', 'Add a photo first');
  if (images.length > MAX_IMAGES) throw new HomeworkError(400, 'too_many_images', `At most ${MAX_IMAGES} photos`);
  return images.map((img) => {
    if (!img || !MEDIA_TYPES.includes(img.mediaType)) throw new HomeworkError(400, 'image_rejected', 'Photos must be JPEG, PNG, WebP or GIF');
    if (typeof img.data !== 'string' || !/^[A-Za-z0-9+/]+=*$/.test(img.data)) throw new HomeworkError(400, 'image_rejected', 'Photo data is not base64');
    if (img.data.length * 0.75 > MAX_IMAGE_BYTES) throw new HomeworkError(400, 'image_too_big', 'Photo is too large');
    return { type: 'image', source: { type: 'base64', media_type: img.mediaType, data: img.data } };
  });
}

class HomeworkReader {
  /**
   * @param {object} opts
   * @param {string} opts.apiKey   Anthropic API key ('' turns the feature off)
   * @param {string} opts.model    Claude model id
   * @param {object} [opts.client] a ready Anthropic client (tests pass a fake)
   */
  constructor({ apiKey, model, client }) {
    this.model = model;
    this.client = client || (apiKey ? new Anthropic({ apiKey }) : null);
  }

  get enabled() {
    return Boolean(this.client);
  }

  async read({ images, plan }) {
    if (!this.client) throw new HomeworkError(503, 'not_configured', 'No API key is set');
    const content = [...checkImages(images), { type: 'text', text: buildPrompt(plan) }];
    let response;
    try {
      response = await this.client.beta.messages.create({
        model: this.model,
        max_tokens: 16000,
        // If the model declines, the API retries on a fallback model in the same call.
        betas: ['server-side-fallback-2026-07-01'],
        fallbacks: 'default',
        messages: [{ role: 'user', content }],
      });
    } catch (err) {
      throw toHomeworkError(err);
    }
    if (response.stop_reason === 'refusal') throw new HomeworkError(422, 'refused', 'Claude declined to read this photo');
    const text = response.content.filter((b) => b.type === 'text').map((b) => b.text).join('');
    return parseReply(text);
  }
}

/** Map SDK errors to short codes; never include the key or the request in messages. */
function toHomeworkError(err) {
  if (err instanceof Anthropic.AuthenticationError) return new HomeworkError(502, 'bad_key', 'The API key was not accepted');
  if (err instanceof Anthropic.PermissionDeniedError) return new HomeworkError(502, 'bad_key', 'The API key may not use this model');
  if (err instanceof Anthropic.RateLimitError) return new HomeworkError(429, 'rate_limited', 'Too many requests');
  if (err instanceof Anthropic.BadRequestError) return new HomeworkError(400, 'bad_request', 'The request was refused');
  if (err instanceof Anthropic.APIConnectionError) return new HomeworkError(502, 'offline', 'Could not reach Anthropic');
  if (err instanceof Anthropic.APIError) return new HomeworkError(502, 'api_error', `Anthropic error ${err.status || ''}`.trim());
  return new HomeworkError(500, 'server_error', 'Unexpected error');
}

module.exports = { HomeworkReader, HomeworkError, buildPrompt, parseReply, checkImages, MAX_IMAGES };
