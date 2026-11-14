const http = require('http');
const fs = require('fs');
const os = require('os');
const path = require('path');
const {
  buildSeed,
  demoOrder,
  floorplanHash,
  findLatestPlanReviewExport,
  createStorageElement,
  updateElementPoints,
  generateBuildingSvg,
  generateStorageSvg,
  generateSvg,
} = require('./seed');

const PORT = Number(process.env.PORT) || 8080;
const HOST = process.env.HOST || '0.0.0.0';
const PUBLIC = path.join(__dirname, 'public');
const DATA_FILE = path.join(__dirname, 'data', 'state.json');
const SVG_BUILDING = path.join(PUBLIC, 'building.svg');
const SVG_STORAGE = path.join(PUBLIC, 'storage_elements.svg');
const SVG_CACHE = path.join(PUBLIC, 'floorplan.svg');
const COLOR_COUNT = 6;

const STATIC = {
  '/': ['index.html', 'text/html'],
  '/index.html': ['index.html', 'text/html'],
  '/manager': ['manager.html', 'text/html'],
  '/manager.html': ['manager.html', 'text/html'],
  '/picker': ['picker.html', 'text/html'],
  '/picker.html': ['picker.html', 'text/html'],
  '/shared.js': ['shared.js', 'text/javascript'],
  '/shared.css': ['shared.css', 'text/css'],
  '/initial-state.json': ['initial-state.json', 'application/json'],
};

let currentBuildingSvg = '';
let currentStorageSvg = '';
let currentSvg = '';
let cachedParsed = null;

function saveSvgs(buildingSvg, storageSvg, compositeSvg) {
  currentBuildingSvg = buildingSvg;
  currentStorageSvg = storageSvg;
  currentSvg = compositeSvg;
  fs.mkdirSync(PUBLIC, { recursive: true });
  fs.writeFileSync(SVG_BUILDING, buildingSvg, 'utf8');
  fs.writeFileSync(SVG_STORAGE, storageSvg, 'utf8');
  fs.writeFileSync(SVG_CACHE, compositeSvg, 'utf8');
}

function saveAndBroadcastSvgs() {
  const storageSvg = generateStorageSvg({
    bounds: state.bounds,
    elements: state.elements,
    anns: cachedParsed?.anns || [],
  });
  const compositeSvg = generateSvg({
    bounds: state.bounds,
    elements: state.elements,
    anns: cachedParsed?.anns || [],
    blocks: cachedParsed?.blocks || [],
  });
  state.floorplanHash = floorplanHash(compositeSvg);
  saveSvgs(currentBuildingSvg, storageSvg, compositeSvg);
  commit();
}

function loadState() {
  const latestExport = findLatestPlanReviewExport();
  const { state: seeded, buildingSvg, storageSvg, svg, parsed } = buildSeed(latestExport);
  cachedParsed = parsed;
  saveSvgs(buildingSvg, storageSvg, svg);

  try {
    const saved = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
    if (saved.floorplanHash === seeded.floorplanHash && saved.exportSource === seeded.exportSource) {
      return saved;
    }
    console.log(`Plan review export ${seeded.exportSource} loaded: demo data was regenerated.`);
  } catch {
    // No saved state yet.
  }
  return seeded;
}

let state = loadState();
const clients = new Set();

const serverUrls = () => (HOST === '0.0.0.0'
  ? Object.values(os.networkInterfaces()).flat()
    .filter(n => n && n.family === 'IPv4' && !n.internal)
    .map(n => `http://${n.address}:${PORT}`)
  : []);

const payload = () => JSON.stringify({ ...state, serverUrls: serverUrls() });

function commit() {
  state.rev++;
  fs.mkdirSync(path.dirname(DATA_FILE), { recursive: true });
  fs.writeFileSync(DATA_FILE, JSON.stringify(state));
  const message = `data: ${payload()}\n\n`;
  clients.forEach(res => res.write(message));
}

class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

const need = (value, message, status = 404) => {
  if (!value) throw new HttpError(status, message);
  return value;
};

const findList = id => need(state.picklists.find(l => l.id === id), 'Pick list not found');

function nextColor() {
  const busy = new Set(state.picklists.filter(l => l.lines.some(line => !line.picked)).map(l => l.color));
  for (let i = 0; i < COLOR_COUNT; i++) if (!busy.has(i)) return i;
  return (state.nextListNumber - 1) % COLOR_COUNT;
}

