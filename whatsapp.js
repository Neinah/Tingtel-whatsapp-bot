const express = require('express');
const crypto = require('crypto');
const router = express.Router();
const { getAIReply } = require('./brain');
const { getHistory, saveExchange } = require('./db');
const { makeLimiter, makeDeduper, makeUserQueue } = require('./limits');

const VERIFY_TOKEN = process.env.VERIFY_TOKEN;
const WHATSAPP_TOKEN = process.env.WHATSAPP_TOKEN;
const APP_SECRET = process.env.META_APP_SECRET;

if (!APP_SECRET) {
  console.warn('META_APP_SECRET is not set - webhook signatures are NOT being verified');
}

const userLimit = makeLimiter(10, 60 * 60 * 1000);
const isDuplicate = makeDeduper(60 * 60 * 1000);
const runExclusive = makeUserQueue();

function validSignature(req) {
  if (!APP_SECRET) return true;
  const header = req.get('x-hub-signature-256');
  if (!header || !req.rawBody) return false;
  const expected = 'sha256=' + crypto.createHmac('sha256', APP_SECRET).update(req.rawBody).digest('hex');
  const a = Buffer.from(header);
  const b = Buffer.from(expected);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

async function showTypingIndicator(phoneNumberId, messageId) {
  try {
    await fetch(`https://graph.facebook.com/v23.0/${phoneNumberId}/messages`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${WHATSAPP_TOKEN}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        status: 'read',
        message_id: messageId,
        typing_indicator: { type: 'text' }
      })
    });
  } catch (err) {
    console.log('Typing indicator failed:', err.message);
  }
}

async function sendWhatsAppMessage(phoneNumberId, to, text) {
  const safeText = text.length > 4000 ? text.slice(0, 4000) + '...' : text;
  const response = await fetch(`https://graph.facebook.com/v23.0/${phoneNumberId}/messages`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${WHATSAPP_TOKEN}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      to,
      type: 'text',
      text: { body: safeText }
    })
  });
  if (!response.ok) {
    console.error('WhatsApp send failed:', response.status, (await response.text()).slice(0, 300));
  }
}

async function handleWebhook(body) {
  const startTime = Date.now();
  const value = body?.entry?.[0]?.changes?.[0]?.value;
  const message = value?.messages?.[0];
  if (!message) return;

  if (isDuplicate(message.id)) {
    console.log('Duplicate delivery ignored:', message.id);
    return;
  }

  const senderNumber = message.from;
  const phoneNumberId = value.metadata.phone_number_id;
  const userId = `wa_${senderNumber}`;

  if (message.type !== 'text') {
    await showTypingIndicator(phoneNumberId, message.id);
    await sendWhatsAppMessage(
      phoneNumberId,
      senderNumber,
      'I can only read text messages right now - could you type out your question? For anything urgent, reach our support team at 09031832565.'
    );
    return;
  }

  const messageText = message.text?.body || '';
  if (!messageText) return;

  const limit = userLimit(senderNumber);
  if (limit === 'notify') {
    await sendWhatsAppMessage(
      phoneNumberId,
      senderNumber,
      "You've sent quite a few messages recently! Please wait a bit, or reach our support team directly at 09031832565 for urgent issues."
    );
    return;
  }
  if (limit === 'silent') return;

  await runExclusive(userId, async () => {
    const [, history] = await Promise.all([
      showTypingIndicator(phoneNumberId, message.id),
      getHistory(userId)
    ]);

    const { text, tag, failed } = await getAIReply(messageText, history);
    await sendWhatsAppMessage(phoneNumberId, senderNumber, text);

    await saveExchange({
      userId,
      platform: 'whatsapp',
      userText: messageText,
      botReply: text,
      tag,
      history,
      remember: !failed
    });

    console.log(`[${Date.now() - startTime}ms] Replied to ${senderNumber}`);
  });
}

router.get('/', (req, res) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  if (mode === 'subscribe' && token === VERIFY_TOKEN) {
    console.log('WEBHOOK VERIFIED');
    res.status(200).send(challenge);
  } else {
    res.sendStatus(403);
  }
});

router.post('/', (req, res) => {
  if (!validSignature(req)) {
    console.warn('Rejected webhook: invalid signature');
    return res.sendStatus(403);
  }
  res.sendStatus(200);
  handleWebhook(req.body).catch(err => console.error('Error handling WhatsApp message:', err));
});

module.exports = router;
