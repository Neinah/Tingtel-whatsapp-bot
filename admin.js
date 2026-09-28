const express = require('express');
const crypto = require('crypto');
const router = express.Router();
const { getMessages, wipeUpTo } = require('./db');
const { makeLimiter } = require('./limits');

const ADMIN_KEY = process.env.ADMIN_KEY;
const adminLimit = makeLimiter(30, 60 * 60 * 1000);
const MONTH_FORMAT = /^\d{4}-(0[1-9]|1[0-2])$/;

function authorized(req) {
  if (adminLimit(req.ip) !== 'ok') return false;
  const key = req.query.key;
  if (!ADMIN_KEY || typeof key !== 'string') return false;
  const a = Buffer.from(key);
  const b = Buffer.from(ADMIN_KEY);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

function csvCell(value) {
  let s = String(value ?? '');
  if (/^[=+\-@\t\r]/.test(s)) s = "'" + s;
  return '"' + s.replace(/"/g, '""') + '"';
}

router.get('/export', async (req, res) => {
  if (!authorized(req)) return res.sendStatus(403);
  const month = req.query.month;
  if (month && !MONTH_FORMAT.test(month)) {
    return res.status(400).send('month must look like 2026-09');
  }
  try {
    const rows = await getMessages(month);
    const header = ['time', 'platform', 'user', 'flagged', 'category', 'reason', 'customer_message', 'bot_reply'];
    const lines = [header.join(',')].concat(
      rows.map(r =>
        [r.time, r.platform, r.userId, r.flagged, r.category, r.reason, r.userText, r.botReply]
          .map(csvCell)
          .join(',')
      )
    );
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="tingtel-chats-${month || 'all'}.csv"`
    );
    res.send('\uFEFF' + lines.join('\n'));
  } catch (err) {
    console.error('Export failed:', err.message);
    res.status(500).send('Export failed');
  }
});

router.get('/wipe', async (req, res) => {
  if (!authorized(req)) return res.sendStatus(403);
  const month = req.query.month;
  if (!month || !MONTH_FORMAT.test(month)) {
    return res.status(400).send('Add &month=2026-09 (deletes that month and everything before it).');
  }
  if (req.query.confirm !== 'DELETE') {
    return res.status(400).send('Add &confirm=DELETE to confirm. Export first!');
  }
  try {
    res.json(await wipeUpTo(month));
  } catch (err) {
    console.error('Wipe failed:', err.message);
    res.status(500).send('Wipe failed');
  }
});

module.exports = router;
