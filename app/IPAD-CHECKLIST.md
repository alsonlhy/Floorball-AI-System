# iPad check (PLAN.md M6)

These are the M6 checks that need a real iPad and Apple Pencil. The automated tests already cover the layout sizes, 44 pt targets, the CSS that blocks zoom/bounce/selection, presentation mode, and offline use in desktop Chrome.

## Before you start: getting the app onto the iPad

Offline use and "Add to Home Screen" as an app need the page served over **HTTPS** (Safari only runs service workers on HTTPS or `localhost`). Two ways:

1. **Quick look, no offline** — on the PC, in `app/`, run `npm run dev -- --host` and open the "Network" address (for example `http://192.168.x.x:5173`) on the iPad on the same Wi-Fi. Everything except the offline section below works this way.
2. **Full check, including offline** — put the built app (`npm run build`, the `app/dist` folder) on any static HTTPS host (GitHub Pages, Netlify, Cloudflare Pages, Vercel). Open that address in Safari.

Boards are stored per browser and per address. Boards made on the PC do not appear on the iPad; use Export / Import to move one.

## 1. Install and offline

- [ ] Safari → Share → **Add to Home Screen**. The icon (rink with two players) and the name "Floorball" appear.
- [ ] Open it from the home screen: no Safari address bar; the board reaches the screen edges but no button sits under the camera, the rounded corners or the home bar.
- [ ] Make a board with a few players. Close the app (swipe it away), turn on **Airplane Mode**, open it again from the home screen. The library and the board are there; you can add a player and draw.
- [ ] Still offline: swipe the app away and reopen. The change you just made is still there.

## 2. Touch

- [ ] Drag a player with a finger: it follows the finger, and the page does not scroll or bounce.
- [ ] Pinch on the rink: it zooms around your fingers. Two-finger drag pans. **Fit** puts it back.
- [ ] Double-tap quickly on empty rink and on a button: the page does **not** zoom.
- [ ] Long-press on the rink and on a player: no text-selection handles, no magnifier, no "Copy / Look up" menu.
- [ ] Pull down from the top and push up from the bottom of the board: the whole app does not rubber-band.
- [ ] Rotate the iPad: in landscape the tools are along the left edge and the pieces along the right edge; in portrait they are rows under the board. The rink refits each time.
- [ ] Holding the iPad in both hands in landscape, you can reach Pen, Arrow, Undo (left thumb) and Home / Away player (right thumb) without letting go.

## 3. Apple Pencil

- [ ] Pick **Pen** and draw with the Pencil: the line follows the tip with no visible lag, and gets thinner/thicker with pressure.
- [ ] After using the Pencil once, rest your palm on the screen and draw: the palm draws nothing and does not move the board.
- [ ] With the Pencil in use, a single finger now pans the board instead of drawing; two fingers pinch-zoom.
- [ ] Draw an arrow, a zone and text with the Pencil. **Undo** removes them one at a time; **Redo** brings them back.
- [ ] The eraser removes a whole drawing when the Pencil touches it.

## 4. Presentation and playback

- [ ] Build a three-step drill (**+ Step**, move players, repeat). Press **Present**: only the board shows, full screen.
- [ ] Play, pause and step through the drill from the controls at the bottom. **Done** returns to editing.

## Report back

For anything that fails, note the iPad model, the iPadOS version, whether you used Safari or the home-screen app, and what happened. A screen recording helps for touch problems.
