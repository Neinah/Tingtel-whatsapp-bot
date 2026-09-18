const express = require('express');
const app = express();
app.use(express.json());

const whatsappRoutes = require('./whatsapp');
const chatRoutes = require('./chat');

app.use('/webhook', whatsappRoutes);
app.use('/chat', chatRoutes);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Listening on port ${PORT}`));
