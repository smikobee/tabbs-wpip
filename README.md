Please see the original Tabbs repo. This is the same extension, just with with an added PiP option in the sidebar. This is a feature I've always wanted in vertical tabs, so I had Claude add it in. All credits to eduard1414ed for such a great Chromium extension!

https://github.com/eduard1414ed/tabbs

# Tabbs

A small extension for everyone who got used to tabs in Arc. Tabbs adds a side panel with favorites, folders and spaces.

## How it works

- Folders and links are ordinary bookmarks in the folder “Tabbs”. You can edit them in the bookmark manager. If you remove the extension, your bookmarks will stay.
- Favorites sit on top as tiles.
- Rename, move, pin and unpin with a right-click or by dragging. Drop a tab onto another one to open the two side by side, in browsers that have split view.
- Folders can have a pictogram or an emoji instead of the folder icon.
- Spaces, if you want them: separate sets of links and tabs — say, Work and Home. Switch with the icons at the bottom of the panel or by swiping sideways with two fingers. Off by default.
- A space doesn’t switch browser profiles: logins, history and extensions are shared. It only sorts your links and tabs. Spaces use tab groups, so if you use tab groups yourself, keep spaces off.
- Tabbs can’t hide the browser’s own tabs. In Helium its settings can: the welcome page shows how, step by step. In Chrome, Brave and Edge Tabbs works too, but their tab strip stays visible.
- Moving from Arc: in Helium, Tabbs sorts what Helium’s own import brings over; in other browsers you can upload Arc’s sidebar file.
- The panel opens with the toolbar icon or ⇧⌘S (Ctrl+Shift+S on Windows and Linux). It can’t open by itself when the browser restarts — that’s how Chromium works.

## Install

