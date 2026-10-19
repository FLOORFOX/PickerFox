# docs/notes

This folder stores scanned notes, sketches, and photos that help create the SVG floorplan and document layout decisions.

Place your raw photos here (example: `floorplan-sketch.jpg`). After you add a sketch photo, we can trace it into an SVG floorplan.

Naming and workflow
- Place images in `docs/notes/` with names like `YYYY-MM-DD-short-description-author.jpg` (e.g. `2026-10-19-floorplan-sketch-jan.jpg`).
- After adding a photo, run a local trace (Inkscape or any vector tool) or ask me and I can convert it to an SVG for you.

Notes
- Remove EXIF metadata before committing if photos contain location/person data (use `exiftool -all= file.jpg`).
- If images are large, consider using Git LFS. See `docs/notes/LFS_README.md`.
