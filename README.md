# Love Letter to Glasgow

A minimal static photo-book website built around the `Images/` folder.

## How to run locally

From the project root, run a simple local server and open the page in your browser:

```powershell
cd "c:\Users\filelocation"
python -m http.server 4173
```

Then open `http://localhost:4173` in your browser.

## What is included

- `index.html` — page layout and interface
- `styles.css` — dark, minimal styling and book-like visuals
- `script.js` — image loading and page-turn behavior
- `images.json` — manifest of the photos in `Images/`

## Notes

- The site loads the photo list from `images.json`, then builds a spread sequence.
- Some images are shown as dual-page spreads, and some as a full-bleed single page if they are wide.
- The slider works best when served over HTTP, not `file://`.

## Manual Sequencing

You can now use `images.json` in two different ways:

- Automatic mode: an array of filenames, like the current file.
- Manual mode: an object with a `spreads` array so you can art-direct each spread.

`Cover.jpg` and `inside cover.jpg` are still handled separately before the manual sequence starts, so:

- On-screen `Cover` is still the cover.
- On-screen `Spread 2` is still the inside-cover spread.
- The first item in `spreads` becomes on-screen `Spread 3`.

Example manual manifest:

```json
{
  "spreads": [
    {
      "right": "img221.jpg"
    },
    {
      "left": "img244.jpg",
      "right": "img248.jpg"
    },
    {
      "spread": "img262.jpg",
      "margin": "bleed"
    },
    {
      "spread": "img315.jpg",
      "margin": "tight"
    },
    {
      "left": {
        "file": "img366.jpg",
        "margin": "wide"
      },
      "right": {
        "file": "img371.jpg",
        "margin": "tight"
      }
    },
    {
      "left": {
        "type": "blank"
      },
      "right": "img388.jpg"
    }
  ]
}
```

Supported shapes:

- Right-page only:
  `{ "right": "photo.jpg" }`
- Left and right:
  `{ "left": "left.jpg", "right": "right.jpg" }`
- One image across both pages:
  `{ "spread": "wide-photo.jpg" }`
- Blank page:
  `{ "left": { "type": "blank" }, "right": "photo.jpg" }`

Margin controls:

- Presets: `"bleed"`, `"tight"`, `"normal"`, `"wide"`
- Single value:
  `"margin": 18`
- Edge control:

```json
{
  "spread": "img402.jpg",
  "margin": {
    "top": 18,
    "bottom": 18,
    "outer": 18,
    "inner": 0
  }
}
```

For a full spread, `outer` means the outside edges of the book and `inner` means the spine side.
