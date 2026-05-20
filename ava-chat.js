/* ============================================
   AvaAssistant — ava-chat.js
   ChatGPT-style chat with n8n webhook backend
   ============================================ */

// ============ FIREBASE INIT ============
const firebaseConfig = {
  apiKey: "AIzaSyDL5xzJ7wgTlUf6aVe-Wb83ryHzCzr5Y_g",
  authDomain: "avaassistant-188d7.firebaseapp.com",
  projectId: "avaassistant-188d7",
  storageBucket: "avaassistant-188d7.firebasestorage.app",
  messagingSenderId: "804180515719",
  appId: "1:804180515719:web:7329dede43c1da02ff9122",
  measurementId: "G-0DJDHH5JGH"
};
firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();

// Force local persistence to keep user logged in after refresh
auth.setPersistence(firebase.auth.Auth.Persistence.LOCAL).catch(e => console.error("Auth Persistence Error:", e));

const CONFIG = {
  CHAT_WEBHOOK_URL: 'https://n8n2.omelhorvendedoronline.com.br/webhook/ava-chat',
  LEAD_WEBHOOK_URL: 'https://n8n2.omelhorvendedoronline.com.br/webhook/ava-lead-capture',
  WEBHOOK_AUTH_HEADER: 'X-AVA-Auth',
  WEBHOOK_AUTH_VALUE: 'ava-sec-k8x9Qm7Zp3wR5nL2vJ6',
  MSG_COOLDOWN_MS: 3000,
};

let state = {
  // Use sessionStorage to keep the current conversation alive after a page refresh
  sessionId: sessionStorage.getItem('ava_session_id') || genId(),
  messages: JSON.parse(sessionStorage.getItem('ava_current_messages') || '[]'),
  isWaiting: false,
  sidebarOpen: window.innerWidth > 768,
  conversations: [],
};
// Ensure initial session is saved
if (!sessionStorage.getItem('ava_session_id')) {
  sessionStorage.setItem('ava_session_id', state.sessionId);
}

const $ = s => document.querySelector(s);
const $$ = s => document.querySelectorAll(s);

// DOM
const sidebar      = $('#sidebar');
const sidebarClose = $('#sidebarClose');
const sidebarOver  = $('#sidebarOverlay');
const menuBtn      = $('#menuBtn');
const newChatBtnSidebar = $('#newChatBtnSidebar');
const newChatBtnTopbar  = $('#newChatBtnTopbar');
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
  // Apply saved theme immediately
  const savedTheme = localStorage.getItem('ava_theme') || 'light';
  if (savedTheme === 'dark') {
    document.body.classList.add('dark-theme');
  }
  updateLogoTheme();

  // Frases rotativas apenas no título central
  const greetings = [
    'Me fala da sua empresa',
    'O que sua empresa faz atualmente?',
    'Qual é o principal objetivo da sua empresa hoje?',
    'Como funciona sua operação hoje?',
    'Qual é o maior desafio da sua empresa atualmente?',
  ];
  const welcomeEl = document.getElementById('welcomeGreeting');
  if (welcomeEl) welcomeEl.textContent = greetings[Math.floor(Math.random() * greetings.length)];

  initSidebar();
  initChat();
  initLeadModal();
  initLoginModal();
  initSettingsPanel();
  loadConversations();

  // Firebase Auth State Observer
  auth.onAuthStateChanged(user => {
    const loginBtnMore = document.getElementById('loginFromMoreBtn');
    const registerBtnMore = document.getElementById('registerFromMoreBtn');
    const logoutBtn = document.getElementById('logoutBtn');
    
    if (user) {
      document.body.classList.add('user-logged-in');
      if(loginBtnMore) loginBtnMore.style.display = 'none';
      if(registerBtnMore) registerBtnMore.style.display = 'none';
      if(logoutBtn) logoutBtn.style.display = 'flex';
      
      // Load history
      loadConversations();
      updateSettingsPanel(user);

      // If we have messages in state (from sessionStorage), render them
      if (state.messages.length > 0) {
        welcome.style.display = 'none';
        messagesEl.classList.add('active');
        messagesEl.innerHTML = '';
        state.messages.forEach(m => appendMsg(m.role, m.content, false));
        scrollDown();
      }
    } else {
      document.body.classList.remove('user-logged-in');
      if(loginBtnMore) loginBtnMore.style.display = 'flex';
      if(registerBtnMore) registerBtnMore.style.display = 'flex';
      if(logoutBtn) logoutBtn.style.display = 'none';
      
      // Only clear and start new chat if we don't have a temporary session in progress
      if (state.messages.length === 0) {
        state.conversations = [];
        startNewChat();
        renderHistory();
      } else {
        // Just render what we have in state
        renderHistory();
      }
      updateSettingsPanel(null);
    }
  });

  document.getElementById('logoutBtn')?.addEventListener('click', () => {
    auth.signOut().then(() => {
      document.getElementById('moreDropdown')?.classList.remove('active');
      sessionStorage.removeItem('ava_session_id');
      sessionStorage.removeItem('ava_current_messages');
    });
  });

  // Start with sidebar hidden on mobile
  if (window.innerWidth <= 768) {
    sidebar.classList.add('hidden');
    state.sidebarOpen = false;
  }

  // Model Dropdown Logic
  const brandBtn = document.getElementById('brandBtn');
  const modelDropdown = document.getElementById('modelDropdown');
  const currentModel = document.getElementById('currentModel');
  const modelOptions = document.querySelectorAll('.model-option');

  if (brandBtn && modelDropdown) {
    brandBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      modelDropdown.classList.toggle('show');
    });

    document.addEventListener('click', (e) => {
      if (!brandBtn.contains(e.target) && !modelDropdown.contains(e.target)) {
        modelDropdown.classList.remove('show');
      }
    });

    modelOptions.forEach(option => {
      option.addEventListener('click', () => {
        modelOptions.forEach(opt => opt.classList.remove('active'));
        option.classList.add('active');
        currentModel.textContent = option.dataset.model;
        modelDropdown.classList.remove('show');
      });
    });
  }

  // Prevent closing window if unauthenticated and has messages
  window.addEventListener('beforeunload', (e) => {
    if (!auth.currentUser && state.messages.length > 0) {
      e.preventDefault();
      const msg = 'Você tem conversas não salvas! Crie uma conta para não perder seu histórico.';
      e.returnValue = msg;
      return msg;
    }
  });
});

