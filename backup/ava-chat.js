/* ============================================
   AvaAssistant — ava-chat.js
   ChatGPT-style chat with n8n webhook backend
   ============================================ */

const CONFIG = {
  CHAT_WEBHOOK_URL: 'https://n8n2.omelhorvendedoronline.com.br/webhook/ava-chat',
  LEAD_WEBHOOK_URL: 'https://n8n2.omelhorvendedoronline.com.br/webhook/ava-lead-capture',
};

let state = {
  sessionId: genId(),
  messages: [],
  isWaiting: false,
  sidebarOpen: window.innerWidth > 768,
  conversations: [],
};

const $ = s => document.querySelector(s);
const $$ = s => document.querySelectorAll(s);

// DOM
const sidebar      = $('#sidebar');
const sidebarClose = $('#sidebarClose');
const sidebarOver  = $('#sidebarOverlay');
const menuBtn      = $('#menuBtn');
const newChatBtn   = $('#newChatBtn');
const chatHistory  = $('#chatHistory');
const welcome      = $('#welcome');
const messagesEl   = $('#messages');
const chatScroll   = $('#chatScroll');
const chatForm     = $('#chatForm');
const chatInput    = $('#chatInput');
const sendBtn      = $('#sendBtn');
const micBtn       = $('#micBtn');
const voiceBtn     = $('#voiceBtn');
const plusBtn      = $('#plusBtn');
const leadModal    = $('#leadModal');
const modalClose   = $('#modalClose');
const leadForm     = $('#leadForm');
const leadSuccess  = $('#leadSuccess');
const closeSuccess = $('#closeSuccessBtn');

const loginBtn     = $('#loginBtn');
const loginModal   = $('#loginModalOverlay');
const loginClose   = $('#loginModalClose');
const loginForm    = $('#loginForm');
const loginSuccess = $('#loginSuccess');
const loginSubmit  = $('#loginSubmitBtn');

// ============ INIT ============
document.addEventListener('DOMContentLoaded', () => {
  initSidebar();
  initChat();
  initLeadModal();
  initLoginModal();
  loadConversations();

  // Start with sidebar hidden on mobile
  if (window.innerWidth <= 768) {
    sidebar.classList.add('hidden');
    state.sidebarOpen = false;
  }
});

// ============ UTILS ============
function genId() {
  return 'ava_' + Date.now().toString(36) + '_' + Math.random().toString(36).substr(2, 6);
}

// ============ SIDEBAR ============
function initSidebar() {
  menuBtn.addEventListener('click', openSidebar);
  sidebarClose.addEventListener('click', closeSidebar);
  sidebarOver.addEventListener('click', closeSidebar);
  newChatBtn.addEventListener('click', startNewChat);
}

function openSidebar() {
  sidebar.classList.remove('hidden');
  sidebarOver.classList.add('active');
  state.sidebarOpen = true;
}

function closeSidebar() {
  sidebar.classList.add('hidden');
  sidebarOver.classList.remove('active');
  state.sidebarOpen = false;
}

function startNewChat() {
  if (state.messages.length > 0) saveConversation();
  state.sessionId = genId();
  state.messages = [];
  state.isWaiting = false;
  messagesEl.innerHTML = '';
  messagesEl.classList.remove('active');
  welcome.style.display = 'flex';
  chatInput.value = '';
  toggleSendBtn();
  if (window.innerWidth <= 768) closeSidebar();
}

// ============ CONVERSATIONS ============
function loadConversations() {
  try {
    const s = localStorage.getItem('ava_convs');
    if (s) { state.conversations = JSON.parse(s); renderHistory(); }
  } catch (e) { /* ignore */ }
}

