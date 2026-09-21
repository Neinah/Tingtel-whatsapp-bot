const express = require('express');
const app = express();
app.use(express.json());

// Allow requests from any website (needed for the chat widget to work on other sites)
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

const whatsappRoutes = require('./whatsapp');
const chatRoutes = require('./chat');

app.use('/webhook', whatsappRoutes);
app.use('/chat', chatRoutes);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Listening on port ${PORT}`));
