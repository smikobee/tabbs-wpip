import { strings, pickLanguage } from './lib/strings.js';
import { splitFavorites, findFavorites, tileColumns } from './lib/favorites.js';
import { parseArcSidebar, planArcImport, planArcSpacesImport, defaultSpaceFor, countNodes, ARC_FOLDER, ARC_FILE } from './lib/arc.js';
import { findArcImport, defaultArcSort, planArcSort, undoSteps } from './lib/arc-import.js';
import {
  buildTree,
  collectIds,
  collectLinks,
  nodesById,
  peekLinks,
  isRelevantEvent,
  toggleId,
  fallbackIcon,
  splitLeadingEmoji,
} from './lib/tree.js';
import { BINDING_PREFIX, resolveClick, planOpenAll, linkState, tabUrl } from './lib/binding.js';
import { splitWindowTabs, placePairs, tabTitle, iconVersion, soundState, pairSoundState, inSplit } from './lib/tabs.js';
import { completeUrl } from './lib/urls.js';
import {
  pinIndex,
  countContents,
  snapshotSubtree,
  restoreSubtree,
  restoredBindings,
  restoredPictograms,
  remapIds,
} from './lib/edit.js';
import { menuItems, SEPARATOR } from './lib/menu.js';
import { bookmarkDrop, tabDrop, splitDrop, droppedLink } from './lib/drop.js';
import {
  FOLDER_EMOJI,
  withFolderEmoji,
  pickEmoji,
  pictogramSections,
  PICTOGRAM_PREFIX,
  pictogramKey,
  isPictogram,
  parsePictograms,
  folderIconOf,
  stalePictograms,
} from './lib/folder-icons.js';
import { PICTOGRAMS } from './lib/pictograms.js';
import { PANEL_COLOR_KEY, panelPalette, parsePanelColors, colorFor, withColor, isOwnColor, parseHex, parseRgb, toHex, over } from './lib/panel-color.js';
import { themeOf } from './lib/action-icon.js';
import {
  resolveSpaces,
  spaceIcon,
  linkSpaces,
  enableCandidates,
  planEnable,
  needsFirstSpace,
  neighborSpace,
  tabTargets,
  regroupPlan,
  windowSpace,
  pickSpaceTab,
  adjacentSpace,
  reorderSpaces,
  swipeStep,
  SWIPE,
  parseSpaceSession,
  isSpaceSessionKey,
  lastTabKey,
  CURRENT_PREFIX,
  GROUP_PREFIX,
  NO_GROUP,
} from './lib/spaces.js';
import {
  openMenu,
  openIconPicker as openIconPopup,
  openField,
  confirmDialog,
  openArcImport,
  openArcHint,
  openArcSort,
  openEnableSpaces,
  openSpaceDialog,
  showToast,
} from './widgets.js';
import { setUpDrag } from './drag.js';
import { setUpMiniPlayer } from './mini-player.js';
import {
  ROOT_ID_KEY,
  EXPANDED_KEY,
  findRootFolder,
  ensureRoot,
  getSubTree,
  getExpanded,
  setExpanded,
  getCurrentWindowId,
  openInNewTab,
  getAllTabs,
  activateTab,
  getBindings,
  setBindings,
  bindTab,
  unbind,
  requestRestore,
  faviconUrl,
  createBookmark,
  updateBookmark,
  removeBookmark,
  removeBookmarkTree,
  childCount,
  moveTab,
  moveBookmark,
  canSplitTabs,
  createSplit,
  unsplit,
  openSplitTab,
  setTabGroup,
  uiLanguage,
  appName,
  followThemeWithActionIcon,
  platform,
  extensionUrl,
  IMPORT_REQUEST_KEY,
  SPACES_REQUEST_KEY,
  takeRequest,
  SPACES_KEY,
  requestTabGroups,
  getSpaceIds,
  setSpaceIds,
  getSpacesBefore,
  getSpaceSession,
  setSpaceSession,
  setWindowSpace,
  setLastTab,
  tidySpaces,
  turnSpacesOff,
  moveTabsToSpace,
  openBrowserPage,
  IMPORT_PAGE,
  builtInArcImport,
  ARC_PENDING_KEY,
  getArcPending,
  setArcPending,
  forgetArcPending,
  getArcCleanup,
  setArcCleanup,
  getBookmark,
  lastFocusedWindowId,
  getLocalItems,
  setLocalItems,
  removeLocalKeys,
  getPanelColors,
  setPanelColors,
  panelSide,
} from './lib/browser.js';

const RELOAD_DELAY_MS = 50;
const TABS_DELAY_MS = 30;
// A new or restored row is scrolled into view after its folder's expand animation (--dur).
const REVEAL_DELAY_MS = 200;
// After sorting an import from Arc, how long Helium's emptied folders wait for an undo when the
// toast didn't say (the panel was closed): a hovered toast stays longer than UNDO_MS.
const ARC_CLEANUP_AFTER_MS = 60_000;
// How long "Deleted · Undo" stays.
const UNDO_MS = 5000;
const SVG_NS = 'http://www.w3.org/2000/svg';

// Texts in the browser's language (English or Russian).
const S = strings(uiLanguage(), appName());
document.documentElement.lang = pickLanguage(uiLanguage());

const listEl = document.getElementById('list'); // scrolls; holds the favorites, the tree and the open tabs
const favoritesEl = document.getElementById('favorites'); // tiles; stays on top while the list scrolls
const treeEl = document.getElementById('tree');
const openTabsEl = document.getElementById('open-tabs');
const spacesEl = document.getElementById('spaces'); // the bar of space icons at the bottom
document.title = S.appName;

// The video of the tab you left, above the bar (stage 10, mini-player.js).
const miniPlayer = setUpMiniPlayer({ S, before: spacesEl });

const state = {
  rootId: null,
  favoritesId: null, // the folder shown as tiles (lib/favorites.js), null if there is none
  knownIds: new Set(), // the root and everything inside it
  expanded: [], // ids of expanded folders, mirrored in storage.local
  windowId: undefined,
  links: new Map(), // bookmarkId → link, all links shown (tiles and the tree)
  allLinks: new Map(), // the same with spaces off; with spaces on — of all spaces too
  nodes: new Map(), // id → link or folder, all of the tree
  rootChildren: [], // top level of the root folder
  tree: null, // the root folder (lib/tree.js model) as last loaded
  shown: null, // splitFavorites(tree): { favorites, tiles, rest }
  treeRootId: null, // the folder the tree shows: the root, or the current space
  treeNodes: [], // what the tree shows at its top level
  treeLinkIds: [], // links of the tree (not tiles) in tree order: where a split pair can show
  bindings: new Map(), // bookmarkId → tabId, mirrored from storage.session
  pictograms: new Map(), // folderId → pictogram name, mirrored from storage.local (lib/folder-icons.js)
  tabs: new Map(), // tabId → tab, all windows
  activeTabId: null, // the selected tab of the panel's window
  treeLoaded: false, // until then every tab would look unbound, so open tabs wait
  field: null, // the open rename / address field; re-rendering waits while it is open
  dragging: false, // a row of this panel is being dragged; re-rendering waits too
  loadPending: false, // a reload skipped because of the field or a drag
  renameAfterLoad: null, // a just created folder: open its name field once it is shown
  revealAfterLoad: null, // a just pinned or restored item: scroll to it once it is shown

  // Spaces (stage 8): all of these stay empty while spaces are off.
  spaceIds: null, // ids of the space folders from storage.local; null — spaces are off
  spaces: [], // the space folders shown in the bar, in its order; [] — the panel works as without spaces
  stray: [], // top-level items outside the spaces (shown at the end of the first one)
  currentSpace: null, // the space shown in this window
  session: parseSpaceSession({}), // groups ↔ spaces, windows' spaces, last tabs (storage.session)
  linkSpace: new Map(), // bookmarkId → its space (lib/spaces.js linkSpaces)
  targets: null, // tabId → the space each tab of the window belongs in (tabTargets)
  followed: null, // the selected tab and its space last followed: "tabId:spaceId"
  tidyKey: '', // the last regrouping the panel asked the background script for
  spacesSignature: '', // spaces with their names: when it changes, groups are renamed
  pendingSpace: null, // a just created space: switch to it once it is loaded
};

const spacesShown = () => state.spaces.length > 0;

// ---------- Elements

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function svgIcon(viewBox, className, d) {
  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('viewBox', viewBox);
  svg.setAttribute('class', className);
  svg.setAttribute('aria-hidden', 'true');
  const path = document.createElementNS(SVG_NS, 'path');
  path.setAttribute('d', d);
  path.setAttribute('fill', 'none');
  path.setAttribute('stroke', 'currentColor');
  path.setAttribute('stroke-width', '1.5');
  path.setAttribute('stroke-linecap', 'round');
  path.setAttribute('stroke-linejoin', 'round');
  svg.append(path);
  return svg;
}

// A pictogram (lib/pictograms.js): outlined, or filled — the current space in the bar.
function pictogramIcon(name, filled = false) {
  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('viewBox', '0 0 256 256');
  svg.setAttribute('class', 'pictogram');
  svg.setAttribute('aria-hidden', 'true');
  const path = document.createElementNS(SVG_NS, 'path');
  path.setAttribute('d', PICTOGRAMS[name][filled ? 1 : 0]);
  path.setAttribute('fill', 'currentColor');
  svg.append(path);
  return svg;
}

const folderIcon = () =>
  svgIcon('0 0 16 16', 'folder-icon', 'M2.25 4.25c0-.55.45-1 1-1h2.9l1.5 1.5h5.1c.55 0 1 .45 1 1v6c0 .55-.45 1-1 1h-9.5c-.55 0-1-.45-1-1z');
const chevronIcon = () => svgIcon('0 0 12 12', 'chevron', 'M4.5 2.75 7.75 6 4.5 9.25');
const closeIcon = () => svgIcon('0 0 12 12', '', 'M3 3l6 6M9 3 3 9');
const plusIcon = () => svgIcon('0 0 16 16', '', 'M8 3.5v9M3.5 8h9');
const spinnerIcon = () => svgIcon('0 0 16 16', 'spinner', 'M8 2.5A5.5 5.5 0 1 1 2.5 8');
const revertIcon = () => svgIcon('0 0 12 12', '', 'M4 6.5 1.75 4.25 4 2M1.75 4.25h5.5a3 3 0 0 1 0 6H5.5');
const SPEAKER = 'M2.5 6.25h2.25L8 3.5v9L4.75 9.75H2.5z';
const soundOnIcon = () => svgIcon('0 0 16 16', 'sound-on', `${SPEAKER}M10.5 6.25a2.5 2.5 0 0 1 0 3.5M12.25 4.5a5 5 0 0 1 0 7`);
const soundOffIcon = () => svgIcon('0 0 16 16', 'sound-off', `${SPEAKER}M10.5 6.5l3 3M13.5 6.5l-3 3`);

// The speaker: shown while the tab plays sound or is muted; a click mutes or unmutes it.
function soundButton() {
  const button = actionButton('sound', S.mute, soundOnIcon());
  button.append(soundOffIcon());
  return button;
}

// The sound state (lib/tabs.js) on a link, tile or tab element: classes and the speaker's label.
function applySound(wrap, sound) {
  wrap.classList.toggle('is-playing', sound === 'playing');
  wrap.classList.toggle('is-muted', sound === 'muted');
  const button = wrap.querySelector(':scope > .row-actions > [data-action="sound"], :scope > .tile-sound');
  const label = sound === 'muted' ? S.unmute : S.mute;
  if (button && button.title !== label) {
    button.title = label;
    button.setAttribute('aria-label', label);
  }
}

function fallbackIconEl(link) {
  const { letter, hue } = fallbackIcon(link.url, link.title);
  const node = el('span', 'fallback-icon', letter);
  node.style.setProperty('--hue', hue);
  return node;
}

// Site icon elements by URL, carried over between re-renders so icons don't flash.
let iconCache = new Map();

function createSiteIcon(link) {
  const img = el('img');
  img.alt = '';
  img.decoding = 'async';
  img.src = faviconUrl(link.url);
  img.addEventListener('error', () => {
    const fallback = fallbackIconEl(link);
    img.replaceWith(fallback);
    if (iconCache.get(link.url) === img) iconCache.set(link.url, fallback);
  }, { once: true });
  return img;
}

function siteIcon(link, previous) {
  let icon = previous.get(link.url);
  if (icon) previous.delete(link.url); // the same URL twice gets a second element
  else icon = createSiteIcon(link);
  if (!iconCache.has(link.url)) iconCache.set(link.url, icon);
  return icon;
}

function iconBox(child) {
  const box = el('span', 'icon');
  box.append(child);
  return box;
}

function rowButton(className, depth, draggable = false) {
  const row = el('button', `row ${className}`);
  row.type = 'button';
  row.style.setProperty('--depth', depth);
  if (draggable) row.draggable = true;
  return row;
}

function actionButton(action, label, icon) {
  const button = el('button', 'action');
  button.type = 'button';
  button.dataset.action = action;
  button.title = label;
  button.setAttribute('aria-label', label);
  button.append(icon);
  return button;
}

// A link: the row itself plus hover actions on top of its right edge
// (siblings, not children: a button can't contain buttons).
function linkNode(link, depth, icon) {
  const wrap = el('div', 'item link');
  wrap.dataset.id = link.id;

  const row = rowButton('link-row', depth, true);
  row.title = `${link.title}\n${link.url}`;
  row.append(iconBox(icon), el('span', 'title', link.title));

  const actions = el('span', 'row-actions');
  actions.append(
    actionButton('revert', S.revertUrl, revertIcon()),
    actionButton('close', S.closeTab, closeIcon()),
    soundButton(),
  );

  wrap.append(row, actions);
  return wrap;
}

function folderNode(folder, depth, previousIcons) {
  const wrap = el('div', 'folder');
  wrap.dataset.id = folder.id;
  wrap.dataset.depth = depth;

  const icon = folderIconOf(folder, state.pictograms);
  // A folder named by its emoji only: the emoji is its name when a pictogram is its icon.
  const name = folder.title || (icon?.emoji ? '' : folder.emoji || S.untitledFolder);
  const row = rowButton('folder-row', depth, true);
  row.title = name || folder.emoji;
  row.append(
    iconBox(icon?.pictogram ? pictogramIcon(icon.pictogram)
      : icon?.emoji ? el('span', 'emoji', icon.emoji)
      : folderIcon()),
    el('span', 'title', name),
    chevronIcon(),
  );

  const inner = el('div', 'children-inner');
  if (folder.children.length) {
    inner.append(...folder.children.map((node) => treeNode(node, depth + 1, previousIcons)));
  } else {
    const empty = el('div', 'row empty-folder', S.emptyFolder);
    empty.style.setProperty('--depth', depth + 1);
    inner.append(empty);
  }
  const children = el('div', 'children');
  children.append(inner);

  // Links with open tabs show here while the folder is collapsed (see updatePeek).
  const peek = el('div', 'folder-peek');

  wrap.append(row, children, peek);
  setFolderExpanded(wrap, state.expanded.includes(folder.id));
  return wrap;
}

