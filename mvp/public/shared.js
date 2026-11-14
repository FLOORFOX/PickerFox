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

  const esc = value => String(value).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const color = list => COLORS[list.color % COLORS.length];
  const swatch = list => `<span class="swatch" style="--c:${color(list).bg};--ink:${color(list).ink}">${list.number}</span>`;

  function index(state) {
    const group = key => {
      const map = new Map();
      state.stock.forEach(s => map.set(s[key], [...(map.get(s[key]) || []), s]));
      return map;
    };
    const byId = items => new Map(items.map(item => [item.id, item]));
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

  let mode = null; // 'server' | 'static'
  let clientState = null;
  let onStateCallback = null;
  let broadcastChannel = null;
  try { broadcastChannel = new BroadcastChannel('pickerfox_sync'); } catch {}

  const DEMO_CUSTOMERS = [
    'Trattoria Bella', 'Sushi Kumo', 'Burger Werk', 'Café Linde',
    'Pho Saigon', 'Taverna Olympos', 'Kebab Haus Mitte', 'Bowl & Co',
  ];

  async function connect(onState, onStatus) {
    onStateCallback = onState;
    if (location.protocol === 'file:' || location.hostname.endsWith('github.io')) {
      mode = 'static';
    } else {
      try {
        const res = await fetch('./api/state', { method: 'GET', cache: 'no-store' });
        if (res.ok && res.headers.get('content-type')?.includes('application/json')) {
          mode = 'server';
        } else {
          mode = 'static';
        }
      } catch {
        mode = 'static';
      }
    }

    if (mode === 'server') {
      const source = new EventSource('./api/events');
      source.onmessage = event => onState(JSON.parse(event.data));
      source.onopen = () => onStatus(true);
      source.onerror = () => onStatus(false);
      return;
    }

    // Static mode (GitHub Pages, local static preview, or file:)
    onStatus(true);
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
        clientState = await (await fetch('./initial-state.json?v=' + Date.now())).json();
        localStorage.setItem('pf.state', JSON.stringify(clientState));
      } catch (err) {
        console.error('Failed to load initial state:', err);
      }
    }
    if (clientState) onState(clientState);
  }

  function applyClientMutation(route, body) {
    if (!clientState) return;
    let m;
    const cleanRoute = route.startsWith('/') ? route : '/' + route;
    if (cleanRoute === '/api/orders/demo') {
      const num = clientState.nextOrderNumber++;
      const shuffled = [...clientState.products].sort(() => Math.random() - 0.5).slice(0, 4 + Math.floor(Math.random() * 5));
      clientState.orders.push({
        id: `o${num}`,
        number: num,
        customer: DEMO_CUSTOMERS[Math.floor(Math.random() * DEMO_CUSTOMERS.length)],
        createdAt: new Date().toISOString(),
        lines: shuffled.map(p => ({ productId: p.id, qty: 1 + Math.floor(Math.random() * 6) }))
      });
    } else if (cleanRoute === '/api/picklists') {
      const order = clientState.orders.find(o => o.id === body.orderId);
      if (!order) throw new Error('Order not found');
      if (clientState.picklists.some(l => l.orderId === order.id)) throw new Error('This order already has a pick list');
      const busy = new Set(clientState.picklists.filter(l => l.lines.some(line => !line.picked)).map(l => l.color));
      let color = 0;
      for (let i = 0; i < 6; i++) { if (!busy.has(i)) { color = i; break; } }
      const num = clientState.nextListNumber++;
      clientState.picklists.push({
        id: `l${num}`, number: num, orderId: order.id, orderNumber: order.number, customer: order.customer,
        color, pickerId: null, createdAt: new Date().toISOString(),
        lines: order.lines.map(line => ({ ...line, picked: false, pickedAt: null }))
      });
    } else if ((m = cleanRoute.match(/\/api\/picklists\/(\w+)\/assign$/))) {
      const list = clientState.picklists.find(l => l.id === m[1]);
      if (list) list.pickerId = body.pickerId || null;
    } else if ((m = cleanRoute.match(/\/api\/picklists\/(\w+)\/pick$/))) {
      const list = clientState.picklists.find(l => l.id === m[1]);
      if (list && list.lines[body.line]) {
        list.lines[body.line].picked = Boolean(body.picked);
        list.lines[body.line].pickedAt = body.picked ? new Date().toISOString() : null;
      }
    } else if ((m = cleanRoute.match(/\/api\/picklists\/(\w+)\/delete$/))) {
      clientState.picklists = clientState.picklists.filter(l => l.id !== m[1]);
    } else if ((m = cleanRoute.match(/\/api\/elements\/([\w-]+)\/levels$/))) {
      const el = clientState.elements.find(e => e.id === m[1]);
      if (el) {
        const levels = Number(body.levels);
        const affected = body.applyToAll ? clientState.elements.filter(e => e.type === el.type) : [el];
        affected.forEach(e => { e.levels = levels; });
      }
    } else if (cleanRoute === '/api/elements') {
      const isRack = body.type === 'rack';
      const existing = clientState.elements.filter(e => e.type === body.type);
      const num = Math.max(0, ...existing.map(e => Number((e.code || '').replace(/\D/g, '')))) + 1;
      const code = isRack ? `R-${String(num).padStart(2, '0')}` : `P-${String(num).padStart(3, '0')}`;
      const id = `${body.type}-custom-${Date.now().toString(36)}`;
      const cx = body.cx !== undefined ? Math.round(body.cx) : Math.round(clientState.bounds.x + clientState.bounds.w / 2);
      const cy = body.cy !== undefined ? Math.round(body.cy) : Math.round(clientState.bounds.y + clientState.bounds.h / 2);
      const bays = isRack ? (Number(body.bays) || 3) : 1;
      const width = isRack ? Math.max(120, bays * 80) : 120;
      const depth = isRack ? 120 : 80;
      const newEl = {
        id, type: body.type, code, block: '', cx, cy, width, depth, dir: 'h', bays,
        levels: isRack ? 3 : 1, count: bays, index: num, locked: false,
        points: [[cx - width/2, cy - depth/2], [cx + width/2, cy - depth/2], [cx + width/2, cy + depth/2], [cx - width/2, cy + depth/2]]
      };
      clientState.elements.push(newEl);
    } else if ((m = cleanRoute.match(/\/api\/elements\/([\w-]+)\/move$/))) {
      const el = clientState.elements.find(e => e.id === m[1]);
      if (el) {
        el.cx = Math.round(Number(body.cx));
        el.cy = Math.round(Number(body.cy));
        const w = el.width || 80, h = el.depth || 120;
        el.points = [[el.cx - w/2, el.cy - h/2], [el.cx + w/2, el.cy - h/2], [el.cx + w/2, el.cy + h/2], [el.cx - w/2, el.cy + h/2]];
      }
    } else if ((m = cleanRoute.match(/\/api\/elements\/([\w-]+)\/rotate$/))) {
      const el = clientState.elements.find(e => e.id === m[1]);
      if (el) {
        el.dir = el.dir === 'h' ? 'v' : 'h';
        [el.width, el.depth] = [el.depth, el.width];
        const w = el.width, h = el.depth;
        el.points = [[el.cx - w/2, el.cy - h/2], [el.cx + w/2, el.cy - h/2], [el.cx + w/2, el.cy + h/2], [el.cx - w/2, el.cy + h/2]];
      }
    } else if ((m = cleanRoute.match(/\/api\/elements\/([\w-]+)\/lock$/))) {
      const el = clientState.elements.find(e => e.id === m[1]);
      if (el) el.locked = Boolean(body.locked);
    } else if ((m = cleanRoute.match(/\/api\/elements\/([\w-]+)\/delete$/))) {
      clientState.elements = clientState.elements.filter(e => e.id !== m[1]);
      clientState.stock = clientState.stock.filter(s => s.elementId !== m[1]);
    } else if (cleanRoute === '/api/stock') {
      const { productId, elementId, bay, level, qty } = body;
      const same = s => s.productId === productId && s.elementId === elementId && s.bay === bay && s.level === level;
      if (qty === 0) {
        clientState.stock = clientState.stock.filter(s => !same(s));
      } else {
        const entry = clientState.stock.find(same);
        if (entry) entry.qty = qty;
        else clientState.stock.push({ productId, elementId, bay, level, qty });
      }
    } else if (cleanRoute === '/api/reset') {
      try { localStorage.removeItem('pf.state'); } catch {}
      fetch('./initial-state.json?v=' + Date.now())
        .then(r => r.json())
        .then(initial => {
          clientState = initial;
          clientState.rev = (clientState.rev || 0) + 1;
          clientState.floorplanHash = 'client-' + clientState.rev;
          try { localStorage.setItem('pf.state', JSON.stringify(clientState)); } catch {}
          broadcastChannel?.postMessage({ type: 'state', state: clientState });
          onStateCallback?.(clientState);
        });
    }
  }

  async function post(path, body = {}) {
    if (clientPeerConnection && clientPeerConnection.open) {
      try {
        clientPeerConnection.send({ type: 'action', path, body });
        return true;
      } catch (err) {
        console.error('Failed to send action over WebRTC:', err);
      }
    }

    if (mode === 'server') {
      try {
        const cleanPath = path.startsWith('/') ? path : '/' + path;
        const res = await fetch('.' + cleanPath, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body)
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Request failed');
        return data;
      } catch (error) {
        toast(error instanceof TypeError ? 'No connection to the server' : error.message);
        return null;
      }
    }

    // Static client mode
    try {
      applyClientMutation(path, body);
      clientState.rev = (clientState.rev || 0) + 1;
      clientState.floorplanHash = 'client-' + clientState.rev;
      try { localStorage.setItem('pf.state', JSON.stringify(clientState)); } catch {}
      broadcastChannel?.postMessage({ type: 'state', state: clientState });
      onStateCallback?.(clientState);
      return clientState;
    } catch (err) {
      toast(err.message || 'Action failed');
      return null;
    }
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

  async function createMap(container, state, { onSelect, onMoveElement }) {
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
    const labels = make('g', {});
    const pins = make('g', {});
    let moveTarget = null;

    svg.querySelectorAll('.el').forEach(node => {
      const id = node.id || node.dataset.el;
      const el = elements.get(id);
      if (!el) return;
      node.dataset.el = el.id;
      const label = svg.querySelector(`.lbl[data-for="${el.id}"]`);
      nodes.set(el.id, { node, label });
    });
    if (!nodes.size) {
      svg.querySelectorAll('[data-symbol]').forEach(node => {
        const el = elements.get(node.id);
        if (!el) return;
        node.classList.add('el', el.type);
        node.dataset.el = el.id;
        const label = make('text', { x: el.cx, y: el.cy, class: `lbl ${el.type}` });
        label.textContent = el.type === 'rack' ? el.code : String(Number(el.code.slice(2)));
        labels.appendChild(label);
        nodes.set(el.id, { node, label });
      });
      svg.appendChild(labels);
    }
    svg.appendChild(pins);

    const pad = 10;
    const base = { x: state.bounds.x - pad, y: state.bounds.y - pad, w: state.bounds.w + pad * 2, h: state.bounds.h + pad * 2 };
    let view = { ...base };
    const apply = () => svg.setAttribute('viewBox', `${view.x} ${view.y} ${view.w} ${view.h}`);
    apply();
    container.appendChild(svg);

    const toSvg = (x, y) => new DOMPoint(x, y).matrixTransform(svg.getScreenCTM().inverse());

    function zoomAt(factor, x, y) {
      const w = Math.max(base.w / 14, Math.min(base.w * 1.5, view.w / factor));
      const ratio = w / view.w;
      view = { x: x - (x - view.x) * ratio, y: y - (y - view.y) * ratio, w, h: view.h * ratio };
      apply();
    }

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

      const elNode = event.target.closest?.('[data-el]');
      const elId = elNode?.dataset.el;
      const elObj = elId ? elements.get(elId) : null;
      if (elObj && !elObj.locked && onMoveElement && event.button === 0) {
        moveTarget = {
          id: elObj.id,
          el: elObj,
          node: elNode,
          startCx: elObj.cx,
          startCy: elObj.cy,
          startX: event.clientX,
          startY: event.clientY,
          moved: false,
        };
      }
    });
    svg.addEventListener('pointermove', event => {
      const last = pointers.get(event.pointerId);
      if (!last) return;

      if (moveTarget) {
        const scale = 1 / svg.getScreenCTM().a;
        const dx = (event.clientX - moveTarget.startX) * scale;
        const dy = (event.clientY - moveTarget.startY) * scale;
        if (Math.hypot(dx, dy) > 6) moveTarget.moved = true;
        if (moveTarget.moved) {
          moveTarget.node.style.transform = `translate(${dx}px, ${dy}px)`;
          return;
        }
      }

      const before = pointers.size === 2 ? spread() : null;
      pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
      const scale = 1 / svg.getScreenCTM().a;
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
        moveTarget.node.style.transform = '';
        if (moveTarget.moved) {
          const scale = 1 / svg.getScreenCTM().a;
          const dx = (event.clientX - moveTarget.startX) * scale;
          const dy = (event.clientY - moveTarget.startY) * scale;
          const snap = 25;
          const newCx = Math.round((moveTarget.startCx + dx) / snap) * snap;
          const newCy = Math.round((moveTarget.startCy + dy) / snap) * snap;
          onMoveElement(moveTarget.id, newCx, newCy);
          moveTarget = null;
          tap = null;
          return;
        }
        moveTarget = null;
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
      updateElements: list => {
        elements.clear();
        list.forEach(e => {
          elements.set(e.id, e);
          const item = nodes.get(e.id);
          if (item) {
            const pts = e.points ? e.points.map(p => `${p[0]},${p[1]}`).join(' ') : null;
            if (pts) {
              const base = item.node.querySelector('.el-base');
              if (base) base.setAttribute('points', pts);
              const hit = item.node.querySelector('.hit');
              if (hit) hit.setAttribute('points', pts);
            }
            if (item.label) {
              item.label.setAttribute('x', e.cx);
              item.label.setAttribute('y', e.cy);
            }
          } else {
            const isRack = e.type === 'rack';
            const grp = make('g', {
              id: e.id,
              class: `el ${e.type}${e.locked ? '' : ' unlocked'}`,
              'data-el': e.id,
              'data-code': e.code,
              'data-locked': String(Boolean(e.locked)),
              tabindex: '0',
              role: 'button',
              'aria-label': `${isRack ? 'Rack' : 'Pallet'} ${e.code}`
            });
            const pts = e.points ? e.points.map(p => `${p[0]},${p[1]}`).join(' ') : '';
            const basePoly = make('polygon', { class: 'el-base', points: pts });
            grp.appendChild(basePoly);
            const parentGroup = svg.querySelector(isRack ? '#storage-racks' : '#storage-pallets') || svg;
            parentGroup.appendChild(grp);

            const lbl = make('text', {
              class: `lbl ${e.type}`,
              'data-for': e.id,
              x: e.cx,
              y: e.cy
            });
            lbl.textContent = isRack ? e.code : (e.index || e.code.replace(/\D/g, ''));
            const labelsGroup = svg.querySelector('#labels') || svg;
            labelsGroup.appendChild(lbl);
            nodes.set(e.id, { node: grp, label: lbl });
          }
        });
        nodes.forEach(({ node, label }, id) => {
          if (!elements.has(id)) {
            node.remove();
            if (label) label.remove();
            nodes.delete(id);
          }
        });
      },
      async reloadSvg() {
        try {
          const text = await (await fetch('./floorplan.svg?v=' + Date.now())).text();
          const freshDoc = new DOMParser().parseFromString(text, 'image/svg+xml').documentElement;
          const freshNodes = document.importNode(freshDoc, true);
          svg.replaceChildren(...freshNodes.childNodes);
          nodes.clear();
          svg.querySelectorAll('.el').forEach(node => {
            const id = node.id || node.dataset.el;
            const el = elements.get(id);
            if (!el) return;
            node.dataset.el = el.id;
            const label = svg.querySelector(`.lbl[data-for="${el.id}"]`);
            nodes.set(el.id, { node, label });
          });
          svg.appendChild(pins);
          apply();
        } catch (err) {
          console.error('Failed to reload SVG floorplan:', err);
        }
      },
      // inset = share of the map height covered by an overlay at the bottom.
      focus(ids, inset = 0) {
        const targets = [...ids].map(id => elements.get(id)).filter(Boolean);
        const frame = svg.getBoundingClientRect();
        if (!targets.length || !frame.width || !frame.height) return;
        const xs = targets.map(e => e.cx);
        const ys = targets.map(e => e.cy);
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
      paint({ stocked = new Set(), marks = new Map(), selected = new Set() }) {
        nodes.forEach(({ node, label }, id) => {
          const el = elements.get(id);
          const isUnlocked = el && !el.locked;
          node.classList.toggle('unlocked', Boolean(isUnlocked));
          const mark = marks.get(id);
          const isSelected = selected.has(id);
          node.classList.toggle('stocked', stocked.has(id));
          node.classList.toggle('mark', Boolean(mark));
          node.classList.toggle('done', Boolean(mark?.done));
          node.classList.toggle('sel', isSelected);
          node.style.setProperty('--mark', mark ? mark.color : '');
          if (label) {
            label.style.fill = mark && !mark.done ? mark.ink : isSelected && !mark ? '#fff' : '';
            label.style.fontWeight = mark || isSelected ? '700' : '';
          }
        });
        const pinR = Math.max(20, Math.round(state.bounds.w / 35));
        pins.replaceChildren(...[...selected].filter(id => elements.has(id)).map(id => {
          const el = elements.get(id);
          return make('circle', { class: 'pin', cx: el.cx, cy: el.cy, r: pinR });
        }));
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

  let activePeer = null;
  const peerConnections = new Set();
  let clientPeerConnection = null;

  function generateRoomCode() {
    const bytes = crypto.getRandomValues(new Uint8Array(16));
    return Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('');
  }

  function startPeerHost({ roomCode, onStatus, onAction, getState }) {
    if (typeof Peer === 'undefined') {
      onStatus?.('PeerJS library not loaded', 0);
      return null;
    }
    const code = roomCode || generateRoomCode();
    const peerId = 'pickerfox-room-' + code.toLowerCase();
    let currentStatus = 'Connecting to peer signaling network…';

    try {
      if (activePeer) activePeer.destroy();
      activePeer = new Peer(peerId, {
        debug: 1,
        config: {
          iceServers: [
            { urls: 'stun:stun.l.google.com:19302' },
            { urls: 'stun:stun1.l.google.com:19302' },
            { urls: 'stun:stun2.l.google.com:19302' },
            { urls: 'stun:stun.cloudflare.com:3478' }
          ]
        }
      });

      activePeer.on('open', () => {
        currentStatus = `Waiting for phone to scan… (Room ${code})`;
        onStatus?.(currentStatus, 0);
      });

      activePeer.on('connection', conn => {
        peerConnections.add(conn);
        currentStatus = `Phone connected (${peerConnections.size} phone active)`;
        onStatus?.(currentStatus, peerConnections.size);

        const pushState = () => {
          try {
            const s = getState?.();
            if (s && conn.open) conn.send({ type: 'state', state: s });
          } catch {}
        };

        if (conn.open) pushState();
        else conn.on('open', pushState);
        setTimeout(pushState, 350);
        setTimeout(pushState, 1200);

        conn.on('data', data => {
          if (data?.type === 'get_state') {
            pushState();
          } else if (data?.type === 'action') {
            onAction?.(data.path, data.body);
          }
        });

        const drop = () => {
          peerConnections.delete(conn);
          currentStatus = peerConnections.size ? `Phone connected (${peerConnections.size} phone active)` : `Waiting for phone to scan… (Room ${code})`;
          onStatus?.(currentStatus, peerConnections.size);
        };
        conn.on('close', drop);
        conn.on('error', drop);
      });

      activePeer.on('error', err => {
        if (err.type === 'unavailable-id') {
          currentStatus = 'This room is already open in another tab. Press "New room".';
          onStatus?.(currentStatus, peerConnections.size);
          return;
        }
        currentStatus = 'Peer notice: ' + (err.message || err.type);
        onStatus?.(currentStatus, peerConnections.size);
      });
    } catch (err) {
      currentStatus = 'WebRTC init failed: ' + err.message;
      onStatus?.(currentStatus, 0);
    }

    return {
      roomCode: code,
      getStatus: () => currentStatus,
      broadcastState: s => {
        peerConnections.forEach(conn => {
          try { if (conn.open) conn.send({ type: 'state', state: s }); } catch {}
        });
      },
      close: () => {
        peerConnections.forEach(c => c.close());
        peerConnections.clear();
        activePeer?.destroy();
        activePeer = null;
      }
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

  function connectPeerClient({ roomCode, onState, onStatus }) {
    if (typeof Peer === 'undefined') {
      onStatus?.(false, 'PeerJS not available');
      return null;
    }
    const targetPeerId = 'pickerfox-room-' + roomCode.toLowerCase();
    const shortCode = roomCode.slice(0, 6);
    onStatus?.(false, `Connecting to Manager (Room ${shortCode})…`);

    try {
      const clientPeer = new Peer({
        debug: 1,
        config: {
          iceServers: [
            { urls: 'stun:stun.l.google.com:19302' },
            { urls: 'stun:stun1.l.google.com:19302' },
            { urls: 'stun:stun2.l.google.com:19302' },
            { urls: 'stun:stun.cloudflare.com:3478' }
          ]
        }
      });

      clientPeer.on('open', () => {
        onStatus?.(false, `Joining room ${shortCode}…`);
        const conn = clientPeer.connect(targetPeerId, { reliable: true });
        clientPeerConnection = conn;

        const onConnected = () => {
          onStatus?.(true, `Live with Manager (${shortCode})`);
          try { conn.send({ type: 'get_state' }); } catch {}
        };

        if (conn.open) onConnected();
        else conn.on('open', onConnected);

        conn.on('data', data => {
          if (data?.type === 'state') {
            onState?.(data.state);
          }
        });

        const drop = () => {
          onStatus?.(false, 'Disconnected from manager');
          clientPeerConnection = null;
        };
        conn.on('close', drop);
        conn.on('error', err => {
          onStatus?.(false, 'Connection error: ' + (err.message || 'room unreachable'));
          clientPeerConnection = null;
        });
      });

      clientPeer.on('error', err => {
        onStatus?.(false, 'Peer notice: ' + (err.type || err.message));
      });
    } catch (err) {
      onStatus?.(false, 'WebRTC error: ' + err.message);
    }

    return {
      sendAction: (path, body) => {
        if (clientPeerConnection && clientPeerConnection.open) {
          clientPeerConnection.send({ type: 'action', path, body });
          return true;
        }
        return false;
      }
    };
  }

  return { esc, color, swatch, index, address, addresses, locations, progress, status, listMarks, connect, post, toast, createMap, frontView, startPeerHost, connectPeerClient, generateRoomCode, clearSavedData };
})();
