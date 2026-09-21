(function() {
  const CHAT_ENDPOINT = 'https://tingtel-whatsapp-bot.onrender.com/chat';

  const style = document.createElement('style');
  style.textContent = `
    #tingtel-bubble {
      position: fixed; bottom: 20px; right: 20px;
      width: 60px; height: 60px; border-radius: 50%;
      background: #1e3a5f; color: white; display: flex;
      align-items: center; justify-content: center;
      cursor: pointer; box-shadow: 0 4px 12px rgba(0,0,0,0.2);
      z-index: 9999; font-size: 28px;
    }
    #tingtel-chat-window {
      position: fixed; bottom: 90px; right: 20px;
      width: 320px; height: 440px; background: white;
      border-radius: 16px; box-shadow: 0 8px 24px rgba(0,0,0,0.2);
      display: none; flex-direction: column; overflow: hidden;
      z-index: 9999; font-family: sans-serif;
    }
    #tingtel-chat-header {
      background: #1e3a5f; color: white; padding: 14px;
      font-weight: 600; font-size: 14px;
    }
    #tingtel-chat-messages {
      flex: 1; overflow-y: auto; padding: 12px;
      display: flex; flex-direction: column; gap: 8px;
    }
    .tingtel-msg { max-width: 80%; padding: 8px 12px; border-radius: 12px; font-size: 13px; line-height: 1.4; }
    .tingtel-msg.bot { background: #f2f2f7; align-self: flex-start; }
    .tingtel-msg.user { background: #1e3a5f; color: white; align-self: flex-end; }
    #tingtel-chat-input-row { display: flex; border-top: 1px solid #e5e7eb; }
    #tingtel-chat-input { flex: 1; border: none; padding: 12px; font-size: 13px; outline: none; }
    #tingtel-chat-send { background: #e8262a; color: white; border: none; padding: 0 16px; cursor: pointer; }
  `;
  document.head.appendChild(style);

  const bubble = document.createElement('div');
  bubble.id = 'tingtel-bubble';
  bubble.innerHTML = '💬';
  document.body.appendChild(bubble);

  const chatWindow = document.createElement('div');
  chatWindow.id = 'tingtel-chat-window';
  chatWindow.innerHTML = `
    <div id="tingtel-chat-header">Tingtel Support</div>
    <div id="tingtel-chat-messages"></div>
    <div id="tingtel-chat-input-row">
      <input id="tingtel-chat-input" type="text" placeholder="Type a message..." />
      <button id="tingtel-chat-send">Send</button>
    </div>
  `;
  document.body.appendChild(chatWindow);

  const messagesEl = document.getElementById('tingtel-chat-messages');
  const inputEl = document.getElementById('tingtel-chat-input');
  const sendBtn = document.getElementById('tingtel-chat-send');

  function addMessage(text, sender) {
    const msg = document.createElement('div');
    msg.className = `tingtel-msg ${sender}`;
    msg.textContent = text;
    messagesEl.appendChild(msg);
    messagesEl.scrollTop = messagesEl.scrollHeight;
  }

  bubble.addEventListener('click', () => {
    const isOpen = chatWindow.style.display === 'flex';
    chatWindow.style.display = isOpen ? 'none' : 'flex';
    if (!isOpen && messagesEl.children.length === 0) {
      addMessage("Hi! I'm Tingtel's assistant. How can I help you today?", 'bot');
    }
  });

  async function sendMessage() {
    const text = inputEl.value.trim();
    if (!text) return;
    addMessage(text, 'user');
    inputEl.value = '';

    try {
      const response = await fetch(CHAT_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text })
      });
      const data = await response.json();
      addMessage(data.reply || "Sorry, something went wrong.", 'bot');
    } catch (err) {
      addMessage("Sorry, I couldn't connect. Please try again.", 'bot');
    }
  }

  sendBtn.addEventListener('click', sendMessage);
  inputEl.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') sendMessage();
  });
})();
