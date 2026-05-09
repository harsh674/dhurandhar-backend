const asyncHandler = require("../utils/asyncHandler");
const wa = require("../services/whatsapp.service");
const flow = require("../services/whatsappFlow.service");
const { ok } = require("../helpers/response");
const env = require("../config/env");

exports.verify = (req, res) => {
  // lightweight CORS for Meta verification requests
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];
  const expected = env.whatsapp.verifyToken;

  const okVerify = mode === "subscribe" && token === expected;
  if (!okVerify) {
    console.warn(
      `[wa:verify] failed — mode=${mode} tokenMatches=${token === expected} expectedSet=${Boolean(expected)}`
    );
    return res.sendStatus(403);
  }

  // 1. Force the response header to be pure plain text
  res.setHeader('Content-Type', 'text/plain');

  // 2. Wrap challenge in String() to prevent Express status code casting crashes
  // 3. Use end() to cleanly terminate the stream with nothing but the raw string value
  return res.status(200).end(String(challenge));
};

exports.incoming = asyncHandler(async (req, res) => {
  const io = req.app.get("io");
  // Log summary for debugging; return 200 quickly so Meta doesn't retry.
  try {
    console.log('[wa:incoming] recv', {
      query: req.query,
      headers: { 'x-vercel-protection-bypass': req.headers['x-vercel-protection-bypass'] },
      entry: Array.isArray(req.body?.entry) ? req.body.entry.length : undefined,
    });
  } catch (e) {
    console.error('[wa:incoming] log-failure', e);
  }

  res.sendStatus(200);
  flow
    .handleIncoming(req.body, io)
    .then(() => console.log('[wa:incoming] processed'))
    .catch((e) => console.error('[wa-flow]', e));
});

exports.send = asyncHandler(async (req, res) => {
  const { to, body, template, components } = req.body;
  console.log('[wa:send] attempt', { to, type: template ? 'template' : 'text', hasComponents: Boolean(components) });
  try {
    const result = template ? await wa.sendTemplate(to, template, components) : await wa.sendText(to, body);
    console.log('[wa:send] success', { to, resultStubbed: result && result.stubbed });
    ok(res, result);
  } catch (err) {
    console.error('[wa:send] failed', { to, err: err && err.message });
    // surface a 502 for upstream failures
    res.status(502).json({ error: 'WhatsApp send failed' });
  }
});