// A favorites tile: the site icon only, the name in the tooltip. Behaves like a link;
// an open one shows × in its corner on hover (a sibling of the tile button, as on links).
function tileNode(link, icon) {
  const wrap = el('div', 'tile');
  wrap.dataset.id = link.id;
  const button = el('button', 'tile-row');
  button.type = 'button';
  button.draggable = true;
  button.title = `${link.title}\n${link.url}`;
  button.setAttribute('aria-label', link.title);
  const box = el('span', 'tile-icon');
  box.append(icon);
  button.append(box);
  const close = actionButton('close', S.closeTab, closeIcon());
  close.classList.add('tile-close');
  const sound = soundButton();
  sound.classList.add('tile-sound');
  wrap.append(button, close, sound);
  return wrap;
}

function treeNode(node, depth, previousIcons) {
  return node.kind === 'folder'
    ? folderNode(node, depth, previousIcons)
    : linkNode(node, depth, siteIcon(node, previousIcons));
}

function message(text, button) {
  const box = el('div', 'message');
  box.append(el('div', '', text));
  if (button) box.append(button);
  return box;
}

// ---------- Rendering

function setFolderExpanded(wrap, expanded) {
  wrap.classList.toggle('is-expanded', expanded);
  wrap.querySelector(':scope > .folder-row').setAttribute('aria-expanded', String(expanded));
  wrap.querySelector(':scope > .children').inert = !expanded;
}

function applyExpanded() {
  const expanded = new Set(state.expanded);
  for (const wrap of listEl.querySelectorAll('.folder')) {
    const shouldExpand = expanded.has(wrap.dataset.id);
    if (wrap.classList.contains('is-expanded') !== shouldExpand) setFolderExpanded(wrap, shouldExpand);
  }
  applyTabState();
}

// Fade only the titles that don't fit.
function updateClipping(scope = listEl) {
  for (const title of scope.querySelectorAll('.title')) {
    title.classList.toggle('is-clipped', title.scrollWidth > title.clientWidth);
  }
}

// Replaces the list content keeping scroll position and keyboard focus.
function render(nodes) {
  const scrollTop = listEl.scrollTop;
  const focused = listEl.contains(document.activeElement)
    ? document.activeElement.closest('[data-id]')?.dataset.id
    : null;

  treeEl.replaceChildren(...nodes);
  listEl.scrollTop = scrollTop;
  updateClipping(treeEl);

  if (focused) {
    const target = treeEl.querySelector(`[data-id="${CSS.escape(focused)}"]`);
    target?.querySelector(':scope > .row')?.focus({ preventScroll: true });
  }
}

// The tab of a link (any window), or undefined.
const linkTab = (id) => state.tabs.get(state.bindings.get(id));

// The link has a tab, in any window.
const isLinkOpen = (link) => linkTab(link.id) !== undefined;

// Links with an open tab inside a collapsed folder: copies of their rows are shown
// right under that folder (the outermost collapsed one when nested), in tree order.
function updatePeek() {
  const peeks = peekLinks(state.treeNodes, new Set(state.expanded), isLinkOpen);
  const sources = new Set();

  for (const peek of listEl.querySelectorAll('.folder-peek')) {
    const host = peek.parentElement;
    const links = (peeks.get(host.dataset.id) ?? [])
      .map((link) => ({ link, original: listEl.querySelector(`.link:not(.is-peek)[data-id="${CSS.escape(link.id)}"]`) }))
      .filter(({ original }) => original);
    for (const { original } of links) sources.add(original);

    const shown = [...peek.children];
    if (shown.length === links.length && shown.every((node, i) => node.dataset.id === links[i].link.id)) continue;
    const kept = new Map(shown.map((node) => [node.dataset.id, node]));
    const added = [];
    peek.replaceChildren(...links.map(({ link, original }) => {
      if (kept.has(link.id)) return kept.get(link.id);
      const icon = original.querySelector('.icon').firstElementChild.cloneNode(true);
      const node = linkNode(link, Number(host.dataset.depth) + 1, icon);
      node.classList.add('is-peek');
      added.push(node);
      return node;
    }));
    added.forEach(updateClipping);
  }

  // The original rows are hidden while their copies are shown, so during the collapse
  // animation a link isn't seen twice.
  for (const source of listEl.querySelectorAll('.is-peek-source')) {
    if (!sources.has(source)) source.classList.remove('is-peek-source');
  }
  for (const source of sources) source.classList.add('is-peek-source');
}

// The other half of a split pair on a link's row (a sibling of the row, like its actions).
function partnerHalf(depth) {
  const half = el('button', 'pair-half');
  half.type = 'button';
  half.style.setProperty('--depth', depth);
  half.append(el('span', 'icon'), el('span', 'title'));
  return half;
}

// The link shows its pair: its own tab on the left (the link's row), `partner` on the right.
function applyPartner(wrap, partner) {
  let half = wrap.querySelector(':scope > .pair-half');
  if (!partner) {
    if (!half) return;
    half.remove();
    wrap.classList.remove('is-pair');
    wrap.firstElementChild.querySelector('.title').classList.remove('is-dimmed');
    updateClipping(wrap);
    return;
  }
  if (!half) {
    half = partnerHalf(wrap.firstElementChild.style.getPropertyValue('--depth'));
    wrap.firstElementChild.after(half);
    wrap.classList.add('is-pair');
  }
  updateTabFace(half, partner);
  updateClipping(wrap);
}

// Which tabs of the panel's window show where: on links, as pairs, below the divider.
// With spaces — only tabs of the current space and of no space (tiles).
function tabLayout() {
  const tabs = [...state.tabs.values()].filter((tab) => {
    if (!state.targets || tab.windowId !== state.windowId) return true;
    const target = state.targets.get(tab.id);
    return target === null || target === state.currentSpace;
  });
  const split = splitWindowTabs(tabs, state.bindings, state.links, state.windowId);
  return placePairs(split, state.treeLinkIds);
}

// Of a pair shown as one row, the half that isn't selected is greyed out.
function dimHalves([left, right], [leftTab, rightTab]) {
  left.classList.toggle('is-dimmed', rightTab?.id === state.activeTabId);
  right.classList.toggle('is-dimmed', leftTab?.id === state.activeTabId);
}

// Open / selected / moved away: classes on link and tile elements, no re-render.
function applyTabState() {
  if (spacesShown()) {
    state.targets = spaceTargets(state.currentSpace);
    if (state.treeLoaded && followActiveTab()) return; // switched space: shown again from scratch
    checkSpaceGroups();
  } else state.targets = null;
  updatePeek();
  const { onLinks, loose } = tabLayout();
  for (const wrap of listEl.querySelectorAll('.link, .tile')) {
    const link = state.links.get(wrap.dataset.id);
    if (!link) continue;
    const tab = state.tabs.get(state.bindings.get(wrap.dataset.id));
    const partner = wrap.classList.contains('link') ? onLinks.get(link.id) : undefined;
    const { open, active: selected, moved } = linkState(link, tab, state.activeTabId);
    const active = selected || (partner !== undefined && partner.id === state.activeTabId);
    wrap.classList.toggle('is-open', open);
    wrap.classList.toggle('is-active', active);
    wrap.classList.toggle('is-moved', moved);
    wrap.firstElementChild.setAttribute('aria-current', active ? 'page' : 'false');
    applyPartner(wrap, partner);
    if (partner) {
      dimHalves([wrap.firstElementChild.querySelector('.title'), wrap.querySelector(':scope > .pair-half > .title')], [tab, partner]);
    }
    applySound(wrap, partner ? pairSoundState([tab, partner]) : soundState(tab));
  }
  renderOpenTabs(loose);
}

// ---------- Favorites tiles

const tilesEl = el('div', 'tiles');
// Shown only while something that can become a tile is dragged and there are no tiles.
const favoritesDropEl = el('div', 'favorites-drop', S.favoritesDrop);
favoritesEl.append(tilesEl, favoritesDropEl);

// As many tiles in a row as fit, rows evened out (lib/favorites.js).
function updateTileColumns() {
  const count = tilesEl.childElementCount;
  if (!count) return;
  const style = getComputedStyle(tilesEl);
  const columns = tileColumns(count, tilesEl.clientWidth, {
    minWidth: parseFloat(style.getPropertyValue('--tile-min-w')),
    gap: parseFloat(style.columnGap) || 0,
  });
  tilesEl.style.setProperty('--tile-cols', columns);
}

function renderTiles(tiles, previousIcons) {
  const focused = favoritesEl.contains(document.activeElement)
    ? document.activeElement.closest('[data-id]')?.dataset.id
    : null;
  favoritesEl.querySelector(':scope > .field')?.remove(); // a tile's saved name field
  tilesEl.replaceChildren(...tiles.map((link) => tileNode(link, siteIcon(link, previousIcons))));
  favoritesEl.classList.toggle('has-tiles', tiles.length > 0);
  updateTileColumns();
  if (focused) tilesEl.querySelector(`[data-id="${CSS.escape(focused)}"] > button`)?.focus({ preventScroll: true });
}

// ---------- Open tabs below the divider

const tabListEl = el('div', 'tab-list');
// tabId (or "pair-" + splitViewId for a pair) → row element, reused so icons don't flash.
const tabNodes = new Map();

function buildOpenTabs() {
  const newTab = rowButton('new-tab-row', 0);
  newTab.dataset.action = 'new-tab';
  newTab.append(iconBox(plusIcon()), el('span', 'title', S.newTab));
  openTabsEl.append(el('div', 'divider'), tabListEl, newTab);
}

function tabIcon(tab) {
  const url = tabUrl(tab);
  const img = el('img');
  img.alt = '';
  img.decoding = 'async';
  img.src = faviconUrl(url, 32, iconVersion(tab));
  img.addEventListener('error', () => img.replaceWith(fallbackIconEl({ url, title: tabTitle(tab) })), { once: true });
  return img;
}

function tabNode(tab) {
  const wrap = el('div', 'item tab-item is-open');
  wrap.dataset.tabId = tab.id;
  const row = rowButton('tab-row', 0, true);
  row.append(el('span', 'icon'), el('span', 'title'));
  const actions = el('span', 'row-actions');
  actions.append(actionButton('close', S.closeTab, closeIcon()), soundButton());
  wrap.append(row, actions);
  return wrap;
}

// Two tabs side by side (split view) as one row: the left tab is the row itself, the right
// one a half on top of the row's right part. Not dragged: moving a tab breaks its pair.
function pairNode() {
  const wrap = el('div', 'item tab-item pair-item is-open is-pair');
  const row = rowButton('pair-row', 0);
  row.append(el('span', 'icon'), el('span', 'title'));
  const actions = el('span', 'row-actions');
  actions.append(actionButton('close', S.closePair, closeIcon()), soundButton());
  wrap.append(row, partnerHalf(0), actions);
  return wrap;
}

// A tab's title and icon on a row or a half of a pair.
function updateTabFace(face, tab) {
  face.dataset.tabId = tab.id;
  const title = tabTitle(tab);
  const titleEl = face.querySelector('.title');
  if (titleEl.textContent !== title) titleEl.textContent = title;
  face.title = `${title}\n${tabUrl(tab)}`;

  const version = iconVersion(tab);
  if (face.dataset.icon !== version) {
    face.dataset.icon = version;
    face.querySelector('.icon').replaceChildren(tabIcon(tab), spinnerIcon());
  }
  face.classList.toggle('is-loading', tab.status === 'loading');
}

function updateTabNode(wrap, tab) {
  const row = wrap.firstElementChild;
  updateTabFace(row, tab);
  applySound(wrap, soundState(tab));
  const active = tab.id === state.activeTabId;
  wrap.classList.toggle('is-active', active);
  row.setAttribute('aria-current', active ? 'page' : 'false');
}

function updatePairNode(wrap, { pair: [left, right], splitViewId }) {
  wrap.dataset.tabId = left.id;
  wrap.dataset.pairTabId = right.id;
  wrap.dataset.splitViewId = splitViewId;
  const [row, half] = wrap.children;
  updateTabFace(row, left);
  updateTabFace(half, right);
  dimHalves([row.querySelector('.title'), half.querySelector('.title')], [left, right]);
  applySound(wrap, pairSoundState([left, right]));
  const active = left.id === state.activeTabId || right.id === state.activeTabId;
  wrap.classList.toggle('is-active', active);
  row.setAttribute('aria-current', active ? 'page' : 'false');
}

// Rows are updated in place and only re-ordered when the order changed:
// tabs change often (titles, loading), and nothing should flash or jump.
// `loose` — tabs and pairs below the divider (tabLayout).
function renderOpenTabs(loose) {
  if (!state.treeLoaded) return;
  const keyOf = (item) => (item.pair ? `pair-${item.splitViewId}` : item.id);
  const nodes = loose.map((item) => {
    const key = keyOf(item);
    let node = tabNodes.get(key);
    if (!node) {
      node = item.pair ? pairNode() : tabNode(item);
      tabNodes.set(key, node);
    }
    if (item.pair) updatePairNode(node, item);
    else updateTabNode(node, item);
    return node;
  });

  const shown = new Set(loose.map(keyOf));
  for (const key of tabNodes.keys()) {
    if (!shown.has(key)) tabNodes.delete(key);
  }
  const current = tabListEl.children;
  if (current.length !== nodes.length || nodes.some((node, i) => current[i] !== node)) {
    tabListEl.replaceChildren(...nodes);
  }
  updateClipping(tabListEl);
}

// `tiles` — links of the favorites folder, `rest` — the top level without it (splitFavorites).
function renderTree({ tiles, rest }) {
  const previousIcons = iconCache;
  iconCache = new Map();
  renderTiles(tiles, previousIcons);
  // An empty space says where links come from, even under tiles.
  render(rest.length || (tiles.length && !spacesShown())
    ? rest.map((node) => treeNode(node, 0, previousIcons))
    : [message(S.emptyRoot)]);
  applyTabState();
}

// No tree to show: no tiles and no spaces either.
function renderMessage(box) {
  state.spaces = [];
  state.treeNodes = [];
  renderSpaces(null);
  renderTiles([], new Map());
  render([box]);
}

function renderMissingRoot() {
  const button = el('button', 'message-button', S.createRoot);
  button.type = 'button';
  button.dataset.action = 'create-root';
  renderMessage(message(S.rootMissing, button));
}

// ---------- Data

// Our own writes come back through storage.onChanged; skip those echoes so a quick
// double click doesn't replay an intermediate state.
let pendingExpandedWrites = 0;