function saveConversation() {
  if (!state.messages.length) return;
  const first = state.messages.find(m => m.role === 'user');
  const title = first ? first.content.substring(0, 45) + (first.content.length > 45 ? '…' : '') : 'Nova conversa';
  const idx = state.conversations.findIndex(c => c.sid === state.sessionId);
  const conv = { sid: state.sessionId, title, msgs: state.messages, t: Date.now() };
  if (idx >= 0) state.conversations[idx] = conv;
  else state.conversations.unshift(conv);
  state.conversations = state.conversations.slice(0, 20);
  try { localStorage.setItem('ava_convs', JSON.stringify(state.conversations)); } catch (e) {}
  renderHistory();
}

function renderHistory() {
  chatHistory.innerHTML = '';
  state.conversations.forEach(c => {
    const li = document.createElement('li');
    li.textContent = c.title;
    if (c.sid === state.sessionId) li.classList.add('active');
    li.addEventListener('click', () => loadConv(c.sid));
    chatHistory.appendChild(li);
  });
}

function loadConv(sid) {
  const conv = state.conversations.find(c => c.sid === sid);
  if (!conv) return;
  if (state.messages.length) saveConversation();
  state.sessionId = sid;
  state.messages = [...conv.msgs];
  welcome.style.display = 'none';
  messagesEl.classList.add('active');
  messagesEl.innerHTML = '';
  state.messages.forEach(m => appendMsg(m.role, m.content, false));
  renderHistory();
  scrollDown();
  if (window.innerWidth <= 768) closeSidebar();
}

// ============ CHAT ============
function initChat() {
  chatForm.addEventListener('submit', onSubmit);

  chatInput.addEventListener('input', () => {
    chatInput.style.height = 'auto';
    chatInput.style.height = Math.min(chatInput.scrollHeight, 180) + 'px';
    toggleSendBtn();
  });

  chatInput.addEventListener('keydown', e => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (chatInput.value.trim() && !state.isWaiting) {
        chatForm.dispatchEvent(new Event('submit'));
      }
    }
  });

  // Plus button opens lead modal
  plusBtn.addEventListener('click', () => openLeadModal());
}

function toggleSendBtn() {
  const has = chatInput.value.trim().length > 0;
  sendBtn.style.display = has ? 'flex' : 'none';
  micBtn.style.display = has ? 'none' : 'flex';
  voiceBtn.style.display = has ? 'none' : 'inline-flex';
}

async function onSubmit(e) {
  e.preventDefault();
  const text = chatInput.value.trim();
  if (!text || state.isWaiting) return;

  welcome.style.display = 'none';
  messagesEl.classList.add('active');

  addMsg('user', text);
  chatInput.value = '';
  chatInput.style.height = 'auto';
  toggleSendBtn();

  state.isWaiting = true;
  const typing = showTyping();

  try {
    const res = await fetch(CONFIG.CHAT_WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: text,
        sessionId: state.sessionId,
        timestamp: new Date().toISOString(),
        history: state.messages.slice(-10).map(m => ({ role: m.role, content: m.content })),
      }),
    });
    if (!res.ok) throw new Error(res.status);
    const data = await res.json();
    removeTyping(typing);

    if (data.showLeadForm) openLeadModal();
    addMsg('assistant', data.reply || data.output || data.text || 'Desculpe, não consegui processar.');
  } catch (err) {
    console.error(err);
    removeTyping(typing);
    addMsg('assistant', '⚠️ Erro ao conectar com o servidor. Tente novamente.');
  } finally {
    state.isWaiting = false;
    chatInput.focus();
  }
}

function addMsg(role, content) {
  state.messages.push({ role, content, t: Date.now() });
  appendMsg(role, content, true);
  saveConversation();
}

function appendMsg(role, content, animate) {
  const div = document.createElement('div');
  div.className = `msg ${role}`;
  div.innerHTML = `<div class="msg-text">${md(content)}</div>`;
  messagesEl.appendChild(div);
  scrollDown();
}

function md(text) {
  return '<p>' + text
    .replace(/```(\w*)\n?([\s\S]*?)```/g, '<pre><code>$2</code></pre>')
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/^[-•] (.+)$/gm, '<li>$1</li>')
    .replace(/\[(.+?)\]\((.+?)\)/g, '<a href="$2" target="_blank">$1</a>')
    .replace(/\n\n/g, '</p><p>')
    .replace(/\n/g, '<br>')
  + '</p>';
}

