# ALT PPT package format (draft)

## Goal
- Single package file for slide content and assets.
- Works offline and with external URLs.

## Container
- Extension: `.altppt`
- Container: ZIP

## Layout
- `index.html` at the ZIP root is the preferred entry point.
- Assets (images, css, js, media) can live in subfolders.
- External URLs are allowed.

## Entry resolution
- If `index.html` exists, load it.
- Else, load the first `.html` file found at the ZIP root.

## Notes
- This draft keeps backward compatibility with older packages that store a
  single HTML file with a non-standard name.
- Future updates can add an optional `manifest.json` without breaking this.