function saveExpanded(ids) {
  state.expanded = ids;
  pendingExpandedWrites++;
  setExpanded(ids).catch((error) => {
    pendingExpandedWrites--;
    console.error('Failed to save expanded folders', error);
  });
}

// A folder's pictogram (lib/folder-icons.js); null — none. The panel re-renders when the
// change comes back through storage.onChanged.
async function setPictogram(folderId, name) {
  if (name === (state.pictograms.get(folderId) ?? null)) return;
  if (name) await setLocalItems({ [pictogramKey(folderId)]: name });
  else await removeLocalKeys([pictogramKey(folderId)]);
}

async function setPictograms(pictograms) {
  if (pictograms.size) await setLocalItems(Object.fromEntries([...pictograms].map(([id, name]) => [pictogramKey(id), name])));
}

let loadGeneration = 0;

const isEditing = () => Boolean(state.field?.isActive());
// Re-rendering would take away the field being typed in or the row being dragged.
const isBusy = () => isEditing() || state.dragging;

async function load() {
  if (isBusy()) {
    state.loadPending = true;
    return;
  }
  const generation = ++loadGeneration;
  try {
    const root = await findRootFolder();
    if (generation !== loadGeneration) return;
    if (!root) {
      state.rootId = null;
      state.favoritesId = null;
      state.knownIds = new Set();
      state.links = new Map(); // bindings are kept: the folder may come back
      state.allLinks = new Map();
      state.treeLinkIds = [];
      state.treeLoaded = true;
      renderMissingRoot();
      applyTabState();
      return;
    }

    const tree = buildTree(await getSubTree(root.id));
    if (generation !== loadGeneration) return;
    if (isBusy()) {
      state.loadPending = true;
      return;
    }

    const { all, folders } = collectIds(tree);
    const shown = splitFavorites(tree);
    state.rootId = root.id;
    state.favoritesId = shown.favorites?.id ?? null;
    state.knownIds = all;
    // Links in folders inside the favorites aren't shown: their tabs go below the divider.
    state.allLinks = new Map(collectLinks({ children: [...shown.tiles, ...shown.rest] }).map((link) => [link.id, link]));
    state.nodes = nodesById(tree);
    state.rootChildren = tree.children;
    state.tree = tree;
    state.shown = shown;
    state.treeLoaded = true;
    applyTree();
    cleanUpRemoved(folders);
    afterLoad();
  } catch (error) {
    if (generation !== loadGeneration) return;
    console.error('Failed to load bookmarks', error);
    renderMessage(message(S.loadError));
    state.treeLoaded = true;
    applyTabState();
  }
}

// Forget expanded folders and pictograms of folders that are gone, and bindings of removed
// links (their tabs are no longer pinned). The tree this load has may already be old — undo may be
// creating bookmarks right now — so candidates are checked against a fresh read:
// anything that got into the state before this read started is already in it.
async function cleanUpRemoved(folders) {
  const goneFolders = state.expanded.filter((id) => !folders.has(id));
  const goneLinks = [...state.bindings.keys()].filter((id) => !state.allLinks.has(id));
  const gonePictograms = stalePictograms(state.pictograms, folders);
  if ((!goneFolders.length && !goneLinks.length && !gonePictograms.length) || !state.rootId) return;
  try {
    const fresh = collectIds(buildTree(await getSubTree(state.rootId)));

    const staleFolders = new Set(goneFolders.filter((id) => !fresh.folders.has(id)));
    if (staleFolders.size) saveExpanded(state.expanded.filter((id) => !staleFolders.has(id)));

    const stalePictogramIds = gonePictograms.filter((id) => !fresh.folders.has(id));
    if (stalePictogramIds.length) await removeLocalKeys(stalePictogramIds.map(pictogramKey));

    const staleLinks = goneLinks.filter((id) => !fresh.all.has(id) && state.bindings.has(id));
    if (staleLinks.length) {
      for (const id of staleLinks) state.bindings.delete(id);
      await unbind(staleLinks);
    }
  } catch (error) {
    console.error('Failed to clean up removed bookmarks', error);
  }
}

// A field closed or a drag ended: catch up on changes that came meanwhile.
function resumeLoad() {
  if (isBusy() || !state.loadPending) return;
  state.loadPending = false;
  scheduleLoad();
}

// The row of a link or folder; for a link shown under a collapsed folder — its copy.
function rowOf(id) {
  const escaped = CSS.escape(id);
  return listEl.querySelector(`.is-peek[data-id="${escaped}"]`)
    ?? listEl.querySelector(`[data-id="${escaped}"]:not(.is-peek)`);
}

function afterLoad() {
  const renameId = state.renameAfterLoad;
  if (renameId && state.nodes.has(renameId)) {
    state.renameAfterLoad = null;
    const wrap = rowOf(renameId);
    if (wrap) startRename(wrap);
  }
  const revealId = state.revealAfterLoad;
  if (revealId && state.nodes.has(revealId)) {
    state.revealAfterLoad = null;
    setTimeout(() => {
      rowOf(revealId)?.querySelector(':scope > .row')?.scrollIntoView({ block: 'nearest' });
    }, REVEAL_DELAY_MS);
  }
}

// Tab events come often (loading, several tabs at once): re-read all tabs in a batch.
let tabsTimer = null;
function scheduleTabsRefresh() {
  clearTimeout(tabsTimer);
  tabsTimer = setTimeout(refreshTabs, TABS_DELAY_MS);
}

let tabsGeneration = 0;
async function refreshTabs() {
  const generation = ++tabsGeneration;
  try {
    const tabs = await getAllTabs();
    if (generation !== tabsGeneration) return;
    state.tabs = new Map(tabs.map((tab) => [tab.id, tab]));
    state.activeTabId = tabs.find((tab) => tab.active && tab.windowId === state.windowId)?.id ?? null;
    applyTabState();
  } catch (error) {
    console.error('Failed to read tabs', error);
  }
}

// Bookmark events come in bursts (import, moving several items), so batch them.
let reloadTimer = null;
function scheduleLoad() {
  clearTimeout(reloadTimer);
  reloadTimer = setTimeout(load, RELOAD_DELAY_MS);
}

// ---------- Spaces (stage 8)
//
// A space is a top-level folder of the root: the tree shows the current one, below the divider
// only its tabs (lib/spaces.js tabTargets). Which tab is in which space — tab groups; only the
// background script changes them, the panel asks it to (tidySpaces) and reads its records.

const spaceIconsEl = el('div', 'space-icons');
const spaceAddEl = el('button', 'space-add');
spaceAddEl.type = 'button';
spaceAddEl.title = S.spaces.newSpace;
spaceAddEl.setAttribute('aria-label', S.spaces.newSpace);
spaceAddEl.append(plusIcon());
spacesEl.append(spaceIconsEl, spaceAddEl);

// A space's bookmark title from the dialog: an emoji typed at the start of the name wins
// over the one picked in the grid.
const spaceTitle = (name, emoji) => (splitLeadingEmoji(name).emoji ? name : withFolderEmoji(name, emoji));

// The space's name in menus and tooltips.
const spaceLabel = (space) => space.name.trim() || S.spaces.untitled;

// Pictograms: outlined, the current space's filled.
function spaceIconNode(space, current = false) {
  const icon = spaceIcon(space, state.pictograms.get(space.id));
  if (icon.pictogram) return pictogramIcon(icon.pictogram, current);
  return icon.emoji ? el('span', 'emoji', icon.emoji) : el('span', 'space-letter', icon.letter);
}

// The bar of icons, the current one highlighted (no name above the tree — Ed's choice);
// `space` null — spaces are off.
function renderSpaces(space) {
  const on = Boolean(space);
  spaceAddEl.hidden = !on;
  // With spaces off the bar stays for the eyedropper (stage 9), if the browser has one.
  const bar = on || canPickColor;
  spacesEl.hidden = !bar;
  if (on) spacesEl.setAttribute('aria-label', S.spaces.bar);
  else spacesEl.removeAttribute('aria-label');
  document.body.classList.toggle('has-bar', bar);
  if (!on) {
    spaceIconsEl.replaceChildren();
    return;
  }
  spaceIconsEl.replaceChildren(...state.spaces.map((node) => {
    const button = el('button', 'space-icon');
    button.type = 'button';
    button.draggable = true; // along the bar — another order (stage 8b)
    button.dataset.spaceId = node.id;
    button.title = spaceLabel(node);
    button.setAttribute('aria-label', spaceLabel(node));
    const current = node.id === space.id;
    button.classList.toggle('is-current', current);
    button.setAttribute('aria-current', current ? 'true' : 'false');
    button.append(spaceIconNode(node, current));
    return button;
  }));
  spaceIconsEl.querySelector('.is-current')?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
}

// What the tree shows: the whole root, or with spaces on — the current space (and the
// top-level items outside the spaces at the end of the first one). After a load and on
// switching spaces.
function applyTree() {
  const { tiles, rest } = state.shown;
  const { list, stray } = state.spaceIds
    ? resolveSpaces(state.tree, state.spaceIds, state.favoritesId)
    : { list: [], stray: [] };
  state.spaces = list;
  state.stray = list.length ? stray : [];
  let space = null;
  let shownRest = rest;
  if (list.length) {
    state.linkSpace = linkSpaces({ list, stray }, tiles);
    const ids = list.map((node) => node.id);
    if (state.pendingSpace && ids.includes(state.pendingSpace)) {
      // A new space: shown right away, with a new tab in it.
      state.currentSpace = state.pendingSpace;
      state.pendingSpace = null;
      persistCurrent(state.currentSpace);
      openNewTab();
    }
    if (!ids.includes(state.currentSpace)) {
      state.currentSpace = initialSpace(ids);
      persistCurrent(state.currentSpace);
    }
    space = list.find((node) => node.id === state.currentSpace);
    shownRest = space === list[0] ? [...space.children, ...stray] : space.children;
  } else {
    state.linkSpace = new Map();
    state.currentSpace = null;
  }
  state.treeRootId = space?.id ?? state.rootId;
  state.treeNodes = shownRest;
  state.links = space
    ? new Map(collectLinks({ children: [...tiles, ...shownRest] }).map((link) => [link.id, link]))
    : state.allLinks;
  state.treeLinkIds = collectLinks({ children: shownRest }).map((link) => link.id);
  renderSpaces(space);
  renderTree({ tiles, rest: shownRest });
  syncSpaceGroups();
}

// The window's space when the panel opens: the one stored for it, else its selected tab's,
// else the one used last, else the first.
function initialSpace(ids) {
  const active = state.tabs.get(state.activeTabId);
  return windowSpace({
    stored: state.session.current.get(state.windowId),
    activeTarget: active && spaceTargets(undefined).get(active.id),
    last: state.session.last,
    ids,
  });
}

// The space each tab of the window belongs in; `current` — where tabs of no space go.
const spaceTargets = (current) => tabTargets(windowTabs(), {
  linkSpace: state.linkSpace,
  bindings: state.bindings,
  groupSpace: state.session.groupSpace,
  current,
});

// The tree root's children: where a pinned tab goes at the top level.
const treeRootChildren = () => state.nodes.get(state.treeRootId)?.children ?? state.rootChildren;

// Spaces or their names changed: their groups get the new names.
function syncSpaceGroups() {
  const signature = JSON.stringify(state.spaces.map((space) => [space.id, space.name]));
  if (signature === state.spacesSignature) return;
  state.spacesSignature = signature;
  if (spacesShown()) tidySpaces().catch((error) => console.error('Failed to ask for tidying the spaces', error));
}

// A tab not in its space's group (a tab became a tile's, a link took over an open tab…):
// the background script is asked to fix it, once for each such state.
function checkSpaceGroups() {
  const tabs = windowTabs();
  const groupOf = new Map();
  for (const tab of tabs) {
    const spaceId = state.session.groupSpace.get(tab.groupId);
    if (spaceId && !groupOf.has(spaceId)) groupOf.set(spaceId, tab.groupId);
  }
  const plan = regroupPlan(tabs, state.targets, groupOf);
  const key = plan.ungroup.length || plan.join.size ? JSON.stringify([plan.ungroup, [...plan.join]]) : '';
  if (key && key !== state.tidyKey) {
    tidySpaces(state.windowId).catch((error) => console.error('Failed to ask for tidying the spaces', error));
  }
  state.tidyKey = key;
}

// Our own writes of this window's space, until they come back through storage.onChanged.
const spaceWrites = [];

// The window's space in storage.session (a new window starts in the one used last).
function persistCurrent(id) {
  const stored = state.session.current.get(state.windowId);
  if (stored === id && state.session.last === id) return;
  if (stored !== id) spaceWrites.push(id);
  state.session.current.set(state.windowId, id);
  state.session.last = id;
  setWindowSpace(state.windowId, id).catch((error) => console.error('Failed to save the space', error));
}

// The tab selected in a space: switching back there selects it again.
function rememberTab(spaceId, tabId) {
  const key = lastTabKey(state.windowId, spaceId);
  if (state.session.lastTabs.get(key) === tabId) return;
  state.session.lastTabs.set(key, tabId);
  setLastTab(state.windowId, spaceId, tabId).catch((error) => console.error('Failed to save the space tab', error));
}

function showSpace(id) {
  state.currentSpace = id;
  persistCurrent(id);
  if (isBusy()) state.loadPending = true;
  else applyTree();
}

// The selected tab is in another space (⌃Tab, ⌘1…9, ⌘⇧T, another window's tab moved here):
// the panel follows it. True if it switched (the panel was shown again from scratch).
function followActiveTab() {
  const tab = state.tabs.get(state.activeTabId);
  if (!tab || tab.windowId !== state.windowId) return false;
  const target = state.targets.get(tab.id);
  const key = `${tab.id}:${target}`;
  if (key === state.followed) return false;
  if (target && target !== state.currentSpace && state.spaces.some((space) => space.id === target)) {
    if (isBusy()) {
      state.loadPending = true; // after the field or the drag
      return false;
    }
    state.followed = key;
    rememberTab(target, tab.id);
    showSpace(target);
    return true;
  }
  state.followed = key;
  if (target === null || target === state.currentSpace) rememberTab(state.currentSpace, tab.id);
  return false;
}

// A click on a space's icon: the tab last selected there, else its most recent one, else a new tab.
function switchSpace(id) {
  if (id === state.currentSpace || !state.spaces.some((space) => space.id === id) || isBusy()) return;
  const lastTab = state.session.lastTabs.get(lastTabKey(state.windowId, id));
  const tabId = pickSpaceTab(windowTabs(), state.targets ?? new Map(), id, lastTab);
  showSpace(id);
  if (tabId !== null) selectTab(tabId);
  else openNewTab();
}