// ============ UTILS ============
function updateLogoTheme() {
  const isDark = document.body.classList.contains('dark-theme');
  const logos = document.querySelectorAll('.brand-logo');
  logos.forEach(img => {
    img.src = isDark ? 'images/logo_branca_cropped.png?v=5' : 'images/logo_preta_cropped.png?v=5';
  });
}

function genId() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return 'ava_' + crypto.randomUUID();
  }
  return 'ava_' + Date.now().toString(36) + '_' + Math.random().toString(36).substr(2, 6);
}

// ============ SIDEBAR ============
function initSidebar() {
  menuBtn?.addEventListener('click', toggleSidebar);
  sidebarClose?.addEventListener('click', closeSidebar);
  sidebarOver?.addEventListener('click', closeSidebar);
  
  const handleNewChat = (btn) => {
    if (btn) {
      btn.style.background = 'var(--bg-hover)';
      setTimeout(() => btn.style.background = '', 200);
    }
    startNewChat();
  };

  newChatBtnSidebar?.addEventListener('click', () => handleNewChat(newChatBtnSidebar));
  newChatBtnTopbar?.addEventListener('click', () => handleNewChat(newChatBtnTopbar));
}

function toggleSidebar() {
  if (state.sidebarOpen) {
    closeSidebar();
  } else {
    openSidebar();
  }
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
  sessionStorage.setItem('ava_session_id', state.sessionId);
  state.messages = [];
  sessionStorage.removeItem('ava_current_messages');
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
  if (auth.currentUser) {
    db.collection('users').doc(auth.currentUser.uid).collection('conversations')
      .orderBy('t', 'desc')
      .get()
      .then(snapshot => {
        state.conversations = [];
        snapshot.forEach(doc => {
          const data = doc.data();
          // Ensure sid is always present, prioritizing document ID
          data.sid = doc.id || data.sid;
          state.conversations.push(data);
        });
        renderHistory();
      })
      .catch(e => console.error("Error loading conversations:", e));
  } else {
    state.conversations = [];
    renderHistory();
  }
}

function saveConversation() {
  if (!state.messages.length) return;
  const first = state.messages.find(m => m.role === 'user');
  const title = first ? first.content.substring(0, 45) + (first.content.length > 45 ? '…' : '') : 'Nova conversa';
  const idx = state.conversations.findIndex(c => c.sid === state.sessionId);
  
  let conv;
  if (idx >= 0) {
    conv = { ...state.conversations[idx], title, msgs: state.messages, t: Date.now() };
    state.conversations[idx] = conv;
  } else {
    conv = { sid: state.sessionId, title, msgs: state.messages, t: Date.now(), archived: false };
    state.conversations.unshift(conv);
  }
  
  // Save to Cloud if logged in
  if (auth.currentUser) {
    db.collection('users').doc(auth.currentUser.uid).collection('conversations').doc(state.sessionId).set(conv)
      .catch(e => console.error("Error saving conversation:", e));
  }
  
  renderHistory();
}

function deleteChat(sid, e) {
  if (e) {
    e.preventDefault();
    e.stopPropagation();
  }
  
  if (!auth.currentUser) {
    alert('Você precisa criar uma conta ou entrar para excluir ou arquivar conversas.');
    openLoginModal('login');
    return;
  }
  
  if (!sid) {
    console.error("Tentativa de excluir chat sem ID (sid)");
    return;
  }

  if (!confirm('Excluir esta conversa permanentemente?')) return;
  
  try {
    // Delete from Firestore
    db.collection('users').doc(auth.currentUser.uid).collection('conversations').doc(sid).delete()
      .then(() => {
        console.log("Chat excluído do Firestore:", sid);
      })
      .catch(err => {
        console.error("Erro ao excluir do Firestore:", err);
        alert("Não foi possível excluir a conversa do servidor.");
      });
    
    // Update local state immediately for better UX
    state.conversations = state.conversations.filter(c => c.sid !== sid);
    
    if (state.sessionId === sid) {
      startNewChat();
    } else {
      renderHistory();
    }

    // Close any open menus
    document.querySelectorAll('.chat-options-menu').forEach(menu => menu.classList.remove('show'));

  } catch (err) {
    console.error("Erro fatal na função deleteChat:", err);
  }
}

function archiveChat(sid, e, isArchiving = true) {
  if (e) { e.stopPropagation(); }
  if (!auth.currentUser) {
    alert('Você precisa criar uma conta ou entrar para arquivar conversas.');
    openLoginModal('login');
    return;
  }
  const idx = state.conversations.findIndex(c => c.sid === sid);
  if (idx >= 0) {
    state.conversations[idx].archived = isArchiving;
    if (auth.currentUser) {
      db.collection('users').doc(auth.currentUser.uid).collection('conversations').doc(sid)
        .update({ archived: isArchiving })
        .catch(e => console.error("Error archiving chat:", e));
    }
    
    // Close the options menu if open
    document.querySelectorAll('.chat-options-menu').forEach(menu => menu.classList.remove('show'));
    renderHistory();
  }
}

function toggleOptionsMenu(sid, e) {
  if (e) { e.stopPropagation(); }
  // close all others
  document.querySelectorAll('.chat-options-menu').forEach(menu => {
    if (menu.id !== `options-menu-${sid}`) menu.classList.remove('show');
  });
  const menu = document.getElementById(`options-menu-${sid}`);
  if (menu) {
    menu.classList.toggle('show');
  }
}

// Global click to close chat options menu
document.addEventListener('click', (e) => {
  if (!e.target.closest('.chat-options-btn') && !e.target.closest('.chat-options-menu')) {
    document.querySelectorAll('.chat-options-menu').forEach(menu => menu.classList.remove('show'));
  }
});