function showTyping() {
  const el = document.createElement('div');
  el.className = 'msg assistant';
  el.innerHTML = `
    <div class="msg-text">
      <div class="typing-dots"><span></span><span></span><span></span></div>
    </div>`;
  messagesEl.appendChild(el);
  scrollDown();
  return el;
}

function removeTyping(el) {
  if (el?.parentNode) el.parentNode.removeChild(el);
}

function scrollDown() {
  requestAnimationFrame(() => { chatScroll.scrollTop = chatScroll.scrollHeight; });
}

// ============ LEAD MODAL ============
function initLeadModal() {
  modalClose.addEventListener('click', closeLeadModal);
  closeSuccess.addEventListener('click', closeLeadModal);
  leadModal.addEventListener('click', e => { if (e.target === leadModal) closeLeadModal(); });
  document.addEventListener('keydown', e => { if (e.key === 'Escape') closeLeadModal(); });
  leadForm.addEventListener('submit', onLeadSubmit);
}

function openLeadModal() {
  leadModal.classList.add('active');
  leadForm.style.display = 'block';
  leadSuccess.style.display = 'none';
  leadForm.reset();
}

function closeLeadModal() { leadModal.classList.remove('active'); }

async function onLeadSubmit(e) {
  e.preventDefault();
  const d = {
    name: $('#leadName').value.trim(),
    company: $('#leadCompany').value.trim(),
    whatsapp: $('#leadWhatsapp').value.trim(),
    email: $('#leadEmail').value.trim(),
    segment: $('#leadSegment').value,
    message: $('#leadMessage').value.trim(),
    source: 'ava-assistant',
    sessionId: state.sessionId,
    timestamp: new Date().toISOString(),
  };
  if (!d.name || !d.whatsapp) { alert('Preencha nome e WhatsApp.'); return; }

  const btn = $('#leadSubmitBtn');
  btn.disabled = true;
  btn.textContent = 'Enviando…';

  try {
    await fetch(CONFIG.LEAD_WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(d),
    });
    leadForm.style.display = 'none';
    leadSuccess.style.display = 'block';
    addMsg('assistant', `✅ **${d.name}**, recebemos sua solicitação! Entraremos em contato pelo WhatsApp **${d.whatsapp}** em breve.`);
  } catch (err) {
    alert('Erro ao enviar. Tente novamente.');
  } finally {
    btn.disabled = false;
    btn.textContent = 'Solicitar Reunião';
  }
}

// ============ LOGIN MODAL ============
function initLoginModal() {
  loginBtn.addEventListener('click', (e) => {
    e.preventDefault();
    openLoginModal();
  });
  loginClose.addEventListener('click', closeLoginModal);
  loginModal.addEventListener('click', e => { if (e.target === loginModal) closeLoginModal(); });
  document.addEventListener('keydown', e => { if (e.key === 'Escape') closeLoginModal(); });
  
  loginForm.addEventListener('submit', (e) => {
    e.preventDefault();
    loginSubmit.disabled = true;
    loginSubmit.textContent = 'Autenticando...';
    
    // Simulate API call for login/register
    setTimeout(() => {
      loginForm.style.display = 'none';
      loginSuccess.style.display = 'block';
      setTimeout(() => {
        closeLoginModal();
        loginBtn.textContent = 'Minha Conta';
      }, 1500);
    }, 1000);
  });
}

function openLoginModal() {
  loginModal.classList.add('active');
  loginForm.style.display = 'block';
  loginSuccess.style.display = 'none';
  loginForm.reset();
  loginSubmit.disabled = false;
  loginSubmit.textContent = 'Acessar';
}

function closeLoginModal() { 
  loginModal.classList.remove('active'); 
}

window.AvaAssistant = { openLeadModal, closeLeadModal, startNewChat };
