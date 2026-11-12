# PickerFox product spec

## Purpose

PickerFox is a warehouse product-finding and picking-support app for Tidox, a company that buys restaurant supplies in bulk and sells them in smaller quantities, including takeaway packaging and other single-use items. Its main goal is to help warehouse pickers find the right product quickly, reduce picking errors and wasted walking, and share warehouse conditions with managers.

It works break-bulk: it buys by the pallet or container and sells by the carton, from its own warehouse. This break-bulk nature determines the app's processes.

## Business context

Tidox serves restaurant customers across Berlin. Managers receive orders, prepare a numbered picking list for each restaurant order, plan deliveries using one or two trucks, and organize incoming stock and warehouse locations. Pickers use those lists to collect products and load the orders for delivery. Managers have extensive knowledge of the warehouse, while pickers may have different levels of experience and may not know about recently added or moved products.

## Problem statement

- Pickers can lose time searching for products, especially when they are new or unfamiliar with a product or a recent location change.
- When a picker cannot find an item, they may need to stop and ask a manager or teammate.
- Pickers can see low or missing stock while picking, but managers may not learn about the problem quickly enough.
- Warehouse location and stock knowledge should be easier to share and keep up to date.
- Several restaurant orders are picked each day. If lists or the products picked for different orders are confused, the wrong order may be loaded for a restaurant.
- Customers sometimes contact managers for delivery updates. This is a possible future opportunity, separate from the core warehouse-picking problem.

## Users

- **Developer:** the FloorFox team. Uses plan review, a separate tool outside the app, where the warehouse floor plan is drawn and maintained.
- **Pickers:** The Tidox pickers. Find products, follow picking lists, and report issues at storage locations.
- **Managers:** The Tidox managers, our customer. Organize the warehouse, search products by SKU or name, manage product/location and inventory information, prepare picking work, and review reported issues.
- **Drivers:** Deliver the completed restaurant orders. Driver tools are not part of the initial warehouse MVP.
- **Customers:** May benefit from delivery progress information in a later phase.

## Interfaces

There are three interfaces:

- Manager: the editor of products, stock, storage elements and pick lists.
- Picker: the viewer.

## Product goals

1. Help every picker find the correct product and storage location without relying on another person’s memory.
2. Reduce wasted walking, interruptions, and picking mistakes.
3. Make stock issues observed by pickers visible to managers.
4. Help managers maintain a shared, useful view of product locations and stock status.
5. Keep each restaurant order’s picking work clearly identifiable to reduce the risk of mixing orders.

## Map

- Shows construction elements (walls, door, stairs, areas) for orientation, storage elements (racks, rows, pallets) that hold products, and obstacles.
- The map is the top view. It shows storage elements, not slots.
- Clicking a storage element opens its front view: its bays, levels, pallets and slots drawn, with a details box in text: the products with their details, and the amounts: cartons per product and the number of different products.

## Storage

- A product can span several levels, pallets or racks.
- Every storage element has a coordinate address and a human-readable id, coded by hall, aisle or similar.
- Products sit in slots. A slot is addressed by the storage element it is in: element, level, slot. In a rack: rack, bay, level, slot. A pallet in a rack: rack, bay, level, pallet, slot.
- Freestanding pallet rows are flexible storage. Pallets, especially freestanding ones, can have levels too.
- Racks are fixed storage. A rack is built from bays, and each bay has levels.
- Racks without pallets can also carry slots.
- Building services (Haustechnik) and similar items are obstacles, not storage elements.
- A level can hold one slot or several. A slot can hold one product or several.

## Products

- Name
- Tidox SKU (Tidox Art.-Nr.)
- Manufacturer SKU (Hersteller-Code)
- Label on the carton (Bezeichnung auf Karton)
- Photo of the product, the carton, or both

## MVP requirements

### Product search and warehouse map

- Search for products by name or SKU.
- Show the matching product’s storage location on the warehouse floorplan.
- Clearly highlight the location, such as the rack, bay, or slot/address, where that information is available.
- Show a product or package photo to help a picker verify they have the right item.
- Make the interface usable on smartphones, which the pickers will use.
- Touch: pan by default, pinch to zoom, smooth on a phone.

### Picking lists and order separation

- **Manager:** Prepares lists of products to collect and assigns them to pickers.
- **Picker:** Sees the pick lists assigned to them.
- Represent each restaurant order as a separate, numbered picking list.
- Make the active picking list easy for the picker to identify while collecting products.
- Give each list a distinct color, for example: Picklist 1 = green, Picklist 2 = yellow, with additional lists assigned other distinguishable colors.
- Show the list number/name and color together wherever the list is shown; do not rely on color alone to identify an order.
- Use the same list identity consistently in the picking interface and, where supported, on printed lists or order containers so the picker can keep each restaurant’s items separate while picking and loading.
- Avoid using colors that are too similar at the same time, and ensure text and markers remain readable for users with color-vision deficiencies.
- Make it clear which list/order a picker is currently working on and provide a way to switch lists deliberately.
- **Picker:** Confirms each pick, for now with a simple checklist instead of barcode or QR scanning.

