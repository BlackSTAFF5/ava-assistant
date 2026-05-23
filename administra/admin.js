/* ============================================
   AvaCRM — admin.js
   Firebase Auth + Firestore Real-time Leads
   ============================================ */

// Firebase Config
const firebaseConfig = {
  apiKey: "AIzaSyDL5xzJ7wgTlUf6aVe-Wb83ryHzCzr5Y_g",
  authDomain: "avaassistant-188d7.firebaseapp.com",
  projectId: "avaassistant-188d7",
  storageBucket: "avaassistant-188d7.firebasestorage.app",
  messagingSenderId: "804180515719",
  appId: "1:804180515719:web:7329dede43c1da02ff9122",
};
firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();

let allLeads = [];
let unsubscribe = null;

// ============ TOAST ============
function showToast(msg, type = 'success') {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.className = 'toast ' + type + ' show';
  setTimeout(() => { t.classList.remove('show'); }, 3000);
}

// ============ ESCAPE HTML ============
function esc(str) {
  const d = document.createElement('div');
  d.textContent = str || '';
  return d.innerHTML;
}

// ============ SESSION TIMEOUT ============
let sessionTimer = null;
const SESSION_TIMEOUT_MS = 30 * 60 * 1000; // 30 min

function resetSessionTimer() {
  if (sessionTimer) clearTimeout(sessionTimer);
  sessionTimer = setTimeout(() => {
    showToast('Sessão expirada por inatividade.', 'error');
    auth.signOut();
  }, SESSION_TIMEOUT_MS);
}

document.addEventListener('click', resetSessionTimer);
document.addEventListener('keydown', resetSessionTimer);
document.addEventListener('mousemove', resetSessionTimer);

// ============ AUTH ============
auth.onAuthStateChanged(async (user) => {
  if (user) {
    try {
      const userDoc = await db.collection('users').doc(user.uid).get();
      if (userDoc.exists && userDoc.data().isAdmin === true) {
        document.getElementById('loginOverlay').style.display = 'none';
        document.getElementById('adminPanel').style.display = 'flex';
        startRealtimeLeads();
        showToast('Bem-vindo ao painel!');
        resetSessionTimer();
      } else {
        showToast('Acesso negado: conta sem privilégio de admin.', 'error');
        auth.signOut();
      }
    } catch (err) {
      console.error('Erro auth:', err);
      showToast('Erro ao verificar permissões.', 'error');
      auth.signOut();
    }
  } else {
    document.getElementById('loginOverlay').style.display = 'flex';
    document.getElementById('adminPanel').style.display = 'none';
    if (unsubscribe) { unsubscribe(); unsubscribe = null; }
    if (sessionTimer) { clearTimeout(sessionTimer); sessionTimer = null; }
  }
});

// Login Form
document.getElementById('loginForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const email = document.getElementById('adminEmail').value.trim();
  const pass = document.getElementById('adminPassword').value;
  const btn = document.getElementById('loginBtn');
  const err = document.getElementById('loginError');

  btn.disabled = true;
  btn.textContent = 'Autenticando...';
  err.style.display = 'none';

  try {
    await auth.signInWithEmailAndPassword(email, pass);
  } catch (error) {
    err.textContent = 'E-mail ou senha incorretos.';
    err.style.display = 'block';
    btn.disabled = false;
    btn.textContent = 'Entrar no Painel';
  }
});

// Logout
document.getElementById('logoutBtn').addEventListener('click', () => {
  auth.signOut();
  showToast('Sessão encerrada.');
});

// ============ REAL-TIME LEADS ============
function startRealtimeLeads() {
  showSkeleton();
  unsubscribe = db.collection('leads')
    .orderBy('timestamp', 'desc')
    .onSnapshot((snapshot) => {
      allLeads = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      renderLeads(allLeads);
      updateStats(allLeads);
    }, (err) => {
      console.error('Firestore error:', err);
      showToast('Erro ao carregar leads. Verifique as regras do Firestore.', 'error');
      renderEmpty('Erro ao carregar. Verifique permissões do Firestore.');
    });
}

// ============ SKELETON ============
function showSkeleton() {
  const tbody = document.getElementById('leadsTableBody');
  let rows = '';
  for (let i = 0; i < 5; i++) {
    rows += `<tr><td><div class="skeleton" style="width:120px;margin-bottom:6px"></div><div class="skeleton" style="width:80px;height:12px"></div></td><td><div class="skeleton" style="width:110px"></div></td><td><div class="skeleton" style="width:140px"></div></td><td><div class="skeleton" style="width:80px"></div></td><td><div class="skeleton" style="width:70px"></div></td><td><div class="skeleton" style="width:80px"></div></td><td><div class="skeleton" style="width:60px"></div></td></tr>`;
  }
  tbody.innerHTML = rows;
}

