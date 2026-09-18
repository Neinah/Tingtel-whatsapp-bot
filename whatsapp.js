const express = require('express');
const router = express.Router();
const { getAIReply } = require('./brain');

const VERIFY_TOKEN = process.env.VERIFY_TOKEN;
const WHATSAPP_TOKEN = process.env.WHATSAPP_TOKEN;

const rateLimitMap = new Map();
const RATE_LIMIT = 10;
const RATE_WINDOW_MS = 60 * 60 * 1000;

function isRateLimited(senderNumber) {
  const now = Date.now();
  const record = rateLimitMap.get(senderNumber) || { count: 0, windowStart: now };
  if (now - record.windowStart > RATE_WINDOW_MS) {
    rateLimitMap.set(senderNumber, { count: 1, windowStart: now });
    return false;
  }
  record.count += 1;
  rateLimitMap.set(senderNumber, record);
  return record.count > RATE_LIMIT;
}

async function showTypingIndicator(phoneNumberId, messageId) {
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
}

async function sendWhatsAppMessage(phoneNumberId, to, text) {
  const safeText = text.length > 4000 ? text.slice(0, 4000) + '...' : text;
  await fetch(`https://graph.facebook.com/v23.0/${phoneNumberId}/messages`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${WHATSAPP_TOKEN}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      to: to,
      type: 'text',
      text: { body: safeText }
    })
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

router.post('/', async (req, res) => {
  res.sendStatus(200);
  const startTime = Date.now();

  try {
    const entry = req.body?.entry?.[0];
    const change = entry?.changes?.[0];
    const value = change?.value;
    const message = value?.messages?.[0];

    if (!message) return;

    const senderNumber = message.from;
    const phoneNumberId = value.metadata.phone_number_id;
    const incomingMessageId = message.id;

    if (message.type !== 'text') {
      await showTypingIndicator(phoneNumberId, incomingMessageId);
      await sendWhatsAppMessage(
        phoneNumberId,
        senderNumber,
        "I can only read text messages right now - could you type out your question? For anything urgent, reach our support team at 09031832565."
      );
      return;
    }

    const messageText = message.text?.body || "";
    if (!messageText) return;

    if (isRateLimited(senderNumber)) {
      await sendWhatsAppMessage(
        phoneNumberId,
        senderNumber,
        "You've sent quite a few messages recently! Please wait a bit, or reach our support team directly at 09031832565 for urgent issues."
      );
      return;
    }

    await showTypingIndicator(phoneNumberId, incomingMessageId);
    const aiReply = await getAIReply(messageText);
    await sendWhatsAppMessage(phoneNumberId, senderNumber, aiReply);

    console.log(`[${Date.now() - startTime}ms] Done - Replied to ${senderNumber}: ${aiReply}`);
  } catch (err) {
    console.error('Error handling WhatsApp message:', err);
  }
});

module.exports = router;
