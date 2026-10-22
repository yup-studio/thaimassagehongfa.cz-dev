(() => {
  const D = window.HF_I18N, CFG = window.HF_FORM || {};
  const KEY = 'hongfa-lang';
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  let lang = 'cs';
  const t = k => (D[lang] && D[lang][k]) ?? D.cs[k] ?? '';

  // ---------- language ----------
  const pick = () => {
    try { const s = localStorage.getItem(KEY); if (s === 'cs' || s === 'en') return s; } catch (e) {}
    const langs = navigator.languages || [navigator.language || 'cs'];
    for (const l of langs) { const p = String(l).toLowerCase().slice(0, 2); if (p === 'cs' || p === 'sk') return 'cs'; if (p === 'en') return 'en'; }
    return 'cs';
  };
  const apply = l => {
    lang = l;
    document.documentElement.lang = l;
    document.querySelectorAll('[data-i18n]').forEach(el => { el.textContent = t(el.dataset.i18n); });
    document.querySelectorAll('[data-i18n-attr]').forEach(el => el.dataset.i18nAttr.split(';').forEach(p => { const [a, k] = p.split(':'); el.setAttribute(a, t(k)); }));
    document.title = t('seo.title');
    document.querySelector('meta[name=description]').setAttribute('content', t('seo.description'));
    document.querySelectorAll('[data-lang]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.lang === l)));
    revalidate();
  };
  document.querySelectorAll('[data-lang]').forEach(b => b.addEventListener('click', () => { try { localStorage.setItem(KEY, b.dataset.lang); } catch (e) {} apply(b.dataset.lang); }));

  // ---------- nav ----------
  const nav = document.getElementById('nav');
  const onScroll = () => nav.classList.toggle('solid', scrollY > 40);
  addEventListener('scroll', onScroll, { passive: true }); onScroll();
  const burger = nav.querySelector('.burger'), mnav = document.getElementById('mnav');
  const setMenu = open => {
    burger.setAttribute('aria-expanded', String(open)); mnav.hidden = !open;
    document.body.classList.toggle('menu-open', open);
    burger.setAttribute('aria-label', t(open ? 'ui.nav.close' : 'ui.nav.menu'));
  };
  burger.addEventListener('click', () => setMenu(mnav.hidden));
  mnav.addEventListener('click', e => { if (e.target.closest('a')) setMenu(false); });
  addEventListener('keydown', e => { if (e.key === 'Escape' && !mnav.hidden) setMenu(false); });

  // ---------- hero video: skip on reduced motion / save-data / slow network ----------
  const v = document.getElementById('hv');
  if (v) {
    const c = navigator.connection || {};
    const slow = c.saveData || /(^|-)2g$/.test(c.effectiveType || '');
    if (!reduce && !slow) {
      v.src = matchMedia('(max-width: 700px)').matches ? v.dataset.mobile : v.dataset.desktop;
      v.preload = 'auto';
      v.addEventListener('playing', () => v.classList.add('on'), { once: true });
      const p = v.play(); if (p && p.catch) p.catch(() => {});
    }
  }

  // ---------- scroll reveal ----------
  const els = document.querySelectorAll('.reveal');
  if (reduce || !('IntersectionObserver' in window)) els.forEach(e => e.classList.add('in'));
  else {
    const io = new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } }), { rootMargin: '0px 0px -8% 0px', threshold: 0.08 });
    els.forEach(e => io.observe(e));
  }

  // ---------- enquiry form ----------
  const f = document.getElementById('enq');
  const enabled = Boolean(CFG.endpoint);
  const status = document.getElementById('fstatus');
  const msg = f.elements.message, count = document.getElementById('count');
  let touched = false;
  const setErr = (name, key) => {
    const el = document.getElementById('e-' + name), input = f.elements[name];
    el.textContent = key ? t(key) : ''; input.setAttribute('aria-invalid', key ? 'true' : 'false');
    if (key) input.setAttribute('aria-describedby', 'e-' + name); else input.removeAttribute('aria-describedby');
    return !key;
  };
  function validate() {
    const name = f.elements.name.value.trim(), email = f.elements.email.value.trim(), phone = f.elements.phone.value.trim(), m = msg.value.trim();
    const ok = [
      setErr('name', name ? '' : 'ui.booking.required'),
      setErr('email', !email ? 'ui.booking.required' : /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email) ? '' : 'ui.booking.invalidEmail'),
      setErr('phone', !phone || /^\+?[0-9 ()-]{9,20}$/.test(phone) ? '' : 'ui.booking.invalidPhone'),
      setErr('message', !m ? 'ui.booking.required' : m.length > 256 ? 'ui.booking.tooLong' : '')
    ];
    return ok.every(Boolean);
  }
  function revalidate() { if (touched) validate(); if (status.dataset.key) status.textContent = t(status.dataset.key); }
  const setStatus = (key, kind) => { status.dataset.key = key || ''; status.className = 'status ' + (kind || ''); status.textContent = key ? t(key) : ''; };
  const upd = () => { count.textContent = msg.value.length + ' / 256'; count.classList.toggle('max', msg.value.length >= 256); };
  msg.addEventListener('input', upd); upd();
  f.addEventListener('input', () => { if (touched) validate(); });

  if (enabled && CFG.turnstileSiteKey) {
    const s = document.createElement('script'); s.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js'; s.async = true; s.defer = true; document.head.appendChild(s);
  }

  f.addEventListener('submit', async e => {
    e.preventDefault(); touched = true;
    if (!validate()) { f.querySelector('[aria-invalid=true]')?.focus(); return; }
    if (!enabled) { setStatus('ui.booking.unavailable', 'warn'); return; }
    if (f.elements.website.value) { setStatus('ui.booking.success', 'ok'); f.reset(); upd(); return; } // honeypot: silently drop
    const btn = f.querySelector('.submit'), label = btn.querySelector('[data-i18n]');
    btn.disabled = true; label.dataset.i18n = 'ui.booking.sending'; label.textContent = t('ui.booking.sending'); setStatus('', '');
    try {
      const body = { name: f.elements.name.value.trim(), email: f.elements.email.value.trim(), phone: f.elements.phone.value.trim(), message: msg.value.trim(), lang, profile: CFG.profile };
      const tk = f.querySelector('[name="cf-turnstile-response"]'); if (tk) body.turnstileToken = tk.value;
      const r = await fetch(CFG.endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      if (!r.ok) throw Error(String(r.status));
      setStatus('ui.booking.success', 'ok'); f.reset(); upd(); touched = false;
    } catch (err) {
      setStatus('ui.booking.error', 'bad');
    } finally {
      btn.disabled = false; label.dataset.i18n = 'ui.booking.submit'; label.textContent = t('ui.booking.submit');
      if (window.turnstile) try { window.turnstile.reset(); } catch (e) {}
    }
  });

  apply(pick());
})();