**Chrome Web Store:** [Tabbs](https://chromewebstore.google.com/detail/tabbs/ildcgodlkfahmmfdfjnjcghpgoecminp)

**From the source:**

1. Download this repository (Code → Download ZIP) and unzip it somewhere it will stay — the browser loads the extension from that folder.
2. Open `chrome://extensions` (in Helium: `helium://extensions`) and turn on **Developer mode** in the top right corner.
3. Click **Load unpacked** and choose the `extension` folder inside the repository.
4. A welcome page opens with the setup steps below. Click the extension’s icon on the toolbar or press **⇧⌘S** (Ctrl+Shift+S on Windows and Linux) to open the panel.

To change the shortcut, open `chrome://extensions/shortcuts` (`helium://extensions/shortcuts`).

The panel can’t open by itself when the browser starts or in a new window — that’s how Chromium works. Use the icon or the shortcut.

## Set up Helium

The welcome page walks you through this, with links to the right settings and a tick for every step; open it again from the panel: right-click empty space → **Welcome & setup**.

The extension can’t hide the browser’s own tab list, but Helium’s settings can. In `helium://settings/appearance`:

1. Set **Layout** to **Vertical**.
2. Turn on **Show vertical tabs on right side**.
3. Turn on **Frameless mode** and **Always show the top bar**, turn off **Always show the sidebar**. Helium’s own tabs hide and slide out at the edge of the window.
4. Further down, in **Side panel position**, set **Helium Panels** to **Left**.
5. With the shortcut you can hide the puzzle icon if you like: **Customize your toolbar** → **Toolbar** → turn off **Extensions**.

Also handy: **Enable quick page link copying with ⌘+Shift+C** (Behavior section) copies the page address.

Using a color theme in Helium? Click the eyedropper at the bottom of the panel, then click the panel’s header — the panel takes the same color. The dark theme switches by itself. To go back to the usual colors, right-click the eyedropper → **Reset color**.

In Chrome, Brave or Edge the extension works too, but their own tab strip stays visible.

## Move from Arc

Right-click empty space in the panel → **Import from Arc…** (or the button on the welcome page).
1. In Helium this opens Helium’s own import: choose **Arc – your name** (not `__ARC_SYSTEM_PROFILE`) and click **Import**.
2. When it’s done, the panel offers **Sort into Tabbs**:
   - favorites become tiles;
   - each space gets a name (Helium loses the names, so its first links are shown) and goes on top, as a folder, as a space, into one of your spaces, or is skipped.
3. The bookmarks are moved out of Helium’s “Imported from Arc” folder on the bookmarks bar, and the emptied folder is removed. **Undo** puts everything back.

In Brave and Edge, or via the small **Choose Arc’s file by hand…** link, choose Arc’s sidebar file, `StorableSidebar.json`:

- **Mac:** `~/Library/Application Support/Arc/StorableSidebar.json` — **Choose file…** copies this path for you: in the file window press ⇧⌘G, then ⌘V, Return and **Open**. Or just drag the file from Finder onto the import dialog.
- **Windows:** `%LOCALAPPDATA%\Packages\TheBrowserCompany.Arc_…\LocalCache\Local\Arc\`

Then pick what to bring: Arc’s favorites become tiles, one space goes on top, other spaces become folders. Nothing in Arc changes, and nothing in Tabbs is deleted — links are only added.

## Spaces

Like in Arc: each space has its own links and open tabs, favorites are shared. Off by default. To turn them on, right-click empty space in the panel → **Turn on spaces…** → tick the folders that become spaces (everything else goes into the first one) → **Turn on**, and Helium asks to let Tabbs manage tab groups — that’s where it keeps which tab belongs to which space. Switch with the icons at the bottom of the panel; right-click an icon to rename it, change its icon, make it a folder or delete it. **Turn off spaces…** in the same menu makes them ordinary folders again; tabs stay open. You can also turn them on from the welcome page.

- **Swipe** sideways with two fingers on the panel to go to the next or the previous space.
- **Keys:** assign them to “Next space” and “Previous space” in `helium://extensions/shortcuts` (none by default).
- **Drag** a tab, a link, a folder or an address onto another space’s icon to move it there; drag an icon along the bar to change the order.
- **Import from Arc** with spaces on brings Arc’s spaces over as spaces: each one into a new space or into one of yours.

Helium shows tab groups on the bookmarks bar. To keep spaces off it, turn off “Automatically pin new tab groups to the bookmarks bar” (or “Show tab groups in bookmarks bar”) in `helium://settings/appearance`. If you use tab groups yourself, keep spaces off.

## Back up

`helium://bookmarks` → ⋮ → **Export bookmarks**. To restore, import the file and put the “Tabbs” folder back into “Other bookmarks”.

## Limitations

- The panel opens only from the icon or the shortcut.
- The panel header (icon, name, pin, ×) is drawn by the browser.
- After a browser restart, links find their tabs again by address during the first 30 seconds.
- Sites that aren’t in your history show a grey globe instead of their icon.

## Privacy

Nothing is collected or sent anywhere: no network requests, no analytics, no remote code. See [PRIVACY.md](PRIVACY.md).

## Development

Plain HTML, CSS and JavaScript modules, no dependencies and no build step: `extension/` loads as it is (Load unpacked). The logic that doesn’t need a browser is in `extension/lib/` and is tested with Node 22+:

```
npm test
npm run pack      # dist/tabbs-<version>.zip, as it goes to the Chrome Web Store
```

`scripts/arc-to-bookmarks.mjs` turns Arc’s sidebar into a bookmarks HTML file — the import before the panel could do it. `scripts/pictograms.mjs` makes `extension/lib/pictograms.js` from the Phosphor Icons package.

This repository is a snapshot of the author’s working copy, updated with each release; what changed is in [CHANGELOG.md](CHANGELOG.md).

## License

[MIT](LICENSE) © Eduard Tsarionov

The pictograms for folders and spaces are [Phosphor Icons](https://phosphoricons.com), MIT — see [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).
