const { TINGTEL_CONTEXT } = require('./context');
const { makeDailyCap } = require('./limits');

const GROQ_API_KEY = process.env.GROQ_API_KEY;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

const FALLBACK_REPLY = "Sorry, I didn't quite catch that - could you rephrase, or reach our support team at 09031832565?";
const BUSY_REPLY = "We're getting a lot of messages right now. For anything urgent, please reach our support team at 09031832565.";

const overDailyCap = makeDailyCap(parseInt(process.env.DAILY_AI_CAP || '3000', 10));

const VALID_TAGS = [
  'none', 'failed_transfer', 'money_not_received', 'sell_airtime_issue',
  'login_pin', 'network_pin', 'rates_fees', 'app_bug', 'fraud_concern', 'other_complaint'
];
const TAG_REGEX = /\[\[\s*TAG\s*:\s*([A-Za-z_]+)\s*\]\]/g;

function parseReply(raw) {
  const matches = [...raw.matchAll(TAG_REGEX)];
  let tag = null;
  if (matches.length) {
    const found = matches[matches.length - 1][1].toLowerCase();
    tag = VALID_TAGS.includes(found) ? found : 'other_complaint';
  }
  const text = raw.replace(TAG_REGEX, '').trim();
  return { text, tag };
}

async function getAIReply(messageText, history = []) {
  if (overDailyCap()) {
    console.log('Daily AI cap reached');
    return { text: BUSY_REPLY, tag: null, failed: true };
  }

  const recent = history.slice(-10);

  try {
    const groqResponse = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${GROQ_API_KEY}`,
        'Content-Type': 'application/json'
      },
      signal: AbortSignal.timeout(15000),
      body: JSON.stringify({
        model: 'openai/gpt-oss-120b',
        messages: [
          { role: 'system', content: TINGTEL_CONTEXT },
          ...recent.map(m => ({ role: m.role, content: m.content })),
          { role: 'user', content: messageText }
        ],
        reasoning_effort: 'low',
        max_completion_tokens: 1000,
        temperature: 0.5
      })
    });
    const groqData = await groqResponse.json();
    const raw = groqData?.choices?.[0]?.message?.content;
    if (raw) {
      const parsed = parseReply(raw);
      if (parsed.text) return { ...parsed, failed: false };
    }
    console.log('Groq gave no usable reply:', JSON.stringify(groqData?.error || groqData).slice(0, 300));
  } catch (err) {
    console.log('Groq failed, falling back to Gemini:', err.message);
  }

  try {
    const geminiResponse = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: AbortSignal.timeout(25000),
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: TINGTEL_CONTEXT }] },
          contents: [
            ...recent.map(m => ({
              role: m.role === 'assistant' ? 'model' : 'user',
              parts: [{ text: m.content }]
            })),
            { role: 'user', parts: [{ text: messageText }] }
          ],
          safetySettings: [
            { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_ONLY_HIGH' },
            { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_ONLY_HIGH' },
            { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_ONLY_HIGH' },
            { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_ONLY_HIGH' }
          ]
        })
      }
    );
    const geminiData = await geminiResponse.json();
    const raw = geminiData?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (raw) {
      const parsed = parseReply(raw);
      if (parsed.text) return { ...parsed, failed: false };
    }
    console.log('Gemini gave no usable reply:', JSON.stringify(geminiData?.error || geminiData).slice(0, 300));
  } catch (err) {
    console.log('Gemini also failed:', err.message);
  }

  return { text: FALLBACK_REPLY, tag: null, failed: true };
}

module.exports = { getAIReply };
