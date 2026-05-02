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
  initSidebar();
  initChat();
  initLeadModal();
  initLoginModal();
  loadConversations();

  // Firebase Auth State Observer
  auth.onAuthStateChanged(user => {
    const loginBtnMore = document.getElementById('loginFromMoreBtn');
    const registerBtnMore = document.getElementById('registerFromMoreBtn');
    const logoutBtn = document.getElementById('logoutBtn');
    
    if (user) {
      // User is logged in
      if(loginBtnMore) loginBtnMore.style.display = 'none';
      if(registerBtnMore) registerBtnMore.style.display = 'none';
      if(logoutBtn) logoutBtn.style.display = 'flex';
      loadConversations();
    } else {
      // User is logged out
      if(loginBtnMore) loginBtnMore.style.display = 'flex';
      if(registerBtnMore) registerBtnMore.style.display = 'flex';
      if(logoutBtn) logoutBtn.style.display = 'none';
      
      // Clear chats when logged out
      state.conversations = [];
      startNewChat();
      renderHistory();
    }
  });

  document.getElementById('logoutBtn')?.addEventListener('click', () => {
    auth.signOut().then(() => {
      document.getElementById('moreDropdown')?.classList.remove('active');
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
});

// ============ UTILS ============
function genId() {
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
  if (auth.currentUser) {
    db.collection('users').doc(auth.currentUser.uid).collection('conversations')
      .orderBy('t', 'desc')
      .get()
      .then(snapshot => {
        state.conversations = [];
        snapshot.forEach(doc => {
          state.conversations.push(doc.data());
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
  if (e) { e.stopPropagation(); }
  if (!confirm('Excluir esta conversa permanentemente?')) return;
  
  if (auth.currentUser) {
    db.collection('users').doc(auth.currentUser.uid).collection('conversations').doc(sid).delete()
      .catch(e => console.error("Error deleting chat:", e));
  }
  
  state.conversations = state.conversations.filter(c => c.sid !== sid);
  if (state.sessionId === sid) {
    startNewChat();
  } else {
    renderHistory();
  }
}

function archiveChat(sid, e, isArchiving = true) {
  if (e) { e.stopPropagation(); }
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

  // Only show options if logged in
  if (auth.currentUser) {
    // Options Button
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
  }
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
      // Use FormData when files are attached
      const fd = new FormData();
      fd.append('message', text);
      fd.append('sessionId', state.sessionId);
      fd.append('timestamp', new Date().toISOString());
      fd.append('history', JSON.stringify(state.messages.map(m => ({ role: m.role, content: m.content }))));
      files.forEach(f => fd.append('files', f));
      body = fd;
    } else {
      headers['Content-Type'] = 'application/json';
      body = JSON.stringify({
        message: text,
        sessionId: state.sessionId,
        timestamp: new Date().toISOString(),
        history: state.messages.map(m => ({ role: m.role, content: m.content })),
      });
    }

    const res = await fetch(CONFIG.CHAT_WEBHOOK_URL, { method: 'POST', headers, body });
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

// ============ FILE UPLOAD ============
state.pendingFiles = [];

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

window.AvaAssistant = { openLeadModal, closeLeadModal, startNewChat };

// Init extra features after DOM ready
document.addEventListener('DOMContentLoaded', () => {
  initMoreDropdown();
  initSpeech();
});