// ---------- Spaces: the swipe (stage 8b)
//
// Two fingers sideways on the trackpad (wheel events over the list) switch to the neighbouring
// space: the tree and the tabs below the divider follow the fingers, the tiles and the bar stay.
// lib/spaces.js swipeStep decides; no going round — at either end the content only gives a little.

const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
const SWIPE_EDGE = 0.25; // how much the content follows the fingers where there is no next space
let swipe = null;
let swipeEndTimer = null;

// How far the tree and the tabs are moved sideways (px); 0 — back in place, with a transition.
function moveSwiped(px) {
  listEl.style.setProperty('--swipe-x', `${px}px`);
  listEl.classList.toggle('is-swiping', px !== 0);
}

// The new space's content slides in from where the fingers went.
function slideIn(direction) {
  if (reducedMotion.matches) return;
  listEl.classList.remove('slide-next', 'slide-previous');
  void listEl.offsetWidth; // restart the animation
  listEl.classList.add(direction === 'next' ? 'slide-next' : 'slide-previous');
}

function endSwipe() {
  swipe = null;
  moveSwiped(0);
}

const spaceStep = (direction) =>
  adjacentSpace(state.spaces.map((space) => space.id), state.currentSpace, direction === 'next' ? 1 : -1);

function onSwipeWheel(event) {
  if (!spacesShown() || event.ctrlKey || isBusy() || document.querySelector('.menu, .overlay')) return;
  const step = swipeStep(swipe, { dx: event.deltaX, dy: event.deltaY, time: event.timeStamp });
  swipe = step.state;
  clearTimeout(swipeEndTimer);
  swipeEndTimer = setTimeout(endSwipe, SWIPE.gap);
  if (step.action) {
    moveSwiped(0);
    const id = spaceStep(step.action);
    if (!id) return; // the first or the last space: the content springs back
    switchSpace(id);
    slideIn(step.action);
    return;
  }
  if (step.axis === 'y' || reducedMotion.matches) return;
  const edge = !spaceStep(step.offset < 0 ? 'next' : 'previous');
  moveSwiped(edge ? step.offset * SWIPE_EDGE : step.offset);
}

listEl.addEventListener('wheel', onSwipeWheel, { passive: true });
listEl.addEventListener('animationend', (event) => {
  if (event.target === treeEl) listEl.classList.remove('slide-next', 'slide-previous');
});

// The records of spaces changed (here, in another window or in the background script).
let spaceSessionTimer = null;
let externalSpace; // this window's space set by someone else, e.g. the background script after a restart
function onSpaceSessionChanged(changes) {
  if (state.windowId === undefined || !Object.keys(changes).some(isSpaceSessionKey)) return;
  const mine = `${CURRENT_PREFIX}${state.windowId}`;
  if (mine in changes) {
    const value = changes[mine].newValue;
    const at = spaceWrites.indexOf(value);
    if (at >= 0) spaceWrites.splice(0, at + 1);
    else externalSpace = value;
  }
  clearTimeout(spaceSessionTimer);
  spaceSessionTimer = setTimeout(refreshSpaceSession, TABS_DELAY_MS);
}

async function refreshSpaceSession() {
  try {
    state.session = await getSpaceSession();
    const external = externalSpace;
    externalSpace = undefined;
    if (typeof external === 'string' && external !== state.currentSpace && state.spaces.some((space) => space.id === external)) {
      state.currentSpace = external;
      if (!isBusy()) {
        applyTree();
        return;
      }
      state.loadPending = true;
    }
    applyTabState();
  } catch (error) {
    console.error('Failed to read the spaces', error);
  }
}

// ---------- Spaces: turning on and off, new, deleted (stage 8)

let spaceDialogOpen = false;

// The dialog (widgets.js) asks which folders become spaces and, in the click on "Turn on",
// for the tab groups permission; planEnable (lib/spaces.js) decides what moves where.
async function enableSpaces() {
  if (spaceDialogOpen || !state.rootId || !state.tree || state.spaceIds) return;
  spaceDialogOpen = true;
  try {
    const { tree, favoritesId } = state;
    const before = new Set(await getSpacesBefore());
    const choice = await openEnableSpaces({
      labels: { ...S.spaces, cancel: S.cancel },
      folders: enableCandidates(tree, favoritesId).map((folder) => ({ id: folder.id, title: folder.name.trim() || S.untitledFolder })),
      checked: before,
      needsFirst: (ids) => needsFirstSpace(tree, favoritesId, ids),
      hasGroups: [...state.tabs.values()].some((tab) => tab.groupId !== undefined && tab.groupId !== NO_GROUP),
      onConfirm: () => requestTabGroups().catch(() => false),
    });
    if (choice) await turnSpacesOn(choice);
  } catch (error) {
    console.error('Failed to turn on spaces', error);
  } finally {
    spaceDialogOpen = false;
  }
}

// What isn't ticked moves into a new first space. Every window starts in the first space:
// its tabs go there, except tiles' and links' (those go with their links).
async function turnSpacesOn({ spaces, firstName }) {
  const tree = buildTree(await getSubTree(state.rootId)); // it may have changed while the dialog was open
  const plan = planEnable(tree, findFavorites(tree)?.id ?? null, spaces);
  let ids = plan.spaces;
  if (plan.create) {
    const folder = await createBookmark({ parentId: state.rootId, index: plan.create.index, title: firstName });
    for (const id of plan.move) await moveBookmark(id, { parentId: folder.id });
    ids = [folder.id, ...ids];
  }
  const windows = new Set([...state.tabs.values()].map((tab) => tab.windowId));
  windows.delete(state.windowId);
  if (windows.size) {
    await setSpaceSession(Object.fromEntries([...windows].map((windowId) => [`${CURRENT_PREFIX}${windowId}`, ids[0]])));
  }
  state.currentSpace = ids[0];
  persistCurrent(ids[0]);
  state.spaceIds = ids;
  await setSpaceIds(ids);
  await tidySpaces();
}

// Spaces become ordinary folders; the background script dissolves their groups.
async function disableSpaces() {
  if (!state.spaceIds) return;
  const confirmed = await confirmDialog({
    title: S.spaces.disableTitle,
    text: S.spaces.disableText,
    confirmLabel: S.spaces.turnOff,
    cancelLabel: S.cancel,
    danger: false,
  });
  if (!confirmed) return;
  try {
    await turnSpacesOff();
  } catch (error) {
    console.error('Failed to turn off spaces', error);
  }
}

const spaceDialogLabels = (more) => ({ ...S.spaces, tabs: S.iconTabs, cancel: S.cancel, ...more });
const spaceDialogIcons = () => ({ pictograms: pictogramSections(S.pictogramThemes), render: pictogramIcon, emojis: FOLDER_EMOJI });

// "+": a new space at the end of the root, shown at once with a new tab.
async function newSpace() {
  if (spaceDialogOpen || !state.rootId || !spacesShown()) return;
  spaceDialogOpen = true;
  try {
    const choice = await openSpaceDialog({ labels: spaceDialogLabels(), ...spaceDialogIcons() });
    if (!choice) return;
    const name = choice.name || S.spaces.newDefault;
    const folder = await createBookmark({ parentId: state.rootId, title: spaceTitle(name, choice.icon?.emoji) });
    if (choice.icon?.pictogram) await setPictogram(folder.id, choice.icon.pictogram);
    state.pendingSpace = folder.id;
    await setSpaceIds([...state.spaces.map((space) => space.id), folder.id]);
  } catch (error) {
    console.error('Failed to create a space', error);
  } finally {
    spaceDialogOpen = false;
  }
}

// A top-level folder outside the spaces becomes the last space.
function makeSpace(id) {
  const ids = state.spaces.map((space) => space.id);
  if (!ids.length || ids.includes(id) || !state.stray.some((node) => node.id === id)) return;
  setSpaceIds([...ids, id]).catch((error) => console.error('Failed to make a space', id, error));
}

// The groups of space `fromId` become `toId`'s (its tabs move there), and so do windows in it.
async function handOverSpace(fromId, toId) {
  const session = await getSpaceSession();
  const records = {};
  for (const [groupId, spaceId] of session.groupSpace) {
    if (spaceId === fromId) records[`${GROUP_PREFIX}${groupId}`] = toId;
  }
  for (const [windowId, spaceId] of session.current) {
    if (spaceId === fromId && windowId !== state.windowId) records[`${CURRENT_PREFIX}${windowId}`] = toId;
  }
  if (Object.keys(records).length) await setSpaceSession(records);
  if (state.currentSpace === fromId) showSpace(toId);
}

// "Make it a folder in…": the other spaces in a second menu at the same place.
function chooseSpaceFor(target) {
  const others = state.spaces.filter((space) => space.id !== target.id);
  if (!others.length) return;
  openMenu({
    x: target.at.x,
    y: target.at.y,
    items: others.map((space) => ({ id: space.id, label: spaceLabel(space) })),
    onSelect: (intoId) => makeFolder(target.id, intoId),
  });
}

// A space becomes an ordinary folder at the end of another space, its tabs go there too.
async function makeFolder(spaceId, intoId) {
  try {
    await handOverSpace(spaceId, intoId);
    await moveBookmark(spaceId, { parentId: intoId });
    await setSpaceIds(state.spaces.map((space) => space.id).filter((id) => id !== spaceId));
    await tidySpaces();
  } catch (error) {
    console.error('Failed to make the space a folder', spaceId, error);
  }
}

// Asks first; its links and folders are deleted with "Undo", its open tabs move to the next
// space (the last one's — to the previous). The last space can't be deleted.
async function deleteSpace(id) {
  const ids = state.spaces.map((space) => space.id);
  const space = state.spaces.find((node) => node.id === id);
  const neighborId = neighborSpace(ids, id);
  const neighbor = state.spaces.find((node) => node.id === neighborId);
  if (!space || !neighbor) return;
  const contents = countContents(space);
  const confirmed = await confirmDialog({
    title: S.spaces.deleteTitle(spaceLabel(space)),
    text: [contents.links || contents.folders ? `${S.folderContents(contents)}.` : '', S.spaces.tabsMove(spaceLabel(neighbor))]
      .filter(Boolean).join(' '),
    confirmLabel: S.confirmDelete,
    cancelLabel: S.cancel,
  });
  if (!confirmed) return;
  try {
    await handOverSpace(id, neighborId);
    const index = ids.indexOf(id);
    if (!(await removeItem(id, { afterUndo: (restoredId) => restoreSpace(restoredId, index) }))) return;
    await setSpaceIds((await getSpaceIds() ?? ids).filter((spaceId) => spaceId !== id));
    await tidySpaces();
  } catch (error) {
    console.error('Failed to delete the space', id, error);
  }
}

// "Undo" after deleting a space: the folder is back (with a new id) — and a space again, in its old place.
async function restoreSpace(restoredId, index) {
  const ids = await getSpaceIds();
  if (!restoredId || !ids) return; // spaces were turned off meanwhile: it stays a folder
  const next = ids.filter((id) => id !== restoredId);
  next.splice(Math.min(index, next.length), 0, restoredId);
  await setSpaceIds(next);
}

// Rename from the bar: the same dialog as for a new space, with its name and icon.
async function renameSpace(id) {
  const space = state.spaces.find((node) => node.id === id);
  if (!space || spaceDialogOpen) return;
  spaceDialogOpen = true;
  try {
    const pictogram = state.pictograms.get(id);
    const choice = await openSpaceDialog({
      labels: spaceDialogLabels({ newSpace: S.spaces.renameTitle, create: S.spaces.save }),
      ...spaceDialogIcons(),
      name: space.title,
      icon: pictogram ? { pictogram } : space.emoji ? { emoji: space.emoji } : null,
    });
    if (!choice || (!choice.name && !choice.icon)) return;
    // A pictogram leaves the name's emoji as it is (it shows in the bookmark manager).
    const title = spaceTitle(choice.name, choice.icon?.pictogram ? space.emoji : choice.icon?.emoji);
    if (title !== space.name) await updateBookmark(id, { title });
    await setPictogram(id, choice.icon?.pictogram ?? null);
  } catch (error) {
    console.error('Failed to rename the space', id, error);
  } finally {
    spaceDialogOpen = false;
  }
}

const spaceTarget = (wrap, id) => ({ kind: 'space-folder', wrap, id, only: state.spaces.length < 2 });

function runSpaceMenuItem(item, target) {
  switch (item) {
    case 'rename':
      renameSpace(target.id);
      break;
    case 'change-icon': {
      const wrap = target.wrap.isConnected
        ? target.wrap
        : spaceIconsEl.querySelector(`[data-space-id="${CSS.escape(target.id)}"]`);
      if (wrap) openIconPicker(wrap);
      break;
    }
    case 'make-folder':
      chooseSpaceFor(target);
      break;
    case 'new-space':
      newSpace();
      break;
    case 'delete-space':
      deleteSpace(target.id);
      break;
  }
}

spacesEl.addEventListener('click', (event) => {
  const icon = event.target.closest('.space-icon');
  if (icon) switchSpace(icon.dataset.spaceId);
  else if (event.target.closest('.space-add')) newSpace();
  else if (event.target.closest('.eyedropper')) pickPanelColor();
});

// ---------- The panel's color (stage 9)
//
// The eyedropper at the right end of the bar, there with spaces off too: the browser's own
// EyeDropper picks the color of Helium's panel header, lib/panel-color.js works out the
// other colors from it. A color per theme (storage.local), applied on every theme switch
// and in every window; right click — "Reset color" for the current theme.

// Phosphor Icons (MIT), "eyedropper", bold: as thick as the "+" next to it.
const EYEDROPPER = 'M228,67.24a39.77,39.77,0,0,0-12.51-28.52C199.91,24,174.71,24.5,159.29,39.93L142.48,56.84a28,28,0,0,0-35.64,3.29l-9,9a20,20,0,0,0-.73,27.49L48.9,144.84A43.76,43.76,0,0,0,37,185.28l-7.5,17.19a17.66,17.66,0,0,0,3.71,19.65,19.9,19.9,0,0,0,22.15,4.19l16.31-7.13a43.88,43.88,0,0,0,39.45-12.09l48.24-48.26a20,20,0,0,0,27.47-.73l9-9a28.06,28.06,0,0,0,3.26-35.72l17.23-17.33A39.69,39.69,0,0,0,228,67.24ZM94.15,190.11a20,20,0,0,1-20,5,11.93,11.93,0,0,0-8.32.47L57,199.38,60.69,191a12,12,0,0,0,.37-8.64,19.92,19.92,0,0,1,4.81-20.55l48.2-48.22,28.28,28.3Zm105.14-111-25.37,25.52a12,12,0,0,0,0,16.95l4.88,4.89a4,4,0,0,1,0,5.66l-6.14,6.15-55-55.05,6.14-6.14a4,4,0,0,1,5.65,0L134.35,82a12,12,0,0,0,8.49,3.51h0A12,12,0,0,0,151.34,82l24.94-25.08c6.3-6.3,16.48-6.63,22.71-.74a16,16,0,0,1,.3,23Z';

