// Which items the panel's context menu shows. No chrome.* calls.
//
// target — what was right-clicked:
//   { kind: 'link', open, moved, tile, split }  open: the link has a tab; moved: the tab left its
//     address; tile: a favorites tile (its × shows only on hover, so closing is in the menu too);
//     split: its tab is in a pair (split view)
//   { kind: 'folder', closedLinks, openLinks, stray }  how many links inside (nested too) have no tab /
//     a tab; stray: spaces are on and the folder is at the top level outside them (it can become one)
//   | { kind: 'tab', split } | { kind: 'pair' } (two tabs side by side below the divider)
//   | { kind: 'space-folder', only } a space: its icon in the bar (stage 8);
//     only: the last space (it can't be deleted or made a folder: turn spaces off instead)
//   | { kind: 'empty', spaces, miniPlayer } (empty space, the divider, "New tab"); spaces: spaces are on;
//     miniPlayer: the mini player is on (stage 10)
// canPinCurrent — the selected tab can be pinned (it isn't a link's tab already).
// Returns item ids in order, SEPARATOR between groups; `disabled` lists inactive ones.
// Labels are in lib/strings.js (S.menu[id]).

export const SEPARATOR = '-';

export function menuItems(target, { canPinCurrent = false } = {}) {
  const disabled = new Set();
  let items;
  switch (target.kind) {
    case 'link':
      items = ['rename', 'edit-url'];
      if (target.moved) items.push('revert');
      items.push('open-copy');
      if (target.tile && target.open) items.push('close-link-tab');
      if (target.split) items.push('unsplit');
      items.push(SEPARATOR, target.open ? 'unpin' : 'delete');
      break;
    case 'folder':
      items = ['rename', 'change-icon', 'new-subfolder', 'pin-current-here', SEPARATOR, 'open-all', 'close-all', SEPARATOR, 'delete-folder'];
      if (target.stray) items.splice(2, 0, 'make-space');
      if (!canPinCurrent) disabled.add('pin-current-here');
      if (!target.closedLinks) disabled.add('open-all');
      if (!target.openLinks) disabled.add('close-all');
      break;
    case 'tab':
      items = target.split ? ['pin-tab', 'unsplit', 'close-tab'] : ['pin-tab', 'close-tab'];
      break;
    case 'pair':
      items = ['unsplit', 'close-pair'];
      break;
    case 'space-folder':
      items = ['rename', 'change-icon', 'make-folder', SEPARATOR, 'new-space', SEPARATOR, 'delete-space'];
      if (target.only) {
        disabled.add('make-folder');
        disabled.add('delete-space');
      }
      break;
    case 'empty':
      items = ['new-folder', 'pin-current', SEPARATOR, 'import-arc', target.spaces ? 'disable-spaces' : 'enable-spaces', target.miniPlayer ? 'disable-mini-player' : 'enable-mini-player', 'welcome'];
      if (!canPinCurrent) disabled.add('pin-current');
      break;
    default:
      items = [];
  }
  return { items, disabled };
}