function handleApi(route, body) {
  let m;
  if (route === 'POST /api/orders/demo') {
    state.orders.push(demoOrder(state, Math.random));
  } else if (route === 'POST /api/picklists') {
    const order = need(state.orders.find(o => o.id === body.orderId), 'Order not found');
    need(!state.picklists.some(l => l.orderId === order.id), 'This order already has a pick list', 409);
    const number = state.nextListNumber;
    state.picklists.push({
      id: `l${number}`,
      number,
      orderId: order.id,
      orderNumber: order.number,
      customer: order.customer,
      color: nextColor(),
      pickerId: null,
      createdAt: new Date().toISOString(),
      lines: order.lines.map(line => ({ ...line, picked: false, pickedAt: null })),
    });
    state.nextListNumber++;
  } else if ((m = route.match(/^POST \/api\/picklists\/(\w+)\/assign$/))) {
    const list = findList(m[1]);
    const pickerId = body.pickerId || null;
    if (pickerId) need(state.pickers.some(p => p.id === pickerId), 'Picker not found');
    list.pickerId = pickerId;
  } else if ((m = route.match(/^POST \/api\/picklists\/(\w+)\/pick$/))) {
    const line = need(findList(m[1]).lines[body.line], 'Line not found');
    line.picked = Boolean(body.picked);
    line.pickedAt = line.picked ? new Date().toISOString() : null;
  } else if ((m = route.match(/^POST \/api\/picklists\/(\w+)\/delete$/))) {
    const list = findList(m[1]);
    state.picklists = state.picklists.filter(l => l !== list);
  } else if ((m = route.match(/^POST \/api\/elements\/([\w-]+)\/levels$/))) {
    const element = need(state.elements.find(e => e.id === m[1]), 'Storage element not found');
    const levels = Number(body.levels);
    need(Number.isInteger(levels) && levels >= 1 && levels <= 10, 'Levels must be between 1 and 10', 400);
    const affected = body.applyToAll ? state.elements.filter(e => e.type === element.type) : [element];
    const affectedIds = new Set(affected.map(e => e.id));
    const maxStockLevel = Math.max(0, ...state.stock.filter(s => affectedIds.has(s.elementId)).map(s => s.level));
    if (levels < maxStockLevel && !body.force) {
      throw new HttpError(400, `Cannot reduce to ${levels} levels: stock exists on level ${maxStockLevel}. Remove or move the stock first.`);
    }
    affected.forEach(e => { e.levels = levels; });
    saveAndBroadcastSvgs();
    return;
  } else if (route === 'POST /api/elements') {
    const newEl = createStorageElement(state, body);
    if (cachedParsed && cachedParsed.findBlock) {
      newEl.block = cachedParsed.findBlock(newEl.cx, newEl.cy);
    }
    state.elements.push(newEl);
    saveAndBroadcastSvgs();
    return;
  } else if ((m = route.match(/^POST \/api\/elements\/([\w-]+)\/move$/))) {
    const element = need(state.elements.find(e => e.id === m[1]), 'Storage element not found');
    need(!element.locked || body.force, 'Element is locked. Unlock it before moving.', 403);
    const snap = 25;
    element.cx = Math.round(Number(body.cx) / snap) * snap;
    element.cy = Math.round(Number(body.cy) / snap) * snap;
    if (cachedParsed && cachedParsed.findBlock) {
      element.block = cachedParsed.findBlock(element.cx, element.cy);
    }
    updateElementPoints(element);
    saveAndBroadcastSvgs();
    return;
  } else if ((m = route.match(/^POST \/api\/elements\/([\w-]+)\/rotate$/))) {
    const element = need(state.elements.find(e => e.id === m[1]), 'Storage element not found');
    need(!element.locked || body.force, 'Element is locked. Unlock it before rotating.', 403);
    element.dir = element.dir === 'h' ? 'v' : 'h';
    [element.width, element.depth] = [element.depth, element.width];
    updateElementPoints(element);
    saveAndBroadcastSvgs();
    return;
  } else if ((m = route.match(/^POST \/api\/elements\/([\w-]+)\/lock$/))) {
    const element = need(state.elements.find(e => e.id === m[1]), 'Storage element not found');
    element.locked = Boolean(body.locked);
    saveAndBroadcastSvgs();
    return;
  } else if ((m = route.match(/^POST \/api\/elements\/([\w-]+)\/delete$/))) {
    const element = need(state.elements.find(e => e.id === m[1]), 'Storage element not found');
    const stockCount = state.stock.filter(s => s.elementId === element.id).reduce((sum, s) => sum + s.qty, 0);
    if (stockCount > 0 && !body.force) {
      throw new HttpError(400, `Cannot delete ${element.code}: contains ${stockCount} cartons. Empty the element first or confirm force delete.`);
    }
    state.stock = state.stock.filter(s => s.elementId !== element.id);
    state.elements = state.elements.filter(e => e.id !== element.id);
    saveAndBroadcastSvgs();
    return;
  } else if (route === 'POST /api/stock') {
    need(state.products.some(p => p.id === body.productId), 'Product not found');
    const element = need(state.elements.find(e => e.id === body.elementId), 'Storage element not found');
    const { bay, level, qty } = body;
    const whole = n => Number.isInteger(n);
    need(whole(bay) && bay >= 1 && bay <= element.bays && whole(level) && level >= 1 && level <= element.levels, 'Slot does not exist', 400);
    need(whole(qty) && qty >= 0 && qty <= 9999, 'Amount must be a whole number from 0 to 9999', 400);
    const same = s => s.productId === body.productId && s.elementId === element.id && s.bay === bay && s.level === level;
    const entry = state.stock.find(same);
    if (qty === 0) state.stock = state.stock.filter(s => !same(s));
    else if (entry) entry.qty = qty;
    else state.stock.push({ productId: body.productId, elementId: element.id, bay, level, qty });
  } else if (route === 'POST /api/reset') {
    const rev = state.rev;
    const { state: seeded, buildingSvg, storageSvg, svg, parsed } = buildSeed();
    cachedParsed = parsed;
    saveSvgs(buildingSvg, storageSvg, svg);
    state = seeded;
    state.rev = rev;
  } else {
    throw new HttpError(404, 'Unknown request');
  }
  commit();
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let raw = '';
    req.on('data', chunk => {
      raw += chunk;
      if (raw.length > 100000) reject(new HttpError(413, 'Request too large'));
    });
    req.on('end', () => {
      try {
        const body = raw ? JSON.parse(raw) : {};
        if (!body || typeof body !== 'object') throw new Error();
        resolve(body);
      } catch {
        reject(new HttpError(400, 'Invalid JSON'));
      }
    });
    req.on('error', reject);
  });
}

