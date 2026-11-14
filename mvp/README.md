# PickerFox MVP

A proof of concept with a manager page and a picker page that stay in sync through a small local server. It needs Node.js and nothing else.

## Run

### Local server (Node.js)

From the repository root:

```
node mvp/server.js
```

- Manager (desktop): http://localhost:8080/manager (or `http://localhost:8080/manager.html`)
- Picker (phone): the server prints an address like `http://192.168.x.x:8080/picker`. The phone must be on the same Wi-Fi, and Windows may ask once to allow Node through the firewall.

The server has no login and is reachable by every device on the network. To keep it on this computer only, set `HOST=127.0.0.1`. `PORT` changes the port.

### GitHub Pages (In-browser static mode)

The app is **dual-mode**: when hosted statically on GitHub Pages or any static web host without Node.js:
- It automatically detects the static environment.
- It loads `./initial-state.json` and manages state directly in browser `localStorage`.
- Open tabs on the same computer (e.g. Manager in one window, Picker in another) sync in real time using the browser's native `BroadcastChannel` API.
- Deployed automatically from `mvp/public` via GitHub Actions (`.github/workflows/pages.yml`).

To enable GitHub Pages in your GitHub repository:
1. Go to repository **Settings > Pages**.
2. Under **Build and deployment > Source**, select **GitHub Actions**.
3. Pushing to `main` will automatically build and publish the site.

## What it does

- Floor plan & storage layout: loaded directly from the latest export of `plan-review` (`assets/plan-review/plan-review-annotations_*.json`). It automatically detects and uses the newest export (currently `plan-review-annotations_20261113-222324.json`), separating the warehouse into two clean SVGs sharing the same coordinate frame:
  - `building.svg` (http://localhost:8080/building.svg): the building itself — outer walls, interior partitions, loading dock rolling doors (*Sektionaltor 1 & 2* with ramp guides), loading zones (*Ladezone 1 & 2* / Bereitstellung), driving thoroughfares (*Hauptstrasse* / circulation corridors), room differentiation (Büro with "2 Ebenen", WC, Haustechnik), darker outdoor cutout (*Außenbereich*), and subtle 6-block sector boundaries (`H1.1–H1.3`, `H2.1–H2.3`).
  - `storage_elements.svg` (http://localhost:8080/storage_elements.svg): the storage elements — all 26 racks (`R-01` to `R-26`), 29 pallet rows (194 floor pallets `P-001` to `P-194`), and their labels.
  - `floorplan.svg` (http://localhost:8080/floorplan.svg): the composite view of both layers.
- Human-readable block addresses: every storage element is mapped to its Hall and Block sector (e.g. `H2.1 · R-01 · B1 · L2` or `H2.2 · P-064`), making finding items intuitive.
- Demo data: 50 restaurant-supply products, 5 orders, 3 pickers, with stock distributed across the real racks and pallets.
- Manager:
  - Create pick lists from orders, assign them to pickers, and follow progress live.
  - Front view: click any rack or pallet to see its bays and vertical levels.
  - Configurable levels: adjust vertical level count (1 to 6) per storage element, or apply across all racks/pallets with one click.
  - Multi-product slots: place multiple different products in any slot (e.g. sharing a pallet or shelf), change carton counts, or remove products.
  - Lightweight Layout Editor:
    - Dedicated **`Edit layout`** mode switch in the top header.
    - When active, collapses operational sidebars to maximize floorplan space, revealing a clean full-width tool strip: `＋ Pallet`, `＋ Rack 2-Bay`, `＋ Rack 3-Bay`, `＋ Rack 4-Bay`.
    - **Position lock safeguard:** All racks and pallets are **locked by default** to prevent accidental movement. Moving or rotating requires an explicit **`Unlock to move`** step on the selected element.
    - Unlocked elements can be dragged across the floor (with automatic 25 cm grid snap) or rotated 90° (`↻ 90°`).
    - Delete elements with automatic safety check if stock is stored on them.
- Picker: map as the main view, product search, assigned pick lists with number and colour, and a checklist to confirm picks. When viewing an item, the card shows any other products sharing the same slot.
- Every change appears on all open pages within about a second.

## Data

State is saved in `mvp/data/state.json` (not committed), so it survives a restart. "Reset demo" on the manager page restores the starting data. Whenever a newer plan-review export is saved into `assets/plan-review/`, the server detects the updated source, regenerates `building.svg`, `storage_elements.svg`, and `floorplan.svg`, and resets the demo data to match the new warehouse geometry.
