const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const RACK_LEVELS = 3;
const BAY_LEN = { 1: 1.14, 2: 2.00, 3: 2.88, 4: 3.78 };
const RACK_POST = 0.09;
const RACK_GAP = 0.08;
const RACK_OVR = 0.05;

const PRODUCTS = [
  ['Pizza box 26 cm kraft', 'PIZZAKARTON 26x26x4 KRAFT 100 ST'],
  ['Pizza box 33 cm kraft', 'PIZZAKARTON 33x33x4 KRAFT 100 ST'],
  ['Pizza box 40 cm kraft', 'PIZZAKARTON 40x40x4 KRAFT 50 ST'],
  ['Pizza box 50 cm family', 'PIZZAKARTON 50x50x5 FAMILY 50 ST'],
  ['Burger box kraft large', 'BURGERBOX KRAFT L 300 ST'],
  ['Fries tray paper medium', 'POMMESSCHALE PAPIER M 500 ST'],
  ['Noodle box 26 oz', 'NUDELBOX 26OZ MIT HENKEL 500 ST'],
  ['Sushi tray black 22 cm with lid', 'SUSHI TRAY 22CM SCHWARZ + DECKEL 400 ST'],
  ['Salad bowl 750 ml kraft', 'SALATSCHALE 750ML KRAFT 300 ST'],
  ['Salad bowl lid 750 ml', 'DECKEL SALATSCHALE 750ML 300 ST'],
  ['Soup cup 16 oz with lid', 'SUPPENBECHER 16OZ + DECKEL 250 ST'],
  ['Aluminium tray 1/2 GN', 'ALUSCHALE 1/2 GN 100 ST'],
  ['Aluminium tray lid 1/2 GN', 'DECKEL ALUSCHALE 1/2 GN 100 ST'],
  ['Menu box 2-compartment', 'MENUEBOX 2-GETEILT 200 ST'],
  ['Kebab bag foil-lined', 'DOENERTASCHE ALU 1000 ST'],
  ['Paper bag with handle large', 'PAPIERTRAGETASCHE L 250 ST'],
  ['Paper bag with handle small', 'PAPIERTRAGETASCHE S 250 ST'],
  ['Carrier bag recycled 38 cm', 'TRAGETASCHE RECYCLING 38CM 500 ST'],
  ['Hot cup 8 oz double wall', 'HEISSBECHER 8OZ DOPPELWAND 500 ST'],
  ['Hot cup 12 oz double wall', 'HEISSBECHER 12OZ DOPPELWAND 500 ST'],
  ['Hot cup lid 80 mm', 'DECKEL HEISSBECHER 80MM 1000 ST'],
  ['Hot cup lid 90 mm', 'DECKEL HEISSBECHER 90MM 1000 ST'],
  ['Cold cup 0.3 l clear', 'KALTBECHER 0,3L KLAR 800 ST'],
  ['Cold cup 0.5 l clear', 'KALTBECHER 0,5L KLAR 800 ST'],
  ['Dome lid for cold cup', 'DOMDECKEL KALTBECHER 800 ST'],
  ['Paper straw 20 cm', 'PAPIERTRINKHALM 20CM 5000 ST'],
  ['Cup carrier 4-cup', 'BECHERTRAEGER 4ER 200 ST'],
  ['Napkin 33 cm white 2-ply', 'SERVIETTE 33CM WEISS 2LG 2000 ST'],
  ['Napkin 40 cm red 3-ply', 'SERVIETTE 40CM ROT 3LG 1000 ST'],
  ['Dispenser napkin 1-ply', 'SPENDERSERVIETTE 1LG 9000 ST'],
  ['Wooden fork 16 cm', 'HOLZGABEL 16CM 1000 ST'],
  ['Wooden knife 16 cm', 'HOLZMESSER 16CM 1000 ST'],
  ['Wooden spoon 16 cm', 'HOLZLOEFFEL 16CM 1000 ST'],
  ['Chopsticks bamboo wrapped', 'ESSSTAEBCHEN BAMBUS 2000 PAAR'],
  ['Wooden stirrer 14 cm', 'RUEHRSTAEBCHEN HOLZ 14CM 10000 ST'],
  ['Baking paper sheets 40x60', 'BACKPAPIER 40x60 500 BL'],
  ['Cling film 45 cm x 300 m', 'FRISCHHALTEFOLIE 45CM 300M 4 RL'],
  ['Aluminium foil 30 cm x 150 m', 'ALUFOLIE 30CM 150M 4 RL'],
  ['Greaseproof paper 1/8 sheet', 'EINSCHLAGPAPIER 1/8 BOGEN 12,5 KG'],
  ['Sauce cup 30 ml with lid', 'DRESSINGBECHER 30ML + DECKEL 2000 ST'],
  ['Sauce cup 80 ml with lid', 'DRESSINGBECHER 80ML + DECKEL 1000 ST'],
  ['Nitrile gloves M black', 'NITRILHANDSCHUHE M SCHWARZ 10x100'],
  ['Nitrile gloves L black', 'NITRILHANDSCHUHE L SCHWARZ 10x100'],
  ['Bin liner 120 l', 'MUELLSACK 120L 250 ST'],
  ['Bin liner 60 l', 'MUELLSACK 60L 500 ST'],
  ['Paper towel roll 2-ply', 'KUECHENROLLE 2LG 32 RL'],
  ['Hand towel paper z-fold', 'FALTHANDTUCH Z-FALZ 3750 BL'],
  ['Dish soap 10 l', 'SPUELMITTEL 10L KANISTER'],
  ['Degreaser spray 750 ml', 'FETTLOESER SPRAY 750ML 12 FL'],
  ['Till roll thermal 80 mm', 'THERMOROLLE 80MM 50 RL'],
];

