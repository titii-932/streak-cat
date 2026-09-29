(() => {
  const $ = id => document.getElementById(id);
  const pick = a => a[Math.floor(Math.random() * a.length)];

  const T = {
    sleep: ["Zzz... réveille-moi en te mettant au travail ♡", "Chut, je dors... un petit clic pour me réveiller ?", "Zzz... j'attends que tu t'y mettes ♡"],
    happy: ["Youpi, c'est noté pour aujourd'hui ♡", "Bravo toi, belle journée de travail !", "Un jour de plus, tu es trop forte ✧", "Continue comme ça, je suis fier de toi !"],
    sad: ["Tu n'as pas encore appuyé... je t'attends ♡", "Snif... j'ai besoin de ton clic aujourd'hui", "Ta streak est en danger, viens vite !"],
    dead: ["Je n'en peux plus... on recommence ensemble ?", "Plus de streak... je suis à bout... ♡"],
  };
  const NOTES = {
    'pass-gained': () => "Tu as gagné un Work Pass ! ★",
    'pass-used': n => n.count > 1 ? `${n.count} Work Pass ont protégé ta streak ★ Reprends aujourd'hui !` : "Un Work Pass a protégé ta streak hier ★ Reprends aujourd'hui !",
    'lost': () => "Je suis à bout... ta streak s'est arrêtée. On recommence ensemble ?",
  };
  const heart = '<svg viewBox="0 0 32 30"><path class="h" d="M16 28C4 19 2 12 2 8.5 2 4.5 5.5 2 9 2c3 0 5.5 1.7 7 4.2C17.5 3.7 20 2 23 2c3.5 0 7 2.5 7 6.5C30 12 28 19 16 28z"/></svg>';
  const star = '<svg viewBox="0 0 24 24"><path class="s" d="M12 2l3 6.5 7 .8-5.2 4.8 1.5 7L12 17.5 5.7 21.1l1.5-7L2 9.3l7-.8z"/></svg>';

  function spiral(cx, cy, R, turns) {
    let d = ''; const n = 46;
    for (let i = 0; i <= n; i++) { const t = i / n, a = t * turns * 2 * Math.PI, r = t * R; d += (i ? 'L' : 'M') + (cx + r * Math.cos(a)).toFixed(1) + ' ' + (cy + r * Math.sin(a)).toFixed(1) + ' '; }
    return d;
  }
  $('spL').setAttribute('d', spiral(72, 94, 12, 2.5));
  $('spR').setAttribute('d', spiral(128, 94, 12, 2.5));

  let last = { mood: null, noteKey: '', pressed: null, streak: null };

  function render(v, animate) {
    $('w').dataset.mood = v.mood;
    $('date').textContent = v.dateLabel;
    const n = $('num');
    n.textContent = v.streak;
    $('unit').textContent = v.streak > 1 ? 'jours' : 'jour';
    if (animate || (last.streak !== null && last.streak !== v.streak)) { n.classList.remove('bump'); void n.offsetWidth; n.classList.add('bump'); }

    const noteKey = v.note ? v.note.type + (v.note.count || '') : '';
    if (v.mood !== last.mood || noteKey !== last.noteKey || v.pressed !== last.pressed) {
      $('msg').textContent = v.note ? NOTES[v.note.type](v.note) : pick(T[v.mood]);
    }
    const k = v.streak % 7, filled = (v.streak > 0 && k === 0) ? 7 : k;
    $('week').innerHTML = Array.from({ length: 7 }, (_, i) => `<div class="dot ${i < filled ? 'on' : ''} ${i === 6 ? 'gift' : ''}">${heart}</div>`).join('');
    const b = $('btn');
    b.classList.toggle('done', v.pressed);
    b.disabled = v.pressed;
    b.textContent = v.pressed ? "Fait pour aujourd'hui ✓" : (v.mood === 'dead' ? 'Je recommence ♡' : "Je m'y mets ! ♡");
    $('tickets').innerHTML = Array.from({ length: v.maxPasses }, (_, i) => `<div class="tk ${i < v.passes ? 'on' : ''}">${star}</div>`).join('');
    $('passtxt').textContent = v.passes + ' / ' + v.maxPasses + (v.passes === v.maxPasses ? ' (max)' : '');
    last = { mood: v.mood, noteKey, pressed: v.pressed, streak: v.streak };
    requestAnimationFrame(() => window.api.resize(Math.ceil(document.body.scrollHeight)));
  }

  function confetti() {
    const c = $('confetti'), ch = ['♡', '✦', '★', '✧', '♡'], col = ['var(--main)', 'var(--sun)', 'var(--cheek)', 'var(--main2)'];
    for (let i = 0; i < 30; i++) {
      const e = document.createElement('i'); e.textContent = ch[i % ch.length]; e.style.color = col[i % col.length];
      e.style.setProperty('--x', (Math.random() * 300 - 150) + 'px'); e.style.setProperty('--y', (Math.random() * -260 - 20) + 'px');
      e.style.setProperty('--r', (Math.random() * 540 - 270) + 'deg'); e.style.fontSize = (14 + Math.random() * 14) + 'px';
      c.appendChild(e); setTimeout(() => e.remove(), 1300);
    }
  }

  $('btn').addEventListener('click', async () => {
    const res = await window.api.press();
    if (res.ok) {
      render(res.view, true); confetti();
      if (res.view.note && res.view.note.type === 'pass-gained') { const p = $('pass'); p.classList.remove('pop'); void p.offsetWidth; p.classList.add('pop'); }
    }
  });
  $('menu').addEventListener('click', () => window.api.menu());
  document.addEventListener('contextmenu', e => { e.preventDefault(); window.api.menu(); });

  window.api.onState(v => render(v, false));
  window.api.getState().then(v => render(v, false));
})();
