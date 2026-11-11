# TIDOX warehouse workflow and pain points

## Purpose

This document captures how TIDOX currently runs its warehouse operations and where time is lost. It is intended to help turn the business process into clear product requirements for PickerFox.

## People and roles

### Managers
- Two managers organize the warehouse and prepare the day’s work.
- They receive customer orders from restaurants across Berlin.
- They decide how many trucks are needed and plan the delivery routes.
- They organize incoming stock, assign storage locations, and keep the warehouse structured.
- They have deep practical knowledge of where products are stored and how the warehouse operates.

### Pickers
- Pickers collect products according to a printed picking list.
- They load the picked products into the truck(s).
- Some pickers know the warehouse very well, while others are newer or less familiar with recently added products or recent stock movements.
- If they cannot find a product, they often have to stop and ask a manager or another team member.

### Drivers
- Drivers load the finished orders and deliver them to the restaurants.
- The route planning is done by the managers.
- Managers may need to answer customer questions about the truck location during delivery.

## Daily process

### Before the day starts
- Managers receive customer orders from restaurants.
- The managers plan the routes for the day.
- TIDOX has two trucks. If there are too many deliveries for one route, they split the work into two routes.
- Each restaurant order gets a number.
- A separate picking list is printed for each restaurant order, for example: `picklist_1`, `picklist_2`, etc.
- The managers hand the printed lists to the pickers.

### During picking
- The picker starts with one picklist, then another, and so on.
- The picker loads the products into the truck according to the route and restaurant order.
- A major risk is that a picker cannot find a product quickly.
- This causes delays because they have to ask someone for help.
- Some products may be almost empty or there may be less packaging than expected.
- Pickers can often see these issues in reality while handling the stock, even if the managers are responsible for the overall warehouse organization.

### During delivery
- Once the truck or trucks are loaded, drivers take the orders to the restaurants.
- The managers have already planned the route through the city.
- Managers may need to track trucks during the day.
- If deliveries run late, customers may contact the managers and ask where the truck is.

### Warehouse replenishment
- Incoming products are received and organized by the managers.
- The managers decide where products should be stored.
- Inventory information should be kept up to date so the warehouse remains predictable and the pickers can find products faster.

## Main time-loss issues

### 1. Product lookup delays
This is the most obvious and costly problem.
- A picker cannot find an item.
- They stop work and ask a teammate or a manager.
- This is worse when the picker is new, unfamiliar with a product, or the product was recently moved or newly stocked.

### 2. Stock issues are seen too late
Pickers often notice real conditions on the floor, such as:
- a product is nearly empty
- there is less stock than expected
- the packaging is running low
- a storage location seems incorrect or incomplete

If the manager does not get this information quickly, it can cause delay or missed orders later in the day.

### 3. Warehouse knowledge is concentrated in a few people
The managers know the warehouse from experience, but the pickers may not.
The business currently depends on people knowing the layout and product placement by memory.
This makes the process fragile and harder to scale.

### 4. Replenishment and inventory are not fully visible in a shared system
Managers organize incoming goods and storage locations, but the process may not be visible to everyone in a simple, shared way.
This makes fast product lookup and stock visibility harder than it should be.

### 5. Delivery and customer communication gaps
The managers may need to answer customers asking where a truck is.
A live view of truck progress would help but is not the core warehouse problem.

## Requirements implied by the workflow

### For pickers
- Search for a product by name, SKU, or category.
- See the storage location of the product on a warehouse floorplan.
- See a clear visual location of the product in the warehouse.
- Optionally view a photo of the package or product to confirm the correct item.
- Mark location-level issues on the floorplan, such as: low stock, empty location, incorrect placement, or missing product.
- Those issues should be visible to managers.

### For managers
- Manage the warehouse layout and product locations.
- Maintain inventory information in a central system.
- See stock level status, ideally using a simple visual map:
  - green = full
  - yellow = medium / lower
  - red = empty or critical
- See picker-reported problems on the floorplan.
- Possibly manage or send picking lists digitally instead of relying only on paper lists.
- Review product movement and stock health over time.

### Optional / longer-term features
- Show fast-moving vs. slow-moving products as a heatmap on the floorplan.
- Suggest a route through the warehouse for a picker to collect multiple items efficiently.
- Support customer-facing truck tracking with delivery progress, such as “how many stops before delivery”.
- Connect PickerFox to existing ordering or ERP systems for picking lists and stock data.

## Business value summary

The main business value is not just “mapping products” but reducing wasted walking and wasted time caused by uncertainty.
The app should help TIDOX replace a system that depends on a few people knowing the warehouse with a shared, visible, and trackable process.

The most important benefits are:
- faster picking
- fewer interruptions asking where a product is
- better communication between pickers and managers
- more real-time visibility of stock problems
- easier warehouse organization and replenishment

## Next step

This document should inform the product spec and help define the first practical MVP for PickerFox.
