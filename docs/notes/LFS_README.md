# Git LFS (Large File Storage) guide for PickerFox

Use Git LFS when you intend to track large binary files (images, PDFs, large scans) so the repository stays fast and small.

Quick setup (one-time on each machine):

- Install git-lfs:
  - macOS: `brew install git-lfs`
  - Ubuntu/Debian: `sudo apt install git-lfs`
  - Windows: `choco install git-lfs` or use the Git for Windows installer
- Initialize: `git lfs install`

Track file types (one-time in repo):

```bash
git lfs track "*.png"
git lfs track "*.jpg"
git lfs track "*.jpeg"
git lfs track "*.pdf"
# commit the .gitattributes file
git add .gitattributes
git commit -m "Track images with Git LFS"
```

Optimizing images
- ImageMagick example (resize + quality):
  `magick input.jpg -resize 1600x -strip -quality 80 output.jpg`
- Remove EXIF (sensitive metadata) with exiftool:
  `exiftool -all= output.jpg`
