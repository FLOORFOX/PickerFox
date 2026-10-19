# PickerFox

Indoor warehouse navigation and search — help pickers find products faster with optimized routes and real‑time location search.

## Motivation

PickerFox helps warehouse pickers find any product reliably and quickly. Today pickers frequently need to ask supervisors or search manually, which wastes time and slows the whole operation. PickerFox reduces walking time and confusion by showing an optimized route on a floorplan and giving clear, confirmable pick instructions. Over time we also collect movement data to build a heatmap that highlights fast- and slow-moving products so storage locations can be optimized.

## Goals

- Build a clear, maintainable floorplan representation (SVG) that models racks and storage addresses.
- Map every storage space to an address (rack, bay, level). Racks can have up to three levels — the UI should display level information and support a 3D-like visualization (stacked levels or simple 3D rendering) so pickers can quickly see which level to target.
- Provide fast product search → show location(s) on the floorplan and an optimized pick route.
- Capture pick confirmations and movement telemetry to create heatmaps for later optimization.
- Support flexible storage areas (pallet zones, temporary placements) that can be created, activated, deactivated and edited by managers without changing the physical floorplan image.

## Flexible storage spaces & management UI

Warehouses often contain both fixed rack addresses and flexible storage areas (pallets, temporary staging zones) whose contents and addresses change frequently. PickerFox will support both types and provide a management interface so supervisors can maintain accurate location data.

Key management features:
- Define fixed storage addresses for racks (e.g. RACK-12-BAY-03-LEVEL-2). These are single authoritative locations for assigned SKUs.
- Define flexible storage areas as grid/cell regions (chessboard overlay) on the floorplan. Each cell can be toggled active/inactive and assigned an address when in use.
- Move products between addresses via an admin UI (drag/drop or form), or update location programmatically via CSV/import or API.
- Activate/deactivate storage cells to reflect temporary zones (staging, overflow) — inactive cells are ignored by route generation and search unless explicitly included.
- Provide history/versioning for location changes (who moved what, when) to support audits and analytics.

Management UI suggestions:
- An "Edit Floorplan" mode that overlays a configurable grid (chessboard) on top of the SVG. Clicking a cell opens a modal to create/activate a storage space, set its address, or assign products.
- A separate "Locations" admin table for bulk edits, CSV import/export, and search by address or product.
- A visual indicator (color or icon) for cells: empty, occupied, locked (fixed rack), or inactive.
- History panel per location to view recent moves and picks.
- Scanning (QR/barcode) is optional and intended primarily for storage/workflow tasks (e.g. when managers assign or move products, activate/deactivate cells, or perform spot-checks). Scanning should be configurable per site — many sites will prefer fast one-tap confirmations for picks while keeping scans available for audits and product placement.

## Minimum Viable Product (MVP)

- Upload or edit a floorplan SVG and place racks with addresses.
- Product search by SKU or name that returns one or more storage addresses (including flexible cells when active).
- Visual map view: pan/zoom floorplan, highlight rack(s) and level(s), toggle to show grid overlay with active flexible cells.
- Generate an optimized route for a single picklist and display it on the map.
- Quick picker confirmation (single-tap or swipe) for picked items. Scanning (QR/barcode) is optional and available for storing products, location changes, or audits.

## Suggested features (planned)

- Batch pick optimization (combine multiple orders, constraints-aware routing).
- Real-time positioning (BLE beacons / Wi‑Fi RTT / UWB) for live "locate me" on the map.
- Offline caching of current picklist & floorplan for connectivity-poor zones.
- Analytics dashboard: pick times, walking distance, heatmap of product movements.
- Role-based access: picker vs admin, import/export CSV for inventory and locations.

## Floorplan & addressing model

- Floorplans are stored as SVG files. Each rack is mapped to a region/anchor with a unique address (example: RACK-12-BAY-03-LEVEL-2).
- Flexible areas are represented as a grid overlay: each cell has optional metadata (address, enabled flag, occupancy).
- Use a coordinate system (pixel coordinates + floor image dimensions) so we can translate between SVG positions and real-world coordinates when needed.
- For 3D representation: provide a level selector (Level 1/2/3) that layers the appropriate rack level or use a simple 3D view (WebGL/three.js) for a more realistic stack view.

## Heatmap idea

- Collect events when items are picked or when pickers visit a location: { productId, locationId, timestamp }.
- Aggregate visits per location over time to render a heatmap overlay on the floorplan (normalized counts per time period).
- Use heatmaps to recommend relocating high-turn SKUs to more accessible locations.

## Tech options (recommendations)

- Frontend: React (PWA) for fastest iteration and mobile support; consider React + Map/Canvas layers for SVG floorplans. For more 3D-heavy visualizations, use three.js or WebGL.
- Mobile-native alternative: React Native or Flutter if you need tighter native scanner or offline integration.
- Backend: Node.js (Express / Fastify) or Python (FastAPI) for REST APIs. Keep it simple for MVP.
- Database: PostgreSQL (add PostGIS only if you need advanced spatial queries). Redis for caches and ephemeral state.
- Route optimization: start with a simple heuristic (nearest-neighbor) in-app; upgrade to OR-Tools or a server-side TSP solver for complex batching.

## API & data model (brief)

- Product: { id, sku, name, description, locations: [locationId...] }
- Location: { id, code, rackId?, bay?, level?, x, y, floor, type: 'fixed' | 'flexible', active: bool }
- FlexibleCell: { id, floorplanId, gridX, gridY, widthCells, heightCells, address?, active, metadata }
- PickList: { id, items: [{productId, qty, locationId}], status, assignedTo }
- Floorplan: { id, name, svgUrl, widthPx, heightPx, realWidthM, realHeightM }
- TelemetryEvent: { deviceId, userId, locationId, productId?, eventType, timestamp }

Suggested management API endpoints:
- GET /api/floorplans/:id
- POST /api/floorplans (upload SVG)
- GET /api/floorplans/:id/grid (returns grid & flexible cell metadata)
- POST /api/floorplans/:id/grid/cells (create/update cells)
- POST /api/locations (create/modify location entries)
- POST /api/locations/:id/move (update product assignments)
- GET /api/heatmap?from=...&to=...

## How to contribute

- If this repo is public: open issues for feature requests and bugs, submit PRs against the main branch, and follow a CONTRIBUTING.md when one exists.
- If private / internal: add collaborators or invite team members; use issues to track work and small, reviewable PRs for changes.

## Roadmap / next steps

1. Finalize addressing scheme (rack/bay/level format) and sample SVG floorplan.  
2. Decide grid size & flexible-cell semantics for each warehouse/pilot site.  
3. Scaffold frontend (React PWA) with a floorplan viewer, SVG sample, and a grid overlay editor.  
4. Add product search and map highlighting.  
5. Implement simple route generator and picklist flow.  
6. Add manager workflows for assigning/moving products (CSV import, drag/drop, optional scan flows) and start collecting telemetry for heatmaps.  
7. Pilot in one warehouse and iterate on accuracy and UX.

## Project status

Early concept — README and project plan created. No production code yet.

## License

Specify a license. Common choices: MIT (permissive), Apache-2.0 (permissive with patent grant), or keep private/internal.

---

If you want, I can now:
- Create GitHub issues for: admin location management, grid editor, picker quick-confirm UI, and telemetry/heatmap collection.  
- Scaffold a starter project (React PWA + simple server).  
- Add an optional LICENSE file (MIT / Apache-2.0).

Tell me which of these to do next.