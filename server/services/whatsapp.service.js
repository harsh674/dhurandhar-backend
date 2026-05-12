// WhatsApp Cloud API service — STUBBED.
// Set WHATSAPP_TOKEN + WHATSAPP_PHONE_NUMBER_ID in .env to activate real sends.
const axios = require("axios");
const env = require("../config/env");

const enabled = () => Boolean(env.whatsapp.token && env.whatsapp.phoneNumberId);

const apiUrl = () =>
  `https://graph.facebook.com/${env.whatsapp.apiVersion}/${env.whatsapp.phoneNumberId}/messages`;

async function sendText(to, body) {
  if (!enabled()) {
    // eslint-disable-next-line no-console
    console.log(`[whatsapp:stub] → ${to}: ${body}`);
    return { stubbed: true };
  }
  const { data } = await axios.post(
    apiUrl(),
    { messaging_product: "whatsapp", to, type: "text", text: { body } },
    { headers: { Authorization: `Bearer ${env.whatsapp.token}` } }
  );
  return data;
}

async function sendTemplate(to, template, components = []) {
  if (!enabled()) {
    // eslint-disable-next-line no-console
    console.log(`[whatsapp:stub] template ${template} → ${to}`, components);
    return { stubbed: true };
  }
  const { data } = await axios.post(
    apiUrl(),
    {
      messaging_product: "whatsapp",
      to,
      type: "template",
      template: { name: template, language: { code: "en" }, components },
    },
    { headers: { Authorization: `Bearer ${env.whatsapp.token}` } }
  );
  return data;
}

function verifyWebhook(query) {
  const mode = query["hub.mode"];
  const token = query["hub.verify_token"];
  const challenge = query["hub.challenge"];
  if (mode === "subscribe" && token === env.whatsapp.verifyToken) return challenge;
  return null;
}
async function sendButtons(to, data) {
  return axios.post(
    apiUrl(),
    {
      messaging_product: "whatsapp",
      to,
      type: "interactive",
      interactive: {
        type: "button",
        body: {
          text: data.body,
        },
        action: {
          buttons: data.buttons.map((b) => ({
            type: "reply",
            reply: {
              id: b.id,
              title: b.title,
            },
          })),
        },
      },
    },
    {
      headers: {
        Authorization: `Bearer ${env.whatsapp.token}`,
        "Content-Type": "application/json",
      },
    }
  );
}

async function sendList(to, data) {
  return axios.post(
    apiUrl(),
    {
      messaging_product: "whatsapp",
      to,
      type: "interactive",
      interactive: {
        type: "list",
        body: {
          text: data.body,
        },
        action: {
          button: data.buttonText,
          sections: data.sections,
        },
      },
    },
    {
      headers: {
        Authorization: `Bearer ${env.whatsapp.token}`,
        "Content-Type": "application/json",
      },
    }
  );
}

async function sendLocationOptions(phone) {

  return wa.sendButtons(phone, {
    body:
      "📍 Choose how you'd like to share your location",

    buttons: [
      {
        id: "SHARE_LOCATION",
        title: "Current Location",
      },
      {
        id: "MANUAL_ADDRESS",
        title: "Enter Address",
      },
    ],
  });
}

module.exports = {
  sendText,
  sendButtons,
  sendList,
  sendTemplate, verifyWebhook, sendLocationOptions, enabled
};