const send = (res, status, type, content) => {
  res.writeHead(status, { 'Content-Type': `${type}; charset=utf-8`, 'Cache-Control': 'no-store' });
  res.end(content);
};

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost').pathname;
  try {
    if (req.method === 'GET' && url === '/api/events') {
      res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-store', Connection: 'keep-alive' });
      res.write(`retry: 1500\n\ndata: ${payload()}\n\n`);
      clients.add(res);
      req.on('close', () => clients.delete(res));
    } else if (req.method === 'GET' && url === '/api/state') {
      send(res, 200, 'application/json', payload());
    } else if (req.method === 'GET' && url === '/building.svg') {
      send(res, 200, 'image/svg+xml', currentBuildingSvg);
    } else if (req.method === 'GET' && url === '/storage_elements.svg') {
      send(res, 200, 'image/svg+xml', currentStorageSvg);
    } else if (req.method === 'GET' && url === '/floorplan.svg') {
      send(res, 200, 'image/svg+xml', currentSvg);
    } else if (req.method === 'GET' && STATIC[url]) {
      send(res, 200, STATIC[url][1], fs.readFileSync(path.join(PUBLIC, STATIC[url][0])));
    } else if (req.method === 'POST' && url.startsWith('/api/')) {
      handleApi(`POST ${url}`, await readBody(req));
      send(res, 200, 'application/json', payload());
    } else {
      throw new HttpError(404, 'Not found');
    }
  } catch (error) {
    if (!error.status) console.error(error);
    send(res, error.status || 500, 'application/json', JSON.stringify({ error: error.status ? error.message : 'Server error' }));
  }
});

// Keeps idle connections open through proxies and phone power saving.
setInterval(() => clients.forEach(res => res.write(': ping\n\n')), 25000).unref();

server.listen(PORT, HOST, () => {
  console.log('PickerFox MVP running');
  console.log(`  Floor plan source: ${state.exportSource}`);
  console.log(`  Building SVG:      http://localhost:${PORT}/building.svg`);
  console.log(`  Storage SVG:       http://localhost:${PORT}/storage_elements.svg`);
  console.log(`  This computer:     http://localhost:${PORT}`);
  serverUrls().forEach(u => console.log(`  Phones on Wi-Fi:   ${u}/picker`));
});
