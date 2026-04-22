# Resources

Place production assets here:

- `icon.ico` — Windows app icon (256×256 multi-size ICO). Generated from
  `icon.svg` during CI via ImageMagick (`magick resources/icon.svg -define icon:auto-resize=16,24,32,48,64,128,256 resources/icon.ico`).
- `icon.png` — Linux/macOS 512×512 PNG.
- `installerHeader.bmp` / `installerSidebar.bmp` — optional NSIS installer
  graphics.

`icon.svg` is the canonical artwork; regenerate the raster variants rather
than editing them by hand.
