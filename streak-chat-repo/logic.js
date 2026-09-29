// Logique de la streak : aucune dépendance à Electron, testable seule.
const MAX_PASSES = 5;   // Work Pass stockables
const PASS_EVERY = 7;   // un Work Pass gagné tous les 7 jours de streak
const LATE_HOUR = 17;   // à partir de cette heure, le chat s'inquiète s'il n'a pas eu son clic

const pad = n => String(n).padStart(2, '0');
const dkey = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const parse = k => { const [y, m, d] = k.split('-').map(Number); return new Date(y, m - 1, d, 12); }; // midi : évite les soucis d'heure d'été
const addDays = (k, n) => { const d = parse(k); d.setDate(d.getDate() + n); return dkey(d); };

function defaultState() {
  return { streak: 0, best: 0, passes: 0, lastPressDate: null, resolvedUntil: null, lost: false, maxDateSeen: null, note: null };
}

// Date "effective" : on ne laisse jamais le temps reculer (protège contre un changement d'heure Windows).
function effectiveToday(state, now) {
  const t = dkey(now);
  if (state.maxDateSeen && t < state.maxDateSeen) return state.maxDateSeen;
  state.maxDateSeen = t;
  return t;
}

// Règle les jours passés sans clic : un Work Pass est consommé par jour raté, sinon la streak retombe à 0.
function resolve(state, today) {
  const yesterday = addDays(today, -1);
  if (!state.resolvedUntil) state.resolvedUntil = state.lastPressDate || yesterday;
  let guard = 0;
  while (state.resolvedUntil < yesterday && guard++ < 4000) {
    state.resolvedUntil = addDays(state.resolvedUntil, 1);
    if (state.streak > 0) {
      if (state.passes > 0) {
        state.passes--;
        const count = state.note && state.note.type === 'pass-used' && state.note.date === today ? state.note.count + 1 : 1;
        state.note = { date: today, type: 'pass-used', count };
      } else {
        state.streak = 0;
        state.lost = true;
        state.note = { date: today, type: 'lost' };
      }
    }
  }
  return state;
}

function press(state, now) {
  const today = effectiveToday(state, now);
  resolve(state, today);
  if (state.lastPressDate === today) return false;
  state.streak++;
  state.best = Math.max(state.best || 0, state.streak);
  state.lastPressDate = today;
  state.resolvedUntil = today;
  state.lost = false;
  state.note = null;
  if (state.streak % PASS_EVERY === 0 && state.passes < MAX_PASSES) {
    state.passes++;
    state.note = { date: today, type: 'pass-gained' };
  }
  return true;
}

function view(state, now) {
  const today = effectiveToday(state, now);
  resolve(state, today);
  const pressed = state.lastPressDate === today;
  let mood;
  if (pressed) mood = 'happy';
  else if (state.lost) mood = 'dead';
  else mood = now.getHours() >= LATE_HOUR ? 'sad' : 'sleep';
  return {
    streak: state.streak,
    passes: state.passes,
    maxPasses: MAX_PASSES,
    pressed,
    mood,
    note: state.note && state.note.date === today ? state.note : null,
    dateLabel: now.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'short' }),
  };
}

module.exports = { defaultState, press, view, resolve, effectiveToday, dkey, addDays, MAX_PASSES, PASS_EVERY, LATE_HOUR };