const canPickColor = 'EyeDropper' in window;
const darkTheme = matchMedia('(prefers-color-scheme: dark)');

const eyedropperEl = el('button', 'eyedropper');
eyedropperEl.type = 'button';
eyedropperEl.title = S.panelColor.pick;
eyedropperEl.setAttribute('aria-label', S.panelColor.pick);
eyedropperEl.hidden = !canPickColor;
{
  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('viewBox', '0 0 256 256');
  svg.setAttribute('aria-hidden', 'true');
  const path = document.createElementNS(SVG_NS, 'path');
  path.setAttribute('d', EYEDROPPER);
  path.setAttribute('fill', 'currentColor');
  svg.append(path);
  eyedropperEl.append(svg);
}
// Shown next to the eyedropper while it is open: where to click.
const eyedropperHint = el('div', 'eyedropper-hint', S.panelColor.hint);
eyedropperHint.setAttribute('role', 'status');
eyedropperHint.hidden = true;
spacesEl.append(eyedropperEl, eyedropperHint);
// With the panel on the left, the eyedropper comes before "+" (Ed's choice).
panelSide().then((side) => {
  if (side === 'left') spacesEl.insertBefore(eyedropperEl, spaceAddEl);
});

let panelColors = {}; // { light?, dark? } — lib/panel-color.js
let paletteTokens = []; // the CSS variables set by the current color, to take them off
let picking = null; // AbortController while the eyedropper is open

const currentTheme = () => themeOf(darkTheme.matches);

// A token's value as the page sees it now, [r, g, b] (tokens.css colors are light-dark()).
function tokenColor(name) {
  const probe = el('span');
  probe.style.color = `var(${name})`;
  document.body.append(probe);
  const color = parseRgb(getComputedStyle(probe).color)?.rgb;
  probe.remove();
  return color;
}

// The current theme's color on the page, or the usual colors of tokens.css. `color-scheme`
// follows the color: a light color in the dark theme takes the light menus and toast.
function applyPanelColor() {
  const root = document.documentElement;
  for (const name of paletteTokens) root.style.removeProperty(name);
  paletteTokens = [];
  root.style.removeProperty('color-scheme');
  const hex = colorFor(panelColors, currentTheme());
  const palette = hex && panelPalette(hex);
  if (!palette) return;
  root.style.colorScheme = palette.scheme;
  const { tokens } = panelPalette(hex, tokenColor('--accent'));
  for (const [name, value] of Object.entries(tokens)) root.style.setProperty(name, value);
  paletteTokens = Object.keys(tokens);
}

function loadPanelColor() {
  darkTheme.addEventListener('change', applyPanelColor);
  getPanelColors()
    .then((colors) => {
      panelColors = colors;
      applyPanelColor();
    })
    .catch((error) => console.error('Failed to read the panel color', error));
}

async function savePanelColor(hex) {
  panelColors = withColor(panelColors, currentTheme(), hex);
  applyPanelColor();
  await setPanelColors(panelColors);
}

// What the eyedropper may land on if it is clicked a second time: the panel's background,
// the button under the pointer and its icon (lib/panel-color.js isOwnColor).
function ownColors() {
  const background = parseRgb(getComputedStyle(document.body).backgroundColor).rgb;
  const style = getComputedStyle(eyedropperEl);
  const button = parseRgb(style.backgroundColor);
  const under = button ? over(button.rgb, button.alpha, background) : background;
  const icon = parseRgb(style.color);
  return [background, under, icon ? over(icon.rgb, icon.alpha, under) : under];
}

// A click on the eyedropper: the hint and the browser's eyedropper; picked, cancelled with
// Esc or clicked again — the hint goes. A color of the panel itself changes nothing; but on a
// Mac the eyedropper doesn't see pages and catches the second click itself, returning a dark
// stand-in color (docs/02-architecture.md, "Цвет панели") — "Reset color" undoes it.
async function pickPanelColor() {
  if (picking) {
    picking.abort();
    return;
  }
  const controller = new AbortController();
  picking = controller;
  const own = ownColors();
  eyedropperHint.hidden = false;
  eyedropperEl.classList.add('is-picking');
  try {
    const { sRGBHex } = await new EyeDropper().open({ signal: controller.signal });
    const hex = parseHex(sRGBHex) ? sRGBHex : parseRgb(sRGBHex) && toHex(parseRgb(sRGBHex).rgb);
    if (hex && !isOwnColor(hex, own)) await savePanelColor(hex);
  } catch (error) {
    if (error?.name !== 'AbortError') console.error('Failed to pick the panel color', error);
  } finally {
    if (picking === controller) picking = null;
    eyedropperHint.hidden = true;
    eyedropperEl.classList.remove('is-picking');
  }
}

function showPanelColorMenu(event) {
  const theme = currentTheme();
  openMenu({
    x: event.clientX,
    y: event.clientY,
    items: [{ id: 'reset-color', label: S.panelColor.reset, disabled: !colorFor(panelColors, theme) }],
    onSelect: () => {
      panelColors = withColor(panelColors, theme, null);
      applyPanelColor();
      setPanelColors(panelColors).catch((error) => console.error('Failed to reset the panel color', error));
    },
  });
}

// ---------- Actions

function toggleFolder(id) {
  saveExpanded(toggleId(state.expanded, id));
  applyExpanded();
}

// Links being opened right now: a quick second click must not create a second tab.
const opening = new Set();

// Like a pinned tab in Arc: switch to the link's tab, adopt an open tab with the
// same address, or open a new one — and remember it.
async function openLink(id) {
  const link = state.links.get(id);
  if (!link || opening.has(id)) return;
  opening.add(id);
  try {
    // Fresh data, not the panel's copy: the tab may have been closed a moment ago.
    const [bindings, tabs] = await Promise.all([getBindings(), getAllTabs()]);
    const result = resolveClick({ bookmarkId: id, url: link.url, bindings, tabs, windowId: state.windowId });
    let tabId;
    if (result.action === 'create') {
      tabId = (await openInNewTab(link.url, state.windowId)).id;
    } else {
      tabId = result.tab.id;
      await activateTab(result.tab, state.windowId);
    }
    if (result.action !== 'switch') {
      state.bindings.set(id, tabId);
      await bindTab(id, tabId);
      applyTabState();
    }
  } catch (error) {
    console.error('Failed to open', link.url, error);
  } finally {
    opening.delete(id);
  }
}

// Cmd+click or middle click: one more copy in a background tab, not bound.
function openCopy(id) {
  const link = state.links.get(id);
  if (!link) return;
  openInNewTab(link.url, state.windowId, false).catch((error) => console.error('Failed to open', link.url, error));
}

// One tab id or several (both tabs of a pair).
function closeTab(tabIds) {
  chrome.tabs.remove(tabIds).catch((error) => console.error('Failed to close tab', tabIds, error));
}

function closeLinkTab(id) {
  const tabId = state.bindings.get(id);
  if (tabId !== undefined) closeTab(tabId);
}

// Without switching to the tab. Both tabs of a pair together: if either plays, both go quiet.
function toggleSound(tabIds) {
  const tabs = tabIds.map((tabId) => state.tabs.get(tabId)).filter(Boolean);
  const muted = pairSoundState(tabs) !== 'muted';
  for (const tab of tabs) {
    chrome.tabs.update(tab.id, { muted }).catch((error) => console.error('Failed to mute or unmute', tab.id, error));
  }
}

function unsplitTabs(splitViewId) {
  if (inSplit({ splitViewId })) unsplit(splitViewId).catch((error) => console.error('Failed to unsplit', splitViewId, error));
}

function selectTab(tabId) {
  chrome.tabs.update(tabId, { active: true }).catch((error) => console.error('Failed to select tab', tabId, error));
}

function openNewTab() {
  openInNewTab(undefined, state.windowId).catch((error) => console.error('Failed to open a new tab', error));
}

// More new tabs than this — "Open all" asks first.
const OPEN_ALL_ASK = 10;

// Links of a folder, nested ones too, that the panel shows.
const linksOf = (folder) => collectLinks({ children: folder.children }).filter((link) => state.links.has(link.id));

// Folders whose links are being opened right now: a second "Open all" waits.
const openingAll = new Set();

// Every link of the folder gets a tab: an open one is left as it is, an open tab with its
// address is adopted, the rest open in background tabs at the end of the window.
async function openAll(folderId) {
  const folder = state.nodes.get(folderId);
  if (!folder || openingAll.has(folderId)) return;
  openingAll.add(folderId);
  try {
    const [bindings, tabs] = await Promise.all([getBindings(), getAllTabs()]);
    const { bind, create } = planOpenAll(linksOf(folder), bindings, tabs, state.windowId);
    if (create.length > OPEN_ALL_ASK) {
      const confirmed = await confirmDialog({
        title: S.confirmOpenAll(create.length),
        text: S.folderLabel(folder.title || folder.emoji || S.untitledFolder),
        confirmLabel: S.confirmOpen,
        cancelLabel: S.cancel,
        danger: false,
      });
      if (!confirmed) return;
    }
    expandFolder(folderId);
    if (bind.size) {
      for (const [id, tabId] of bind) state.bindings.set(id, tabId);
      await setBindings(bind);
    }
    for (const link of create) {
      const tab = await openInNewTab(link.url, state.windowId, false);
      state.bindings.set(link.id, tab.id); // before the tabs refresh, so it doesn't flash below the divider
      await bindTab(link.id, tab.id);
    }
    applyTabState();
  } catch (error) {
    console.error('Failed to open the folder', folderId, error);
  } finally {
    openingAll.delete(folderId);
  }
}

// Tabs of the folder's links are closed; the links stay.
function closeAll(folderId) {
  const folder = state.nodes.get(folderId);
  if (!folder) return;
  const tabIds = linksOf(folder).map((link) => state.bindings.get(link.id)).filter((tabId) => state.tabs.has(tabId));
  if (tabIds.length) chrome.tabs.remove(tabIds).catch((error) => console.error('Failed to close the folder tabs', error));
}

// Back to the bookmark's address in the same tab, and show it.
async function revertLink(id) {
  const link = state.links.get(id);
  const tab = state.tabs.get(state.bindings.get(id));
  if (!link || !tab) return;
  try {
    await chrome.tabs.update(tab.id, { url: link.url });
    await activateTab(tab, state.windowId);
  } catch (error) {
    console.error('Failed to go back to', link.url, error);
  }
}

// ---------- Editing

function expandFolder(id) {
  if (id === state.rootId || id === state.treeRootId || id === state.favoritesId || state.expanded.includes(id)) return;
  saveExpanded([...state.expanded, id]);
  applyExpanded();
}

// Is this tab shown on a link (pinned; of any space), not below the divider?
function isPinnedTab(tabId) {
  for (const [bookmarkId, boundTabId] of state.bindings) {
    if (boundTabId === tabId && state.allLinks.has(bookmarkId)) return true;
  }
  return false;
}

const canPinCurrent = () => state.activeTabId !== null && state.tabs.has(state.activeTabId) && !isPinnedTab(state.activeTabId);

// The field stays until the panel re-renders the row with the saved value.
function saveBookmark(id, changes, field) {
  updateBookmark(id, changes).catch((error) => {
    console.error('Failed to save', id, changes, error);
    field.close();
  });
}

function startRename(wrap) {
  const node = state.nodes.get(wrap.dataset.id);
  if (!node || isEditing()) return;
  const field = openField(wrap, {
    value: node.name || (node.kind === 'link' ? node.title : ''),
    placeholder: node.kind === 'folder' ? S.untitledFolder : node.title,
    label: S.renameField,
    onCommit: (value) => {
      const title = value.trim();
      if (!title || title === node.name) return 'close';
      saveBookmark(node.id, { title }, field);
      return 'saving';
    },
    onEnd: resumeLoad,
  });
  state.field = field;
}

function startEditUrl(wrap) {
  const link = state.links.get(wrap.dataset.id);
  if (!link || isEditing()) return;
  const field = openField(wrap, {
    value: link.url,
    label: S.urlField,
    invalidHint: S.invalidUrl,
    onCommit: (value) => {
      const url = completeUrl(value);
      if (!url) return 'invalid';
      if (url === link.url) return 'close';
      saveBookmark(link.id, { url }, field);
      return 'saving';
    },
    onEnd: resumeLoad,
  });
  state.field = field;
}

// The icon picker under the folder row (or above a space's icon in the bar). A pictogram
// goes to storage.local and leaves the title as it is; an emoji goes to the start of the
// title and takes the pictogram away; "Remove icon" removes both.
function openIconPicker(wrap) {
  const folder = state.nodes.get(wrap.dataset.id ?? wrap.dataset.spaceId);
  if (!folder || folder.kind !== 'folder' || isEditing()) return;
  const row = wrap.classList.contains('space-icon') ? wrap : wrap.querySelector(':scope > .row');
  const rowRect = row.getBoundingClientRect();
  const iconRect = (row.querySelector('.icon') ?? row).getBoundingClientRect();
  wrap.classList.add('is-menu-target');
  openIconPopup({
    x: iconRect.left - parseFloat(getComputedStyle(row).getPropertyValue('--menu-pad')),
    y: rowRect.bottom,
    rowTop: rowRect.top,
    ...iconChoice(),
    current: folderIconOf(folder, state.pictograms),
    onPick: (icon) => changeFolderIcon(folder, icon)
      .catch((error) => console.error('Failed to change the icon', folder.id, error)),
    onClose: () => wrap.classList.remove('is-menu-target'),
  });
}

// The icon picker's set and texts (widgets.js openIconPicker; the import dialogs' icon buttons).
function iconChoice() {
  return {
    pictograms: pictogramSections(S.pictogramThemes),
    render: pictogramIcon,
    placeholder: folderIcon,
    emojis: FOLDER_EMOJI,
    parse: pickEmoji,
    labels: {
      title: S.iconPicker,
      tabs: S.iconTabs,
      other: S.otherEmoji,
      field: S.otherEmojiField,
      hint: S.emojiHint[platform()] ?? '',
      invalid: S.notEmoji,
      remove: S.removeIcon,
      button: S.menu['change-icon'],
    },
  };
}

async function changeFolderIcon(folder, icon) {
  if (!icon?.pictogram) {
    const title = withFolderEmoji(folder.name, icon?.emoji ?? null);
    if (title !== folder.name) await updateBookmark(folder.id, { title });
  }
  await setPictogram(folder.id, icon?.pictogram ?? null);
}

// A new folder named "New folder" with its name field open, at the end of `parentId`.
async function createFolder(parentId) {
  try {
    expandFolder(parentId);
    const node = await createBookmark({ parentId, title: S.newFolderTitle });
    state.renameAfterLoad = node.id;
    state.revealAfterLoad = node.id;
  } catch (error) {
    console.error('Failed to create a folder', error);
  }
}

