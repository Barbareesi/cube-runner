# Neon Dash

A colorful Three.js endless runner. Move between the three lanes with **← / →** (or **A / D**) and jump with **↑ / Space** to avoid the incoming blocks. Collect coins for bonus points and spend them in the **Cube Shop** to unlock accessories. Cube color and owned items are saved in the browser. On touch screens, use the on-screen arrow buttons. Your best score is saved in the browser.

Open **Cube Shop** from the game header to choose a free cube color or spend coins on the street cap (35), headphones (55), or crown (90). Purchased accessories remain unlocked and can be equipped on later visits.

## Run

The game uses browser ES modules, so serve this folder over HTTP. From this folder, run:

```sh
python3 -m http.server 8000
```

Then open `http://localhost:8000` in a modern browser. Three.js and the optional display fonts are loaded from CDNs, so an internet connection is required.
