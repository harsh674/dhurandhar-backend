const asyncHandler = require("../utils/asyncHandler");
const wa = require("../services/whatsapp.service");
const flow = require("../services/whatsappFlow.service");
const { ok } = require("../helpers/response");
const env = require("../config/env");

exports.verify = (req, res) => {
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
  // Always 200 quickly so Meta doesn't retry; process async.
  res.sendStatus(200);
  flow.handleIncoming(req.body, io).catch((e) => console.error("[wa-flow]", e));
});

exports.send = asyncHandler(async (req, res) => {
  const { to, body, template, components } = req.body;
  const result = template ? await wa.sendTemplate(to, template, components) : await wa.sendText(to, body);
  ok(res, result);
});