function createHistoryItem(c) {
  const li = document.createElement('li');
  if (c.sid === state.sessionId) li.classList.add('active');
  li.addEventListener('click', () => loadConv(c.sid));
  
  const titleSpan = document.createElement('span');
  titleSpan.className = 'chat-title';
  titleSpan.textContent = c.title;
  li.appendChild(titleSpan);

  // Always show options button, but logic handles login requirement
  const btn = document.createElement('button');
  btn.className = 'chat-options-btn';
  btn.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/><circle cx="5" cy="12" r="1"/></svg>';
  btn.addEventListener('click', (e) => toggleOptionsMenu(c.sid, e));
  li.appendChild(btn);

  // Dropdown Menu
  const menu = document.createElement('div');
  menu.className = 'chat-options-menu';
  menu.id = `options-menu-${c.sid}`;
  
  // Archive/Unarchive Option
  const archiveOpt = document.createElement('button');
  archiveOpt.className = 'chat-option';
  if (c.archived) {
    archiveOpt.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 8v13H3V8M1 3h22v5H1z"/><polyline points="10 12 14 12"/></svg> Desarquivar';
    archiveOpt.addEventListener('click', (e) => archiveChat(c.sid, e, false));
  } else {
    archiveOpt.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 8v13H3V8M1 3h22v5H1z"/><polyline points="10 12 14 12"/></svg> Arquivar';
    archiveOpt.addEventListener('click', (e) => archiveChat(c.sid, e, true));
  }
  menu.appendChild(archiveOpt);

  // Delete Option
  const deleteOpt = document.createElement('button');
  deleteOpt.className = 'chat-option delete';
  deleteOpt.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg> Excluir';
  deleteOpt.addEventListener('click', (e) => deleteChat(c.sid, e));
  menu.appendChild(deleteOpt);

  li.appendChild(menu);

  return li;
}

function renderHistory() {
  const activeHistoryEl = document.getElementById('chatHistory');
  const archivedHistoryEl = document.getElementById('archivedHistory');
  const archivedContainer = document.getElementById('archivedHistoryContainer');
  
  if (activeHistoryEl) activeHistoryEl.innerHTML = '';
  if (archivedHistoryEl) archivedHistoryEl.innerHTML = '';
  
  let hasArchived = false;

  state.conversations.forEach(c => {
    const li = createHistoryItem(c);
    if (c.archived) {
      if (archivedHistoryEl) archivedHistoryEl.appendChild(li);
      hasArchived = true;
    } else {
      if (activeHistoryEl) activeHistoryEl.appendChild(li);
    }
  });

  if (archivedContainer) {
    archivedContainer.style.display = hasArchived ? 'block' : 'none';
  }
}

function loadConv(sid) {
  const conv = state.conversations.find(c => c.sid === sid);
  if (!conv) return;
  if (state.messages.length) saveConversation();
  state.sessionId = sid;
  sessionStorage.setItem('ava_session_id', state.sessionId);
  state.messages = [...conv.msgs];
  sessionStorage.setItem('ava_current_messages', JSON.stringify(state.messages));
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

  // Plus button opens file picker
  const fileInput = document.getElementById('fileInput');
  plusBtn.addEventListener('click', () => fileInput.click());
  fileInput.addEventListener('change', onFilesSelected);

  // Mobile focus improvement
  chatInput.addEventListener('focus', () => {
    if (window.innerWidth <= 768) {
      setTimeout(scrollDown, 300);
    }
  });
}

function toggleSendBtn() {
  const has = chatInput.value.trim().length > 0 || state.pendingFiles?.length > 0;
  sendBtn.style.display = has ? 'flex' : 'none';
  micBtn.style.display = has ? 'none' : 'flex';
  voiceBtn.style.display = has ? 'none' : 'inline-flex';
}

async function onSubmit(e) {
  e.preventDefault();
  const text = chatInput.value.trim();
  const files = state.pendingFiles || [];
  if ((!text && !files.length) || state.isWaiting) return;

  // Anti-spam cooldown
  const now = Date.now();
  if (state._lastSent && (now - state._lastSent) < CONFIG.MSG_COOLDOWN_MS) {
    return;
  }
  state._lastSent = now;

  welcome.style.display = 'none';
  messagesEl.classList.add('active');

  // Build display message
  let displayText = text;
  if (files.length) {
    const names = files.map(f => f.name).join(', ');
    displayText = (text ? text + '\n' : '') + `📎 ${names}`;
  }

  addMsg('user', displayText);
  chatInput.value = '';
  chatInput.style.height = 'auto';
  clearFilePreview();
  toggleSendBtn();

  state.isWaiting = true;
  const typing = showTyping();

  try {
    let body, headers = {};

    if (files.length) {
      // Converte todos os arquivos para base64 para máxima compatibilidade com n8n
      const fileDataArray = await Promise.all(files.map(f => fileToBase64(f)));

      headers['Content-Type'] = 'application/json';
      headers[CONFIG.WEBHOOK_AUTH_HEADER] = CONFIG.WEBHOOK_AUTH_VALUE;
      body = JSON.stringify({
        message: text,
        sessionId: state.sessionId,
        timestamp: new Date().toISOString(),
        history: state.messages.map(m => ({ role: m.role, content: m.content })),
        files: fileDataArray,
      });
    } else {
      headers['Content-Type'] = 'application/json';
      headers[CONFIG.WEBHOOK_AUTH_HEADER] = CONFIG.WEBHOOK_AUTH_VALUE;
      body = JSON.stringify({
        message: text,
        sessionId: state.sessionId,
        timestamp: new Date().toISOString(),
        history: state.messages.map(m => ({ role: m.role, content: m.content })),
      });
    }

    const res = await fetch(CONFIG.CHAT_WEBHOOK_URL, { method: 'POST', headers, body });

    // Lê a resposta como texto primeiro para evitar erro de parse JSON
    const rawText = await res.text();
    if (!res.ok) {
      console.error('Erro do servidor:', res.status, rawText);
      throw new Error(`HTTP ${res.status}: ${rawText.substring(0, 200)}`);
    }

    let data;
    try {
      data = JSON.parse(rawText);
    } catch {
      // Se não for JSON válido, usa o texto como resposta direta
      data = { reply: rawText };
    }

    removeTyping(typing);

    // n8n pode retornar array [{json:{...}}] ou objeto direto
    if (Array.isArray(data)) data = data[0]?.json || data[0] || {};

    let reply = data.reply || data.output || data.text || 'Desculpe, não consegui processar.';
    let shouldOpenLead = !!data.showLeadForm;

    // Fallback: detecta [LEAD_FORM] localmente caso o backend não tenha processado
    if (reply.includes('[LEAD_FORM]')) {
      shouldOpenLead = true;
      reply = reply.replace(/\[LEAD_FORM\]/g, '').trim();
    }

    if (shouldOpenLead) {
      setTimeout(() => openLeadModal(), 1500);
    }
    await addMsg('assistant', reply, true);
  } catch (err) {
    console.error('Erro no envio:', err);
    removeTyping(typing);
    await addMsg('assistant', '⚠️ Erro ao conectar com o servidor. Tente novamente.', false);
  } finally {
    state.isWaiting = false;
    chatInput.focus();
  }
}

