const express = require('express');
const router = express.Router();
const { getAIReply } = require('./brain');
const { getHistory, saveExchange } = require('./db');
const { makeLimiter, makeUserQueue } = require('./limits');

const sessionLimit = makeLimiter(20, 60 * 60 * 1000);
const ipLimit = makeLimiter(120, 60 * 60 * 1000);
const runExclusive = makeUserQueue();

router.post('/', async (req, res) => {
  try {
    const { message, sessionId } = req.body || {};
    if (!message || typeof message !== 'string') {
      return res.status(400).json({ error: 'Missing "message" field' });
    }

    const text = message.trim().slice(0, 2000);
    if (!text) {
      return res.status(400).json({ error: 'Empty message' });
    }

    const validSession = typeof sessionId === 'string' && /^[A-Za-z0-9_-]{10,64}$/.test(sessionId);
    const userId = validSession ? `web_${sessionId}` : null;

    const ipBlocked = ipLimit(req.ip) !== 'ok';
    const sessionBlocked = validSession && sessionLimit(sessionId) !== 'ok';
    if (ipBlocked || sessionBlocked) {
      return res.status(429).json({
        reply: "You've sent a lot of messages in a short time. Please wait a while, or contact our support team at 09031832565."
      });
    }

    const work = async () => {
      const history = userId ? await getHistory(userId) : [];
      const { text: reply, tag, failed } = await getAIReply(text, history);
      res.json({ reply });
      await saveExchange({
        userId: userId || 'web_anonymous',
        platform: 'web',
        userText: text,
        botReply: reply,
        tag,
        history,
        remember: !failed && !!userId
      });
    };

    if (userId) {
      await runExclusive(userId, work);
    } else {
      await work();
    }
  } catch (err) {
    console.error('Error handling chat message:', err);
    if (!res.headersSent) {
      res.status(500).json({ error: 'Something went wrong' });
    }
  }
});

module.exports = router;
