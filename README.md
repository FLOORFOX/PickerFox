# PickerFox

Indoor warehouse navigation and search for faster picking and better warehouse management.

PickerFox helps warehouse teams move faster and make better decisions. Pickers can quickly find the right product on a visual floorplan and follow a smarter route through the warehouse. Managers can maintain inventory locations, update storage areas, and track which zones are full, available, or low in stock.

## Motivation

Warehouse picking often slows down because employees need to search manually, ask for help, or walk inefficient routes across large facilities. PickerFox aims to reduce that wasted time by combining product search, floorplan navigation, and route guidance in one system.

At the same time, warehouse operations depend on accurate location data. Managers need to assign products to addresses, move stock between locations, activate or deactivate optional storage zones, and update the map as the warehouse changes. PickerFox supports both use cases: helping pickers find products quickly while also giving managers a practical way to maintain the warehouse map and inventory setup.

## What the app should do

- Search for products by SKU or name
- Show matching storage locations on a floorplan
- Highlight racks, bays, and levels visually
- Generate an optimized route for picking
- Support fixed and flexible storage areas
- Let managers move stock between addresses
- Show stock state on the map: full, available, low, empty, inactive
- Display heatmaps for fast-moving and slow-moving locations

## MVP scope

The first version should cover the essentials:

- Upload or edit a warehouse SVG floorplan
- Define fixed rack addresses and storage locations
- Search for products and show their location on the map
- Highlight the selected product and related rack/address
- Generate a simple optimized route for a single pick
- Confirm picks with barcode or QR scan
- Support optional storage zones that can be toggled on and off

## Management features

A strong part of PickerFox is the management experience. Managers need to:

- assign products to storage addresses
- move products between locations
- activate or deactivate flexible storage zones
- manage temporary staging and overflow areas
- see at a glance which locations are full, available, or low in stock
- review heatmaps for product movement and high-traffic areas

## Heatmap and stock visibility

The floorplan should also help teams understand operational patterns. A map overlay can show:

- fast-moving vs slow-moving products
- high-traffic zones
- underused storage areas
- locations that are almost empty or near capacity

This gives both pickers and managers a better picture of how inventory is moving across the warehouse.

## Suggested architecture

### Frontend
- React / PWA for a mobile-friendly warehouse interface
- interactive SVG floorplan viewer
- search, highlighting, and route visualization

### Backend
- Node.js or Python API
- product, location, and inventory services
- route generation and telemetry handling

### Data model
- Product
- Location
- Floorplan
- PickList
- TelemetryEvent

## Roadmap

The project is still early stage, and the roadmap should stay focused on a practical MVP:

1. Create a sample warehouse SVG floorplan and addressing model
2. Build the management view for assigning and moving stock
3. Add product search and map highlighting for pickers
4. Add route generation for single-order picks
5. Add stock-state and heatmap overlays
6. Add scan-based confirmation and warehouse telemetry
7. Validate in a pilot warehouse and iterate on UX

## Project status

Early concept stage. The repo currently contains product planning and direction, but no production-ready application code yet.

## License

A license has not been chosen yet. If the project is meant to be open source, add a license such as MIT or Apache-2.0.

If you want, the next step is to create a structured GitHub milestone and issue plan for the roadmap above.