// The tab becomes a link and stays open, not reloaded: it moves from below the
// divider onto the new link. `index` undefined — at the end of the folder.
async function pinTab(tab, parentId, index) {
  const url = tab && tabUrl(tab);
  if (!url || !parentId) return;
  try {
    expandFolder(parentId);
    const details = { parentId, title: tabTitle(tab), url };
    if (index !== undefined) details.index = index;
    const node = await createBookmark(details);
    state.bindings.set(node.id, tab.id); // before the reload, so the tab doesn't flash below the divider
    state.revealAfterLoad = node.id;
    await bindTab(node.id, tab.id);
  } catch (error) {
    console.error('Failed to pin the tab', tab.id, error);
  }
}

// Top level: after the last link of the root (or the space); into a folder: at its end.
function pinCurrentTab(folderId) {
  if (!canPinCurrent()) return;
  const tab = state.tabs.get(state.activeTabId);
  if (folderId) pinTab(tab, folderId);
  else pinTab(tab, state.treeRootId, pinIndex(treeRootChildren()));
}

// Delete a link or a folder; unpin — delete an open link, its tab stays and becomes
// the first one below the divider (as in Arc), or goes to `tabIndex` of `windowId` when
// dropped there. `openedTabId` — a closed link dropped below the divider was just opened
// in this tab: undo pins it back. Can be undone for UNDO_MS; `afterUndo(newId)` runs after that.
// True if removed.
async function removeItem(id, { unpin = false, tabIndex = 0, windowId, openedTabId, afterUndo } = {}) {
  try {
    const [node, bindings] = await Promise.all([getSubTree(id), getBindings()]);
    if (openedTabId !== undefined) bindings.set(id, openedTabId);
    const snapshot = snapshotSubtree(node, { expanded: state.expanded, bindings, pictograms: state.pictograms });
    if (unpin && openedTabId === undefined) {
      const tabId = bindings.get(id);
      // While still bound the tab isn't shown below the divider, so the move is unseen.
      if (state.tabs.has(tabId)) {
        await moveTab(tabId, tabIndex, windowId).catch((error) => console.error('Failed to move the tab', error));
      }
    }
    await (node.url === undefined ? removeBookmarkTree(id) : removeBookmark(id));
    showToast({
      text: unpin ? S.unpinned : S.removed,
      actionLabel: S.undo,
      duration: UNDO_MS,
      onAction: () => undoRemove(snapshot).then((idMap) => afterUndo?.(idMap?.get(snapshot.node.id))),
    });
    return true;
  } catch (error) {
    console.error('Failed to remove', id, error);
    return false;
  }
}

// A non-empty folder asks first.
async function deleteFolder(id) {
  const folder = state.nodes.get(id);
  if (!folder) return;
  const contents = countContents(folder);
  if (contents.links || contents.folders) {
    const confirmed = await confirmDialog({
      title: S.confirmDeleteFolder(folder.name.trim() || S.untitledFolder),
      text: S.folderContents(contents),
      confirmLabel: S.confirmDelete,
      cancelLabel: S.cancel,
    });
    if (!confirmed) return;
  }
  removeItem(id);
}

// The same bookmarks again (with new ids) in the old place; tabs that are still open
// are pinned to them again, folders that were expanded are expanded, pictograms come back. → old id → new id.
async function undoRemove(snapshot) {
  try {
    const idMap = await restoreSubtree(snapshot, { create: createBookmark, childCount, fallbackParentId: state.rootId });
    state.revealAfterLoad = idMap.get(snapshot.node.id);
    await setPictograms(restoredPictograms(snapshot, idMap));
    const [tabs, bindings] = await Promise.all([getAllTabs(), getBindings()]);
    const restored = restoredBindings(snapshot, idMap, new Set(tabs.map((tab) => tab.id)), bindings);
    if (restored.size) {
      for (const [id, tabId] of restored) state.bindings.set(id, tabId);
      await setBindings(restored);
    }
    const expanded = remapIds(snapshot.expanded, idMap).filter((id) => !state.expanded.includes(id));
    if (expanded.length) {
      saveExpanded([...state.expanded, ...expanded]);
      applyExpanded();
    }
    return idMap;
  } catch (error) {
    console.error('Failed to undo', error);
    return null;
  }
}

// ---------- Context menu

// What was right-clicked: a link (or its copy under a collapsed folder, or a tile),
// a folder, an open tab, or anything else in the list ("empty").
function menuTarget(node) {
  const link = node.closest('.link, .tile');
  if (link) {
    return {
      kind: 'link',
      tile: link.classList.contains('tile'),
      wrap: link,
      id: link.dataset.id,
      open: link.classList.contains('is-open'),
      moved: link.classList.contains('is-moved'),
      split: inSplit(linkTab(link.dataset.id)),
    };
  }
  const folderPart = node.closest('.folder-row, .empty-folder');
  if (folderPart) {
    const wrap = folderPart.closest('.folder');
    const folder = state.nodes.get(wrap.dataset.id);
    const links = folder ? linksOf(folder) : [];
    const openLinks = links.filter(isLinkOpen).length;
    const stray = state.stray.some((item) => item.id === wrap.dataset.id);
    return { kind: 'folder', wrap, id: wrap.dataset.id, openLinks, closedLinks: links.length - openLinks, stray };
  }
  const pair = node.closest('.pair-item');
  if (pair) {
    return {
      kind: 'pair',
      wrap: pair,
      tabIds: [Number(pair.dataset.tabId), Number(pair.dataset.pairTabId)],
      splitViewId: Number(pair.dataset.splitViewId),
    };
  }
  const tab = node.closest('.tab-item');
  if (tab) {
    const tabId = Number(tab.dataset.tabId);
    return { kind: 'tab', wrap: tab, tabId, split: inSplit(state.tabs.get(tabId)) };
  }
  return { kind: 'empty', spaces: state.spaceIds !== null, miniPlayer: miniPlayer.isEnabled() };
}

function runMenuItem(item, target) {
  if (target.kind === 'space-folder') {
    runSpaceMenuItem(item, target);
    return;
  }
  const wrap = target.wrap?.isConnected ? target.wrap : target.id && rowOf(target.id);
  switch (item) {
    case 'rename':
      if (wrap) startRename(wrap);
      break;
    case 'edit-url':
      if (wrap) startEditUrl(wrap);
      break;
    case 'revert':
      revertLink(target.id);
      break;
    case 'open-copy': {
      const link = state.links.get(target.id);
      if (link) openInNewTab(link.url, state.windowId).catch((error) => console.error('Failed to open', link.url, error));
      break;
    }
    case 'close-link-tab':
      closeLinkTab(target.id);
      break;
    case 'unpin':
      removeItem(target.id, { unpin: true });
      break;
    case 'delete':
      removeItem(target.id);
      break;
    case 'open-all':
      openAll(target.id);
      break;
    case 'close-all':
      closeAll(target.id);
      break;
    case 'delete-folder':
      deleteFolder(target.id);
      break;
    case 'change-icon':
      if (wrap) openIconPicker(wrap);
      break;
    case 'new-subfolder':
      createFolder(target.id);
      break;
    case 'pin-current-here':
      pinCurrentTab(target.id);
      break;
    case 'pin-tab':
      pinTab(state.tabs.get(target.tabId), state.treeRootId, pinIndex(treeRootChildren()));
      break;
    case 'close-tab':
      closeTab(target.tabId);
      break;
    case 'unsplit':
      unsplitTabs(target.splitViewId ?? state.tabs.get(target.tabId ?? state.bindings.get(target.id))?.splitViewId);
      break;
    case 'close-pair':
      closeTab(target.tabIds);
      break;
    case 'new-folder':
      createFolder(state.treeRootId);
      break;
    case 'pin-current':
      pinCurrentTab(null);
      break;
    case 'import-arc':
      importFromArc();
      break;
    case 'make-space':
      makeSpace(target.id);
      break;
    case 'enable-spaces':
      enableSpaces();
      break;
    case 'disable-spaces':
      disableSpaces();
      break;
    case 'enable-mini-player':
      miniPlayer.turnOn();
      break;
    case 'disable-mini-player':
      miniPlayer.turnOff();
      break;
    case 'welcome':
      openInNewTab(extensionUrl('welcome.html'), state.windowId)
        .catch((error) => console.error('Failed to open the welcome page', error));
      break;
  }
}

// ---------- Import from Arc (stage 7b; Helium's own import after stage 8b)

let importOpen = false;

// Helium imports from Arc itself: its import page opens in a new tab, the panel says what to
// choose there, and once the import is done the background script notes what came
// (ARC_PENDING_KEY) and the panel offers to sort it (sortArcImport). Where the browser can't
// import from Arc (Brave, Edge), and by a small link under the hint — Arc's file by hand.
let hint = null; // the hint while it's shown

async function importFromArc() {
  if (importOpen || sortOpen) return;
  if (!builtInArcImport()) {
    importFromFile();
    return;
  }
  importOpen = true;
  let next = null;
  try {
    const pending = await getArcPending();
    await openBrowserPage(IMPORT_PAGE);
    hint = openArcHint({ labels: { ...S.arcSort, title: S.arcImport.title }, previous: Boolean(pending?.dismissed) });
    next = await hint;
  } catch (error) {
    console.error('Failed to open Helium\'s import', error);
  } finally {
    hint = null;
    importOpen = false;
  }
  if (next === 'file') importFromFile();
  else if (next === 'previous') sortArcImport({ again: true });
}

let sortOpen = false;

// What Helium's import brought from Arc (lib/arc-import.js) → the dialog → moved into the root
// folder: only what this import created is touched. Shown by itself in the panel of the window
// the user is in; once cancelled (`dismissed`), only when asked again from the hint.
async function sortArcImport({ again = false } = {}) {
  if (sortOpen || state.windowId === undefined) return;
  sortOpen = true;
  try {
    // Another dialog is open (the hint aside): the sorting waits for it to close.
    while (document.querySelector('.overlay .dialog:not(.arc-hint)')) await new Promise((resolve) => setTimeout(resolve, 500));
    const pending = await getArcPending();
    if (!pending || (pending.dismissed && !again)) return;
    if (!again && (await lastFocusedWindowId()) !== state.windowId) return;
    const nodes = (await Promise.all(pending.ids.map((id) => getSubTree(id).catch(() => null)))).filter(Boolean);
    const found = findArcImport(nodes);
    if (!found) {
      await forgetArcPending();
      return;
    }
    hint?.close();
    const spaces = spacesShown();
    const defaults = defaultArcSort(found, { spaces });
    const modes = spaces
      ? [
        { value: 'space', label: S.arcSort.space },
        ...state.spaces.map((space) => ({ value: `into:${space.id}`, label: S.arcImport.into(spaceLabel(space)) })),
        { value: 'skip', label: S.arcSort.skip },
      ]
      : [
        { value: 'top', label: S.arcSort.top },
        { value: 'folder', label: S.arcSort.folder },
        { value: 'skip', label: S.arcSort.skip },
      ];
    const choice = await openArcSort({
      labels: { ...S.arcSort, favorites: S.arcImport.favorites },
      favorites: found.favorites.length,
      spaces: found.spaces.map((space, index) => ({
        ...space,
        mode: defaults.spaces[index].mode,
        title: defaults.spaces[index].title,
        placeholder: S.arcSort.spaceName(index + 1),
      })),
      modes,
      icons: iconChoice(),
    });
    if (!choice) {
      await setArcPending({ ...pending, dismissed: true });
      return;
    }
    await forgetArcPending();
    const result = await applyArcSort(found, choice);
    showToast({
      text: S.arcSort.done(result),
      actionLabel: S.undo,
      duration: UNDO_MS,
      onAction: () => undoArcSort(result.log, pending),
      onClose: (undone) => {
        if (!undone) cleanUpArcImport({ now: true }).catch((error) => console.error('Failed to clean up after the import', error));
      },
    });
  } catch (error) {
    console.error('Failed to sort the import from Arc', error);
  } finally {
    sortOpen = false;
  }
}

// Moves, renames and new folders, in order (planArcSort); the log is what undoArcSort takes back.
async function applyArcSort(found, choice) {
  const root = await ensureRoot();
  let favoritesId = findFavorites(buildTree(await getSubTree(root.id)))?.id ?? null;
  const plan = planArcSort(found, choice, { favoritesExists: Boolean(favoritesId), untitled: S.arcSort.spaceName });
  // Helium's folders go once the undo is over; a panel opened meanwhile leaves them alone.
  const cleanup = await getArcCleanup();
  await setArcCleanup({ ids: [...new Set([...cleanup.ids, ...plan.cleanup])], after: Date.now() + ARC_CLEANUP_AFTER_MS });

  const log = [];
  const move = async (id, parentId, title) => {
    const node = await getBookmark(id);
    if (title !== undefined && title !== node.title) {
      await updateBookmark(id, { title });
      log.push({ renamed: { id, title: node.title } });
    }
    await moveBookmark(id, { parentId });
    log.push({ moved: { id, parentId: node.parentId, index: node.index } });
  };
  if (plan.favorites) {
    if (plan.favorites.create) {
      favoritesId = (await createBookmark({ parentId: root.id, index: 0, title: S.favoritesFolder })).id;
      log.push({ created: { id: favoritesId } });
    }
    for (const id of plan.favorites.ids) await move(id, favoritesId);
  }
  for (const id of plan.top) await move(id, root.id);
  const setIcon = async (id, pictogram) => {
    if (!pictogram) return;
    await setPictogram(id, pictogram);
    log.push({ pictogram: { id } });
  };
  for (const { id, title, pictogram } of plan.folders) {
    await move(id, root.id, title);
    await setIcon(id, pictogram);
  }
  for (const { id, title, pictogram } of plan.spaces) {
    await move(id, root.id, title);
    await setIcon(id, pictogram);
    await setSpaceIds([...((await getSpaceIds()) ?? []), id]);
    log.push({ space: { id } });
  }
  for (const { target, ids } of plan.into) {
    if ((await childCount(target)) === null) continue; // the space is gone
    for (const id of ids) await move(id, target);
  }
  return { links: plan.links, folders: plan.folderCount, log };
}

// Everything back where it was, last step first; the import can be sorted again (from the hint).
async function undoArcSort(log, pending) {
  try {
    for (const step of undoSteps(log)) {
      if (step.moved) await moveBookmark(step.moved.id, { parentId: step.moved.parentId, index: step.moved.index });
      else if (step.renamed) await updateBookmark(step.renamed.id, { title: step.renamed.title });
      else if (step.space) await setSpaceIds(((await getSpaceIds()) ?? []).filter((id) => id !== step.space.id));
      else if (step.pictogram) await setPictogram(step.pictogram.id, null);
      else if (step.created && (await childCount(step.created.id)) === 0) await removeBookmark(step.created.id);
    }
    await setArcPending({ ...pending, dismissed: true });
  } catch (error) {
    console.error('Failed to undo the sorting', error);
  }
}