async function addMsg(role, content, animate = false) {
  state.messages.push({ role, content, t: Date.now() });
  sessionStorage.setItem('ava_current_messages', JSON.stringify(state.messages));
  if (role === 'assistant' && animate) {
    await typewriterMsg(content);
  } else {
    appendMsg(role, content);
  }
  saveConversation();
}

function appendMsg(role, content) {
  const div = document.createElement('div');
  div.className = `msg ${role}`;
  
  const wrap = document.createElement('div');
  wrap.className = 'msg-content-wrap';
  
  const msgText = document.createElement('div');
  msgText.className = 'msg-text';
  msgText.innerHTML = md(content);
  
  wrap.appendChild(msgText);
  div.appendChild(wrap);
  
  // Actions
  if (role === 'assistant') {
    wrap.insertAdjacentHTML('beforeend', createMsgActionsHTML(content));
    bindMsgActions(div, content);
  } else if (role === 'user') {
    wrap.insertAdjacentHTML('beforeend', createUserMsgActionsHTML(content));
    bindMsgActions(div, content);
  }
  
  messagesEl.appendChild(div);
  scrollDown();
}

// Typewriter animation - animates smoothly the entire text
function typewriterMsg(content) {
  return new Promise((resolve) => {
    const div = document.createElement('div');
    div.className = 'msg assistant';

    const wrap = document.createElement('div');
    wrap.className = 'msg-content-wrap';
    const msgText = document.createElement('div');
    msgText.className = 'msg-text';
    
    const cursor = document.createElement('span');
    cursor.className = 'typing-cursor';
    
    wrap.appendChild(msgText);
    wrap.appendChild(cursor);
    div.appendChild(wrap);
    messagesEl.appendChild(div);
    scrollDown();

    const chars = Array.from(content);
    let i = 0;
    let displayed = '';
    
    // Dynamic chunk size: larger messages type faster so user doesn't wait forever
    const chunkSize = chars.length > 400 ? 4 : (chars.length > 200 ? 2 : 1);

    const interval = setInterval(() => {
      if (i >= chars.length) {
        clearInterval(interval);
        msgText.innerHTML = md(content);
        cursor.remove();
        wrap.insertAdjacentHTML('beforeend', createMsgActionsHTML(content));
        bindMsgActions(div, content);
        scrollDown();
        resolve();
        return;
      }

      for (let step = 0; step < chunkSize && i < chars.length; step++) {
        displayed += chars[i];
        i++;
      }

      msgText.innerHTML = md(displayed);
      messagesEl.scrollTop = messagesEl.scrollHeight;
    }, 15);
  });
}

function escapeHTML(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function md(text) {
  const safeText = escapeHTML(text);
  return '<p>' + safeText
    .replace(/```(\w*)\n?([\s\S]*?)```/g, '<pre><code>$2</code></pre>')
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/^[-•] (.+)$/gm, '<li>$1</li>')
    .replace(/\[(.+?)\]\((.+?)\)/g, (match, title, url) => {
      if (url.toLowerCase().trim().startsWith('javascript:')) return title;
      return `<a href="${url}" target="_blank">${title}</a>`;
    })
    .replace(/\n\n/g, '</p><p>')
    .replace(/\n/g, '<br>')
  + '</p>';
}

