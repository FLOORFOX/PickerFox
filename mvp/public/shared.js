const PF = (() => {
  // Colour-blind-safe palette; lists are always shown with their number as well.
  const COLORS = [
    { bg: '#009E73', ink: '#fff' },
    { bg: '#F0E442', ink: '#111' },
    { bg: '#0072B2', ink: '#fff' },
    { bg: '#D55E00', ink: '#fff' },
    { bg: '#CC79A7', ink: '#111' },
    { bg: '#56B4E9', ink: '#111' },
  ];

  const ISSUE_TYPES = {
    low: 'Low stock',
    empty: 'Empty or missing',
    location: 'Wrong or uncertain location',
  };

  // Routes a phone logged in with the user role may send to the manager.
  const USER_ROUTES = [/^\/api\/picklists\/\w+\/pick$/, /^\/api\/issues$/];

  const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const color = list => COLORS[list.color % COLORS.length];
  const swatch = list => `<span class="swatch" style="--c:${color(list).bg};--ink:${color(list).ink}">${list.number}</span>`;
  const cleanRoute = route => (route.startsWith('/') ? route : '/' + route);

  function index(state) {
    const group = key => {
      const map = new Map();
      state.stock.forEach(s => map.set(s[key], [...(map.get(s[key]) || []), s]));
      return map;
    };
    const byId = items => new Map((items || []).map(item => [item.id, item]));
    return {
      products: byId(state.products),
      elements: byId(state.elements),
      pickers: byId(state.pickers),
      stockByProduct: group('productId'),
      stockByElement: group('elementId'),
    };
  }

  function address(ix, slot) {
    const el = ix.elements.get(slot.elementId);
    if (!el) return '';
    const prefix = el.block ? `${el.block} · ` : '';
    if (el.type === 'rack') return `${prefix}${el.code} · B${slot.bay} · L${slot.level}`;
    return el.levels > 1 ? `${prefix}${el.code} · L${slot.level}` : `${prefix}${el.code}`;
  }

  const locations = (ix, productId) => ix.stockByProduct.get(productId) || [];
  const addresses = (ix, productId) => locations(ix, productId).map(s => address(ix, s)).join(', ') || 'No location';

  function progress(list) {
    return { done: list.lines.filter(l => l.picked).length, total: list.lines.length };
  }

  function status(list) {
    const { done, total } = progress(list);
    if (done === total) return 'Done';
    if (!list.pickerId) return 'Unassigned';
    return done ? 'In progress' : 'Assigned';
  }

  // Storage elements a list touches; "done" once every line stored there is picked.
  function listMarks(ix, list) {
    const marks = new Map();
    list.lines.forEach(line => locations(ix, line.productId).forEach(s => {
      const mark = marks.get(s.elementId) || { color: color(list).bg, ink: color(list).ink, done: true };
      if (!line.picked) mark.done = false;
      marks.set(s.elementId, mark);
    }));
    return marks;
  }

  // Stock status per storage element, set by its emptiest slot.
  function stockStatus(ix, settings) {
    const { low = 10, critical = 3 } = settings?.stock || {};
    const result = new Map();
    ix.stockByElement.forEach((entries, elementId) => {
      const lowest = Math.min(...entries.map(s => s.qty));
      result.set(elementId, lowest >= low ? 'ok' : lowest >= critical ? 'low' : 'crit');
    });
    return result;
  }

  const openIssues = state => (state.issues || []).filter(i => i.status === 'open');

  async function sha256(text) {
    const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
    return Array.from(new Uint8Array(bytes), b => b.toString(16).padStart(2, '0')).join('');
  }

  function deviceLabel() {
    const ua = navigator.userAgent;
    const os = /Android/.test(ua) ? 'Android' : /iPhone|iPad/.test(ua) ? 'iOS' : /Windows/.test(ua) ? 'Windows' : /Mac/.test(ua) ? 'Mac' : 'Device';
    const browser = /Edg\//.test(ua) ? 'Edge' : /SamsungBrowser/.test(ua) ? 'Samsung Internet' : /Chrome\//.test(ua) ? 'Chrome' : /Firefox\//.test(ua) ? 'Firefox' : /Safari\//.test(ua) ? 'Safari' : 'Browser';
    return `${os} · ${browser}`;
  }

  // ---------------------------------------------------------------- Session

  function currentUser() {
    try { return JSON.parse(localStorage.getItem('pf.session')) || null; } catch { return null; }
  }

  function setSession(user, passHash) {
    const session = { userId: user.id, username: user.username, role: user.role, pickerId: user.pickerId || null, passHash };
    try { localStorage.setItem('pf.session', JSON.stringify(session)); } catch {}
    return session;
  }

  async function login(state, username, password) {
    const passHash = await sha256(password);
    const user = (state.users || []).find(u => u.username.toLowerCase() === username.trim().toLowerCase() && u.passHash === passHash);
    return user ? setSession(user, passHash) : null;
  }

  function logout() {
    try { localStorage.removeItem('pf.session'); } catch {}
    location.href = './index.html';
  }

  // Sends the visitor to the login page unless the session has one of the roles.
  function requireRole(roles) {
    const session = currentUser();
    if (session && roles.includes(session.role)) return session;
    location.replace('./index.html');
    return null;
  }

  // Ends the session when its account was deleted or its password changed.
  function checkSession(state) {
    const session = currentUser();
    if (!session) return;
    const user = (state.users || []).find(u => u.id === session.userId);
    if (!user || user.passHash !== session.passHash || user.role !== session.role) logout();
  }

  // ---------------------------------------------------------------- State

  let clientState = null;
  let onStateCallback = null;
  let broadcastChannel = null;
  try { broadcastChannel = new BroadcastChannel('pickerfox_sync'); } catch {}

  const DEMO_CUSTOMERS = [
    'Trattoria Bella', 'Sushi Kumo', 'Burger Werk', 'Café Linde',
    'Pho Saigon', 'Taverna Olympos', 'Kebab Haus Mitte', 'Bowl & Co',
  ];

  const fetchInitial = async () => (await fetch('./initial-state.json?v=' + Date.now())).json();

  // Fills in parts that data saved by an older version lacks.
  async function normalize(state) {
    if (!state.users) {
      try { state.users = (await fetchInitial()).users || []; } catch { state.users = []; }
    }
    state.issues ||= [];
    state.settings ||= {};
    state.settings.stock ||= { low: 10, critical: 3 };
    state.elements.forEach(e => { delete e.locked; });
    return state;
  }

  function save() {
    clientState.rev = (clientState.rev || 0) + 1;
    try { localStorage.setItem('pf.state', JSON.stringify(clientState)); } catch {}
    broadcastChannel?.postMessage({ type: 'state', state: clientState });
    onStateCallback?.(clientState);
  }

  async function connect(onState, onStatus) {
    onStateCallback = onState;
    onStatus?.(true);
    if (broadcastChannel) {
      broadcastChannel.onmessage = event => {
        if (event.data?.state) {
          clientState = event.data.state;
          onState(clientState);
        }
      };
    }
    window.addEventListener('storage', event => {
      if (event.key === 'pf.state' && event.newValue) {
        try {
          clientState = JSON.parse(event.newValue);
          onState(clientState);
        } catch {}
      }
    });

    try {
      const saved = localStorage.getItem('pf.state');
      if (saved) clientState = JSON.parse(saved);
    } catch {}

    if (!clientState) {
      try {
        clientState = await fetchInitial();
      } catch (err) {
        console.error('Failed to load initial state:', err);
      }
    }
    if (clientState) {
      await normalize(clientState);
      try { localStorage.setItem('pf.state', JSON.stringify(clientState)); } catch {}
      onState(clientState);
    }
  }

  const rectPoints = (cx, cy, w, h) => [[cx - w / 2, cy - h / 2], [cx + w / 2, cy - h / 2], [cx + w / 2, cy + h / 2], [cx - w / 2, cy + h / 2]];

  function bounds(points) {
    const xs = points.map(p => p[0]);
    const ys = points.map(p => p[1]);
    const x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys);
    return { x0, x1, y0, y1, w: x1 - x0, h: y1 - y0, cx: (x0 + x1) / 2, cy: (y0 + y1) / 2 };
  }

  function applyMutation(route, body) {
    const state = clientState;
    let m;
    const findList = id => {
      const list = state.picklists.find(l => l.id === id);
      if (!list) throw new Error('Pick list not found');
      return list;
    };
    const findElement = id => {
      const el = state.elements.find(e => e.id === id);
      if (!el) throw new Error('Storage element not found');
      return el;
    };
    const findUser = id => {
      const user = state.users.find(u => u.id === id);
      if (!user) throw new Error('User not found');
      return user;
    };

    if (route === '/api/orders/demo') {
      const num = state.nextOrderNumber++;
      const shuffled = [...state.products].sort(() => Math.random() - 0.5).slice(0, 4 + Math.floor(Math.random() * 5));
      state.orders.push({
        id: `o${num}`,
        number: num,
        customer: DEMO_CUSTOMERS[Math.floor(Math.random() * DEMO_CUSTOMERS.length)],
        createdAt: new Date().toISOString(),
        lines: shuffled.map(p => ({ productId: p.id, qty: 1 + Math.floor(Math.random() * 6) })),
      });
    } else if (route === '/api/picklists') {
      const order = state.orders.find(o => o.id === body.orderId);
      if (!order) throw new Error('Order not found');
      if (state.picklists.some(l => l.orderId === order.id)) throw new Error('This order already has a pick list');
      const busy = new Set(state.picklists.filter(l => l.lines.some(line => !line.picked)).map(l => l.color));
      let listColor = 0;
      for (let i = 0; i < COLORS.length; i++) { if (!busy.has(i)) { listColor = i; break; } }
      const num = state.nextListNumber++;
      state.picklists.push({
        id: `l${num}`, number: num, orderId: order.id, orderNumber: order.number, customer: order.customer,
        color: listColor, pickerId: null, createdAt: new Date().toISOString(),
        lines: order.lines.map(line => ({ ...line, picked: false, pickedAt: null })),
      });
    } else if ((m = route.match(/^\/api\/picklists\/(\w+)\/assign$/))) {
      findList(m[1]).pickerId = body.pickerId || null;
    } else if ((m = route.match(/^\/api\/picklists\/(\w+)\/pick$/))) {
      const line = findList(m[1]).lines[body.line];
      if (!line) throw new Error('Line not found');
      const picked = Boolean(body.picked);
      if (picked && !line.taken) {
        // Take the cartons from the fullest slots first.
        let need = line.qty;
        const takenFrom = [];
        state.stock.filter(s => s.productId === line.productId).sort((a, b) => b.qty - a.qty).forEach(s => {
          const qty = Math.min(need, s.qty);
          if (!qty) return;
          s.qty -= qty;
          need -= qty;
          takenFrom.push({ elementId: s.elementId, bay: s.bay, level: s.level, qty });
        });
        state.stock = state.stock.filter(s => s.qty > 0);
        Object.assign(line, { taken: true, takenFrom, short: need });
      } else if (!picked && line.taken) {
        (line.takenFrom || []).forEach(t => {
          const entry = state.stock.find(s => s.productId === line.productId && s.elementId === t.elementId && s.bay === t.bay && s.level === t.level);
          if (entry) entry.qty += t.qty;
          else if (state.elements.some(e => e.id === t.elementId)) state.stock.push({ productId: line.productId, elementId: t.elementId, bay: t.bay, level: t.level, qty: t.qty });
        });
        Object.assign(line, { taken: false, takenFrom: [], short: 0 });
      }
      line.picked = picked;
      line.pickedAt = picked ? new Date().toISOString() : null;
    } else if ((m = route.match(/^\/api\/picklists\/(\w+)\/delete$/))) {
      findList(m[1]);
      state.picklists = state.picklists.filter(l => l.id !== m[1]);
    } else if (route === '/api/elements') {
      const isRack = body.type === 'rack';
      const existing = state.elements.filter(e => e.type === body.type);
      const num = Math.max(0, ...existing.map(e => Number((e.code || '').replace(/\D/g, '')))) + 1;
      const code = isRack ? `R-${String(num).padStart(2, '0')}` : `P-${String(num).padStart(3, '0')}`;
      const cx = body.cx !== undefined ? Math.round(body.cx) : Math.round(state.bounds.x + state.bounds.w / 2);
      const cy = body.cy !== undefined ? Math.round(body.cy) : Math.round(state.bounds.y + state.bounds.h / 2);
      const bays = isRack ? (Number(body.bays) || 3) : 1;
      const width = isRack ? Math.max(120, bays * 80) : 120;
      const depth = isRack ? 120 : 80;
      state.elements.push({
        id: `${body.type}-custom-${Date.now().toString(36)}`,
        type: body.type, code, block: '', cx, cy, width, depth, dir: 'h', bays,
        levels: isRack ? 3 : 1, count: bays, index: num,
        points: rectPoints(cx, cy, width, depth),
      });
    } else if ((m = route.match(/^\/api\/elements\/([\w-]+)\/levels$/))) {
      const el = findElement(m[1]);
      const levels = Number(body.levels);
      if (!Number.isInteger(levels) || levels < 1 || levels > 6) throw new Error('Levels must be 1 to 6');
      (body.applyToAll ? state.elements.filter(e => e.type === el.type) : [el]).forEach(e => { e.levels = levels; });
    } else if ((m = route.match(/^\/api\/elements\/([\w-]+)\/move$/))) {
      const el = findElement(m[1]);
      const box = bounds(el.points);
      // Either a new centre (cx, cy) or a shift (dx, dy).
      const dx = body.dx !== undefined ? Number(body.dx) : Math.round(Number(body.cx)) - box.cx;
      const dy = body.dy !== undefined ? Number(body.dy) : Math.round(Number(body.cy)) - box.cy;
      if (!Number.isFinite(dx) || !Number.isFinite(dy)) throw new Error('Invalid position');
      el.points = el.points.map(([x, y]) => [x + dx, y + dy]);
      el.cx = Math.round(box.cx + dx);
      el.cy = Math.round(box.cy + dy);
    } else if ((m = route.match(/^\/api\/elements\/([\w-]+)\/rotate$/))) {
      const el = findElement(m[1]);
      const box = bounds(el.points);
      // Quarter turn around the element's centre.
      el.points = el.points.map(([x, y]) => [Math.round(box.cx - (y - box.cy)), Math.round(box.cy + (x - box.cx))]);
      el.dir = el.dir === 'h' ? 'v' : 'h';
      [el.width, el.depth] = [el.depth, el.width];
    } else if ((m = route.match(/^\/api\/elements\/([\w-]+)\/delete$/))) {
      findElement(m[1]);
      state.elements = state.elements.filter(e => e.id !== m[1]);
      state.stock = state.stock.filter(s => s.elementId !== m[1]);
    } else if (route === '/api/layout/restore') {
      state.elements = body.elements;
      state.stock = body.stock;
    } else if (route === '/api/stock') {
      const { productId, elementId, bay, level, qty } = body;
      const same = s => s.productId === productId && s.elementId === elementId && s.bay === bay && s.level === level;
      if (qty === 0) {
        state.stock = state.stock.filter(s => !same(s));
      } else {
        const entry = state.stock.find(same);
        if (entry) entry.qty = qty;
        else state.stock.push({ productId, elementId, bay, level, qty });
      }
    } else if (route === '/api/users') {
      const username = String(body.username || '').trim();
      if (!username) throw new Error('Enter a username');
      if (state.users.some(u => u.username.toLowerCase() === username.toLowerCase())) throw new Error('This username is taken');
      if (!body.passHash) throw new Error('Enter a password');
      const num = Math.max(0, ...state.users.map(u => Number(u.id.replace(/\D/g, '')) || 0)) + 1;
      state.users.push({ id: `a${num}`, username, passHash: body.passHash, role: body.role === 'admin' ? 'admin' : 'user', pickerId: body.pickerId || null });
    } else if ((m = route.match(/^\/api\/users\/(\w+)\/update$/))) {
      const user = findUser(m[1]);
      if (body.role && body.role !== user.role && user.role === 'admin' && state.users.filter(u => u.role === 'admin').length === 1) {
        throw new Error('Keep at least one admin');
      }
      if (body.role) user.role = body.role === 'admin' ? 'admin' : 'user';
      if ('pickerId' in body) user.pickerId = body.pickerId || null;
      if (body.passHash) user.passHash = body.passHash;
    } else if ((m = route.match(/^\/api\/users\/(\w+)\/delete$/))) {
      const user = findUser(m[1]);
      if (user.role === 'admin' && state.users.filter(u => u.role === 'admin').length === 1) throw new Error('Keep at least one admin');
      state.users = state.users.filter(u => u.id !== user.id);
    } else if (route === '/api/issues') {
      if (!ISSUE_TYPES[body.type]) throw new Error('Choose an issue type');
      const num = Math.max(0, ...state.issues.map(i => Number(i.id.replace(/\D/g, '')) || 0)) + 1;
      state.issues.push({
        id: `i${num}`, type: body.type, productId: body.productId || null, elementId: body.elementId || null,
        bay: body.bay || null, level: body.level || null, note: String(body.note || '').slice(0, 300),
        by: body.by || null, at: new Date().toISOString(), status: 'open', resolvedAt: null,
      });
    } else if ((m = route.match(/^\/api\/issues\/(\w+)\/resolve$/))) {
      const issue = state.issues.find(i => i.id === m[1]);
      if (!issue) throw new Error('Issue not found');
      issue.status = 'resolved';
      issue.resolvedAt = new Date().toISOString();
    } else if (route === '/api/settings/stock') {
      const low = Number(body.low);
      const critical = Number(body.critical);
      if (!Number.isInteger(low) || !Number.isInteger(critical) || critical < 0 || low <= critical) {
        throw new Error('"Low" must be a whole number above "critical"');
      }
      state.settings.stock = { low, critical };
    } else {
      throw new Error('Unknown action');
    }
  }

  // Replaces the whole state, for reset and import.
  async function replaceState(next) {
    const rev = clientState?.rev || 0;
    clientState = await normalize(next);
    clientState.rev = rev;
    save();
  }

  async function post(path, body = {}) {
    const route = cleanRoute(path);
    if (clientPeerConnection && clientPeerConnection.open) {
      try {
        clientPeerConnection.send({ type: 'action', path: route, body });
        return true;
      } catch (err) {
        console.error('Failed to send action over WebRTC:', err);
      }
    }
    try {
      if (!clientState) throw new Error('No data loaded');
      if (route === '/api/reset') {
        await replaceState(await fetchInitial());
      } else if (route === '/api/import') {
        const next = body.state;
        if (!next || !Array.isArray(next.elements) || !Array.isArray(next.products) || !Array.isArray(next.stock) || !next.bounds) {
          throw new Error('This file is not a PickerFox export');
        }
        await replaceState(next);
      } else {
        applyMutation(route, body);
        save();
      }
      return clientState;
    } catch (err) {
      toast(err.message || 'Action failed');
      return null;
    }
  }

  function download(filename, text) {
    const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
    const link = Object.assign(document.createElement('a'), { href: url, download: filename });
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  let toastTimer;
  function toast(message) {
    document.querySelector('.toast')?.remove();
    const node = document.createElement('div');
    node.className = 'toast';
    node.setAttribute('role', 'status');
    node.textContent = message;
    document.body.appendChild(node);
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => node.remove(), 2600);
  }

  // ---------------------------------------------------------------- Map

  // canDrag(id) decides which element a press may drag; every other press pans.
  async function createMap(container, state, { onSelect, onMoveElement, canDrag = () => false }) {
    const text = await (await fetch('./floorplan.svg')).text();
    const svg = document.importNode(new DOMParser().parseFromString(text, 'image/svg+xml').documentElement, true);
    const NS = svg.namespaceURI;
    const make = (name, attributes) => {
      const node = document.createElementNS(NS, name);
      Object.entries(attributes).forEach(([key, value]) => node.setAttribute(key, value));
      return node;
    };
    svg.querySelectorAll('image').forEach(node => node.remove());
    svg.removeAttribute('width');
    svg.removeAttribute('height');
    svg.classList.add('pf-map');

    const elements = new Map(state.elements.map(e => [e.id, e]));
    const nodes = new Map();
    const pins = make('g', {});
    let moveTarget = null;

    // Centre and orientation of an element as drawn in floorplan.svg.
    function drawnBox(node) {
      const points = [];
      node.querySelectorAll('polygon').forEach(poly => (poly.getAttribute('points') || '').trim().split(/\s+/).forEach(pair => {
        const [x, y] = pair.split(',').map(Number);
        if (Number.isFinite(x) && Number.isFinite(y)) points.push([x, y]);
      }));
      return points.length ? bounds(points) : null;
    }

    svg.querySelectorAll('.el').forEach(node => {
      const id = node.id || node.dataset.el;
      if (!elements.has(id)) return;
      node.dataset.el = id;
      node.removeAttribute('data-locked');
      const label = svg.querySelector(`.lbl[data-for="${id}"]`);
      nodes.set(id, { node, label, drawn: drawnBox(node) });
    });
    svg.appendChild(pins);

    const pad = 10;
    const base = { x: state.bounds.x - pad, y: state.bounds.y - pad, w: state.bounds.w + pad * 2, h: state.bounds.h + pad * 2 };
    let view = { ...base };
    const apply = () => svg.setAttribute('viewBox', `${view.x} ${view.y} ${view.w} ${view.h}`);
    apply();
    container.appendChild(svg);

    const toSvg = (x, y) => new DOMPoint(x, y).matrixTransform(svg.getScreenCTM().inverse());
    const unit = () => 1 / svg.getScreenCTM().a;

    function zoomAt(factor, x, y) {
      const w = Math.max(base.w / 14, Math.min(base.w * 1.5, view.w / factor));
      const ratio = w / view.w;
      view = { x: x - (x - view.x) * ratio, y: y - (y - view.y) * ratio, w, h: view.h * ratio };
      apply();
    }

    // Places an element where its state says: drawn elements move and turn as a whole.
    function place(e) {
      const item = nodes.get(e.id);
      if (!item || !e.points?.length) return;
      const box = bounds(e.points);
      if (item.drawn) {
        const turned = (item.drawn.w >= item.drawn.h) !== (box.w >= box.h);
        item.node.setAttribute('transform', `translate(${box.cx} ${box.cy}) rotate(${turned ? 90 : 0}) translate(${-item.drawn.cx} ${-item.drawn.cy})`);
      } else {
        item.node.querySelector('.el-base')?.setAttribute('points', e.points.map(p => p.join(',')).join(' '));
      }
      if (item.label) {
        item.label.setAttribute('x', box.cx);
        item.label.setAttribute('y', box.cy);
      }
    }

    function addNode(e) {
      const isRack = e.type === 'rack';
      const node = make('g', {
        id: e.id, class: `el ${e.type}`, 'data-el': e.id, 'data-code': e.code,
        tabindex: '0', role: 'button', 'aria-label': `${isRack ? 'Rack' : 'Pallet'} ${e.code}`,
      });
      node.appendChild(make('polygon', { class: 'el-base', points: '' }));
      (svg.querySelector(isRack ? '#storage-racks' : '#storage-pallets') || svg).insertBefore(node, null);
      const label = make('text', { class: `lbl ${e.type}`, 'data-for': e.id, x: e.cx, y: e.cy });
      label.textContent = isRack ? e.code : (e.index || e.code.replace(/\D/g, ''));
      (svg.querySelector('#labels') || svg).appendChild(label);
      svg.appendChild(pins);
      nodes.set(e.id, { node, label, drawn: null });
    }

    function updateElements(list) {
      elements.clear();
      list.forEach(e => {
        elements.set(e.id, e);
        if (!nodes.has(e.id)) addNode(e);
        place(e);
      });
      nodes.forEach(({ node, label }, id) => {
        if (elements.has(id)) return;
        node.remove();
        label?.remove();
        nodes.delete(id);
      });
    }
    updateElements(state.elements);

    const pointers = new Map();
    let tap = null;
    const spread = () => {
      const [a, b] = [...pointers.values()];
      return { d: Math.hypot(a.x - b.x, a.y - b.y), x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
    };

    svg.addEventListener('pointerdown', event => {
      svg.setPointerCapture(event.pointerId);
      pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
      tap = pointers.size === 1 ? { target: event.target, moved: 0 } : null;
      moveTarget = null;
      const id = event.target.closest?.('[data-el]')?.dataset.el;
      const item = id && nodes.get(id);
      if (item && pointers.size === 1 && onMoveElement && canDrag(id)) {
        const label = item.label;
        moveTarget = {
          id, item, startX: event.clientX, startY: event.clientY, moved: false,
          transform: item.node.getAttribute('transform') || '',
          labelX: Number(label?.getAttribute('x')), labelY: Number(label?.getAttribute('y')),
        };
      }
    });
    svg.addEventListener('pointermove', event => {
      const last = pointers.get(event.pointerId);
      if (!last) return;

      if (moveTarget) {
        const dx = (event.clientX - moveTarget.startX) * unit();
        const dy = (event.clientY - moveTarget.startY) * unit();
        if (Math.hypot(event.clientX - moveTarget.startX, event.clientY - moveTarget.startY) > 6) moveTarget.moved = true;
        if (moveTarget.moved) {
          const { item } = moveTarget;
          if (item.drawn) {
            item.node.setAttribute('transform', `translate(${dx} ${dy}) ${moveTarget.transform}`);
          } else {
            item.node.setAttribute('transform', `translate(${dx} ${dy})`);
          }
          if (item.label) {
            item.label.setAttribute('x', moveTarget.labelX + dx);
            item.label.setAttribute('y', moveTarget.labelY + dy);
          }
        }
        return;
      }

      const before = pointers.size === 2 ? spread() : null;
      pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
      const scale = unit();
      if (before) {
        const after = spread();
        view.x -= (after.x - before.x) * scale;
        view.y -= (after.y - before.y) * scale;
        apply();
        const center = toSvg(after.x, after.y);
        zoomAt(after.d / Math.max(before.d, 1), center.x, center.y);
      } else if (pointers.size === 1) {
        const dx = event.clientX - last.x;
        const dy = event.clientY - last.y;
        if (tap) tap.moved += Math.abs(dx) + Math.abs(dy);
        view.x -= dx * scale;
        view.y -= dy * scale;
        apply();
      }
    });
    const release = event => {
      if (!pointers.delete(event.pointerId)) return;
      if (moveTarget) {
        const target = moveTarget;
        moveTarget = null;
        if (target.moved) {
          const dx = (event.clientX - target.startX) * unit();
          const dy = (event.clientY - target.startY) * unit();
          const el = elements.get(target.id);
          if (target.item.drawn) target.item.node.setAttribute('transform', target.transform);
          else target.item.node.removeAttribute('transform');
          place(el);
          tap = null;
          if (event.type === 'pointerup' && el) {
            const box = bounds(el.points);
            const snap = 25;
            onMoveElement(target.id, Math.round((box.cx + dx) / snap) * snap, Math.round((box.cy + dy) / snap) * snap);
          }
          return;
        }
      }
      // A press that barely moved is a tap; anything else was a pan.
      if (event.type === 'pointerup' && tap && tap.moved < 8) {
        onSelect(tap.target.closest?.('[data-el]')?.dataset.el || null);
      }
      tap = null;
    };
    svg.addEventListener('pointerup', release);
    svg.addEventListener('pointercancel', release);
    svg.addEventListener('wheel', event => {
      event.preventDefault();
      const point = toSvg(event.clientX, event.clientY);
      zoomAt(event.deltaY < 0 ? 1.2 : 1 / 1.2, point.x, point.y);
    }, { passive: false });

    return {
      zoom: factor => zoomAt(factor, view.x + view.w / 2, view.y + view.h / 2),
      reset: () => { view = { ...base }; apply(); },
      center: () => ({ x: view.x + view.w / 2, y: view.y + view.h / 2 }),
      updateElements,
      // inset = share of the map height covered by an overlay at the bottom.
      focus(ids, inset = 0) {
        const targets = [...ids].map(id => elements.get(id)).filter(Boolean);
        const frame = svg.getBoundingClientRect();
        if (!targets.length || !frame.width || !frame.height) return;
        const centres = targets.map(e => bounds(e.points));
        const xs = centres.map(b => b.cx);
        const ys = centres.map(b => b.cy);
        const minBox = Math.max(120, Math.round(state.bounds.w / 3.5));
        const w = Math.max(minBox, Math.max(...xs) - Math.min(...xs) + minBox * 0.4);
        const h = Math.max(minBox, Math.max(...ys) - Math.min(...ys) + minBox * 0.4);
        const free = frame.height * (1 - Math.min(inset, 0.7));
        const scale = Math.min(frame.width / w, free / h);
        const middle = (Math.min(...ys) + Math.max(...ys)) / 2;
        view = {
          x: (Math.min(...xs) + Math.max(...xs)) / 2 - frame.width / scale / 2,
          y: middle - free / scale / 2,
          w: frame.width / scale,
          h: frame.height / scale,
        };
        apply();
      },
      // stock: Map id -> 'ok' | 'low' | 'crit'; issues: Set of ids with open issues.
      paint({ stocked = new Set(), marks = new Map(), selected = new Set(), stock = null, issues = new Set() }) {
        nodes.forEach(({ node, label }, id) => {
          const mark = marks.get(id);
          const isSelected = selected.has(id);
          const level = stock?.get(id);
          node.classList.toggle('stocked', stocked.has(id));
          node.classList.toggle('mark', Boolean(mark));
          node.classList.toggle('done', Boolean(mark?.done));
          node.classList.toggle('sel', isSelected);
          node.classList.toggle('st', Boolean(level));
          ['ok', 'low', 'crit'].forEach(name => node.classList.toggle(`st-${name}`, level === name));
          node.style.setProperty('--mark', mark ? mark.color : '');
          if (label) {
            label.style.fill = mark && !mark.done ? mark.ink : isSelected && !mark ? '#fff' : '';
            label.style.fontWeight = mark || isSelected ? '700' : '';
          }
        });
        const pinR = Math.max(20, Math.round(state.bounds.w / 35));
        const markers = [...selected].filter(id => elements.has(id)).map(id => {
          const box = bounds(elements.get(id).points);
          return make('circle', { class: 'pin', cx: box.cx, cy: box.cy, r: pinR });
        });
        [...issues].filter(id => elements.has(id)).forEach(id => {
          const box = bounds(elements.get(id).points);
          const r = Math.round(pinR * 0.75);
          const group = make('g', { class: 'issue-pin', transform: `translate(${box.x1} ${box.y0})` });
          group.appendChild(make('circle', { r }));
          const mark = make('text', {});
          mark.textContent = '!';
          group.appendChild(mark);
          markers.push(group);
        });
        pins.replaceChildren(...markers);
      },
    };
  }

  // Front view of one storage element: bays left to right, levels bottom to top.
  function frontView(ix, el, { hot = new Set(), selected = null, onSlot } = {}) {
    const entries = ix.stockByElement.get(el.id) || [];
    const rack = el.type === 'rack';
    let html = '';
    for (let level = el.levels; level >= 1; level--) {
      html += `<div class="ax">${rack || el.levels > 1 ? `L${level}` : ''}</div>`;
      for (let bay = 1; bay <= el.bays; bay++) {
        const inSlot = entries.filter(s => s.bay === bay && s.level === level);
        const classes = ['slot'];
        if (!inSlot.length) classes.push('empty');
        if (inSlot.some(s => hot.has(s.productId))) classes.push('hot');
        if (selected && selected.bay === bay && selected.level === level) classes.push('sel');
        const label = `${address(ix, { elementId: el.id, bay, level })}: ${inSlot.length ? inSlot.map(s => `${s.qty} × ${ix.products.get(s.productId).name}`).join(', ') : 'empty'}`;
        html += `<button type="button" class="${classes.join(' ')}" data-bay="${bay}" data-level="${level}" aria-label="${esc(label)}" title="${esc(label)}">${
          inSlot.map(s => `<span class="carton${hot.has(s.productId) ? ' hot' : ''}"><b>${s.qty}</b> ${esc(ix.products.get(s.productId).name)}</span>`).join('')
        }</button>`;
      }
    }
    if (rack) {
      html += '<div></div>';
      for (let bay = 1; bay <= el.bays; bay++) html += `<div class="ax">B${bay}</div>`;
    } else {
      html += '<div></div><div class="base"></div>';
    }
    const wrap = document.createElement('div');
    wrap.className = `front ${el.type}`;
    wrap.style.setProperty('--bays', el.bays);
    wrap.innerHTML = html;
    if (onSlot) {
      wrap.addEventListener('click', event => {
        const slot = event.target.closest('.slot');
        if (slot) onSlot({ bay: Number(slot.dataset.bay), level: Number(slot.dataset.level) });
      });
    }
    return wrap;
  }

  // ---------------------------------------------------------------- Phone pairing

  const ICE = {
    debug: 1,
    config: {
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
        { urls: 'stun:stun2.l.google.com:19302' },
        { urls: 'stun:stun.cloudflare.com:3478' },
      ],
    },
  };

  let activePeer = null;
  let clientPeerConnection = null;

  function generateRoomCode() {
    const bytes = crypto.getRandomValues(new Uint8Array(16));
    return Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('');
  }

  // Phones get the state without password hashes.
  const phoneState = state => ({ ...state, users: (state.users || []).map(({ passHash, ...rest }) => rest) });

  // The manager's side of the room. A phone gets nothing and may do nothing until it logs in.
  function startPeerHost({ roomCode, getState, onAction, onStatus, onDevices }) {
    if (typeof Peer === 'undefined') {
      onStatus?.('PeerJS library not loaded');
      return null;
    }
    const code = roomCode || generateRoomCode();
    const devices = new Map(); // conn -> { peerId, user, device, connectedAt, lastSeen }
    let currentStatus = 'Connecting to peer signaling network…';

    const report = message => {
      if (message) currentStatus = message;
      else currentStatus = devices.size ? `${devices.size} device${devices.size === 1 ? '' : 's'} connected` : 'Waiting for a phone to scan…';
      onStatus?.(currentStatus);
      onDevices?.(list());
    };
    const list = () => [...devices.values()].map(d => ({ ...d, user: { id: d.user.id, username: d.user.username, role: d.user.role } }));
    const send = (conn, message) => { try { if (conn.open) conn.send(message); } catch {} };

    try {
      activePeer?.destroy();
      activePeer = new Peer('pickerfox-room-' + code.toLowerCase(), ICE);
      activePeer.on('open', () => report());

      activePeer.on('connection', conn => {
        conn.on('data', data => {
          const device = devices.get(conn);
          if (data?.type === 'hello') {
            const user = (getState()?.users || []).find(u => u.username.toLowerCase() === String(data.username || '').toLowerCase() && u.passHash === data.passHash);
            if (!user) {
              send(conn, { type: 'denied', reason: 'Wrong username or password' });
              setTimeout(() => conn.close(), 300);
              return;
            }
            const now = new Date().toISOString();
            devices.set(conn, { peerId: conn.peer, user: { ...user }, device: String(data.device || 'Device').slice(0, 60), connectedAt: now, lastSeen: now });
            send(conn, { type: 'welcome', user: { id: user.id, username: user.username, role: user.role, pickerId: user.pickerId } });
            send(conn, { type: 'state', state: phoneState(getState()) });
            report();
            return;
          }
          if (!device) return;
          device.lastSeen = new Date().toISOString();
          if (data?.type === 'get_state') {
            send(conn, { type: 'state', state: phoneState(getState()) });
          } else if (data?.type === 'action') {
            const route = cleanRoute(String(data.path || ''));
            if (device.user.role !== 'admin') {
              if (!USER_ROUTES.some(rule => rule.test(route))) return;
              const pick = route.match(/^\/api\/picklists\/(\w+)\/pick$/);
              if (pick && getState().picklists.find(l => l.id === pick[1])?.pickerId !== device.user.pickerId) return;
            }
            onAction?.(route, data.body || {}, device.user.username);
          }
          onDevices?.(list());
        });
        const drop = () => {
          if (devices.delete(conn)) report();
        };
        conn.on('close', drop);
        conn.on('error', drop);
      });

      activePeer.on('error', err => {
        if (err.type === 'unavailable-id') report('This room is already open in another tab. Press "New room".');
        else report('Peer notice: ' + (err.message || err.type));
      });
    } catch (err) {
      report('WebRTC init failed: ' + err.message);
    }

    const kick = (conn, reason) => {
      send(conn, { type: 'kicked', reason });
      devices.delete(conn);
      setTimeout(() => conn.close(), 300);
    };

    return {
      roomCode: code,
      getStatus: () => currentStatus,
      devices: list,
      broadcastState: state => devices.forEach((_, conn) => send(conn, { type: 'state', state: phoneState(state) })),
      disconnect: peerId => {
        devices.forEach((d, conn) => { if (d.peerId === peerId) kick(conn, 'Disconnected by the manager'); });
        report();
      },
      // Drops phones whose account was deleted, changed role or got a new password.
      revalidate: () => {
        const users = getState()?.users || [];
        devices.forEach((d, conn) => {
          const user = users.find(u => u.id === d.user.id);
          if (!user || user.passHash !== d.user.passHash || user.role !== d.user.role) kick(conn, 'Your account changed. Log in again.');
          else d.user = { ...user };
        });
        report();
      },
      close: () => {
        devices.forEach((_, conn) => conn.close());
        devices.clear();
        activePeer?.destroy();
        activePeer = null;
      },
    };
  }

  function clearSavedData() {
    try {
      Object.keys(localStorage)
        .filter(key => key.startsWith('pf.'))
        .forEach(key => localStorage.removeItem(key));
    } catch {}
    location.reload();
  }

  // The phone's side: logs in to the manager with the given credentials.
  function connectPeerClient({ roomCode, credentials, onState, onStatus, onWelcome, onDenied }) {
    if (typeof Peer === 'undefined') {
      onStatus?.(false, 'PeerJS not available');
      return null;
    }
    const shortCode = roomCode.slice(0, 6);
    onStatus?.(false, `Connecting to Manager (Room ${shortCode})…`);
    let peer = null;

    try {
      peer = new Peer(ICE);
      peer.on('open', () => {
        onStatus?.(false, `Joining room ${shortCode}…`);
        const conn = peer.connect('pickerfox-room-' + roomCode.toLowerCase(), { reliable: true });
        let ended = false;

        const hello = () => {
          try { conn.send({ type: 'hello', username: credentials.username, passHash: credentials.passHash, device: deviceLabel() }); } catch {}
        };
        if (conn.open) hello();
        else conn.on('open', hello);

        conn.on('data', data => {
          if (data?.type === 'welcome') {
            clientPeerConnection = conn;
            onWelcome?.(data.user);
            onStatus?.(true, `Live with Manager (${shortCode})`);
          } else if (data?.type === 'state') {
            onState?.(data.state);
          } else if (data?.type === 'denied' || data?.type === 'kicked') {
            ended = true;
            clientPeerConnection = null;
            if (data.type === 'denied') onDenied?.(data.reason);
            else onStatus?.(false, data.reason || 'Disconnected by the manager');
          }
        });
        conn.on('close', () => {
          clientPeerConnection = null;
          if (!ended) onStatus?.(false, 'Disconnected from manager');
        });
        conn.on('error', err => {
          clientPeerConnection = null;
          onStatus?.(false, 'Connection error: ' + (err.message || 'room unreachable'));
        });
      });
      peer.on('error', err => {
        onStatus?.(false, err.type === 'peer-unavailable' ? 'Room not open. Ask the manager for a new QR code.' : 'Peer notice: ' + (err.type || err.message));
      });
    } catch (err) {
      onStatus?.(false, 'WebRTC error: ' + err.message);
    }

    return { close: () => { clientPeerConnection = null; peer?.destroy(); } };
  }

  return {
    ISSUE_TYPES, esc, color, swatch, index, address, addresses, locations, progress, status, listMarks, stockStatus, openIssues,
    sha256, currentUser, setSession, login, logout, requireRole, checkSession,
    connect, post, download, toast, createMap, frontView,
    startPeerHost, connectPeerClient, generateRoomCode, clearSavedData,
  };
})();