// Helium's folders the sorting emptied are removed; ones still holding something (skipped
// spaces) are never touched. `now` — the toast is gone without an undo; otherwise (a panel
// opening) only once the undo can't be waiting any more.
async function cleanUpArcImport({ now = false } = {}) {
  const { ids, after } = await getArcCleanup();
  if (!ids.length || (!now && Date.now() < after)) return;
  for (const id of ids) {
    if ((await childCount(id)) === 0) await removeBookmark(id).catch((error) => console.warn('Failed to remove the import\'s folder', id, error));
  }
  await setArcCleanup({ ids: [], after: 0 });
}

// The dialog (widgets.js) picks Arc's sidebar file and what to take; planArcImport
// (lib/arc.js) decides where it goes; the bookmarks are created here one by one.
// With spaces on, Arc's spaces become spaces (planArcSpacesImport, stage 8b).
async function importFromFile() {
  if (importOpen) return;
  importOpen = true;
  let parsed = null;
  const spaces = spacesShown() ? state.spaces.map((space) => ({ id: space.id, title: spaceLabel(space) })) : null;
  try {
    const choice = await openArcImport({
      labels: { ...S.arcImport, cancel: S.cancel },
      path: ARC_FILE[platform()] ?? ARC_FOLDER[platform()] ?? ARC_FILE.mac,
      copyPath: ARC_FILE[platform()] ?? '',
      howTo: S.arcImport.howTo[platform()] ?? '',
      spaces,
      icons: iconChoice(),
      readSidebar: (text) => {
        parsed = parseArcSidebar(JSON.parse(text));
        return {
          favorites: countNodes(parsed.favorites).links,
          spaces: parsed.spaces.map((space) => ({
            title: space.title || S.arcImport.untitled,
            links: countNodes(space.items).links,
            into: spaces && defaultSpaceFor(space.title, spaces),
            // Arc's icon: the nearest pictogram, else its emoji.
            icon: space.pictogram ? { pictogram: space.pictogram } : space.emoji ? { emoji: space.emoji } : null,
          })),
        };
      },
    });
    if (!choice || !parsed) return;
    const result = spaces ? await createSpacesFromArc(parsed, choice) : await createFromArc(parsed, choice);
    showToast({ text: S.arcImport.done(result), duration: UNDO_MS });
  } catch (error) {
    console.error('Failed to import from Arc', error);
  } finally {
    importOpen = false;
  }
}

// Only adds: Arc's favorites into the favorites folder (created first in the root if there
// is none), the rest at the end of the root. A link the browser refuses is skipped.
async function createFromArc(parsed, choice) {
  const root = await ensureRoot();
  const favorites = findFavorites(buildTree(await getSubTree(root.id)));
  const plan = planArcImport(parsed, choice, {
    favoritesTitle: S.favoritesFolder,
    favoritesExists: Boolean(favorites),
    untitledTitle: S.arcImport.untitled,
  });
  const { result, add } = arcAdder();
  await addArcFavorites(plan.favorites, favorites, root.id, add, result);
  await add(root.id, plan.root);
  return result;
}

// With spaces on: into an existing space — at its end; a new one — a folder at the end of the
// root, added to the end of the bar before it is filled (so it never shows as a stray folder).
async function createSpacesFromArc(parsed, choice) {
  const root = await ensureRoot();
  const favorites = findFavorites(buildTree(await getSubTree(root.id)));
  const plan = planArcSpacesImport(parsed, choice, {
    favoritesTitle: S.favoritesFolder,
    favoritesExists: Boolean(favorites),
    untitledTitle: S.arcImport.untitled,
  });
  const { result, add } = arcAdder();
  await addArcFavorites(plan.favorites, favorites, root.id, add, result);
  for (const space of plan.spaces) {
    const ids = (await getSpaceIds()) ?? [];
    let parentId = space.into !== null && ids.includes(space.into) && (await childCount(space.into)) !== null ? space.into : null;
    if (parentId === null) {
      parentId = (await createBookmark({ parentId: root.id, title: space.title })).id;
      result.folders++;
      if (space.pictogram) await setPictogram(parentId, space.pictogram);
      await setSpaceIds([...ids, parentId]);
    }
    await add(parentId, space.children);
  }
  return result;
}

// Arc's favorites into the favorites folder, created first at the top of the root if there is none.
async function addArcFavorites(plan, favorites, rootId, add, result) {
  if (!plan) return;
  let favoritesId = favorites?.id;
  if (plan.create) {
    favoritesId = (await createBookmark({ parentId: rootId, index: 0, title: plan.title })).id;
    result.folders++;
  }
  await add(favoritesId, plan.children);
}

// Creates Arc's links and folders one by one, counting them; a link the browser refuses is skipped.
function arcAdder() {
  const result = { links: 0, folders: 0, failed: 0 };
  const add = async (parentId, nodes) => {
    for (const node of nodes) {
      if (node.children) {
        const folder = await createBookmark({ parentId, title: node.title });
        result.folders++;
        if (node.pictogram) await setPictogram(folder.id, node.pictogram);
        await add(folder.id, node.children);
        continue;
      }
      try {
        await createBookmark({ parentId, title: node.title, url: node.url });
        result.links++;
      } catch (error) {
        result.failed++;
        console.warn('Skipped a link from Arc', node.url, error);
      }
    }
  };
  return { result, add };
}

// The welcome page opened this panel (or found it open) to start the import or to turn spaces on.
function checkRequests() {
  if (state.windowId === undefined) return;
  takeRequest(IMPORT_REQUEST_KEY, state.windowId)
    .then((requested) => requested && importFromArc())
    .catch((error) => console.error('Failed to check the import request', error));
  takeRequest(SPACES_REQUEST_KEY, state.windowId)
    .then((requested) => requested && enableSpaces())
    .catch((error) => console.error('Failed to check the spaces request', error));
}

function showContextMenu(event, target) {
  const { items, disabled } = menuItems(target, { canPinCurrent: canPinCurrent() });
  if (!items.length) return;

  // Opened from the keyboard (the context menu key): under the focused row.
  let { clientX: x, clientY: y } = event;
  if (x === 0 && y === 0 && target.wrap) {
    const rect = target.wrap.firstElementChild.getBoundingClientRect();
    x = rect.left;
    y = rect.bottom;
  }
  target.at = { x, y };

  target.wrap?.classList.add('is-menu-target');
  openMenu({
    x,
    y,
    items: items.map((id) => (id === SEPARATOR ? id : { id, label: S.menu[id], disabled: disabled.has(id) })),
    onSelect: (item) => runMenuItem(item, target),
    onClose: () => target.wrap?.classList.remove('is-menu-target'),
  });
}

// Our own menu everywhere in the panel; text fields keep the system one (paste).
document.addEventListener('contextmenu', (event) => {
  if (event.target.closest('input, textarea')) return;
  event.preventDefault();
  if (event.target.closest('.eyedropper')) {
    showPanelColorMenu(event);
    return;
  }
  if (!state.rootId) return;
  if (listEl.contains(event.target)) showContextMenu(event, menuTarget(event.target));
  const icon = event.target.closest('.space-icon');
  if (icon) showContextMenu(event, spaceTarget(icon, icon.dataset.spaceId));
});

// Double click on a link or folder: rename. As in Arc, the first click has already
// opened the link (or toggled the folder; the second click toggles it back).
listEl.addEventListener('dblclick', (event) => {
  const row = event.target.closest('.link-row, .folder-row');
  if (row && state.rootId && !event.target.closest('.folder-row .icon')) startRename(row.parentElement);
});

// ---------- Drag and drop (see drag.js)

const currentTree = () => ({ id: state.rootId, children: state.rootChildren });
const windowTabs = () =>
  [...state.tabs.values()].filter((tab) => tab.windowId === state.windowId).sort((a, b) => a.index - b.index);

// A tab can be pinned unless it is a link's tab already (dragged from another window's panel).
const canPinTab = (tabId) => state.tabs.has(tabId) && !isPinnedTab(tabId);

// A link, a folder, a tab or an address dropped among bookmarks: next to `targetId`
// (`zone` before / after) or into the folder `targetId` (inside / inside-start).
function bookmarkAction(source, targetId, zone) {
  const moving = source.kind === 'link' || source.kind === 'folder';
  const place = bookmarkDrop(currentTree(), { dragId: moving ? source.id : undefined, targetId, zone });
  if (!place) return null;
  if (moving) return { type: 'move-bookmark', id: source.id, ...place };
  if (source.kind === 'tab') return canPinTab(source.tabId) ? { type: 'pin-tab', tabId: source.tabId, ...place } : null;
  return { type: 'create-link', ...place }; // an address from the address bar or a page
}

// A tab or a link dropped onto the middle of another tab or link: the two side by side.
// Not onto itself, onto a pair already, onto a tab of another window, nor between a tab
// pinned in the browser and one that isn't (Chromium doesn't pair those).
function splitAction(source, target) {
  if (source.kind !== 'tab' && source.kind !== 'link') return null;
  const targetLinkId = target.area === 'tree' ? target.id : undefined;
  const sourceLinkId = source.kind === 'link' ? source.id : undefined;
  if (targetLinkId !== undefined && !state.links.has(targetLinkId)) return null;
  if (sourceLinkId !== undefined && (!state.links.has(sourceLinkId) || sourceLinkId === targetLinkId)) return null;
  const targetTab = targetLinkId !== undefined ? linkTab(targetLinkId) : state.tabs.get(target.tabId);
  const sourceTab = sourceLinkId !== undefined ? linkTab(sourceLinkId) : state.tabs.get(source.tabId);
  if ((target.area === 'tabs' && !targetTab) || (source.kind === 'tab' && !sourceTab)) return null;
  if (targetTab && (targetTab.windowId !== state.windowId || inSplit(targetTab))) return null;
  if (sourceTab && sourceTab.id === targetTab?.id) return null;
  if (Boolean(sourceTab?.pinned) !== Boolean(targetTab?.pinned)) return null;
  return {
    type: 'split',
    target: { linkId: targetLinkId, tabId: targetTab?.id },
    source: { linkId: sourceLinkId, tabId: sourceTab?.id },
  };
}

// What a drop of `source` on `target` would do, or null if it can't be dropped there.
// Called on every pointer move while dragging, so it only reads the panel's state.
function resolveDrop(source, target) {
  if (!state.rootId || !state.treeLoaded) return null;
  if (target.area === 'spaces') return spaceDropAction(source, target);
  if (source.kind === 'space') return null; // icons only move along the bar
  if (target.zone === 'onto') return splitAction(source, target);
  if (target.area === 'tree') return bookmarkAction(source, target.id ?? state.treeRootId, target.zone);
  if (target.area === 'tiles') {
    if (source.kind === 'folder') return null; // tiles are links only
    if (state.favoritesId) {
      return target.id ? bookmarkAction(source, target.id, target.zone) : bookmarkAction(source, state.favoritesId, 'inside');
    }
    // No favorites folder yet: it is created by this drop.
    if (source.kind === 'link' ? !state.links.has(source.id) : source.kind === 'tab' && !canPinTab(source.tabId)) return null;
    return { type: 'new-favorites', source };
  }

  // Below the divider.
  const tabs = windowTabs();
  const spot = { targetTabId: target.tabId, zone: target.zone };
  if (source.kind === 'tab') {
    if (!state.tabs.has(source.tabId)) return null;
    const index = tabDrop(tabs, { dragTabId: source.tabId, ...spot });
    return index === null ? null : { type: 'move-tab', tabId: source.tabId, index };
  }
  if (source.kind === 'link') {
    if (!state.links.has(source.id)) return null;
    const tab = state.tabs.get(state.bindings.get(source.id));
    const index = tabDrop(tabs, { dragTabId: tab?.id, ...spot });
    return { type: 'unpin', id: source.id, tabId: tab?.id, index: index ?? tab.index };
  }
  if (source.kind === 'external') return { type: 'open-url', index: tabDrop(tabs, spot) };
  return null; // folders don't go below the divider
}

// An address dropped above the divider becomes a link there.
async function createDroppedLink({ parentId, index }, link) {
  try {
    expandFolder(parentId);
    const details = { parentId, title: link.title, url: link.url };
    if (index !== undefined) details.index = index;
    const node = await createBookmark(details);
    state.revealAfterLoad = node.id;
  } catch (error) {
    console.error('Failed to add', link.url, error);
  }
}

// A link dropped below the divider: its tab stays there (a closed link opens there first).
async function unpinTo({ id, tabId, index }) {
  if (tabId !== undefined) {
    removeItem(id, { unpin: true, tabIndex: index, windowId: state.windowId });
    return;
  }
  const link = state.links.get(id);
  if (!link) return;
  try {
    const tab = await openInNewTab(link.url, state.windowId, true, index);
    removeItem(id, { unpin: true, openedTabId: tab.id });
  } catch (error) {
    console.error('Failed to open', link.url, error);
  }
}

// The first tile: the favorites folder is created at the top of the root, then the
// link moves into it, the tab is pinned there, or the address becomes a link there.
async function dropIntoNewFavorites(source, link) {
  try {
    const folder = await createBookmark({ parentId: state.rootId, index: 0, title: S.favoritesFolder });
    state.favoritesId = folder.id; // not a folder to expand, and the next drop goes into it
    if (source.kind === 'link') await moveBookmark(source.id, { parentId: folder.id });
    else if (source.kind === 'tab') await pinTab(state.tabs.get(source.tabId), folder.id);
    else await createDroppedLink({ parentId: folder.id }, link);
  } catch (error) {
    console.error('Failed to start the favorites', error);
  }
}

// A link's tab, opening it first if it has none (in the background), and binding it.
async function ensureLinkTab(linkId, tabs, bindings) {
  const tab = tabs.find((candidate) => candidate.id === bindings.get(linkId));
  if (tab) return tab;
  const link = state.links.get(linkId);
  if (!link) return null;
  const opened = await openInNewTab(link.url, state.windowId, false);
  state.bindings.set(linkId, opened.id);
  await bindTab(linkId, opened.id);
  return opened;
}