### Picker-reported issues

- A "!" button for reporting things.
- Let pickers report a problem associated with a product and/or storage location on the floorplan.
- Initial issue types should include low stock, empty/missing product, and incorrect or uncertain location.
- Make new reports visible to managers with the affected product, location, issue type, and time reported where available.
- Keep reporting quick enough to use during picking.

### Manager inventory and warehouse information

- Let managers maintain products and their storage locations, assign products to slots, and move stock between slots.
- Let managers record incoming stock and update inventory information.
- Show a simple stock status on the map: green for full, yellow for medium/low, red for empty or critical. Details are to be specified in UX/UI.
- Make the status thresholds configurable or clearly defined with Tidox; do not assume one universal definition of “medium.”
- Show picker-reported issues to managers so they can investigate and resolve them.
- Places racks and pallets freely on the map; only storage elements, not the building.
- Sets any number of levels, slots and products on a pallet.

## Technical

### Frontend

- Interactive SVG floor plan viewer: zoom and pan; each storage element is its own object that can be highlighted or clicked.

### Backend

- An API: the requests the screens send to the server.
- Product, storage and inventory services: the product catalog, the storage elements and their slots, and what is stored where and in what amount.
- Telemetry: events recorded as they happen; the heatmaps are built from it.

### Data model

- Product: one item for sale, with its SKU, name and similar details.
- StorageElement: a rack, row or pallet on the map, with a coordinate address and a human-readable id.
- Slot: a place in a storage element that holds products, addressed by element, bay, level and slot.
- Floorplan: the warehouse drawing that the storage elements sit on.
- PickList: a list of products to collect, assigned by a manager to a picker.
- TelemetryEvent: one recorded event, such as picked, moved or restocked, with time and place.

## Later / optional features

These are useful possibilities but are not required to deliver the core product-finding MVP:

- Import or send picking lists directly from Tidox’s existing order/EDV system, depending on available integration options.
- Suggest an efficient route through the warehouse for a picker collecting several products.
- Show fast-moving and slow-moving products, high-traffic areas, or underused storage as heatmaps, based on reliable movement data.
- Support overflow and temporary staging locations.
- Plan or optimize delivery routes through the city.
- Provide customer-facing delivery tracking, including truck location and the number of stops before delivery. This requires a decision about data access and privacy.
- Barcode or QR scanning to confirm picks.

## Out of scope for the initial MVP

- Replacing Tidox’s complete order-management or EDV system.
- Full city delivery routing and customer-facing live truck tracking.
- Advanced analytics or heatmaps before dependable inventory and movement data is available.
- Complex multi-picker workflow automation before the basic product, location, and picking-list data is reliable.

## Success measures

The MVP should be evaluated with warehouse staff. Useful measures include:

- Time taken to find a product compared with the current process.
- How often pickers need to ask someone where a product is.
- Picking errors, including products assigned to the wrong restaurant order.
- How quickly managers see and resolve reported stock or location issues.
- Whether pickers can distinguish active picking lists and keep their orders separate.
- Whether product locations and stock statuses stay accurate enough to trust.

Specific targets should be agreed with Tidox after observing the current process and establishing a baseline.

## Example acceptance scenarios

- A picker searches by SKU, sees the matching product and storage address, and can locate it on the warehouse floorplan.
- A picker can view a package photo, when one is available, to confirm the selected product.
- A picker reports that a location is nearly empty; a manager can see the report and its location.
- A manager records incoming stock or updates a product location; the updated information is available to pickers.
- Picklist 1 and Picklist 2 have different, consistently displayed colors and visible list numbers, so a picker can tell which restaurant order is active without depending on color alone.
- A picker can see which list an item belongs to and keep products for separate restaurant orders distinct while picking and loading.

## Assumptions and questions to validate

- Confirm the exact names used at Tidox: “picking list,” “picklist,” “packlist,” or another term.
- Confirm how many lists are typically active at once and how colors should be assigned when there are many lists.
- Confirm the current source of product, SKU, location, order, and stock data, and whether it can be integrated.
- Define how inventory quantities are updated and how full, medium/low, and empty thresholds should work.
- Confirm whether each order is collected in a separate cart, pallet, tote, or another marked container.
- Confirm which issue types and follow-up steps managers need.
- React.
- A PWA (installable on a phone like an app, partly usable offline, no app store).
- Node.js or Python for the backend.
- The code of the human-readable id.
- How racks without pallets carry slots.

## Relationship to workflow notes

See [`warehouse-workflow.md`](warehouse-workflow.md) for the observed description of Tidox’s current daily warehouse and delivery process, roles, and pain points. This product spec translates that context into goals and requirements for PickerFox.
