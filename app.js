(() => {
  const $ = (s) => document.querySelector(s);
  const TABLES = [
    ...Array.from({ length: 8 }, (_, i) => ({ id: 'A' + (i + 1), seats: 1, label: 'Bureau' })),
    { id: 'B1', seats: 4, label: 'Table équipe', wide: true },
    { id: 'B2', seats: 4, label: 'Table équipe', wide: true },
    { id: 'C1', seats: 2, label: 'Salle calme' },
    { id: 'C2', seats: 2, label: 'Salle calme' },
  ];
  const KEY = 'atelier21.bookings';
  const OPEN = 8 * 60, CLOSE = 20 * 60, STEP = 30;

  // images
  document.querySelectorAll('.img-slot[data-img]').forEach((el) => {
    const src = window.IMAGES && window.IMAGES[el.dataset.img];
    if (!src) return;
    const img = new Image();
    img.onload = () => (el.style.backgroundImage = `url("${src}")`);
    img.src = src;
  });

  // storage
  const load = () => { try { return JSON.parse(localStorage.getItem(KEY)) || []; } catch { return []; } };
  const save = (b) => { try { localStorage.setItem(KEY, JSON.stringify(b)); } catch {} };
  // données de démo : quelques tables déjà prises pour que le plan ne soit pas vide
  const demo = (date) => {
    let h = 0; for (const c of date) h = (h * 31 + c.charCodeAt(0)) >>> 0;
    return ['A2', 'A5', 'B1', 'C2'].filter((_, i) => (h >> i) & 1)
      .map((t) => ({ table: t, date, from: 9 * 60, to: 13 * 60, demo: true }));
  };

  const fmt = (m) => String(Math.floor(m / 60)).padStart(2, '0') + ':' + String(m % 60).padStart(2, '0');
  const dateEl = $('#date'), startEl = $('#start'), endEl = $('#end');
  const today = new Date(); today.setMinutes(today.getMinutes() - today.getTimezoneOffset());
  dateEl.min = dateEl.value = today.toISOString().slice(0, 10);

  for (let m = OPEN; m < CLOSE; m += STEP) startEl.add(new Option(fmt(m), m));
  startEl.value = 9 * 60;
  const fillEnd = () => {
    const s = +startEl.value, prev = +endEl.value;
    endEl.innerHTML = '';
    for (let m = s + STEP; m <= CLOSE; m += STEP) endEl.add(new Option(fmt(m), m));
    endEl.value = prev > s && prev <= CLOSE ? prev : Math.min(s + 120, CLOSE);
  };
  fillEnd();

  let selected = null;
  const overlap = (b, d, s, e) => b.date === d && s < b.to && e > b.from;
  const taken = (id, d, s, e) => [...load(), ...demo(d)].some((b) => b.table === id && overlap(b, d, s, e));

  const setStep = (n) => document.querySelectorAll('.steps li').forEach((li) => {
    const k = +li.dataset.step; li.classList.toggle('on', k === n); li.classList.toggle('done', k < n);
  });

  function renderPlan() {
    const d = dateEl.value, s = +startEl.value, e = +endEl.value;
    const plan = $('#plan'); plan.innerHTML = '';
    if (selected && taken(selected, d, s, e)) { selected = null; }
    TABLES.forEach((t) => {
      const busy = taken(t.id, d, s, e);
      const b = document.createElement('button');
      b.type = 'button'; b.className = 'table' + (t.wide ? ' wide' : '');
      b.disabled = busy;
      b.setAttribute('aria-pressed', String(selected === t.id));
      b.setAttribute('aria-label', `Table ${t.id}, ${t.label}, ${t.seats} place${t.seats > 1 ? 's' : ''}, ${busy ? 'occupée' : 'libre'}`);
      b.innerHTML = `${t.id}<small>${busy ? 'Occupée' : t.seats + ' pl.'}</small>`;
      b.onclick = () => { selected = t.id; renderPlan(); };
      plan.append(b);
    });
    $('#form').hidden = !selected;
    setStep(selected ? 3 : 2);
    if (selected) {
      const t = TABLES.find((x) => x.id === selected);
      $('#summary').textContent = `Table ${t.id} (${t.label}) · ${new Date(d + 'T00:00').toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })} · ${fmt(s)}–${fmt(e)}`;
    }
  }

  startEl.onchange = () => { fillEnd(); renderPlan(); };
  endEl.onchange = dateEl.onchange = renderPlan;

  function renderMine() {
    const list = $('#mine-list'); list.innerHTML = '';
    const all = load();
    $('#mine-empty').hidden = all.length > 0;
    all.forEach((b, i) => {
      const li = document.createElement('li');
      li.innerHTML = `<span><strong>Table ${b.table}</strong> · ${b.date} · ${fmt(b.from)}–${fmt(b.to)}<br><small>${b.name.replace(/</g, '&lt;')}</small></span>`;
      const btn = document.createElement('button');
      btn.className = 'btn'; btn.textContent = 'Annuler';
      btn.setAttribute('aria-label', `Annuler la réservation de la table ${b.table} le ${b.date}`);
      btn.onclick = () => { const a = load(); a.splice(i, 1); save(a); renderMine(); renderPlan(); toast('Réservation annulée'); };
      li.append(btn); list.append(li);
    });
  }

  function toast(msg) {
    const t = $('#toast'); t.textContent = msg; t.classList.add('show');
    clearTimeout(toast.t); toast.t = setTimeout(() => t.classList.remove('show'), 3200);
  }

  $('#form').addEventListener('submit', (ev) => {
    ev.preventDefault();
    const name = $('#name'), email = $('#email');
    const nOk = name.value.trim().length >= 2;
    const eOk = /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email.value);
    $('#err-name').textContent = nOk ? '' : 'Indiquez votre nom (2 caractères minimum).';
    $('#err-email').textContent = eOk ? '' : 'Indiquez une adresse e-mail valide.';
    name.setAttribute('aria-invalid', String(!nOk)); email.setAttribute('aria-invalid', String(!eOk));
    if (!nOk) return name.focus();
    if (!eOk) return email.focus();
    const d = dateEl.value, s = +startEl.value, e = +endEl.value;
    if (taken(selected, d, s, e)) { toast('Cette table vient d\'être prise.'); return renderPlan(); }
    const all = load();
    all.push({ table: selected, date: d, from: s, to: e, name: name.value.trim(), email: email.value.trim() });
    save(all);
    toast(`Réservé : table ${selected}, ${fmt(s)}–${fmt(e)}. Confirmation envoyée (simulation).`);
    selected = null; ev.target.reset(); renderMine(); renderPlan(); setStep(1);
    $('#mes-reservations').scrollIntoView();
  });

  renderMine(); renderPlan(); setStep(2);
})();