// Split view: the dropped tab goes right after the target one and the two become a pair,
// the dropped one selected. A closed link opens straight as a pair. The dropped tab leaves
// its old pair, comes over from another window, joins the target's tab group.
async function splitTabs({ target, source }) {
  try {
    const [bindings, tabs] = await Promise.all([getBindings(), getAllTabs()]);
    const targetTab = target.linkId !== undefined
      ? await ensureLinkTab(target.linkId, tabs, bindings)
      : tabs.find((tab) => tab.id === target.tabId);
    if (!targetTab || targetTab.windowId !== state.windowId || inSplit(targetTab)) return;

    let sourceTab = source.linkId !== undefined
      ? tabs.find((tab) => tab.id === bindings.get(source.linkId))
      : tabs.find((tab) => tab.id === source.tabId);
    if (!sourceTab) {
      const link = source.linkId !== undefined && state.links.get(source.linkId);
      if (!link) return;
      const opened = await openSplitTab(link.url, targetTab.id);
      state.bindings.set(source.linkId, opened.id);
      await bindTab(source.linkId, opened.id);
      applyTabState();
      return;
    }
    if (sourceTab.id === targetTab.id || Boolean(sourceTab.pinned) !== Boolean(targetTab.pinned)) return;

    if (inSplit(sourceTab)) await unsplit(sourceTab.splitViewId);
    // The target may have just been opened: positions are read again.
    const windowTabs = (await getAllTabs()).filter((tab) => tab.windowId === state.windowId).sort((a, b) => a.index - b.index);
    const index = splitDrop(windowTabs, { dragTabId: sourceTab.id, targetTabId: targetTab.id });
    if (index !== null) sourceTab = await moveTab(sourceTab.id, index, state.windowId);
    const groupId = windowTabs.find((tab) => tab.id === targetTab.id)?.groupId ?? -1;
    if ((sourceTab.groupId ?? -1) !== groupId) await setTabGroup(sourceTab.id, groupId);
    await createSplit([targetTab.id, sourceTab.id]);
    await chrome.tabs.update(sourceTab.id, { active: true });
  } catch (error) {
    console.error('Failed to put the tabs side by side', error);
  }
}

// `external` — what the browser gave for an address dropped from outside the panel.
function performDrop(action, external) {
  const link = external && droppedLink(external);
  if (external && !link) {
    console.warn('Dropped something that is not an address', external);
    return;
  }
  switch (action.type) {
    case 'move-bookmark':
      moveBookmark(action.id, { parentId: action.parentId, index: action.index })
        .catch((error) => console.error('Failed to move', action.id, error));
      break;
    case 'pin-tab':
      pinTab(state.tabs.get(action.tabId), action.parentId, action.index);
      break;
    case 'move-tab':
      moveTab(action.tabId, action.index, state.windowId)
        .catch((error) => console.error('Failed to move the tab', action.tabId, error));
      break;
    case 'unpin':
      unpinTo(action);
      break;
    case 'create-link':
      createDroppedLink(action, link);
      break;
    case 'new-favorites':
      dropIntoNewFavorites(action.source, link);
      break;
    case 'open-url':
      openInNewTab(link.url, state.windowId, true, action.index)
        .catch((error) => console.error('Failed to open', link.url, error));
      break;
    case 'split':
      splitTabs(action);
      break;
    case 'reorder-spaces':
      setSpaceIds(action.ids).catch((error) => console.error('Failed to reorder the spaces', error));
      break;
    case 'tab-to-space':
    case 'bookmark-to-space':
      moveToSpace(action);
      break;
    case 'link-to-space':
      createBookmark({ parentId: action.spaceId, title: link.title, url: link.url })
        .catch((error) => console.error('Failed to add', link.url, error));
      break;
  }
}

// ---------- Spaces: dropping onto the bar (stage 8b)

// The folder is shown in the tree right now (in the current space).
function isShownFolder(id) {
  const walk = (nodes) => nodes.some((node) => node.kind === 'folder' && (node.id === id || walk(node.children)));
  return walk(state.treeNodes ?? []);
}

// A drop onto the bar: an icon dragged along it takes the new place; onto another space's icon
// a tab moves into that space (its group), a link or a folder (a tile too) to the end of that
// space, an address becomes a link there. Not onto the current space: all that is there already.
function spaceDropAction(source, target) {
  if (!spacesShown() || !state.spaces.some((space) => space.id === target.id)) return null;
  if (source.kind === 'space') {
    const ids = reorderSpaces(state.spaces.map((space) => space.id), source.id, target.id, target.zone);
    return ids && { type: 'reorder-spaces', ids };
  }
  if (target.zone !== 'inside' || target.id === state.currentSpace) return null;
  const spaceId = target.id;
  if (source.kind === 'tab') {
    const tab = state.tabs.get(source.tabId);
    if (!tab || tab.windowId !== state.windowId || tab.pinned || inSplit(tab) || isPinnedTab(tab.id)) return null;
    return { type: 'tab-to-space', tabIds: [tab.id], spaceId };
  }
  if (source.kind === 'link' || source.kind === 'folder') {
    const node = state.nodes.get(source.id);
    const shown = source.kind === 'link' ? state.links.has(source.id) : isShownFolder(source.id);
    if (!node || !shown) return null;
    const tabIds = collectLinks(node.kind === 'folder' ? node : { children: [node] })
      .map((link) => state.bindings.get(link.id))
      .filter((tabId) => state.tabs.has(tabId));
    return { type: 'bookmark-to-space', id: source.id, tabIds, spaceId };
  }
  if (source.kind === 'external') return { type: 'link-to-space', spaceId };
  return null;
}

// The selected tab is about to leave the current space: another tab of it is selected first
// (the one last selected there, else the most recent one, else a new tab), so the panel stays.
async function stayInSpace(leaving) {
  if (!leaving.includes(state.activeTabId)) return;
  const tabs = windowTabs().filter((tab) => !leaving.includes(tab.id));
  const lastTab = state.session.lastTabs.get(lastTabKey(state.windowId, state.currentSpace));
  const tabId = pickSpaceTab(tabs, state.targets ?? new Map(), state.currentSpace, lastTab);
  if (tabId !== null) await chrome.tabs.update(tabId, { active: true });
  else await openInNewTab(undefined, state.windowId);
}

// A tab goes into the space's group (the background script does that); a bookmark to the end
// of the space, its tabs follow it by themselves.
async function moveToSpace({ type, id, tabIds, spaceId }) {
  try {
    await stayInSpace(tabIds);
    if (type === 'tab-to-space') await moveTabsToSpace(state.windowId, spaceId, tabIds);
    else await moveBookmark(id, { parentId: spaceId });
  } catch (error) {
    console.error('Failed to move into the space', spaceId, error);
  }
}

setUpDrag({
  listEl,
  favoritesEl,
  treeEl,
  openTabsEl,
  spacesEl,
  canSplit: canSplitTabs,
  resolve: resolveDrop,
  perform: performDrop,
  expandFolder,
  onDragChange: (active) => {
    state.dragging = active;
    resumeLoad();
  },
});

async function createRoot(button) {
  button.disabled = true;
  try {
    await ensureRoot();
    scheduleLoad();
  } catch (error) {
    console.error('Failed to create the root folder', error);
    button.disabled = false;
  }
}

listEl.addEventListener('click', (event) => {
  const button = event.target.closest('button');
  if (!button) return;
  const item = button.closest('.item, .tile');
  const linkId = item?.dataset.id;
  const tabId = item?.dataset.tabId ? Number(item.dataset.tabId) : undefined;
  // Both tabs of a pair: below the divider, or a link's tab and the one beside it.
  const halves = item?.classList.contains('is-pair')
    ? [tabId ?? state.bindings.get(linkId), Number(item.querySelector(':scope > .pair-half').dataset.tabId)]
    : null;
  if (button.classList.contains('pair-half') || button.classList.contains('pair-row')) {
    selectTab(Number(button.dataset.tabId));
  } else if (button.classList.contains('folder-row')) {
    // The folder's icon opens the icon picker; the rest of the row expands and collapses.
    if (event.target.closest('.icon')) {
      if (event.detail <= 1) openIconPicker(button.parentElement);
    } else toggleFolder(button.parentElement.dataset.id);
  }
  else if (button.classList.contains('link-row') || button.classList.contains('tile-row')) {
    if (event.detail > 1) return; // the second click of a double click: rename, not open
    if (event.metaKey || event.ctrlKey) openCopy(linkId);
    else openLink(linkId);
  } else if (button.classList.contains('tab-row')) selectTab(tabId);
  else if (button.dataset.action === 'close') {
    if (tabId !== undefined) closeTab(halves ?? tabId); // a pair below the divider closes whole
    else closeLinkTab(linkId);
  } else if (button.dataset.action === 'sound') toggleSound(halves ?? [tabId ?? state.bindings.get(linkId)]);
  else if (button.dataset.action === 'revert') revertLink(linkId);
  else if (button.dataset.action === 'new-tab') openNewTab();
  else if (button.dataset.action === 'create-root') createRoot(button);
});

// Middle click: on a link opens a copy, like a link on a web page;
// on an open tab closes it, like in the browser's own tab strip (a pair below the divider —
// both tabs; the half beside a link — that tab).
listEl.addEventListener('mousedown', (event) => {
  if (event.button === 1) event.preventDefault(); // no autoscroll
});
listEl.addEventListener('auxclick', (event) => {
  if (event.button !== 1) return;
  const row = event.target.closest('.link-row, .tile-row, .tab-row, .pair-row, .pair-half');
  if (!row) return;
  event.preventDefault();
  const item = row.closest('.item, .tile');
  if (item.classList.contains('pair-item')) closeTab([Number(item.dataset.tabId), Number(item.dataset.pairTabId)]);
  else if (row.classList.contains('pair-half') || row.classList.contains('tab-row')) closeTab(Number(row.dataset.tabId));
  else openCopy(item.dataset.id);
});

// ---------- Live updates

function onBookmarkEvent(ids) {
  // Without a root folder any change may be the one that brings it back.
  if (!state.rootId || isRelevantEvent(ids, state.knownIds)) scheduleLoad();
}

chrome.bookmarks.onCreated.addListener((id, node) => onBookmarkEvent({ id, parentId: node.parentId }));
chrome.bookmarks.onRemoved.addListener((id, info) => onBookmarkEvent({ id, parentId: info.parentId }));
chrome.bookmarks.onChanged.addListener((id) => onBookmarkEvent({ id }));
chrome.bookmarks.onMoved.addListener((id, info) =>
  onBookmarkEvent({ id, parentId: info.parentId, oldParentId: info.oldParentId }));
chrome.bookmarks.onChildrenReordered.addListener((id) => onBookmarkEvent({ id }));
chrome.bookmarks.onImportEnded.addListener(scheduleLoad);

// Tabs: the selected one is highlighted at once, the rest is re-read in a batch.
chrome.tabs.onActivated.addListener(({ tabId, windowId }) => {
  if (windowId === state.windowId) {
    tabsGeneration++; // a refresh already on its way may carry the old selection
    state.activeTabId = tabId;
    applyTabState();
  }
  scheduleTabsRefresh();
});
chrome.tabs.onCreated.addListener(scheduleTabsRefresh);
chrome.tabs.onRemoved.addListener(scheduleTabsRefresh);
chrome.tabs.onReplaced.addListener(scheduleTabsRefresh);
chrome.tabs.onAttached.addListener(scheduleTabsRefresh);
chrome.tabs.onDetached.addListener(scheduleTabsRefresh);
chrome.tabs.onMoved.addListener(scheduleTabsRefresh);
// groupId: which space a tab is in (stage 8).
const TAB_FIELDS = ['url', 'status', 'title', 'favIconUrl', 'discarded', 'pinned', 'audible', 'mutedInfo', 'splitViewId', 'groupId'];
chrome.tabs.onUpdated.addListener((tabId, info) => {
  if (TAB_FIELDS.some((field) => field in info)) scheduleTabsRefresh();
});

// Bindings change in this panel, in other windows' panels and in the background script.
function onBindingsChanged(changes) {
  let changed = false;
  for (const [key, { newValue }] of Object.entries(changes)) {
    if (!key.startsWith(BINDING_PREFIX)) continue;
    const id = key.slice(BINDING_PREFIX.length);
    if (Number.isInteger(newValue)) state.bindings.set(id, newValue);
    else state.bindings.delete(id);
    changed = true;
  }
  if (changed) applyTabState();
}

// Pictograms set or removed here or in another window. True if any changed.
function onPictogramsChanged(changes) {
  let changed = false;
  for (const [key, { newValue }] of Object.entries(changes)) {
    if (!key.startsWith(PICTOGRAM_PREFIX)) continue;
    const id = key.slice(PICTOGRAM_PREFIX.length);
    if (isPictogram(newValue)) state.pictograms.set(id, newValue);
    else state.pictograms.delete(id);
    changed = true;
  }
  return changed;
}

chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'session') {
    if (changes[IMPORT_REQUEST_KEY]?.newValue !== undefined || changes[SPACES_REQUEST_KEY]?.newValue !== undefined) checkRequests();
    onBindingsChanged(changes);
    onSpaceSessionChanged(changes);
    return;
  }
  if (area !== 'local') return;
  if (PANEL_COLOR_KEY in changes) {
    panelColors = parsePanelColors(changes[PANEL_COLOR_KEY].newValue); // here or in another window
    applyPanelColor();
  }
  if (changes[ARC_PENDING_KEY]?.newValue) sortArcImport(); // Helium's import from Arc just ended
  if (ROOT_ID_KEY in changes) scheduleLoad();
  if (onPictogramsChanged(changes)) scheduleLoad();
  if (SPACES_KEY in changes) {
    const ids = changes[SPACES_KEY].newValue;
    state.spaceIds = Array.isArray(ids) ? ids : null; // turned on or off here or in another window
    scheduleLoad();
  }
  if (EXPANDED_KEY in changes) {
    if (pendingExpandedWrites > 0) {
      pendingExpandedWrites--;
      return;
    }
    const ids = changes[EXPANDED_KEY].newValue;
    state.expanded = Array.isArray(ids) ? ids : [];
    applyExpanded(); // changed in another window
  }
});

let clippingFrame = 0;
new ResizeObserver(() => {
  cancelAnimationFrame(clippingFrame);
  clippingFrame = requestAnimationFrame(() => {
    updateClipping();
    updateTileColumns();
  });
}).observe(listEl);

// ---------- Start

async function init() {
  followThemeWithActionIcon();
  loadPanelColor();
  buildOpenTabs();
  let localItems;
  [state.expanded, state.windowId, state.bindings, state.spaceIds, state.session, localItems] =
    await Promise.all([getExpanded(), getCurrentWindowId(), getBindings(), getSpaceIds(), getSpaceSession(), getLocalItems()]);
  state.pictograms = parsePictograms(localItems);
  requestRestore().catch((error) => console.error('Failed to ask for restoring bindings', error));
  await refreshTabs(); // the window's space may be its selected tab's
  await load();
  checkRequests();
  sortArcImport();
  cleanUpArcImport().catch((error) => console.error('Failed to clean up after the import', error));
}

init().catch((error) => {
  console.error('Failed to start the panel', error);
  render([message(S.loadError)]);
});
