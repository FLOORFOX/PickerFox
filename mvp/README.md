# PickerFox MVP

A proof of concept that runs entirely in the browser: a manager page, a picker page and a layout editor. It is published on GitHub Pages from `mvp/public` by `.github/workflows/pages.yml` on every push to `main`.

## Run

- Live: <https://floorfox.github.io/PickerFox/>
- Locally: serve `mvp/public` with any static file server, for example `npx serve mvp/public`, and open the address it prints.

All data lives in the browser (`localStorage`). Tabs on the same computer stay in sync. A phone joins the manager's data through "Connect phone" (see below).

## Demo accounts

The login simulates real authorization for the demo; it is not real security.

| Username | Password | Role |
| --- | --- | --- |
| admin | fox-admin | Admin: manager, layout editor and picker |
| ali | fox-ali | User: picker only, picks as Ali |
| marta | fox-marta | User: picker only, picks as Marta |
| jonas | fox-jonas | User: picker only, picks as Jonas |

Admins add, change and remove users in the manager's **Users** tab.

## Phone connection

- In the manager, **Connect phone** shows a QR code with a long random room code.
- The phone scans it, then logs in. The manager's browser checks the login: without it the phone gets no data and can change nothing.
- A user-role phone can only check off its own pick lists and report issues.
- **Devices** lists the connected phones with user, device and time, and can disconnect them. Deleting a user or changing their password or role disconnects their phones.
- The connection runs through the free PeerJS service to set it up; the data then goes directly between the two browsers, encrypted.

## What it does

- Floor plan with racks and pallets, front view of each rack or pallet with its bays and levels, and slot contents.
- Manager: orders, pick lists with colour and number, assignment to pickers, products, issues, users, stock colours on the map (thresholds editable), export and import of all data.
- Picker: map, product search, assigned pick lists, a checklist to confirm picks, and a "!" button to report low stock, empty or missing products and wrong locations.
- Picking a line takes its cartons from stock (fullest slot first); unchecking puts them back. When there is not enough, the line shows "short N".
- Layout editor: add pallets and racks, tap to select, drag the selected one to move it (25 cm grid), nudge by 50 cm, turn 90°, set levels, delete, and undo.

## Floor plan and starting data

`node mvp/build.js` reads the newest `assets/plan-review/plan-review-annotations_*.json` export and writes `building.svg`, `storage_elements.svg`, `floorplan.svg` and `initial-state.json` into `mvp/public`. Run it after saving a new export. "Reset demo" in the manager goes back to `initial-state.json`.
