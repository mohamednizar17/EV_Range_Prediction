// Chat widget (frontend) - calls backend /api/chat with password protection
(function(){
  const apiBase = window.CHAT_API_BASE || '/api/chat';
  const root = document.body;
  if (!root) return;
  const launcher = document.createElement('button');
  launcher.className = 'chat-launcher';
  launcher.textContent = '💬';
  launcher.title = 'EV Chat';
  launcher.setAttribute('aria-label','Open EV chat');
  const panel = document.createElement('div');
  panel.className = 'chat-panel hidden';
  panel.innerHTML = `
    <div class="chat-header"><span>EV Chat</span><button class="btn ghost" data-close>×</button></div>
    <div class="chat-body" data-body></div>
    <div class="chat-input">
      <input type="password" placeholder="Enter password to access chat..." data-input />
      <button data-send>Send</button>
    </div>`;
  root.appendChild(launcher); root.appendChild(panel);
  const body = panel.querySelector('[data-body]');
  const input = panel.querySelector('[data-input]');
  const sendBtn = panel.querySelector('[data-send]');
  const closeBtn = panel.querySelector('[data-close]');
  const history = [];
  let authenticated = false;

  function add(role, text){
    const div = document.createElement('div');
    div.className = 'chat-msg ' + role;
    div.textContent = text;
    body.appendChild(div);
    body.scrollTop = body.scrollHeight;
  }

  function toggle(){ 
    panel.classList.toggle('hidden'); 
    if(!panel.classList.contains('hidden')){ 
      input.focus(); 
      if(!history.length && !authenticated) {
        add('bot','🔐 Please enter the password to access the chat.');
      }
    }
  }

  launcher.addEventListener('click', toggle);
  closeBtn.addEventListener('click', toggle);

  async function send(){
    const text = String(input.value||'').trim(); 
    if(!text) return; 
    input.value=''; 
    
    // If not authenticated, treat input as password attempt
    if (!authenticated) {
      add('user', '🔒 Password attempt');
      try {
        const payload = { password: text, messages: [] };
        const resp = await fetch(apiBase, { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(payload) });
        if (resp.status === 401) {
          add('bot', '❌ Incorrect password. Try again.');
          return;
        }
        if (!resp.ok) {
          throw new Error('Auth error');
        }
        // Password correct!
        authenticated = true;
        add('bot', '✅ Password correct! Now you can ask about EVs.');
        input.type = 'text';
        input.placeholder = 'Ask about batteries, range, charging...';
        body.scrollTop = body.scrollHeight;
      } catch (e) {
        console.error(e);
        add('bot', '❌ Error verifying password. Try again.');
      }
      return;
    }

    // User is authenticated, proceed with normal chat
    add('user', text); 
    history.push({ role:'user', content:text });
    const loadingDiv = document.createElement('div');
    loadingDiv.className = 'chat-msg bot loading';
    loadingDiv.textContent = '...';
    body.appendChild(loadingDiv);
    body.scrollTop = body.scrollHeight;
    try {
      const payload = { messages: history.slice(-12) }; // No password needed - backend uses session
      const resp = await fetch(apiBase, { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(payload) });
      if(!resp.ok){ const t = await resp.text(); throw new Error(t); }
      const data = await resp.json();
      const reply = data.reply || 'No response';
      history.push({ role:'assistant', content: reply });
      body.removeChild(loadingDiv);
      add('bot', reply);
    } catch(e){
      console.error(e);
      const msg = (e && e.message) ? e.message : String(e||'');
      body.removeChild(loadingDiv);
      add('bot', 'Error talking to backend: ' + msg.slice(0,180));
    }
  }
  sendBtn.addEventListener('click', send);
  input.addEventListener('keydown', e => { if(e.key==='Enter') send(); });
})();
/* EV Range Lab - client-side physics-informed estimator + suggestions */
(function () {
  'use strict';

  // DOM helpers
  const $ = (sel) => document.querySelector(sel);
  const $$ = (sel) => Array.from(document.querySelectorAll(sel));
  // Text normalization for robust search (case/diacritics/punctuation-insensitive)
  function normalizeText(s) {
    return String(s || '')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, ' ')
      .trim();
  }

  // Elements
  const form = $('#rangeForm');
  const resetBtn = $('#resetBtn');
  const randomizeBtn = $('#randomizeBtn');
  const suggestionsEl = $('#suggestions');
  const rangeKmEl = $('#rangeKm');
  const rangeMiEl = $('#rangeMi');
  const effKmPerKwhEl = $('#effKmPerKwh');
  const effWhPerKmEl = $('#effWhPerKm');
  const effKwhPer100El = $('#effKwhPer100');
  const gaugeValEl = $('#rangeGaugeValue');
  const gaugeEl = $('#rangeGauge');
  const badgesEl = $('#factorsBadges');
  const exportLink = $('#exportLink');
  const importLink = $('#importLink');
  const shareLink = $('#shareLink');
  const searchInput = $('#searchInput');
  const compareCountEl = $('#compareCount');
  const compareBtn = $('#compareBtn');
  const clearCompareBtn = $('#clearCompareBtn');
  const compareSection = $('#compareSection');
  const hideCompareBtn = $('#hideCompareBtn');
  const compareTable = $('#compareTable');
  const mode = document.body?.dataset?.mode || 'index';
  // Extra feature elements removed per request

  // Default values
  const defaults = {
    capacity: 60,
    voltage: 400,
    chemistry: 'NMC',
    cellType: 'prismatic',
    mass: 1900,
    cd: 0.24,
    frontalArea: 2.4,
    drivetrain: 'RWD',
    tires: 'eco',
    temperature: 20,
    minPrice: 800000,
  maxPrice: 7500000,
  };

  // Load dataset - try local first, fallback to backend
  let EV_DATA = [];
  async function loadEVData() {
    try {
      const r = await fetch('data/evs.json');
      if (r.ok) {
        EV_DATA = await r.json();
      } else {
        throw new Error('Local fetch failed');
      }
    } catch (e1) {
      // Fallback to backend
      try {
        const backendUrl = window.CHAT_API_BASE ? window.CHAT_API_BASE.replace('/api/chat', '/api/evs') : '/api/evs';
        const r = await fetch(backendUrl);
        if (r.ok) {
          EV_DATA = await r.json();
        }
      } catch (e2) {
        console.warn('Could not load EV data from local or backend', e1, e2);
        EV_DATA = [];
      }
    }
    renderSuggestions();
    renderCompare();
  }
  loadEVData();

  // Persist/restore
  const STORAGE_KEY = 'ev-range-lab@v1';
  function save() {
    const data = getInputs();
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(data)); } catch {}
  }
  function restore() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const data = JSON.parse(raw);
      setInputs(data);
    } catch {}
  }

  // Input helpers
  function getInputs() {
    if (!form) {
      // On pages without the range form (e.g., car catalog), use defaults
      return { ...defaults };
    }
    const f = new FormData(form);
    const num = (v, d) => {
      const n = Number(v);
      return Number.isFinite(n) ? n : d;
    };
    return {
      capacity: num(f.get('capacity'), defaults.capacity),
      voltage: num(f.get('voltage'), defaults.voltage),
      chemistry: String(f.get('chemistry') || defaults.chemistry),
      cellType: String(f.get('cellType') || defaults.cellType),
      mass: num(f.get('mass'), defaults.mass),
      cd: num(f.get('cd'), defaults.cd),
      frontalArea: num(f.get('frontalArea'), defaults.frontalArea),
      drivetrain: String(f.get('drivetrain') || defaults.drivetrain),
      tires: String(f.get('tires') || defaults.tires),
      temperature: num(f.get('temperature'), defaults.temperature),
      minPrice: num(f.get('minPrice'), defaults.minPrice),
      maxPrice: num(f.get('maxPrice'), defaults.maxPrice),
    };
  }
  function setInputs(data) {
    const set = (id, v) => { const el = document.getElementById(id); if (el) el.value = v; };
    Object.entries(defaults).forEach(([k, v]) => set(k, data?.[k] ?? v));
  }

  // Physics model utilities
  const g = 9.80665;
  function airDensity(tempC) {
    // Approximate ISA at sea level adjusted by temperature (simple): rho ~ 1.225 kg/m3 at 15 C
    // We'll map -10..40 C to ~1.34..1.13 kg/m3 linearly then clamp
    const t = Math.max(-30, Math.min(50, tempC));
    const rho = 1.225 + (15 - t) * 0.0025; // very rough; colder → denser air
    return Math.max(1.05, Math.min(1.35, rho));
  }
  function crrForTires(tires) {
    switch (tires) {
      case 'eco': return 0.0090;
      case 'performance': return 0.0120;
      default: return 0.0105; // standard
    }
  }
  function drivetrainEfficiency(dt) {
    switch (dt) {
      case 'FWD': return 0.90;
      case 'AWD': return 0.86;
      default: return 0.88; // RWD
    }
  }
  function usableCapacityFactor(chem) {
    switch (chem) {
      case 'LFP': return 0.95;
      case 'NMC': return 0.93;
      case 'NCA': return 0.92;
      case 'LTO': return 0.85;
      default: return 0.92;
    }
  }
  function cellTypeEfficiency(cellType) {
    // Small efficiency impact on pack/internals
    switch (cellType) {
      case 'cylindrical': return 0.99; // 1% better
      case 'pouch': return 0.995; // 0.5% better
      default: return 1.0; // prismatic baseline
    }
  }
  function voltageFactor(voltage) {
    // Relative to 400V: 800V ~ up to ~6% less losses, clamp ±8%
    const k = 0.06;
    const rel = (voltage - 400) / 400;
    const f = 1 - k * rel;
    return Math.max(0.92, Math.min(1.08, f));
  }
  function temperatureConsumptionFactor(tempC) {
    // Baseline 20 C: colder increases consumption; hot adds AC load
    if (tempC < 20) {
      const inc = 1 + Math.min(0.25, (20 - tempC) * 0.01); // up to +25%
      return inc;
    }
    if (tempC > 30) {
      const inc = 1 + Math.min(0.10, (tempC - 30) * 0.005); // up to +10%
      return inc;
    }
    return 1.0;
  }

  function computeConsumptionWhPerKm(params) {
    const { mass, cd, frontalArea, tires, drivetrain, temperature, voltage, cellType } = params;
    const v = 100 / 3.6; // nominal speed (100 km/h)
    const rho = airDensity(temperature);
    const F_aero = 0.5 * rho * cd * frontalArea * v * v; // N
    const Crr = crrForTires(tires);
    const F_roll = Crr * mass * g; // N
    const eta_drive = drivetrainEfficiency(drivetrain);
    const baseForce = (F_aero + F_roll) / eta_drive;
    let whPerKm = (baseForce * 1000) / 3600;
    whPerKm *= temperatureConsumptionFactor(temperature);
    whPerKm *= voltageFactor(voltage);
    whPerKm *= cellTypeEfficiency(cellType);
    whPerKm = Math.max(90, Math.min(300, whPerKm));
    return whPerKm;
  }

  function computeRange(inputs) {
    const usableKWh = inputs.capacity * usableCapacityFactor(inputs.chemistry);
    const whPerKm = computeConsumptionWhPerKm(inputs);
    const kmPerKwh = 1000 / whPerKm;
    const rangeKm = usableKWh * kmPerKwh;
    return { usableKWh, whPerKm, kmPerKwh, rangeKm };
  }

  function format(n, digits = 0) {
    if (!Number.isFinite(n)) return '--';
    return n.toLocaleString(undefined, { maximumFractionDigits: digits, minimumFractionDigits: digits });
  }
  function formatMoney(n) {
    if (!Number.isFinite(n)) return '--';
    return n.toLocaleString(undefined, { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
  }

  // UI update
  function update() {
    const inputs = getInputs();
    const { usableKWh, whPerKm, kmPerKwh, rangeKm } = computeRange(inputs);
    const rangeMi = rangeKm * 0.621371;

    if (rangeKmEl) rangeKmEl.textContent = format(rangeKm, 0);
    if (rangeMiEl) rangeMiEl.textContent = format(rangeMi, 0);
    if (effKmPerKwhEl) effKmPerKwhEl.textContent = format(kmPerKwh, 2);
    if (effWhPerKmEl) effWhPerKmEl.textContent = format(whPerKm, 0);
    if (effKwhPer100El) effKwhPer100El.textContent = format(whPerKm / 10, 1);
    if (gaugeValEl) gaugeValEl.textContent = format(rangeKm, 0);

    if (gaugeEl) updateGauge(rangeKm);
    if (badgesEl) updateBadges(inputs);
  // extras removed
    renderSuggestions();
    renderCompare();
    save();
  }

  function updateGauge(rangeKm) {
    const max = 800; // cap visual at 800 km
    const pct = Math.max(0, Math.min(1, rangeKm / max));
    const deg = Math.floor(360 * pct);
  gaugeEl.style.background = `conic-gradient(var(--accent) 0deg, var(--accent-2) ${deg}deg, rgba(255,255,255,0.12) ${deg}deg 360deg)`;
  }

  function updateBadges(inputs) {
    const badges = [];
    const tempF = temperatureConsumptionFactor(inputs.temperature);
    badges.push({ label: `Temp ${inputs.temperature}°C`, type: tempF <= 1.02 ? 'good' : (tempF > 1.10 ? 'bad' : '') });
    const voltF = voltageFactor(inputs.voltage);
    badges.push({ label: `${inputs.voltage}V`, type: voltF < 1 ? 'good' : '' });
    const tire = inputs.tires === 'eco' ? 'good' : (inputs.tires === 'performance' ? 'bad' : '');
    badges.push({ label: `Tires: ${inputs.tires}`, type: tire });
    const dt = inputs.drivetrain === 'AWD' ? 'bad' : (inputs.drivetrain === 'FWD' ? 'good' : '');
    badges.push({ label: inputs.drivetrain, type: dt });
    badges.push({ label: `Chem: ${inputs.chemistry}`, type: inputs.chemistry === 'LTO' ? 'bad' : '' });

  badgesEl.innerHTML = badges.map(b => `<span class="badge ${b.type}">${b.label}</span>`).join('');
  }

  // extras removed

  function clamp(v, min, max) { return Math.max(min, Math.min(max, v)); }

  // Suggestions
  function renderSuggestions() {
    const inputs = getInputs();
    if (!EV_DATA?.length) {
      suggestionsEl.innerHTML = `<div class="card">No vehicle data loaded.</div>`;
      return;
    }
  const q = normalizeText(state.searchQuery || '');
    const tokens = q.split(/\s+/).filter(Boolean);
    let pool = EV_DATA;
    if (mode !== 'catalog') {
      const minP = Math.min(inputs.minPrice || 0, inputs.maxPrice || Infinity);
      const maxP = Math.max(inputs.minPrice || 0, inputs.maxPrice || Infinity);
      pool = EV_DATA.filter(v => v.priceINR >= minP && v.priceINR <= maxP);
    }
    let filtered = pool;
    if (tokens.length) {
      filtered = pool.filter(v => {
        const name = normalizeText(v.name);
        return tokens.every(t => name.includes(t));
      });
    }

    // Rank by closeness between predicted and model's recalculated range under user's conditions
    const mine = computeRange(inputs).rangeKm;
    let ranked = filtered
      .map(v => {
        const params = {
          ...inputs,
          capacity: v.capacity_kWh,
          voltage: v.voltageV || inputs.voltage,
          mass: v.mass_kg || inputs.mass,
          cd: v.cd || inputs.cd,
          frontalArea: v.frontalArea_m2 || inputs.frontalArea,
          drivetrain: v.drivetrain || inputs.drivetrain,
          // regen efficiency only displayed, not used in calc now
        };
        const est = computeRange(params).rangeKm;
        const delta = Math.abs(est - mine);
        return { v, est, delta };
      })
      .sort((a,b) => a.delta - b.delta);
    if (mode !== 'catalog') {
      ranked = ranked.slice(0, 6);
    }

    if (!ranked.length) {
      suggestionsEl.innerHTML = `<div class="card">No matches in this price range. Adjust the range to see suggestions.</div>`;
      return;
    }

    const showApply = !!form; // only on index page
    const showCompare = !!compareBtn || mode === 'catalog';
    suggestionsEl.innerHTML = ranked.map(({ v, est }) => `
      <div class="card">
        <div class="title">${v.name}</div>
        <div class="kv"><span>Price</span><span>${formatMoney(v.priceINR)} ₹</span></div>
        <div class="kv"><span>Battery</span><span>${v.capacity_kWh} kWh</span></div>
        <div class="kv"><span>Voltage</span><span>${v.voltageV || 400} V</span></div>
        <div class="kv"><span>EPA range</span><span>${v.range_km_EPA} km</span></div>
        <div class="kv"><span>Est. in your conditions</span><span class="pill">${format(est,0)} km</span></div>
        <div class="btnline">
          ${showApply ? `<button class="btn" data-apply="${encodeURIComponent(v.name)}">Apply specs</button>` : ''}
          ${showCompare ? `<label class="compare-check"><input type="checkbox" data-compare="${encodeURIComponent(v.name)}" ${state.compareSelected.includes(v.name) ? 'checked' : ''}/> Compare</label>` : ''}
        </div>
      </div>
    `).join('');

    // Wire apply buttons
    if (showApply) $$('[data-apply]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const name = decodeURIComponent(e.currentTarget.getAttribute('data-apply'));
        const m = EV_DATA.find(x => x.name === name);
        if (!m) return;
        setInputs({
          ...getInputs(),
          capacity: m.capacity_kWh,
          voltage: m.voltageV || 400,
          mass: m.mass_kg || defaults.mass,
          cd: m.cd || defaults.cd,
          frontalArea: m.frontalArea_m2 || defaults.frontalArea,
          drivetrain: m.drivetrain || defaults.drivetrain
        });
        update();
      });
    });

    // Wire compare checkboxes
    $$('[data-compare]').forEach(inp => {
      inp.addEventListener('change', (e) => {
        const name = decodeURIComponent(e.currentTarget.getAttribute('data-compare'));
        if (e.currentTarget.checked) {
          if (!state.compareSelected.includes(name)) {
            if (state.compareSelected.length >= 5) {
              e.currentTarget.checked = false;
              flashCompareHint('You can compare up to 5 vehicles.');
              return;
            }
            state.compareSelected.push(name);
          }
        } else {
          state.compareSelected = state.compareSelected.filter(n => n !== name);
        }
        updateCompareTray();
        renderCompare();
      });
    });
  }

  // State for search / compare
  const state = {
    searchQuery: '',
    compareSelected: [],
  };

  function updateCompareTray() {
    compareCountEl && (compareCountEl.textContent = String(state.compareSelected.length));
    const hasAny = state.compareSelected.length > 0;
    if (clearCompareBtn) clearCompareBtn.disabled = !hasAny;
    if (compareBtn) compareBtn.disabled = !(state.compareSelected.length >= 2);
  }

  function flashCompareHint(text) {
    const el = document.getElementById('compareHint');
    if (!el) return;
    const prev = el.textContent;
    el.textContent = text;
    setTimeout(() => { el.textContent = prev; }, 1800);
  }

  function renderCompare() {
    if (!compareTable) return;
    if (state.compareSelected.length < 2) {
      compareSection?.classList.add('hidden');
      compareTable.innerHTML = '';
      return;
    }
    // Build comparison columns
    const inputs = getInputs();
    const cars = state.compareSelected
      .map(name => EV_DATA.find(v => v.name === name))
      .filter(Boolean);
    if (cars.length < 2) {
      compareSection?.classList.add('hidden');
      compareTable.innerHTML = '';
      return;
    }
    const rows = [
      { key: 'price', label: 'Price', format: v => formatMoney(v.priceINR) + ' ₹' },
      { key: 'capacity', label: 'Battery', format: v => `${v.capacity_kWh} kWh` },
      { key: 'voltage', label: 'Voltage', format: v => `${v.voltageV || 400} V` },
      { key: 'drivetrain', label: 'Drivetrain', format: v => v.drivetrain },
      { key: 'mass', label: 'Mass', format: v => `${v.mass_kg || '—'} kg` },
      { key: 'cd', label: 'Cd', format: v => `${v.cd ?? '—'}` },
      { key: 'fa', label: 'Frontal area', format: v => `${v.frontalArea_m2 ?? '—'} m²` },
      { key: 'regen', label: 'Regen efficiency', format: v => `${typeof v.regen_eff === 'number' ? Math.round(v.regen_eff*100) : '—'}%` },
      { key: 'epa', label: 'EPA range', format: v => `${v.range_km_EPA} km` },
      { key: 'est', label: 'Est. in your conditions', format: v => {
          const params = {
            ...inputs,
            capacity: v.capacity_kWh,
            voltage: v.voltageV || inputs.voltage,
            mass: v.mass_kg || inputs.mass,
            cd: v.cd || inputs.cd,
            frontalArea: v.frontalArea_m2 || inputs.frontalArea,
            drivetrain: v.drivetrain || inputs.drivetrain,
            // regen efficiency only displayed
          };
          const est = computeRange(params).rangeKm;
          return `${format(est,0)} km`;
        } },
    ];

    const thead = `
      <thead>
        <tr>
          <th>Feature</th>
          ${cars.map(c => `<th><div class="col-head">${c.name}<button class="remove-col" data-remove-col="${encodeURIComponent(c.name)}">×</button></div></th>`).join('')}
        </tr>
      </thead>`;
    const tbodyRows = rows.map(r => `
      <tr>
        <td>${r.label}</td>
        ${cars.map(c => `<td>${r.format(c)}</td>`).join('')}
      </tr>`).join('');
    const tbody = `<tbody>${tbodyRows}</tbody>`;
    compareTable.innerHTML = thead + tbody;
    compareSection?.classList.remove('hidden');

    // Wire remove column
    $$('[data-remove-col]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const name = decodeURIComponent(e.currentTarget.getAttribute('data-remove-col'));
        state.compareSelected = state.compareSelected.filter(n => n !== name);
        updateCompareTray();
        renderSuggestions();
        renderCompare();
      });
    });
  }

  // Export/Import inputs as JSON
  exportLink?.addEventListener('click', (e) => {
    e.preventDefault();
    const state = JSON.stringify(getInputs(), null, 2);
    const blob = new Blob([state], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'ev-range-lab-inputs.json'; a.click();
    URL.revokeObjectURL(url);
  });
  importLink?.addEventListener('click', (e) => {
    e.preventDefault();
    const inp = document.createElement('input');
    inp.type = 'file'; inp.accept = 'application/json,.json';
    inp.onchange = () => {
      const f = inp.files?.[0];
      if (!f) return;
      const r = new FileReader();
      r.onload = () => {
        try { const data = JSON.parse(String(r.result)); setInputs(data); update(); } catch {}
      };
      r.readAsText(f);
    };
    inp.click();
  });

  shareLink?.addEventListener('click', (e) => {
    e.preventDefault();
    const inputs = getInputs();
    const params = new URLSearchParams();
    Object.entries(inputs).forEach(([k,v]) => params.set(k, v));
    const url = `${location.origin}${location.pathname}?${params.toString()}`;
    if (navigator.clipboard) {
      navigator.clipboard.writeText(url).then(() => {
        shareLink.textContent = 'Copied!';
        setTimeout(() => shareLink.textContent = 'Share link', 1800);
      });
    } else {
      prompt('Copy this URL', url); // fallback
    }
  });

  // Events
  form?.addEventListener('submit', (e) => { e.preventDefault(); update(); });
  form?.addEventListener('input', () => { update(); });
  resetBtn?.addEventListener('click', () => { setInputs(defaults); update(); });
  // Unified search wiring: read current input value directly
  function refreshSearch(){
    state.searchQuery = searchInput ? searchInput.value : '';
    renderSuggestions();
  }
  ['input','keyup','change','search','paste'].forEach(ev => searchInput?.addEventListener(ev, refreshSearch));
  compareBtn?.addEventListener('click', () => { renderCompare(); compareSection?.classList.remove('hidden'); document.querySelector('.catalog-wrapper')?.classList.add('compare-shown'); });
  hideCompareBtn?.addEventListener('click', () => { compareSection?.classList.add('hidden'); document.querySelector('.catalog-wrapper')?.classList.remove('compare-shown'); });
  clearCompareBtn?.addEventListener('click', () => { state.compareSelected = []; updateCompareTray(); renderSuggestions(); renderCompare(); });
  randomizeBtn?.addEventListener('click', () => {
    const r = (min, max, step = 1) => Math.round((min + Math.random() * (max - min)) / step) * step;
    setInputs({
      capacity: r(40, 120, 1),
      voltage: r(300, 800, 10),
      chemistry: ['LFP','NMC','NCA','LTO'][r(0,3,1)],
      cellType: ['prismatic','cylindrical','pouch'][r(0,2,1)],
      mass: r(1400, 2700, 10),
      cd: (Math.random() * (0.34 - 0.20) + 0.20).toFixed(3),
      frontalArea: (Math.random() * (3.0 - 2.1) + 2.1).toFixed(2),
      drivetrain: ['FWD','RWD','AWD'][r(0,2,1)],
      tires: ['eco','standard','performance'][r(0,2,1)],
      temperature: r(-10, 40, 1),
      minPrice: r(800000, 2000000, 100000),
      maxPrice: r(2000000, 7500000, 100000),
    });
    update();
  });

  // Init
  setInputs(defaults);
  restore();
  // Apply query string overrides
  (function applyQuery() {
    const qs = new URLSearchParams(location.search);
    if (!qs.size) return;
    const data = {};
    qs.forEach((v,k) => {
      const num = Number(v);
      data[k] = Number.isFinite(num) && v.trim() !== '' ? num : v;
    });
    setInputs({ ...getInputs(), ...data });
  })();
  updateCompareTray();
  update();
})();

// Assistant code removed
