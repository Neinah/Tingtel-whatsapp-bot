const express = require('express');
const router = express.Router();
const { getAIReply } = require('./brain');

router.post('/', async (req, res) => {
  try {
    const { message } = req.body;
    if (!message) {
      return res.status(400).json({ error: 'Missing "message" field' });
    }
    const aiReply = await getAIReply(message);
    res.json({ reply: aiReply });
  } catch (err) {
    console.error('Error handling chat message:', err);
    res.status(500).json({ error: 'Something went wrong' });
  }
});

module.exports = router;
