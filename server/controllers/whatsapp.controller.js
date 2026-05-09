const asyncHandler = require("../utils/asyncHandler");
const wa = require("../services/whatsapp.service");
const flow = require("../services/whatsappFlow.service");
const { ok } = require("../helpers/response");

exports.verify = (req, res) => {
  const challenge = wa.verifyWebhook(req.query);
  if (!challenge) return res.sendStatus(403);
  res.status(200).send(challenge);
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