const CUSTOMERS = [
  'Trattoria Bella', 'Sushi Kumo', 'Burger Werk', 'Café Linde',
  'Pho Saigon', 'Taverna Olympos', 'Kebab Haus Mitte', 'Bowl & Co',
];

const PICKERS = ['Ali', 'Marta', 'Jonas'];

function mulberry32(seed) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const int = (rand, min, max) => min + Math.floor(rand() * (max - min + 1));

function shuffle(rand, items) {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

const rectCorners = (a, b) => [[a[0], a[1]], [b[0], a[1]], [b[0], b[1]], [a[0], b[1]]];
const boxOf = pts => [Math.min(...pts.map(p => p[0])), Math.min(...pts.map(p => p[1])), Math.max(...pts.map(p => p[0])), Math.max(...pts.map(p => p[1]))];
const boxOfMark = m => boxOf(m.points);
const holderDir = h => h.dir || (boxOfMark(h)[2] - boxOfMark(h)[0] >= boxOfMark(h)[3] - boxOfMark(h)[1] ? 'h' : 'v');
const alongOf = (b, dir) => (dir === 'h' ? [b[0], b[2]] : [b[1], b[3]]);
const ptsAttr = pts => pts.map(p => `${p[0]},${p[1]}`).join(' ');

function findLatestPlanReviewExport() {
  const dir = path.resolve(__dirname, '..', 'assets', 'plan-review');
  const files = fs.readdirSync(dir)
    .filter(f => /^plan-review-annotations_.*\.json$/.test(f))
    .sort()
    .reverse();
  if (!files.length) throw new Error('No plan-review-annotations JSON found in assets/plan-review');
  return path.join(dir, files[0]);
}

function rackBays(n) {
  const kb = Math.max(1, Math.ceil(n / 4)), base = Math.floor(n / kb), extra = n % kb;
  return Array.from({ length: kb }, (_, i) => (i < kb - extra ? base : base + 1));
}

function rackLen(n) {
  const b = rackBays(n);
  return b.reduce((s, x) => s + BAY_LEN[x], 0) - RACK_POST * (b.length - 1);
}

function rackLayout(lo, n) {
  const k = 100, bays = rackBays(n), post = Math.round(RACK_POST * k);
  let off = lo;
  return bays.map(s => {
    const L = Math.round(BAY_LEN[s] * k), r = { s, a0: off, len: L };
    off += L - post;
    return r;
  });
}

function drawStepLines(pts, color) {
  const [x0, y0, x1, y1] = boxOf(pts), along = x1 - x0 >= y1 - y0;
  let out = '';
  for (let i = 1; i <= 11; i++) {
    const t = i / 12;
    const a = along ? { x1: x0 + (x1 - x0) * t, y1: y0, x2: x0 + (x1 - x0) * t, y2: y1 } : { x1: x0, y1: y0 + (y1 - y0) * t, x2: x1, y2: y0 + (y1 - y0) * t };
    out += `<line x1="${a.x1}" y1="${a.y1}" x2="${a.x2}" y2="${a.y2}" stroke="${color}" stroke-opacity="0.5" stroke-width="1.4"/>`;
  }
  return out;
}

function drawRackHolder(m, ownedPallets, color) {
  const b = boxOfMark(m), dir = holderDir(m), horiz = dir === 'h';
  const k = 100, ovr = RACK_OVR * k, post = RACK_POST * k, [lo, hi] = alongOf(b, dir);
  const fb = horiz ? [b[0], b[1] + ovr, b[2], b[3] - ovr] : [b[0] + ovr, b[1], b[2] - ovr, b[3]];
  const part = (a0, a1) => ptsAttr(horiz ? rectCorners([a0, fb[1]], [a1, fb[3]]) : rectCorners([fb[0], a0], [fb[2], a1]));
  const count = Number.isInteger(m.count) ? m.count : ownedPallets.length;
  const cuts = count > 0 ? rackLayout(lo, count).slice(1).map(r => [r.a0, r.a0 + post]) : [];

  let pieces = [];
  const strip = (a0, a1) => {
    if (a1 - a0 > 0.3) pieces.push(`<polygon points="${part(a0, a1)}" fill="${color}" fill-opacity="${m.fill ?? 0.3}" stroke="none"/>`);
  };
  const stretch = (a0, a1) => {
    cuts.forEach(c => {
      if (c[0] >= a0 && c[1] <= a1) {
        strip(a0, c[0]);
        a0 = c[1];
      }
    });
    strip(a0, a1);
  };
  const ps = ownedPallets.map(p => alongOf(boxOfMark(p), dir));
  if (ps.length) {
    stretch(lo + post, ps[0][0]);
    for (let i = 1; i < ps.length; i++) stretch(ps[i - 1][1], ps[i][0]);
    stretch(ps[ps.length - 1][1], hi - post);
  }
  pieces.push(`<polygon class="el-base" points="${ptsAttr(rectCorners([fb[0], fb[1]], [fb[2], fb[3]]))}" fill="#ebf2fc" stroke="${color}" stroke-width="2"/>`);
  if (count > 0) {
    [[lo, lo + post], [hi - post, hi], ...cuts].forEach(p => {
      pieces.push(`<polygon points="${part(p[0], p[1])}" fill="${color}" fill-opacity="0.75" stroke="${color}" stroke-width="2"/>`);
    });
  }
  return pieces.join('');
}

function parsePlanReview(exportPath) {
  const raw = fs.readFileSync(exportPath, 'utf8');
  const data = JSON.parse(raw);
  const anns = data.annotations;

  const walls = anns.filter(a => a.category === 'wall');
  const wallPts = walls.flatMap(w => w.points);
  const minX = Math.min(...wallPts.map(p => p[0]));
  const maxX = Math.max(...wallPts.map(p => p[0]));
  const minY = Math.min(...wallPts.map(p => p[1]));
  const maxY = Math.max(...wallPts.map(p => p[1]));
  const pad = 40;
  // Extra bottom padding for the loading dock ramps and labels outside the wall
  const bounds = { x: minX - pad, y: minY - pad, w: maxX - minX + pad * 2, h: maxY - minY + pad + 100 };

  const byRow = (a, b) => {
    const ba = boxOfMark(a), bb = boxOfMark(b);
    const cya = (ba[1] + ba[3]) / 2, cyb = (bb[1] + bb[3]) / 2;
    if (Math.abs(cya - cyb) > 40) return cya - cyb;
    return (ba[0] + ba[2]) / 2 - (bb[0] + bb[2]) / 2;
  };

  const blocks = anns.filter(a => a.category === 'area' && /^hall[12]-block/.test(a.note || ''));
  function findBlock(cx, cy) {
    for (const b of blocks) {
      const bx = boxOfMark(b);
      if (cx >= bx[0] - 10 && cx <= bx[2] + 10 && cy >= bx[1] - 10 && cy <= bx[3] + 10) {
        const note = b.note;
        const hall = note.includes('hall1') ? 'H1' : 'H2';
        const num = note.split('block')[1] || '';
        return `${hall}.${num}`;
      }
    }
    return '';
  }

  const rawRacks = anns.filter(a => a.category === 'rack').sort(byRow);
  const racks = rawRacks.map((r, i) => {
    const b = boxOfMark(r);
    const cx = Math.round((b[0] + b[2]) / 2);
    const cy = Math.round((b[1] + b[3]) / 2);
    const width = b[2] - b[0];
    const depth = b[3] - b[1];
    const dir = r.dir || (width >= depth ? 'h' : 'v');
    const len = Math.max(width, depth);
    const bays = r.count > 0 ? r.count : Math.max(1, Math.round(len / 150));
    return {
      id: r.id,
      type: 'rack',
      code: `R-${String(i + 1).padStart(2, '0')}`,
      block: findBlock(cx, cy),
      cx,
      cy,
      width,
      depth,
      dir,
      bays,
      levels: RACK_LEVELS,
      count: r.count,
      locked: true,
      points: r.points,
    };
  });

  const rawFloorPallets = anns.filter(a => a.category === 'pallet' && (!a.in || a.in.startsWith('row'))).sort(byRow);
  const pallets = rawFloorPallets.map((p, i) => {
    const b = boxOfMark(p);
    const cx = Math.round((b[0] + b[2]) / 2);
    const cy = Math.round((b[1] + b[3]) / 2);
    const width = b[2] - b[0];
    const depth = b[3] - b[1];
    const dir = (width >= depth ? 'h' : 'v');
    return {
      id: p.id,
      type: 'pallet',
      code: `P-${String(i + 1).padStart(3, '0')}`,
      block: findBlock(cx, cy),
      index: i + 1,
      cx,
      cy,
      width,
      depth,
      dir,
      bays: 1,
      levels: 1,
      locked: true,
      points: p.points,
    };
  });

  return { raw, exportPath, bounds, elements: [...racks, ...pallets], racks, pallets, anns, blocks, findBlock };
}

// Building SVG: walls, stairs, doors, obstacle, rooms, and loading dock rolling doors
function generateBuildingSvg({ bounds, anns, blocks = [] }) {
  const walls = anns.filter(a => a.category === 'wall');
  const stairs = anns.filter(a => a.category === 'stairs');
  const doors = anns.filter(a => a.category === 'door');
  const obstacles = anns.filter(a => a.category === 'obstacle');

  const buero = anns.find(a => a.id === 'area-buero');
  const cutout = anns.find(a => a.id === 'area-cutout');
  const wc = anns.find(a => a.id === 'area-wc');
  const wcVorraum = anns.find(a => a.id === 'area-wc-vorraum');

  const hauptstrassen = anns.filter(a => a.category === 'area' && (a.note || '').includes('hauptstrasse'));
  const ladezonen = anns.filter(a => a.category === 'area' && (a.note || '').includes('ladezone'));

  // Align sectional rolling doors with the user's ladezone locations if defined
  const lz1 = ladezonen.find(l => (l.note || '').includes('1'));
  const lz2 = ladezonen.find(l => (l.note || '').includes('2'));
  const cx1 = lz1 ? Math.round((boxOfMark(lz1)[0] + boxOfMark(lz1)[2]) / 2) : 2325;
  const cx2 = lz2 ? Math.round((boxOfMark(lz2)[0] + boxOfMark(lz2)[2]) / 2) : 2825;
  const doorWidth = 280;

  const docks = [
    { id: 'dock-1', name: 'Sektionaltor 1', x1: cx1 - doorWidth / 2, x2: cx1 + doorWidth / 2, cx: cx1 },
    { id: 'dock-2', name: 'Sektionaltor 2', x1: cx2 - doorWidth / 2, x2: cx2 + doorWidth / 2, cx: cx2 },
  ];

  const pieces = [];
  pieces.push(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="${bounds.x} ${bounds.y} ${bounds.w} ${bounds.h}" data-units="cm">`);

  pieces.push(`  <g id="building">`);
  // Warehouse circulation floor (subtle neutral tone)
  pieces.push(`    <rect id="floor" x="1072" y="717" width="2056" height="4506" fill="#fdfdfa" stroke="#cfd5d0" stroke-width="2"/>`);

  // Visible circulation corridors & aisles (Verkehrs- und Fahrwege)
  pieces.push(`    <g id="circulation">`);

  // User-defined Hauptstrassen (or fallback spine)
  if (hauptstrassen.length) {
    hauptstrassen.forEach(h => {
      const bx = boxOfMark(h);
      const cx = Math.round((bx[0] + bx[2]) / 2);
      pieces.push(`      <polygon class="bg-aisle" points="${ptsAttr(h.points)}" fill="#dbe4ed" stroke="#b0c2d4" stroke-width="1.6" stroke-dasharray="10 6"/>`);
      pieces.push(`      <line x1="${cx}" y1="${bx[1] + 15}" x2="${cx}" y2="${bx[3] - 15}" stroke="#70889c" stroke-width="3" stroke-dasharray="18 12" stroke-opacity="0.75"/>`);
      pieces.push(`      <text class="lbl-circulation" x="${cx}" y="${Math.round((bx[1] + bx[3]) / 2)}" transform="rotate(-90 ${cx} ${Math.round((bx[1] + bx[3]) / 2)})">HAUPTSTRASSE</text>`);
    });
  } else {
    pieces.push(`      <rect class="bg-aisle" x="2230" y="741" width="245" height="3940" fill="#dbe4ed" stroke="#b0c2d4" stroke-width="1.6" stroke-dasharray="10 6"/>`);
    pieces.push(`      <line x1="2352" y1="760" x2="2352" y2="4670" stroke="#70889c" stroke-width="3" stroke-dasharray="18 12" stroke-opacity="0.75"/>`);
    pieces.push(`      <text class="lbl-circulation" x="2352" y="1950" transform="rotate(-90 2352 1950)">HAUPTFAHRWEG</text>`);
  }

  // User-defined Ladezonen (or fallback staging area)
  if (ladezonen.length) {
    ladezonen.forEach(l => {
      const bx = boxOfMark(l);
      const num = l.note.replace(/\D/g, '') || '';
      const cx = Math.round((bx[0] + bx[2]) / 2);
      const cy = Math.round((bx[1] + bx[3]) / 2);
      pieces.push(`      <polygon class="bg-ladezone" points="${ptsAttr(l.points)}" fill="#dbe4ed" fill-opacity="0.7" stroke="#70889c" stroke-width="2" stroke-dasharray="12 8"/>`);
      pieces.push(`      <text class="lbl-circulation" x="${cx}" y="${cy - 12}">LADEZONE ${num}</text>`);
      pieces.push(`      <text class="lbl-circulation-sub" x="${cx}" y="${cy + 22}">Bereitstellung</text>`);
    });
  } else {
    pieces.push(`      <rect class="bg-aisle" x="1595" y="4680" width="1509" height="519" fill="#dbe4ed" stroke="#b0c2d4" stroke-width="1.8" stroke-dasharray="12 8"/>`);
    pieces.push(`      <rect x="2150" y="4750" width="350" height="420" fill="none" stroke="#70889c" stroke-width="2.5" stroke-dasharray="14 10" stroke-opacity="0.7"/>`);
    pieces.push(`      <rect x="2650" y="4750" width="350" height="420" fill="none" stroke="#70889c" stroke-width="2.5" stroke-dasharray="14 10" stroke-opacity="0.7"/>`);
    pieces.push(`      <text class="lbl-circulation" x="2325" y="4960">BEREITSTELLUNG TOR 1</text>`);
    pieces.push(`      <text class="lbl-circulation" x="2825" y="4960">BEREITSTELLUNG TOR 2</text>`);
  }

  // West driving aisle (Hall 2) between pallet rows and central spine
  pieces.push(`      <rect class="bg-aisle" x="1780" y="1330" width="130" height="1750" fill="#dbe4ed" stroke="#b0c2d4" stroke-width="1.6" stroke-dasharray="10 6"/>`);
  pieces.push(`      <line x1="1845" y1="1350" x2="1845" y2="3060" stroke="#70889c" stroke-width="2.5" stroke-dasharray="16 10" stroke-opacity="0.65"/>`);
  pieces.push(`      <text class="lbl-circulation" x="1845" y="2400" transform="rotate(-90 1845 2400)">FAHRWEG</text>`);

  // Horizontal cross-aisles (Querwege)
  pieces.push(`      <rect class="bg-aisle" x="1096" y="1060" width="2008" height="150" fill="#dbe4ed" stroke="#b0c2d4" stroke-width="1.6" stroke-dasharray="10 6"/>`);
  pieces.push(`      <rect class="bg-aisle" x="1096" y="1570" width="1380" height="60" fill="#dbe4ed"/>`);
  pieces.push(`      <rect class="bg-aisle" x="1096" y="2131" width="1380" height="144" fill="#dbe4ed"/>`);
  pieces.push(`      <rect class="bg-aisle" x="1096" y="2615" width="1380" height="100" fill="#dbe4ed"/>`);
  pieces.push(`      <rect class="bg-aisle" x="2230" y="2240" width="874" height="190" fill="#dbe4ed"/>`);
  pieces.push(`      <rect class="bg-aisle" x="2230" y="2670" width="874" height="205" fill="#dbe4ed"/>`);
  pieces.push(`      <rect class="bg-aisle" x="1096" y="3207" width="2008" height="50" fill="#dbe4ed"/>`);
  pieces.push(`      <rect class="bg-aisle" x="1096" y="3560" width="1134" height="175" fill="#dbe4ed"/>`);
  pieces.push(`      <rect class="bg-aisle" x="1096" y="3870" width="1134" height="153" fill="#dbe4ed"/>`);

  pieces.push(`    </g>`);

  // Outdoor Cutout: clearly darker exterior tone so it's unmistakably outside the warehouse
  if (cutout) {
    pieces.push(`    <polygon class="bg-cutout" points="${ptsAttr(cutout.points)}" fill="#d0d8d0" stroke="#2d3732" stroke-width="2.5"/>`);
    pieces.push(`    <text class="lbl-outside" x="1572" y="3491">AUßENBEREICH</text>`);
  }

  // Non-warehouse rooms: differentiated with distinct subtle room tones
  if (buero) {
    pieces.push(`    <polygon class="bg-buero" points="${ptsAttr(buero.points)}" fill="#f3eee5" stroke="#2d3732" stroke-width="2.2"/>`);
    pieces.push(`    <text class="lbl-room" x="1333" y="4935">BÜRO</text>`);
    pieces.push(`    <text class="lbl-room-sub" x="1333" y="4970">2 Ebenen</text>`);
  }
  if (wc) {
    pieces.push(`    <polygon class="bg-wc" points="${ptsAttr(wc.points)}" fill="#e9efec" stroke="#2d3732" stroke-width="1.8"/>`);
    pieces.push(`    <text class="lbl-room-sm" x="1178" y="2566">WC</text>`);
  }
  if (wcVorraum) {
    pieces.push(`    <polygon class="bg-wc" points="${ptsAttr(wcVorraum.points)}" fill="#e9efec" stroke="#2d3732" stroke-width="1.8"/>`);
  }

  // Storage block sector boundaries (subtle, non-intrusive zones)
  blocks.forEach(b => {
    const note = b.note || '';
    const h = note.includes('hall1') ? 'HALL 1' : 'HALL 2';
    const num = note.split('block')[1] || '';
    const bx = boxOfMark(b);
    pieces.push(`    <polygon class="bg-block" points="${ptsAttr(b.points)}" fill="#ffffff" fill-opacity="0.45" stroke="#9aa8b5" stroke-width="1.4" stroke-dasharray="10 6" stroke-opacity="0.4"/>`);
    pieces.push(`    <text class="lbl-block" x="${bx[0] + 35}" y="${bx[1] + 45}">${h} · BLOCK ${num}</text>`);
  });

  // Structural walls (outer shell and internal partition walls)
  walls.forEach(w => {
    if (w.shape === 'polygon' || w.shape === 'rect') {
      pieces.push(`    <polygon class="bg-wall" points="${ptsAttr(w.points)}" fill="#e2e6e3" stroke="#2d3732" stroke-width="2.2" stroke-linejoin="round"/>`);
    } else {
      pieces.push(`    <polyline class="bg-wall-line" points="${ptsAttr(w.points)}" fill="none" stroke="#2d3732" stroke-width="2.6" stroke-linecap="round"/>`);
    }
  });

  // Stairs with step lines and label
  stairs.forEach(s => {
    pieces.push(`    <polygon class="bg-stairs" points="${ptsAttr(s.points)}" fill="#eef0ee" stroke="#2d3732" stroke-width="1.8"/>`);
    if (/-steps$/.test(s.id)) pieces.push(`    ${drawStepLines(s.points, '#2d3732')}`);
  });
  pieces.push(`    <text class="lbl-room-sub" x="1170" y="4641">Treppe</text>`);

  // Doors
  doors.forEach(d => {
    pieces.push(`    <polygon class="bg-door" points="${ptsAttr(d.points)}" fill="#e2efe3" stroke="#2e7d32" stroke-width="2"/>`);
  });

  // Obstacles (Building services / Haustechnik)
  obstacles.forEach(o => {
    pieces.push(`    <polygon class="bg-obstacle" points="${ptsAttr(o.points)}" fill="#f3eee9" stroke="#8d6e63" stroke-width="2"/>`);
    pieces.push(`    <text class="lbl-room-sub" x="1197" y="4083">Haustechnik</text>`);
  });

  // Loading Dock Sectional Rolling Doors (Sektionaltore)
  docks.forEach(d => {
    // Break / opening in bottom wall
    pieces.push(`    <rect x="${d.x1}" y="5199" width="${d.x2 - d.x1}" height="24" fill="#f8f8f5"/>`);
    // Rolling door track line across opening
    pieces.push(`    <line x1="${d.x1}" y1="5207" x2="${d.x2}" y2="5207" stroke="#1565c0" stroke-width="4.5" stroke-linecap="round"/>`);
    pieces.push(`    <line x1="${d.x1}" y1="5202" x2="${d.x2}" y2="5202" stroke="#1565c0" stroke-width="1.6" stroke-dasharray="6 3"/>`);
    // End jamb brackets
    pieces.push(`    <rect x="${d.x1 - 4}" y="5198" width="8" height="18" fill="#1565c0" rx="1"/>`);
    pieces.push(`    <rect x="${d.x2 - 4}" y="5198" width="8" height="18" fill="#1565c0" rx="1"/>`);
    // Outside truck guide lines / ramp approach
    pieces.push(`    <path d="M${d.x1} 5223 L${d.x1 + 65} 5285 L${d.x2 - 65} 5285 L${d.x2} 5223" fill="none" stroke="#546e7a" stroke-width="2.2" stroke-dasharray="8 4"/>`);
    // Sektionaltor label inside warehouse floor
    pieces.push(`    <text class="lbl-dock" x="${d.cx}" y="5176">Sektionaltor</text>`);
  });

  pieces.push(`  </g>`);
  pieces.push(`</svg>`);
  return pieces.join('\n');
}

// Storage SVG: pallet rows, floor pallets, racks, and labels
function generateStorageSvg({ bounds, elements, racks: rawRacks, pallets: rawPallets, anns }) {
  const elementsList = elements || [...(rawRacks || []), ...(rawPallets || [])];
  const racks = elementsList.filter(e => e.type === 'rack');
  const pallets = elementsList.filter(e => e.type === 'pallet');
  const rows = (anns || []).filter(a => a.category === 'row');

  const rackPallets = new Map();
  (anns || []).filter(a => a.category === 'pallet' && a.in && a.in.startsWith('rack')).forEach(p => {
    rackPallets.set(p.in, [...(rackPallets.get(p.in) || []), p]);
  });

  const pieces = [];
  pieces.push(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="${bounds.x} ${bounds.y} ${bounds.w} ${bounds.h}" data-units="cm">`);
  pieces.push(`  <defs>`);
  pieces.push(`    <style>`);
  pieces.push(`      .bg-row { fill: none; stroke: #b9a58a; stroke-width: 1.5; stroke-dasharray: 10 5; stroke-opacity: 0.8; }`);
  pieces.push(`      .el { cursor: pointer; }`);
  pieces.push(`      .el-base { vector-effect: non-scaling-stroke; transition: fill 0.12s, stroke 0.12s; }`);
  pieces.push(`      .el.pallet .el-base { fill: #fdfbf7; stroke: #c2c0dc; stroke-width: 1.6; }`);
  pieces.push(`      .el.pallet.stocked .el-base { fill: #e5e3f5; }`);
  pieces.push(`      .el.rack .el-base { fill: #ebf2fc; stroke: #4f84b8; stroke-width: 2.2; }`);
  pieces.push(`      .el.rack.stocked .el-base { fill: #d4e5fc; }`);
  pieces.push(`      .el.mark .el-base { fill: var(--mark) !important; stroke: #182233 !important; }`);
  pieces.push(`      .el.mark.done .el-base { fill-opacity: 0.25 !important; }`);
  pieces.push(`      .el.sel .el-base { stroke: #111 !important; stroke-width: 4 !important; }`);
  pieces.push(`      .el.sel:not(.mark) .el-base { fill: var(--sel) !important; }`);
  pieces.push(`      .el.unlocked .el-base { stroke: #e65100 !important; stroke-width: 3.5 !important; stroke-dasharray: 8 4 !important; }`);
  pieces.push(`      .el.unlocked { cursor: move !important; }`);
  pieces.push(`      .lbl { font: 24px Arial, sans-serif; text-anchor: middle; dominant-baseline: central; pointer-events: none; fill: #656382; paint-order: stroke; stroke: #fff; stroke-width: 4px; stroke-linejoin: round; }`);
  pieces.push(`      .lbl.rack { font-size: 38px; font-weight: 700; fill: #0b2f9e; stroke-width: 6px; }`);
  pieces.push(`      .lbl-room { font: 700 36px Arial, sans-serif; text-anchor: middle; dominant-baseline: central; fill: #374151; letter-spacing: 2px; }`);
  pieces.push(`      .lbl-room-sub { font: 20px Arial, sans-serif; text-anchor: middle; dominant-baseline: central; fill: #6b7280; }`);
  pieces.push(`      .lbl-room-sm { font: 700 24px Arial, sans-serif; text-anchor: middle; dominant-baseline: central; fill: #4b5563; }`);
  pieces.push(`      .lbl-outside { font: 700 32px Arial, sans-serif; text-anchor: middle; dominant-baseline: central; fill: #4e5f52; letter-spacing: 4px; }`);
  pieces.push(`      .lbl-dock { font: 700 18px Arial, sans-serif; text-anchor: middle; dominant-baseline: central; fill: #0d47a1; letter-spacing: 1px; }`);
  pieces.push(`      .lbl-block { font: 700 26px Arial, sans-serif; text-anchor: start; dominant-baseline: central; fill: #607282; fill-opacity: 0.5; letter-spacing: 2px; }`);
  pieces.push(`      .pin { fill: rgba(229, 57, 53, 0.18); stroke: var(--sel); stroke-width: 4; vector-effect: non-scaling-stroke; pointer-events: none; animation: pin-pulse 1.3s ease-in-out infinite alternate; }`);
  pieces.push(`    </style>`);
  pieces.push(`  </defs>`);

  pieces.push(`  <g id="rows">`);
  rows.forEach(r => {
    pieces.push(`    <polygon class="bg-row" points="${ptsAttr(r.points)}"/>`);
  });
  pieces.push(`  </g>`);

  pieces.push(`  <g id="storage-pallets">`);
  pallets.forEach(p => {
    const pts = p.points || p.mark?.points;
    pieces.push(`    <g id="${p.id}" class="el pallet${p.locked ? '' : ' unlocked'}" data-el="${p.id}" data-code="${p.code}" data-locked="${Boolean(p.locked)}" tabindex="0" role="button" aria-label="Pallet ${p.code}">`);
    pieces.push(`      <polygon class="el-base" points="${ptsAttr(pts)}" fill="#fdfbf7" stroke="#c2c0dc" stroke-width="1.6"/>`);
    pieces.push(`    </g>`);
  });
  pieces.push(`  </g>`);

  pieces.push(`  <g id="storage-racks">`);
  racks.forEach(r => {
    const owned = (rackPallets.get(r.id) || []).sort((a, b) => {
      const dir = holderDir(r.mark || r);
      return alongOf(boxOfMark(a), dir)[0] - alongOf(boxOfMark(b), dir)[0];
    });
    const pts = r.points || r.mark?.points;
    pieces.push(`    <g id="${r.id}" class="el rack${r.locked ? '' : ' unlocked'}" data-el="${r.id}" data-code="${r.code}" data-locked="${Boolean(r.locked)}" tabindex="0" role="button" aria-label="Rack ${r.code}">`);
    pieces.push(`      ${drawRackHolder(r.mark || r, owned, '#4f84b8')}`);
    pieces.push(`      <polygon class="hit" points="${ptsAttr(pts)}" fill="transparent"/>`);
    pieces.push(`    </g>`);
  });
  pieces.push(`  </g>`);

  pieces.push(`  <g id="labels" pointer-events="none">`);
  pallets.forEach(p => {
    pieces.push(`    <text class="lbl pallet" data-for="${p.id}" x="${p.cx}" y="${p.cy}">${p.index}</text>`);
  });
  racks.forEach(r => {
    pieces.push(`    <text class="lbl rack" data-for="${r.id}" x="${r.cx}" y="${r.cy}">${r.code}</text>`);
  });
  pieces.push(`  </g>`);

  pieces.push(`</svg>`);
  return pieces.join('\n');
}

// Composite SVG: building underneath, storage elements on top
function generateSvg(parsed) {
  const building = generateBuildingSvg(parsed);
  const storage = generateStorageSvg(parsed);
  const { bounds } = parsed;

  const buildingContent = building.slice(building.indexOf('<g id="building">'), building.lastIndexOf('</svg>'));
  const storageContent = storage.slice(storage.indexOf('</defs>') + 7, storage.lastIndexOf('</svg>'));
  const storageDefs = storage.slice(storage.indexOf('<defs>'), storage.indexOf('</defs>') + 7);

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${bounds.x} ${bounds.y} ${bounds.w} ${bounds.h}" data-units="cm">
${storageDefs}
${buildingContent}
${storageContent}
</svg>`;
}

function demoOrder(state, rand) {
  const number = state.nextOrderNumber++;
  const products = shuffle(rand, state.products).slice(0, int(rand, 4, 8));
  return {
    id: `o${number}`,
    number,
    customer: CUSTOMERS[Math.floor(rand() * CUSTOMERS.length)],
    createdAt: new Date().toISOString(),
    lines: products.map(p => ({ productId: p.id, qty: int(rand, 1, 6) })),
  };
}

function buildSeed(exportPath) {
  const resolvedPath = exportPath || findLatestPlanReviewExport();
  const parsed = parsePlanReview(resolvedPath);
  const rand = mulberry32(20261113);

  const cleanElements = parsed.elements.map(e => ({
    id: e.id,
    type: e.type,
    code: e.code,
    block: e.block,
    cx: e.cx,
    cy: e.cy,
    width: e.width,
    depth: e.depth,
    dir: e.dir,
    bays: e.bays,
    levels: e.levels,
    count: e.count,
    index: e.index,
    locked: true,
    points: e.points,
  }));

  const products = PRODUCTS.map(([name, cartonLabel], i) => ({
    id: `p${i + 1}`,
    sku: `TX-${1001 + i}`,
    mfrSku: `${name.replace(/[^A-Za-z]/g, '').slice(0, 2).toUpperCase()}-${int(rand, 10000, 99999)}`,
    name,
    cartonLabel,
  }));

  const rackSlots = shuffle(rand, cleanElements.filter(e => e.type === 'rack').flatMap(e => {
    const slots = [];
    for (let bay = 1; bay <= e.bays; bay++) {
      for (let level = 1; level <= e.levels; level++) {
        slots.push({ elementId: e.id, bay, level });
      }
    }
    return slots;
  }));

  const palletSlots = shuffle(rand, cleanElements.filter(e => e.type === 'pallet').map(e => ({
    elementId: e.id,
    bay: 1,
    level: 1,
  })));

  const inRacks = 25;
  const stock = [];
  const place = (product, slot) => slot && stock.push({ productId: product.id, ...slot, qty: int(rand, 6, 48) });
  products.forEach((p, i) => place(p, i < inRacks ? rackSlots.pop() : palletSlots.pop() || rackSlots.pop()));

  // A few products get an overflow pallet; a few pallets hold two products.
  shuffle(rand, products).slice(0, 8).forEach(p => place(p, palletSlots.pop()));
  const onPallets = stock.filter(s => cleanElements.find(e => e.id === s.elementId)?.type === 'pallet');
  shuffle(rand, products).slice(0, 5).forEach((p, i) => {
    const host = onPallets[i];
    if (host && host.productId !== p.id) place(p, { elementId: host.elementId, bay: 1, level: 1 });
  });

  const buildingSvg = generateBuildingSvg(parsed);
  const storageSvg = generateStorageSvg(parsed);
  const svg = generateSvg(parsed);
  const svgHash = crypto.createHash('sha1').update(svg).digest('hex');

  const state = {
    rev: 0,
    exportSource: path.basename(resolvedPath),
    floorplanHash: svgHash,
    bounds: parsed.bounds,
    products,
    elements: cleanElements,
    stock,
    pickers: PICKERS.map((name, i) => ({ id: `u${i + 1}`, name })),
    orders: [],
    picklists: [],
    nextOrderNumber: 1001,
    nextListNumber: 1,
  };

  for (let i = 0; i < 5; i++) state.orders.push(demoOrder(state, rand));
  return { state, buildingSvg, storageSvg, svg, parsed };
}

function updateElementPoints(el) {
  const w = el.width || (el.type === 'rack' ? 200 : 80);
  const h = el.depth || 120;
  el.points = rectCorners(
    [el.cx - w / 2, el.cy - h / 2],
    [el.cx + w / 2, el.cy + h / 2]
  );
}

function createStorageElement(state, { type, bays = 3, levels = 3, cx, cy, dir = 'h' }) {
  const isRack = type === 'rack';
  const bounds = state.bounds;
  const targetCx = cx !== undefined ? Math.round(cx) : Math.round(bounds.x + bounds.w / 2);
  const targetCy = cy !== undefined ? Math.round(cy) : Math.round(bounds.y + bounds.h / 2);

  let width, depth, code, id, index, count;
  if (isRack) {
    const existing = state.elements.filter(e => e.type === 'rack');
    const maxNum = Math.max(0, ...existing.map(e => Number(e.code.replace(/\D/g, ''))));
    const num = maxNum + 1;
    code = `R-${String(num).padStart(2, '0')}`;
    id = `rack-custom-${Date.now().toString(36)}`;
    count = bays;
    const len = Math.round(rackLen(count) * 100);
    const dep = 120;
    width = dir === 'h' ? len : dep;
    depth = dir === 'h' ? dep : len;
  } else {
    const existing = state.elements.filter(e => e.type === 'pallet');
    const maxIdx = Math.max(0, ...existing.map(e => Number(e.index || e.code.replace(/\D/g, ''))));
    index = maxIdx + 1;
    code = `P-${String(index).padStart(3, '0')}`;
    id = `pallet-custom-${Date.now().toString(36)}`;
    count = 1;
    width = dir === 'h' ? 120 : 80;
    depth = dir === 'h' ? 80 : 120;
  }

  const el = {
    id,
    type,
    code,
    block: '',
    cx: targetCx,
    cy: targetCy,
    width,
    depth,
    dir,
    bays: isRack ? bays : 1,
    levels: isRack ? levels : 1,
    count,
    index,
    locked: false, // starts unlocked so manager can drag/place it!
    points: [],
  };
  updateElementPoints(el);
  return el;
}

const floorplanHash = svg => crypto.createHash('sha1').update(svg).digest('hex');

module.exports = {
  buildSeed,
  demoOrder,
  floorplanHash,
  findLatestPlanReviewExport,
  parsePlanReview,
  createStorageElement,
  updateElementPoints,
  generateBuildingSvg,
  generateStorageSvg,
  generateSvg,
};
