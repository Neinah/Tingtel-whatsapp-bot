const express = require('express');
const app = express();

app.set('trust proxy', 1);
app.use(express.json({
  limit: '100kb',
  verify: (req, res, buf) => {
    req.rawBody = buf;
  }
}));

app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  next();
});

app.use(express.static('public'));

app.get('/', (req, res) => res.send('OK'));

app.use('/webhook', require('./whatsapp'));
app.use('/chat', require('./chat'));
app.use('/admin', require('./admin'));

process.on('unhandledRejection', err => {
  console.error('Unhandled rejection:', err);
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Listening on port ${PORT}`));
