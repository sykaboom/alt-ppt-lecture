# ALT PPT package format (v2)

## Goal
- Single package file for slide content and assets.
- Works offline and with external URLs.
- JSON-first data model (no DOM/HTML dependency).
- Backward-compatible loader for legacy HTML-based packages.

## Container
- Extension: `.altppt`
- Container: ZIP (no compression required).

## Layout
- `manifest.json` (required)
- `content.json` (required)
- `settings.json` (required)
- `assets/` (optional; binaries)

## manifest.json (required)
```json
{
  "format": "altppt",
  "version": "2.0",
  "createdAt": "2024-01-01T12:00:00Z",
  "updatedAt": "2024-01-01T12:00:00Z",
  "entry": {
    "content": "content.json",
    "settings": "settings.json"
  },
  "assets": [
    {
      "id": "asset_001",
      "path": "assets/asset_001.png",
      "mime": "image/png",
      "bytes": 12345,
      "originalName": "photo.png"
    }
  ],
  "legacy": {
    "source": "html",
    "entry": "index.html"
  }
}
```

## content.json (required)
```json
{
  "documentId": "doc_001",
  "slides": [
    {
      "id": "slide_001",
      "elements": [
        {
          "id": "el_001",
          "type": "image",
          "x": 320,
          "y": 180,
          "width": 640,
          "height": 360,
          "source": {
            "kind": "asset",
            "assetId": "asset_001"
          }
        }
      ]
    }
  ]
}
```

## settings.json (required)
```json
{
  "document": {
    "title": "My Slides",
    "aspectRatio": "16:9",
    "stage": { "width": 1280, "height": 720 }
  },
  "defaults": {
    "text": {
      "fontFamily": "Noto Sans KR, sans-serif",
      "fontSize": 32,
      "fontColor": "#111111",
      "fontWeight": 700
    }
  }
}
```

## Element types
All elements share: `id`, `type`, `x`, `y`, `width`, `height`.

### image
```json
{
  "type": "image",
  "source": { "kind": "asset", "assetId": "asset_001" }
}
```

### video
```json
{
  "type": "video",
  "source": { "kind": "asset", "assetId": "asset_010" },
  "controls": true,
  "autoplay": false,
  "muted": false
}
```

### html (local HTML asset)
```json
{
  "type": "html",
  "source": { "kind": "asset", "assetId": "asset_020" },
  "fov": { "mode": "fov", "scale": 1.0, "offsetX": 0, "offsetY": 0 }
}
```

### embed (external URL, e.g. YouTube)
```json
{
  "type": "embed",
  "provider": "youtube",
  "url": "https://www.youtube.com/watch?v=...",
  "embedUrl": "https://www.youtube-nocookie.com/embed/..."
}
```

### text
```json
{
  "type": "text",
  "text": "Hello",
  "style": {
    "fontFamily": "Noto Sans KR, sans-serif",
    "fontSize": 32,
    "fontColor": "#111111",
    "fontWeight": 700
  }
}
```

## Validation rules (minimum)
- `manifest.json` must exist, `format` must be `altppt`, `version` must be `2.0`.
- `entry.content` and `entry.settings` must exist and point to JSON files in the ZIP.
- All numeric fields must be finite numbers.
- `aspectRatio` must be `16:9` or `4:3`.
- `assets[].id` must be unique; `assets[].path` must exist inside ZIP if referenced.
- `source.kind` must be one of: `asset`, `url`.
- `text.text` must be plain string (no HTML).

## Legacy compatibility
- If `manifest.json` is missing, treat the package as legacy HTML.
- Load the first HTML entry as legacy, parse slides/elements, then convert into v2 model in memory.
- On save, always write v2 (`manifest.json`, `content.json`, `settings.json`, `assets/`).

## Notes
- ZIP container is allowed; the blueprint concern is *data structure*, not file extension.
- External URLs are allowed but must be validated and stored explicitly in `embed` or `video` elements.
