// Writes the floor plan SVGs and the starting demo data into mvp/public.
// Run after saving a new plan-review export: node mvp/build.js
const fs = require('fs');
const path = require('path');
const { buildSeed, findLatestPlanReviewExport } = require('./seed');

const PUBLIC = path.join(__dirname, 'public');
const source = findLatestPlanReviewExport();
const { state, buildingSvg, storageSvg, svg } = buildSeed(source);

fs.writeFileSync(path.join(PUBLIC, 'building.svg'), buildingSvg, 'utf8');
fs.writeFileSync(path.join(PUBLIC, 'storage_elements.svg'), storageSvg, 'utf8');
fs.writeFileSync(path.join(PUBLIC, 'floorplan.svg'), svg, 'utf8');
fs.writeFileSync(path.join(PUBLIC, 'initial-state.json'), JSON.stringify(state, null, 2) + '\n', 'utf8');

console.log(`Built from ${path.basename(source)}:`);
console.log(`  ${state.elements.length} storage elements, ${state.products.length} products, ${state.orders.length} orders, ${state.users.length} users`);