// ============ RENDER ============
function renderLeads(leads) {
  const tbody = document.getElementById('leadsTableBody');
  if (!leads.length) { renderEmpty(); return; }

  const statusLabels = { new: 'Novo', contacted: 'Contatado', meeting: 'Reunião', closed: 'Fechado' };

  tbody.innerHTML = leads.map(lead => {
    const st = lead.status || 'new';
    let date = '—';
    if (lead.timestamp) {
      const d = new Date(lead.timestamp);
      date = d.toLocaleDateString('pt-BR');
    }
    const phone = (lead.whatsapp || '').replace(/\D/g, '');

    return `<tr>
      <td><strong>${esc(lead.name)}</strong><br><small style="color:var(--text-muted)">${esc(lead.company || '—')}</small></td>
      <td><a href="https://wa.me/${phone}" target="_blank" rel="noopener noreferrer" class="wa-link">${esc(lead.whatsapp || '—')}</a></td>
      <td>${esc(lead.email || '—')}</td>
      <td><span class="segment-tag">${esc(lead.segment || '—')}</span></td>
      <td>${date}</td>
      <td><span class="badge ${st}">${statusLabels[st] || st}</span></td>
      <td style="display:flex;gap:8px;align-items:center">
        <select class="status-select" onchange="updateStatus('${lead.id}',this.value)">
          <option value="new" ${st==='new'?'selected':''}>Novo</option>
          <option value="contacted" ${st==='contacted'?'selected':''}>Contatado</option>
          <option value="meeting" ${st==='meeting'?'selected':''}>Reunião</option>
          <option value="closed" ${st==='closed'?'selected':''}>Fechado</option>
        </select>
        <button class="btn-delete" onclick="deleteLead('${lead.id}')" title="Excluir">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg>
        </button>
      </td>
    </tr>`;
  }).join('');
}

function renderEmpty() {
  document.getElementById('leadsTableBody').innerHTML = `<tr><td colspan="7"><div class="empty-state">
    <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" class="empty-icon"><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"></path><rect x="8" y="2" width="8" height="4" rx="1" ry="1"></rect><line x1="9" y1="14" x2="15" y2="14"></line><line x1="9" y1="18" x2="15" y2="18"></line><line x1="9" y1="10" x2="10" y2="10"></line></svg>
    <h3>Nenhum lead encontrado</h3>
    <p>Parece que ainda não temos leads cadastrados.</p>
  </div></td></tr>`;
}

// ============ UPDATE STATUS ============
async function updateStatus(id, status) {
  try {
    await db.collection('leads').doc(id).update({ status });
    showToast('Status atualizado!');
  } catch (err) {
    console.error(err);
    showToast('Erro ao atualizar status.', 'error');
  }
}

// ============ DELETE LEAD ============
async function deleteLead(id) {
  if (!confirm('Tem certeza que deseja excluir este lead?')) return;
  try {
    await db.collection('leads').doc(id).delete();
    showToast('Lead excluído.');
  } catch (err) {
    console.error(err);
    showToast('Erro ao excluir lead.', 'error');
  }
}

// ============ STATS ============
function updateStats(leads) {
  const today = new Date().toDateString();
  document.getElementById('statTotal').textContent = leads.length;
  document.getElementById('statNew').textContent = leads.filter(l => l.timestamp && new Date(l.timestamp).toDateString() === today).length;
  document.getElementById('statContacted').textContent = leads.filter(l => l.status === 'contacted').length;
  document.getElementById('statMeetings').textContent = leads.filter(l => l.status === 'meeting').length;
}

// ============ FILTERS ============
function filterLeads() {
  const search = document.getElementById('searchInput').value.toLowerCase();
  const segment = document.getElementById('segmentFilter').value;
  const status = document.getElementById('statusFilter').value;

  const filtered = allLeads.filter(l => {
    const matchSearch = !search || (l.name || '').toLowerCase().includes(search) || (l.company || '').toLowerCase().includes(search) || (l.whatsapp || '').includes(search);
    const matchSegment = !segment || l.segment === segment;
    const matchStatus = !status || (l.status || 'new') === status;
    return matchSearch && matchSegment && matchStatus;
  });

  renderLeads(filtered);
}

document.getElementById('searchInput').addEventListener('input', filterLeads);
document.getElementById('segmentFilter').addEventListener('change', filterLeads);
document.getElementById('statusFilter').addEventListener('change', filterLeads);
document.getElementById('refreshBtn').addEventListener('click', () => {
  const btn = document.getElementById('refreshBtn');
  btn.classList.add('loading');
  setTimeout(() => btn.classList.remove('loading'), 800);
  if (unsubscribe) { unsubscribe(); }
  startRealtimeLeads();
  showToast('Lista atualizada!');
});

// ============ THEME ============
function updateLogos() {
  const isDark = document.body.classList.contains('dark-theme');
  const src = isDark ? '../images/logo_white_v4.png' : '../images/logo_v4.png';
  document.querySelectorAll('.login-logo,.sidebar-logo').forEach(img => { img.src = src; });
  document.getElementById('themeLabel').textContent = isDark ? 'Modo claro' : 'Modo escuro';
}

document.getElementById('themeToggle').addEventListener('click', () => {
  document.body.classList.toggle('dark-theme');
  const isDark = document.body.classList.contains('dark-theme');
  localStorage.setItem('ava_theme', isDark ? 'dark' : 'light');
  updateLogos();
});

// Init theme
const savedTheme = localStorage.getItem('ava_theme') || 'dark';
if (savedTheme === 'dark') {
  document.body.classList.add('dark-theme');
} else {
  document.body.classList.remove('dark-theme');
}
updateLogos();
