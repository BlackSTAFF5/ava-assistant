'use strict';

/* ─── NAV ─── */
const nav = document.getElementById('main-nav');
const navToggle = document.getElementById('nav-toggle');
const navLinks = document.getElementById('nav-links');

window.addEventListener('scroll', () => {
  nav.classList.toggle('scrolled', window.scrollY > 20);
}, { passive: true });

navToggle?.addEventListener('click', () => {
  const open = navLinks.classList.toggle('open');
  navToggle.setAttribute('aria-expanded', String(open));
  const [s1, s2, s3] = navToggle.querySelectorAll('span');
  if (open) {
    s1.style.transform = 'translateY(7px) rotate(45deg)';
    s2.style.opacity = '0';
    s3.style.transform = 'translateY(-7px) rotate(-45deg)';
  } else {
    s1.style.transform = s2.style.transform = s3.style.transform = '';
    s2.style.opacity = '';
  }
});

navLinks?.querySelectorAll('a').forEach(a => {
  a.addEventListener('click', () => {
    navLinks.classList.remove('open');
    navToggle.setAttribute('aria-expanded', 'false');
    navToggle.querySelectorAll('span').forEach(s => { s.style.transform = ''; s.style.opacity = ''; });
  });
});

/* ─── ACTIVE NAV LINK ─── */
(function () {
  const sections = document.querySelectorAll('section[id]');
  const links = document.querySelectorAll('.nav-link');
  const obs = new IntersectionObserver(entries => {
    entries.forEach(e => {
      if (e.isIntersecting) {
        const id = e.target.id;
        links.forEach(l => {
          l.style.color = l.getAttribute('href') === `#${id}` ? 'var(--orange)' : '';
        });
      }
    });
  }, { rootMargin: '-48% 0px -48% 0px' });
  sections.forEach(s => obs.observe(s));
})();

/* ─── SCROLL REVEAL ─── */
(function () {
  const reveals = document.querySelectorAll('.reveal');
  const obs = new IntersectionObserver(entries => {
    entries.forEach(e => {
      if (e.isIntersecting) {
        e.target.classList.add('visible');
        obs.unobserve(e.target);
      }
    });
  }, { threshold: 0.1, rootMargin: '0px 0px -32px 0px' });
  reveals.forEach(el => obs.observe(el));

  // Also observe step items (they use .visible directly)
  document.querySelectorAll('.step-item').forEach(el => obs.observe(el));
})();

/* ─── FORM ─── */
(function () {
  const form = document.getElementById('contact-form');
  if (!form) return;

  const fields = {
    'name-input':     { errId: 'name-error',     validate: v => v.trim().length >= 2,                           msg: 'Informe seu nome completo.' },
    'company-input':  { errId: 'company-error',   validate: v => v.trim().length >= 2,                           msg: 'Informe o nome da empresa.' },
    'whatsapp-input': { errId: 'whatsapp-error',  validate: v => /^\(?\d{2}\)?\s?\d{4,5}-?\d{4}$/.test(v.replace(/\s/g,'')), msg: 'Informe um WhatsApp válido.' },
    'segment-input':  { errId: 'segment-error',   validate: v => v !== '',                                        msg: 'Selecione o segmento.' },
  };

  const validate = (id, config) => {
    const input = document.getElementById(id);
    const errEl = document.getElementById(config.errId);
    if (!input || !errEl) return true;
    const ok = config.validate(input.value);
    input.classList.toggle('error', !ok);
    errEl.textContent = ok ? '' : config.msg;
    return ok;
  };

  Object.entries(fields).forEach(([id, cfg]) => {
    const el = document.getElementById(id);
    el?.addEventListener('blur', () => validate(id, cfg));
    el?.addEventListener('input', () => { if (el.classList.contains('error')) validate(id, cfg); });
  });

  // WhatsApp mask
  const wa = document.getElementById('whatsapp-input');
  wa?.addEventListener('input', e => {
    let v = e.target.value.replace(/\D/g, '').slice(0, 11);
    if (v.length > 2) v = `(${v.slice(0,2)}) ${v.slice(2)}`;
    if (v.length > 10) v = `${v.slice(0,9)}-${v.slice(9)}`;
    e.target.value = v;
  });

  form.addEventListener('submit', e => {
    e.preventDefault();
    const allOk = Object.entries(fields).every(([id, cfg]) => validate(id, cfg));
    if (!allOk) return;

    const btn = document.getElementById('form-submit-btn');
    const txt = document.getElementById('btn-text');
    const arr = document.getElementById('btn-arrow');
    btn.disabled = true;
    if (txt) txt.textContent = 'Enviando...';
    if (arr) arr.style.display = 'none';

    setTimeout(() => {
      form.style.display = 'none';
      const success = document.getElementById('form-success');
      if (success) { success.style.display = 'flex'; success.style.flexDirection = 'column'; success.style.alignItems = 'center'; }
    }, 1400);
  });
})();

/* ─── BUTTON TACTILE FEEDBACK ─── */
document.querySelectorAll('.btn-primary, .btn-ghost, .nav-cta').forEach(btn => {
  btn.addEventListener('mousedown', () => btn.style.transform = 'scale(0.97)');
  btn.addEventListener('mouseup',   () => btn.style.transform = '');
  btn.addEventListener('mouseleave',() => btn.style.transform = '');
});

/* ─── HERO CARDS STAGGER ─── */
(function () {
  const cards = document.querySelectorAll('.hero-card');
  cards.forEach((card, i) => {
    card.style.opacity = '0';
    card.style.transform = 'translateX(16px)';
    setTimeout(() => {
      card.style.transition = 'opacity 0.5s ease, transform 0.5s ease';
      card.style.opacity = '1';
      card.style.transform = '';
    }, 600 + i * 150);
  });
})();

/* ─── REDUCED MOTION ─── */
if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
  document.querySelectorAll('*').forEach(el => {
    el.style.animationDuration = '0.01ms';
    el.style.transitionDuration = '0.01ms';
  });
}