function showTyping() {
  const el = document.createElement('div');
  el.className = 'msg assistant';
  el.innerHTML = `
    <div class="msg-content-wrap">
      <div class="msg-text">
        <div class="typing-dots-wrapper">
          <div class="typing-dots"><span></span><span></span><span></span></div>
        </div>
      </div>
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
    status: 'new'
  };
  
  if (!d.name || !d.whatsapp) { alert('Por favor, preencha nome e WhatsApp.'); return; }

  const btn = $('#leadSubmitBtn');
  btn.disabled = true;
  btn.textContent = 'Enviando…';

  try {
    // 1. Envia para o Webhook do n8n primeiro
    try {
      await fetch(CONFIG.LEAD_WEBHOOK_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          [CONFIG.WEBHOOK_AUTH_HEADER]: CONFIG.WEBHOOK_AUTH_VALUE
        },
        body: JSON.stringify(d)
      });
    } catch (n8nErr) {
      console.warn('Erro não crítico ao enviar para n8n:', n8nErr);
    }

    // 2. Salva no Firebase Firestore (coleção 'leads')
    try {
      d.createdAt = firebase.firestore.FieldValue.serverTimestamp();
      await db.collection('leads').add(d);
    } catch (fsErr) {
      console.error('Erro de permissão/escrita no Firestore:', fsErr);
      // Se der erro de permissão no firebase, avisa o admin mas não trava o lead
      // pois ele pode ter ido pro n8n. Mas para ser robusto, vamos alertar.
      throw new Error("Erro de banco de dados (Firestore). Verifique as Security Rules.");
    }

    leadForm.style.display = 'none';
    leadSuccess.style.display = 'block';
    addMsg('assistant', `✅ **${d.name}**, recebemos sua solicitação! Entraremos em contato pelo WhatsApp **${d.whatsapp}** em breve.`);
  } catch (err) {
    console.error('Erro ao salvar lead:', err);
    alert('Erro ao enviar sua solicitação. Detalhes no console do navegador.');
  } finally {
    btn.disabled = false;
    btn.textContent = 'Solicitar Reunião';
  }
}

// ============ FILE UPLOAD ============
state.pendingFiles = [];

// Converte qualquer arquivo para base64
function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      resolve({
        name: file.name,
        type: file.type || 'application/octet-stream',
        size: file.size,
        data: reader.result, // data:image/jpeg;base64,....
      });
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function onFilesSelected(e) {
  const newFiles = Array.from(e.target.files);
  state.pendingFiles = [...(state.pendingFiles || []), ...newFiles];
  e.target.value = '';
  renderFilePreview();
  toggleSendBtn();
}

function renderFilePreview() {
  const strip = document.getElementById('filePreviewStrip');
  if (!state.pendingFiles.length) { strip.style.display = 'none'; strip.innerHTML = ''; return; }
  strip.style.display = 'flex';
  strip.innerHTML = '';
  state.pendingFiles.forEach((file, i) => {
    const chip = document.createElement('div');
    chip.className = 'file-chip';
    if (file.type.startsWith('image/')) {
      const img = document.createElement('img');
      img.className = 'file-chip-img';
      img.src = URL.createObjectURL(file);
      chip.appendChild(img);
    } else {
      const icon = document.createElement('span');
      icon.textContent = '📄';
      chip.appendChild(icon);
    }
    const name = document.createElement('span');
    name.textContent = file.name;
    chip.appendChild(name);
    const rm = document.createElement('button');
    rm.className = 'file-chip-remove';
    rm.innerHTML = '×';
    rm.onclick = () => { state.pendingFiles.splice(i, 1); renderFilePreview(); toggleSendBtn(); };
    chip.appendChild(rm);
    strip.appendChild(chip);
  });
}

function clearFilePreview() {
  state.pendingFiles = [];
  renderFilePreview();
}

// ============ VOICE / MIC ============
let recognition = null;
let isListening = false;

function initSpeech() {
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SpeechRecognition) return;
  recognition = new SpeechRecognition();
  recognition.lang = 'pt-BR';
  recognition.continuous = false;
  recognition.interimResults = false;
  recognition.onresult = (e) => {
    const transcript = e.results[0][0].transcript;
    chatInput.value += (chatInput.value ? ' ' : '') + transcript;
    chatInput.dispatchEvent(new Event('input'));
  };
  recognition.onend = () => {
    isListening = false;
    micBtn.style.background = '';
    voiceBtn.style.background = 'black';
  };
  micBtn.addEventListener('click', toggleListening);
  voiceBtn.addEventListener('click', toggleListening);
}

function toggleListening() {
  if (!recognition) { alert('Microfone não suportado neste navegador.'); return; }
  if (isListening) {
    recognition.stop();
  } else {
    recognition.start();
    isListening = true;
    micBtn.style.background = 'rgba(239,68,68,0.15)';
    voiceBtn.style.background = '#ef4444';
  }
}

// ============ SETTINGS PANEL ============
function updateSettingsPanel(user) {
  const accountInfo  = document.getElementById('settingsAccountInfo');
  const guestBtns    = document.getElementById('settingsGuestBtns');
  const userBtns     = document.getElementById('settingsUserBtns');
  const settingsName = document.getElementById('settingsName');
  const settingsEmail= document.getElementById('settingsEmail');
  const settingsAvatar = document.getElementById('settingsAvatar');
  const sidebarUserName = document.getElementById('sidebarUserName');

  if (user) {
    const displayName = user.displayName || user.email?.split('@')[0] || 'Usuário';
    const email = user.email || '';

    if (accountInfo)  { accountInfo.style.display = 'flex'; }
    if (guestBtns)    { guestBtns.style.display = 'none'; }
    if (userBtns)     { userBtns.style.display = 'block'; }
    if (settingsName) { settingsName.textContent = displayName; }
    if (settingsEmail){ settingsEmail.textContent = email; }
    if (sidebarUserName) { sidebarUserName.textContent = displayName; }

    if (settingsAvatar) {
      settingsAvatar.innerHTML = '';
      if (user.photoURL) {
        const img = document.createElement('img');
        img.src = user.photoURL;
        img.alt = displayName;
        settingsAvatar.appendChild(img);
      } else {
        settingsAvatar.textContent = displayName.charAt(0).toUpperCase();
      }
    }
  } else {
    if (accountInfo)  { accountInfo.style.display = 'none'; }
    if (guestBtns)    { guestBtns.style.display = 'block'; }
    if (userBtns)     { userBtns.style.display = 'none'; }
    if (sidebarUserName) { sidebarUserName.textContent = 'Configurações'; }
  }
}

function initSettingsPanel() {
  const settingsBtn      = document.getElementById('settingsBtn');
  const settingsPanel    = document.getElementById('settingsPanel');
  const themeToggleBtn   = document.getElementById('themeToggleBtn');
  const themeLabel       = document.getElementById('themeLabel');
  const settingsArchivedBtn = document.getElementById('settingsArchivedBtn');
  const settingsLoginBtn = document.getElementById('settingsLoginBtn');
  const settingsRegisterBtn = document.getElementById('settingsRegisterBtn');
  const settingsLogoutBtn = document.getElementById('settingsLogoutBtn');

  // Update theme label based on current state
  function updateThemeLabel() {
    const isDark = document.body.classList.contains('dark-theme');
    if (themeLabel) themeLabel.textContent = isDark ? 'Modo escuro' : 'Modo claro';
  }
  updateThemeLabel();

  // Toggle settings panel open/close
  settingsBtn?.addEventListener('click', (e) => {
    e.stopPropagation();
    settingsPanel?.classList.toggle('show');
  });

  // Close on outside click
  document.addEventListener('click', (e) => {
    if (!settingsBtn?.contains(e.target) && !settingsPanel?.contains(e.target)) {
      settingsPanel?.classList.remove('show');
    }
  });

  // Dark / Light mode toggle
  themeToggleBtn?.addEventListener('click', (e) => {
    e.stopPropagation();
    document.body.classList.toggle('dark-theme');
    const isDark = document.body.classList.contains('dark-theme');
    localStorage.setItem('ava_theme', isDark ? 'dark' : 'light');
    updateThemeLabel();
    updateLogoTheme();
  });

  // Go to archived chats
  settingsArchivedBtn?.addEventListener('click', () => {
    settingsPanel?.classList.remove('show');
    const archivedContainer = document.getElementById('archivedHistoryContainer');
    if (archivedContainer && archivedContainer.style.display !== 'none') {
      archivedContainer.scrollIntoView({ behavior: 'smooth', block: 'start' });
    } else {
      alert('Você não tem conversas arquivadas ainda.');
    }
  });

  // Login
  settingsLoginBtn?.addEventListener('click', () => {
    settingsPanel?.classList.remove('show');
    openLoginModal('login');
  });

  // Register
  settingsRegisterBtn?.addEventListener('click', () => {
    settingsPanel?.classList.remove('show');
    openLoginModal('register');
  });

  // Logout
  settingsLogoutBtn?.addEventListener('click', () => {
    settingsPanel?.classList.remove('show');
    auth.signOut().then(() => {
      sessionStorage.removeItem('ava_session_id');
      sessionStorage.removeItem('ava_current_messages');
    });
  });
}

// ============ MORE DROPDOWN ============
function initMoreDropdown() {
  const moreBtn = document.getElementById('moreBtn');
  const moreDropdown = document.getElementById('moreDropdown');
  const loginFromMoreBtn = document.getElementById('loginFromMoreBtn');
  const registerFromMoreBtn = document.getElementById('registerFromMoreBtn');
  const clearChatBtn = document.getElementById('clearChatBtn');

  moreBtn?.addEventListener('click', (e) => {
    e.stopPropagation();
    moreDropdown.classList.toggle('show');
  });
  document.addEventListener('click', (e) => {
    if (!moreBtn?.contains(e.target) && !moreDropdown?.contains(e.target)) {
      moreDropdown?.classList.remove('show');
    }
  });
  loginFromMoreBtn?.addEventListener('click', () => {
    moreDropdown.classList.remove('show');
    openLoginModal('login');
  });
  registerFromMoreBtn?.addEventListener('click', () => {
    moreDropdown.classList.remove('show');
    openLoginModal('register');
  });
  clearChatBtn?.addEventListener('click', () => {
    moreDropdown.classList.remove('show');
    if (confirm('Limpar todo o histórico de conversas?')) {
      state.conversations = [];
      localStorage.removeItem('ava_convs');
      startNewChat();
      if (chatHistory) chatHistory.innerHTML = '';
    }
  });
}

// ============ LOGIN MODAL ============
function initLoginModal() {
  const loginClose = document.getElementById('loginModalClose');
  const loginModal = document.getElementById('loginModalOverlay');
  const tabLogin = document.getElementById('tabLogin');
  const tabRegister = document.getElementById('tabRegister');
  const loginFormWrap = document.getElementById('loginFormWrap');
  const registerFormWrap = document.getElementById('registerFormWrap');
  const loginSuccess = document.getElementById('loginSuccess');
  const loginForm = document.getElementById('loginForm');
  const registerForm = document.getElementById('registerForm');
  const loginSubmit = document.getElementById('loginSubmitBtn');
  const registerSubmit = document.getElementById('registerSubmitBtn');

  loginClose?.addEventListener('click', closeLoginModal);
  loginModal?.addEventListener('click', e => { if (e.target === loginModal) closeLoginModal(); });
  document.addEventListener('keydown', e => { if (e.key === 'Escape') closeLoginModal(); });

  tabLogin?.addEventListener('click', () => {
    tabLogin.classList.add('active'); tabRegister.classList.remove('active');
    loginFormWrap.style.display = ''; registerFormWrap.style.display = 'none';
  });
  tabRegister?.addEventListener('click', () => {
    tabRegister.classList.add('active'); tabLogin.classList.remove('active');
    registerFormWrap.style.display = ''; loginFormWrap.style.display = 'none';
  });

  const googleBtn = document.getElementById('googleLoginBtn');
  googleBtn?.addEventListener('click', () => {
    const provider = new firebase.auth.GoogleAuthProvider();
    auth.signInWithPopup(provider)
      .then((result) => {
        loginFormWrap.style.display = 'none';
        registerFormWrap.style.display = 'none';
        loginSuccess.style.display = 'block';
        loginSuccess.innerHTML = '<p>✅ Login via Google efetuado com sucesso!</p>';
        setTimeout(closeLoginModal, 1500);
      })
      .catch((error) => {
        alert('Erro ao entrar com Google: ' + error.message);
      });
  });

  loginForm?.addEventListener('submit', (e) => {
    e.preventDefault();
    loginSubmit.disabled = true; loginSubmit.textContent = 'Entrando...';
    const email = document.getElementById('loginEmail').value.trim();
    const pass = document.getElementById('loginPassword').value;
    const errorMsg = document.getElementById('loginErrorMsg');
    errorMsg.style.display = 'none';

    auth.signInWithEmailAndPassword(email, pass)
      .then((userCredential) => {
        loginFormWrap.style.display = 'none';
        loginSuccess.style.display = 'block';
        loginSuccess.innerHTML = '<p>✅ Login efetuado com sucesso!</p>';
        setTimeout(closeLoginModal, 1500);
      })
      .catch((error) => {
        loginSubmit.disabled = false; loginSubmit.textContent = 'Entrar';
        errorMsg.style.display = 'block';
        if (error.code === 'auth/invalid-credential' || error.code === 'auth/wrong-password' || error.code === 'auth/user-not-found') {
          errorMsg.textContent = 'E-mail ou senha incorretos.';
        } else {
          console.error("Firebase Auth Error (Login):", error);
          errorMsg.textContent = 'Ocorreu um erro temporário ao tentar entrar. Por favor, tente novamente mais tarde.';
        }
      });
  });

  registerForm?.addEventListener('submit', (e) => {
    e.preventDefault();
    registerSubmit.disabled = true; registerSubmit.textContent = 'Criando conta...';
    const name = document.getElementById('registerName').value.trim();
    const email = document.getElementById('registerEmail').value.trim();
    const pass = document.getElementById('registerPassword').value;
    const errorMsg = document.getElementById('registerErrorMsg');
    errorMsg.style.display = 'none';

    auth.createUserWithEmailAndPassword(email, pass)
      .then((userCredential) => {
        // You can also update the user's display name if needed:
        // userCredential.user.updateProfile({ displayName: name });
        registerFormWrap.style.display = 'none';
        loginSuccess.style.display = 'block';
        loginSuccess.innerHTML = `<p>✅ Conta criada! Bem-vindo(a), <strong>${name}</strong>!</p>`;
        setTimeout(closeLoginModal, 1800);
      })
      .catch((error) => {
        registerSubmit.disabled = false; registerSubmit.textContent = 'Criar conta';
        errorMsg.style.display = 'block';
        if (error.code === 'auth/email-already-in-use') {
          errorMsg.textContent = 'Este e-mail já está em uso.';
        } else if (error.code === 'auth/weak-password') {
          errorMsg.textContent = 'A senha deve ter pelo menos 6 caracteres.';
        } else {
          console.error("Firebase Auth Error (Register):", error);
          errorMsg.textContent = 'Não foi possível criar sua conta neste momento. Por favor, tente novamente mais tarde.';
        }
      });
  });
}

function openLoginModal(tab = 'login') {
  const loginModal = document.getElementById('loginModalOverlay');
  const loginFormWrap = document.getElementById('loginFormWrap');
  const registerFormWrap = document.getElementById('registerFormWrap');
  const loginSuccess = document.getElementById('loginSuccess');
  const tabLogin = document.getElementById('tabLogin');
  const tabRegister = document.getElementById('tabRegister');
  const loginSubmit = document.getElementById('loginSubmitBtn');
  const registerSubmit = document.getElementById('registerSubmitBtn');

  loginModal.classList.add('active');
  loginSuccess.style.display = 'none';
  if (loginSubmit) { loginSubmit.disabled = false; loginSubmit.textContent = 'Entrar'; }
  if (registerSubmit) { registerSubmit.disabled = false; registerSubmit.textContent = 'Criar conta'; }

  if (tab === 'register') {
    tabRegister?.classList.add('active'); tabLogin?.classList.remove('active');
    registerFormWrap.style.display = ''; loginFormWrap.style.display = 'none';
  } else {
    tabLogin?.classList.add('active'); tabRegister?.classList.remove('active');
    loginFormWrap.style.display = ''; registerFormWrap.style.display = 'none';
  }
}

function closeLoginModal() {
  document.getElementById('loginModalOverlay')?.classList.remove('active');
}

// ============ MESSAGE ACTIONS ============
function createMsgActionsHTML(content) {
  return `<div class="msg-actions" style="display:flex;align-items:center;gap:4px;padding:2px 0;">
    <!-- COPIAR -->
    <button class="msg-action-btn" data-action="copy" style="background:none;border:none;cursor:pointer;padding:4px;border-radius:6px;" title="Copiar">
      <img src="images/icons/copiar.png" class="msg-action-icon" alt="Copiar">
    </button>
    <!-- THUMBS UP -->
    <button class="msg-action-btn" data-action="like" style="background:none;border:none;cursor:pointer;padding:4px;border-radius:6px;" title="Gostei">
      <img src="images/icons/like.png" class="msg-action-icon" alt="Gostei">
    </button>
    <!-- THUMBS DOWN -->
    <button class="msg-action-btn" data-action="dislike" style="background:none;border:none;cursor:pointer;padding:4px;border-radius:6px;" title="Não gostei">
      <img src="images/icons/deslike.png" class="msg-action-icon" alt="Não gostei">
    </button>
    <!-- COMPARTILHAR -->
    <button class="msg-action-btn" data-action="share" style="background:none;border:none;cursor:pointer;padding:4px;border-radius:6px;" title="Compartilhar">
      <img src="images/icons/compartilhar.png" class="msg-action-icon" alt="Compartilhar">
    </button>
    <!-- REGENERAR -->
    <button class="msg-action-btn" data-action="regenerate" style="background:none;border:none;cursor:pointer;padding:4px;border-radius:6px;" title="Regenerar">
      <img src="images/icons/tentarnovamente.png" class="msg-action-icon" alt="Regenerar">
    </button>
  </div>`;
}

function createUserMsgActionsHTML(content) {
  return `<div class="msg-actions" style="display:flex;align-items:center;gap:4px;padding:2px 0;">
    <!-- COPIAR -->
    <button class="msg-action-btn" data-action="copy" style="background:none;border:none;cursor:pointer;padding:4px;border-radius:6px;" title="Copiar">
      <img src="images/icons/copiar.png" class="msg-action-icon" alt="Copiar">
    </button>
  </div>`;
}


function bindMsgActions(msgDiv, content) {
  const actions = msgDiv.querySelectorAll('.msg-action-btn');
  actions.forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const action = btn.dataset.action;
      
      switch (action) {
        case 'speaker':
          handleSpeakerMsg(btn, content);
          break;
        case 'copy':
          handleCopyMsg(btn, content);
          break;
        case 'share':
          handleShareMsg(btn, content);
          break;
        case 'like':
          handleLikeMsg(btn);
          break;
        case 'dislike':
          handleDislikeMsg(btn);
          break;
        case 'regenerate':
          handleRegenerateMsg(msgDiv);
          break;
        case 'more':
          // Future: show more options dropdown
          break;
      }
    });
  });
}

let voices = [];
function loadVoices() {
    voices = window.speechSynthesis.getVoices();
}
if ('speechSynthesis' in window) {
    loadVoices();
    window.speechSynthesis.onvoiceschanged = loadVoices;
}

function resetAllSpeakerBtns() {
  document.querySelectorAll('.msg-action-btn[data-action="speaker"]').forEach(b => {
    b.innerHTML = `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon>
      <path d="M15.54 8.46a5 5 0 0 1 0 7.07"></path>
      <path d="M19.07 4.93a10 10 0 0 1 0 14.14"></path>
    </svg>`;
    b.dataset.tooltip = 'Narrar mensagem';
    b.dataset.playing = 'false';
    b.dataset.paused = 'false';
  });
}

function handleSpeakerMsg(btn, content) {
  if (!('speechSynthesis' in window)) {
    showFeedbackToast('Seu navegador não suporta leitura em voz alta.');
    return;
  }

  const isPlaying = btn.dataset.playing === 'true';
  const isPaused = btn.dataset.paused === 'true';

  if (isPlaying) {
    window.speechSynthesis.pause();
    btn.dataset.playing = 'false';
    btn.dataset.paused = 'true';
    btn.dataset.tooltip = 'Continuar narração';
    btn.innerHTML = `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <polygon points="5 3 19 12 5 21 5 3"></polygon>
    </svg>`;
    return;
  }

  if (isPaused) {
    window.speechSynthesis.resume();
    btn.dataset.playing = 'true';
    btn.dataset.paused = 'false';
    btn.dataset.tooltip = 'Pausar narração';
    btn.innerHTML = `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <rect x="6" y="4" width="4" height="16"></rect>
      <rect x="14" y="4" width="4" height="16"></rect>
    </svg>`;
    return;
  }

  window.speechSynthesis.cancel(); 
  resetAllSpeakerBtns();

  const textToRead = content.replace(/<[^>]+>/g, '').trim();
  const utterance = new SpeechSynthesisUtterance(textToRead);
  
  const preferredNames = ['Francisca', 'Google português do Brasil', 'Luciana', 'Vitoria', 'Maria'];
  let selectedVoice = null;
  
  for (const name of preferredNames) {
      selectedVoice = voices.find(v => v.lang.includes('pt-BR') && v.name.includes(name));
      if (selectedVoice) break;
  }
  if (!selectedVoice) selectedVoice = voices.find(v => v.lang.includes('pt-BR') && (v.name.includes('Female') || v.name.includes('Feminino')));
  if (!selectedVoice) selectedVoice = voices.find(v => v.lang.includes('pt-BR'));
  if (selectedVoice) utterance.voice = selectedVoice;
  
  utterance.lang = 'pt-BR';
  utterance.rate = 1.05; 
  utterance.pitch = 1.1; 

  utterance.onend = () => resetAllSpeakerBtns();
  utterance.onerror = () => resetAllSpeakerBtns();

  window.speechSynthesis.speak(utterance);
  
  btn.dataset.playing = 'true';
  btn.dataset.paused = 'false';
  btn.dataset.tooltip = 'Pausar narração';
  btn.innerHTML = `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <rect x="6" y="4" width="4" height="16"></rect>
    <rect x="14" y="4" width="4" height="16"></rect>
  </svg>`;
}

function handleCopyMsg(btn, content) {
  const showSuccess = () => {
    btn.classList.add('copied');
    btn.innerHTML = `<svg class="msg-action-icon" width="24" height="24" viewBox="-2 -2 28 28" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>`;
    showFeedbackToast('Texto copiado!');
    
    setTimeout(() => {
      btn.classList.remove('copied');
      btn.innerHTML = `<img src="images/icons/copiar.png" class="msg-action-icon" alt="Copiar">`;
    }, 2000);
  };

  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(content).then(showSuccess).catch(() => {
      fallbackCopy(content, showSuccess);
    });
  } else {
    fallbackCopy(content, showSuccess);
  }
}

function fallbackCopy(content, successCb) {
  const textarea = document.createElement('textarea');
  textarea.value = content;
  textarea.style.position = 'fixed';
  textarea.style.opacity = '0';
  document.body.appendChild(textarea);
  textarea.select();
  try {
    document.execCommand('copy');
    if (successCb) successCb();
  } catch(err) {
    console.error('Fallback copy error', err);
    showFeedbackToast('Erro ao copiar');
  } finally {
    document.body.removeChild(textarea);
  }
}

function handleShareMsg(btn, content) {
  if (navigator.share) {
    navigator.share({
      title: 'AVA Assistant',
      text: content,
    }).then(() => {
      // Shared successfully
    }).catch(console.error);
  } else {
    // Fallback if Web Share is not supported
    handleCopyMsg(btn, content);
    showFeedbackToast('Link copiado para compartilhamento!');
  }
}

function handleLikeMsg(btn) {
  const parent = btn.closest('.msg-actions');
  const dislikeBtn = parent.querySelector('[data-action="dislike"]');
  
  if (btn.classList.contains('liked')) {
    btn.classList.remove('liked');
    btn.setAttribute('aria-pressed', 'false');
  } else {
    btn.classList.add('liked');
    btn.setAttribute('aria-pressed', 'true');
    if (dislikeBtn) {
      dislikeBtn.classList.remove('disliked');
      dislikeBtn.setAttribute('aria-pressed', 'false');
    }
    showFeedbackToast('Obrigado pelo feedback! 👍');
  }
}

function handleDislikeMsg(btn) {
  const parent = btn.closest('.msg-actions');
  const likeBtn = parent.querySelector('[data-action="like"]');
  
  if (btn.classList.contains('disliked')) {
    btn.classList.remove('disliked');
    btn.setAttribute('aria-pressed', 'false');
  } else {
    btn.classList.add('disliked');
    btn.setAttribute('aria-pressed', 'true');
    if (likeBtn) {
      likeBtn.classList.remove('liked');
      likeBtn.setAttribute('aria-pressed', 'false');
    }
    showFeedbackToast('Feedback recebido. Vamos melhorar! 🙏');
  }
}

function handleRegenerateMsg(msgDiv) {
  // Find the last user message to re-send
  const userMsgs = state.messages.filter(m => m.role === 'user');
  if (!userMsgs.length || state.isWaiting) return;
  
  const lastUserMsg = userMsgs[userMsgs.length - 1].content;
  
  // Remove the last assistant message from state
  const lastAssistantIdx = state.messages.length - 1;
  if (state.messages[lastAssistantIdx]?.role === 'assistant') {
    state.messages.pop();
  }
  
  // Remove the message from DOM
  msgDiv.remove();
  
  // Re-send
  state.isWaiting = true;
  const typing = showTyping();
  
  fetch(CONFIG.CHAT_WEBHOOK_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      [CONFIG.WEBHOOK_AUTH_HEADER]: CONFIG.WEBHOOK_AUTH_VALUE,
    },
    body: JSON.stringify({
      message: `[Regenerar Resposta] Por favor, forneça uma resposta completamente diferente, com outra abordagem e novas palavras, para a minha mensagem: "${lastUserMsg}"`,
      sessionId: state.sessionId,
      timestamp: new Date().toISOString(),
      history: state.messages.map(m => ({ role: m.role, content: m.content })),
      regenerate: true,
    }),
  })
  .then(res => {
    if (!res.ok) throw new Error(res.status);
    return res.json();
  })
  .then(async data => {
    removeTyping(typing);
    const reply = data.reply || data.output || data.text || 'Desculpe, não consegui processar.';
    await addMsg('assistant', reply, true);
  })
  .catch(err => {
    console.error(err);
    removeTyping(typing);
    addMsg('assistant', '⚠️ Erro ao regenerar resposta. Tente novamente.', false);
  })
  .finally(() => {
    state.isWaiting = false;
    chatInput.focus();
  });
}

function showFeedbackToast(message) {
  // Remove existing toast
  document.querySelector('.feedback-toast')?.remove();
  
  const toast = document.createElement('div');
  toast.className = 'feedback-toast';
  toast.textContent = message;
  document.body.appendChild(toast);
  
  // Trigger animation
  requestAnimationFrame(() => {
    toast.classList.add('show');
  });
  
  setTimeout(() => {
    toast.classList.remove('show');
    setTimeout(() => toast.remove(), 300);
  }, 2000);
}

window.AvaAssistant = { openLeadModal, closeLeadModal, startNewChat };

// Init extra features after DOM ready
document.addEventListener('DOMContentLoaded', () => {
  initMoreDropdown();
  initSpeech();
});
