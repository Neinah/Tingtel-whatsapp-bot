const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');

let db = null;
try {
  const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
  initializeApp({ credential: cert(serviceAccount) });
  db = getFirestore();
  console.log('Firestore connected');
} catch (err) {
  console.error('Firestore init failed, running without memory:', err.message);
}

const MAX_STORED = 20;
const SUPPORT_NUMBER = '09031832565';
const IDLE_DAYS = 30;

const COMPLAINT_KEYWORDS = [
  'refund', 'not received', "didn't receive", 'didnt receive', "haven't received",
  'havent received', 'never receive', 'not arrive', 'deducted', 'debited',
  'scam', 'fraud', 'stole', 'missing', 'not credited', 'no reach', 'never reach',
  'never enter', 'dem cut', 'money don go', 'reverse', 'stuck', 'wrong number', 'complain'
];

function classify(userText, botReply, tag) {
  if (tag && tag !== 'none') {
    return { flagged: true, category: tag, reason: 'ai tag' };
  }
  if (tag === null || tag === undefined) {
    const t = userText.toLowerCase();
    const hit = COMPLAINT_KEYWORDS.find(k => t.includes(k));
    if (hit) return { flagged: true, category: 'other_complaint', reason: `keyword: ${hit}` };
  }
  if (botReply.includes(SUPPORT_NUMBER)) {
    return { flagged: true, category: 'escalated', reason: 'escalated to support' };
  }
  return { flagged: false, category: 'none', reason: '' };
}

async function getHistory(userId) {
  if (!db) return [];
  try {
    const snap = await db.collection('conversations').doc(userId).get();
    if (!snap.exists) return [];
    return snap.data().messages || [];
  } catch (err) {
    console.error('Failed to load history:', err.message);
    return [];
  }
}

async function saveExchange({ userId, platform, userText, botReply, tag = null, history = [], remember = true }) {
  if (!db) return;
  try {
    const now = new Date();
    const cleanUser = String(userText).slice(0, 2000);
    const cleanBot = String(botReply).slice(0, 4000);
    const { flagged, category, reason } = classify(cleanUser, cleanBot, tag);

    const writes = [
      db.collection('messages').add({
        userId,
        platform,
        userText: cleanUser,
        botReply: cleanBot,
        flagged,
        category,
        reason,
        createdAt: now,
        month: now.toISOString().slice(0, 7)
      })
    ];

    if (remember) {
      const updated = [
        ...history,
        { role: 'user', content: cleanUser },
        { role: 'assistant', content: cleanBot }
      ].slice(-MAX_STORED);
      writes.push(
        db.collection('conversations').doc(userId).set({ platform, messages: updated, updatedAt: now })
      );
    }

    await Promise.all(writes);
  } catch (err) {
    console.error('Failed to save exchange:', err.message);
  }
}

async function getMessages(month) {
  if (!db) throw new Error('Database not connected');
  let query = db.collection('messages');
  if (month) query = query.where('month', '==', month);
  const snap = await query.get();
  const rows = snap.docs.map(d => {
    const x = d.data();
    return {
      time: x.createdAt?.toDate ? x.createdAt.toDate().toISOString() : '',
      platform: x.platform,
      userId: x.userId,
      flagged: x.flagged,
      category: x.category || '',
      reason: x.reason,
      userText: x.userText,
      botReply: x.botReply
    };
  });
  rows.sort((a, b) => a.time.localeCompare(b.time));
  return rows;
}

async function deleteQuery(makeQuery) {
  let deleted = 0;
  while (true) {
    const snap = await makeQuery().limit(400).get();
    if (snap.empty) break;
    const batch = db.batch();
    snap.docs.forEach(d => batch.delete(d.ref));
    await batch.commit();
    deleted += snap.size;
  }
  return deleted;
}

async function wipeUpTo(month) {
  if (!db) throw new Error('Database not connected');
  const messagesDeleted = await deleteQuery(() =>
    db.collection('messages').where('month', '<=', month)
  );
  const cutoff = new Date(Date.now() - IDLE_DAYS * 24 * 60 * 60 * 1000);
  const conversationsDeleted = await deleteQuery(() =>
    db.collection('conversations').where('updatedAt', '<', cutoff)
  );
  return { messagesDeleted, conversationsDeleted };
}

module.exports = { getHistory, saveExchange, getMessages, wipeUpTo };
