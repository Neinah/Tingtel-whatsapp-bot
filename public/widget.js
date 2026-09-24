(function() {
  const CHAT_ENDPOINT = 'https://tingtel-whatsapp-bot.onrender.com/chat';
  const LOGO_URL = 'https://tingtel-whatsapp-bot.onrender.com/logo.png';
  const PRIMARY_RED = '#E8262A';

  const style = document.createElement('style');
  style.textContent = `
    #tingtel-bubble {
      position: fixed; bottom: 20px; right: 20px;
      width: 64px; height: 64px; border-radius: 50%;
      background: white; display: flex; align-items: center; justify-content: center;
      cursor: pointer; box-shadow: 0 6px 16px rgba(0,0,0,0.25);
      z-index: 9999; border: 2px solid ${PRIMARY_RED};
    }
    #tingtel-bubble img { width: 40px; height: 40px; object-fit: contain; }
    #tingtel-chat-window {
      position: fixed; bottom: 96px; right: 20px;
      width: 400px; height: 620px; background: white;
      border-radius: 18px; box-shadow: 0 12px 32px rgba(0,0,0,0.25);
      display: none; flex-direction: column; overflow: hidden;
      z-index: 9999; font-family: -apple-system, sans-serif;
    }
    #tingtel-chat-header {
      background: ${PRIMARY_RED}; color: white; padding: 16px;
      display: flex; align-items: center; gap: 10px;
    }
    #tingtel-chat-header img { width: 28px; height: 28px; border-radius: 50%; background: white; padding: 3px; }
    #tingtel-chat-header span { font-weight: 600; font-size: 15px; }
    #tingtel-chat-close { margin-left: auto; cursor: pointer; font-size: 18px; opacity: 0.85; }
    #tingtel-home {
      flex: 1; display: flex; flex-direction: column; align-items: center;
      justify-content: center; padding: 24px; text-align: center; gap: 16px;
    }
    #tingtel-home img { width: 72px; height: 72px; object-fit: contain; }
    #tingtel-home p { font-size: 15px; color: #333; margin: 0; line-height: 1.5; }
    #tingtel-chat-messages {
      flex: 1; overflow-y: auto; padding: 14px;
      display: flex; flex-direction: column; gap: 10px;
    }
    .tingtel-row { display: flex; align-items: flex-end; gap: 8px; }
    .tingtel-row.user { justify-content: flex-end; }
    .tingtel-avatar { width: 26px; height: 26px; border-radius: 50%; background: white; border: 1px solid #eee; padding: 3px; flex-shrink: 0; }
    .tingtel-msg { max-width: 75%; padding: 10px 14px; border-radius: 14px; font-size: 13.5px; line-height: 1.45; }
    .tingtel-msg.bot { background: #f4f4f6; color: #222; border-bottom-left-radius: 4px; }
    .tingtel-msg.user { background: ${PRIMARY_RED}; color: white; border-bottom-right-radius: 4px; }
    .tingtel-typing { display: flex; gap: 4px; padding: 12px 14px; background: #f4f4f6; border-radius: 14px; border-bottom-left-radius: 4px; width: fit-content; }
    .tingtel-typing span { width: 6px; height: 6px; border-radius: 50%; background: #999; animation: tingtel-bounce 1.2s infinite ease-in-out; }
    .tingtel-typing span:nth-child(2) { animation-delay: 0.2s; }
    .tingtel-typing span:nth-child(3) { animation-delay: 0.4s; }
    @keyframes tingtel-bounce { 0%, 60%, 100% { transform: translateY(0); } 30% { transform: translateY(-5px); } }
    #tingtel-chat-input-row { display: flex; border-top: 1px solid #e5e7eb; padding: 8px; gap: 8px; }
    #tingtel-chat-input {
      flex: 1; border: 1px solid #e0e0e0; border-radius: 20px;
      padding: 10px 16px; font-size: 13.5px; outline: none;
    }
    #tingtel-chat-input:focus { border-color: ${PRIMARY_RED}; }
    #tingtel-chat-send {
      background: ${PRIMARY_RED}; color: white; border: none;
      width: 40px; height: 40px; border-radius: 50%; cursor: pointer;
      display: flex; align-items: center; justify-content: center; flex-shrink: 0;
      transition: transform 0.15s ease;
    }
    #tingtel-chat-send:active { transform: scale(0.9); }
    @media (max-width: 480px) {
      #tingtel-chat-window { width: calc(100vw - 24px); height: 70vh; right: 12px; bottom: 88px; }
      #tingtel-bubble { right: 16px; bottom: 16px; }
    }
  `;
  document.head.appendChild(style);

  const bubble = document.createElement('div');
  bubble.id = 'tingtel-bubble';
  bubble.innerHTML = `<img src="${LOGO_URL}" alt="Tingtel" />`;
  document.body.appendChild(bubble);

  const chatWindow = document.createElement('div');
  chatWindow.id = 'tingtel-chat-window';
  chatWindow.innerHTML = `
    <div id="tingtel-chat-header">
      <img src="${LOGO_URL}" alt="Tingtel" />
      <span>Tingtel AI Assistant</span>
      <div id="tingtel-chat-close">&times;</div>
    </div>
    <div id="tingtel-home">
      <img src="${LOGO_URL}" alt="Tingtel" />
      <p>Hello! How can I help you today?</p>
    </div>
    <div id="tingtel-chat-messages" style="display:none;"></div>
    <div id="tingtel-chat-input-row">
      <input id="tingtel-chat-input" type="text" placeholder="Type a message..." />
      <button id="tingtel-chat-send">&#10148;</button>
    </div>
  `;
  document.body.appendChild(chatWindow);

  const homeEl = document.getElementById('tingtel-home');
  const messagesEl = document.getElementById('tingtel-chat-messages');
  const inputEl = document.getElementById('tingtel-chat-input');
  const sendBtn = document.getElementById('tingtel-chat-send');
  const closeBtn = document.getElementById('tingtel-chat-close');

  let started = false;

  function addMessage(text, sender) {
    const row = document.createElement('div');
    row.className = `tingtel-row ${sender}`;
    if (sender === 'bot') {
      row.innerHTML = `<img class="tingtel-avatar" src="${LOGO_URL}" alt="" /><div class="tingtel-msg bot"></div>`;
      row.querySelector('.tingtel-msg').textContent = text;
    } else {
      row.innerHTML = `<div class="tingtel-msg user"></div>`;
      row.querySelector('.tingtel-msg').textContent = text;
    }
    messagesEl.appendChild(row);
    messagesEl.scrollTop = messagesEl.scrollHeight;
  }

  function showTyping() {
    const row = document.createElement('div');
    row.className = 'tingtel-row bot';
    row.id = 'tingtel-typing-row';
    row.innerHTML = `<img class="tingtel-avatar" src="${LOGO_URL}" alt="" /><div class="tingtel-typing"><span></span><span></span><span></span></div>`;
    messagesEl.appendChild(row);
    messagesEl.scrollTop = messagesEl.scrollHeight;
  }

  function hideTyping() {
    const row = document.getElementById('tingtel-typing-row');
    if (row) row.remove();
  }

  bubble.addEventListener('click', () => {
    chatWindow.style.display = chatWindow.style.display === 'flex' ? 'none' : 'flex';
  });

  closeBtn.addEventListener('click', () => {
    chatWindow.style.display = 'none';
  });

  async function sendMessage() {
    const text = inputEl.value.trim();
    if (!text) return;

    if (!started) {
      started = true;
      homeEl.style.display = 'none';
      messagesEl.style.display = 'flex';
    }

    addMessage(text, 'user');
    inputEl.value = '';
    showTyping();

    try {
      const response = await fetch(CHAT_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text })
      });
      const data = await response.json();
      hideTyping();
      addMessage(data.reply || "Sorry, something went wrong.", 'bot');
    } catch (err) {
      hideTyping();
      addMessage("Sorry, I couldn't connect. Please try again.", 'bot');
    }
  }

  sendBtn.addEventListener('click', sendMessage);
  inputEl.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') sendMessage();
  });
})();
