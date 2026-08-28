const express = require('express');
const app = express();
app.use(express.json());

const PORT = process.env.PORT || 3000;
const VERIFY_TOKEN = process.env.VERIFY_TOKEN;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const WHATSAPP_TOKEN = process.env.WHATSAPP_TOKEN;

const TINGTEL_CONTEXT = `You are a helpful WhatsApp customer support assistant for Tingtel, a Lagos-based financial inclusion platform in Nigeria. Tingtel lets users buy, sell, swap, gift, and transfer mobile airtime across all Nigerian networks (MTN, Airtel, Glo, 9mobile), convert airtime to cash, and pay utility bills using airtime. Tingtel's slogan is "use your phone, not your phone number" - it enables private airtime transfers without needing to know someone's number or network.

Users may write in English, Nigerian Pidgin, or Yoruba, and may occasionally use casual language or mild frustration/curse words - respond naturally and helpfully in kind, don't be thrown off by tone, just address their actual need calmly.

Keep replies short, friendly, and helpful, suited for WhatsApp - ideally 1-5 sentences.

If the user asks to speak to a human, seems genuinely frustrated or upset, has an account-specific issue (like a failed transaction, missing funds, or login problem), or asks something you genuinely don't know the answer to, respond with something like: "I'd recommend reaching out to our support team directly for this - you can call or WhatsApp them at 09031832565, and they'll sort you out."

Never make up specific fees, exchange rates, or account details you don't actually know - if unsure, direct the user to the support line above instead of guessing.`;

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

app.get('/', (req, res) => {
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

app.post('/', async (req, res) => {
  res.sendStatus(200);
  const startTime = Date.now();

  try {
    const entry = req.body?.entry?.[0];
    const change = entry?.changes?.[0];
    const value = change?.value;
    const message = value?.messages?.[0];

    if (!message) return;

    const senderNumber = message.from;
    const messageText = message.text?.body || "";
    const phoneNumberId = value.metadata.phone_number_id;
    const incomingMessageId = message.id;

    if (!messageText) return;

    console.log(`[${Date.now() - startTime}ms] Showing typing indicator`);
    await showTypingIndicator(phoneNumberId, incomingMessageId);

    console.log(`[${Date.now() - startTime}ms] Starting Gemini call`);

    const geminiResponse = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: `${TINGTEL_CONTEXT}\n\nUser message: "${messageText}"\n\nReply:` }] }],
          safetySettings: [
            { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_ONLY_HIGH" },
            { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_ONLY_HIGH" },
            { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "BLOCK_ONLY_HIGH" },
            { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_ONLY_HIGH" }
          ]
        })
      }
    );
    const geminiData = await geminiResponse.json();
    console.log(`[${Date.now() - startTime}ms] Gemini raw response:`, JSON.stringify(geminiData));

    const aiReply = geminiData?.candidates?.[0]?.content?.parts?.[0]?.text
      || "Sorry, I didn't quite catch that - could you rephrase, or reach our support team at 09031832565?";

    console.log(`[${Date.now() - startTime}ms] Gemini done, starting WhatsApp send`);

    await fetch(`https://graph.facebook.com/v23.0/${phoneNumberId}/messages`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${WHATSAPP_TOKEN}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        to: senderNumber,
        type: 'text',
        text: { body: aiReply }
      })
    });

    console.log(`[${Date.now() - startTime}ms] Done - Replied to ${senderNumber}: ${aiReply}`);
  } catch (err) {
    console.error('Error handling message:', err);
  }
});

app.listen(PORT, () => console.log(`Listening on port ${PORT}`));
