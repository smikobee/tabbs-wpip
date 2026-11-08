import { test } from 'node:test';
import assert from 'node:assert/strict';
import { menuItems, SEPARATOR } from '../extension/lib/menu.js';
import { STRINGS } from '../extension/lib/strings.js';

const S = STRINGS.ru('Tabbs');

test('link without a tab: delete', () => {
  const { items, disabled } = menuItems({ kind: 'link', open: false, moved: false });
  assert.deepEqual(items, ['rename', 'edit-url', 'open-copy', SEPARATOR, 'delete']);
  assert.equal(disabled.size, 0);
});

test('open link: unpin; revert only when the tab left the address', () => {
  assert.deepEqual(menuItems({ kind: 'link', open: true, moved: false }).items,
    ['rename', 'edit-url', 'open-copy', SEPARATOR, 'unpin']);
  assert.deepEqual(menuItems({ kind: 'link', open: true, moved: true }).items,
    ['rename', 'edit-url', 'revert', 'open-copy', SEPARATOR, 'unpin']);
});

test('tile: like a link, plus closing its tab (a tile has no ×)', () => {
  assert.deepEqual(menuItems({ kind: 'link', tile: true, open: true, moved: true }).items,
    ['rename', 'edit-url', 'revert', 'open-copy', 'close-link-tab', SEPARATOR, 'unpin']);
  assert.deepEqual(menuItems({ kind: 'link', tile: true, open: false }).items,
    ['rename', 'edit-url', 'open-copy', SEPARATOR, 'delete']);
});

test('folder: pinning the current tab depends on whether it can be pinned', () => {
  const folder = { kind: 'folder', closedLinks: 2, openLinks: 1 };
  const can = menuItems(folder, { canPinCurrent: true });
  assert.deepEqual(can.items, [
    'rename', 'change-icon', 'new-subfolder', 'pin-current-here', SEPARATOR,
    'open-all', 'close-all', SEPARATOR, 'delete-folder',
  ]);
  assert.equal(can.disabled.size, 0);
  assert.ok(menuItems(folder, { canPinCurrent: false }).disabled.has('pin-current-here'));
});

test('folder: "Открыть всё" needs a link without a tab, "Закрыть всё" — a link with one', () => {
  const allOpen = menuItems({ kind: 'folder', closedLinks: 0, openLinks: 3 }, { canPinCurrent: true }).disabled;
  assert.deepEqual([...allOpen], ['open-all']);
  const noneOpen = menuItems({ kind: 'folder', closedLinks: 3, openLinks: 0 }, { canPinCurrent: true }).disabled;
  assert.deepEqual([...noneOpen], ['close-all']);
  const empty = menuItems({ kind: 'folder', closedLinks: 0, openLinks: 0 }, { canPinCurrent: true }).disabled;
  assert.deepEqual([...empty].sort(), ['close-all', 'open-all']);
});

test('tab below the divider and empty space', () => {
  assert.deepEqual(menuItems({ kind: 'tab' }).items, ['pin-tab', 'close-tab']);
  assert.deepEqual(menuItems({ kind: 'empty' }, { canPinCurrent: true }).items, ['new-folder', 'pin-current', SEPARATOR, 'import-arc', 'enable-spaces', 'enable-mini-player', 'welcome']);
  assert.ok(menuItems({ kind: 'empty' }).disabled.has('pin-current'));
  assert.deepEqual(menuItems({ kind: 'empty', spaces: true }).items.slice(3, 5), ['import-arc', 'disable-spaces']);
  assert.equal(menuItems({ kind: 'empty', miniPlayer: true }).items[5], 'disable-mini-player');
});

test('split view: a pair below the divider and a link whose tab is in a pair', () => {
  assert.deepEqual(menuItems({ kind: 'pair' }).items, ['unsplit', 'close-pair']);
  assert.deepEqual(menuItems({ kind: 'link', open: true, split: true }).items, ['rename', 'edit-url', 'open-copy', 'unsplit', SEPARATOR, 'unpin']);
  assert.ok(!menuItems({ kind: 'link', open: true }).items.includes('unsplit'));
  assert.deepEqual(menuItems({ kind: 'tab', split: true }).items, ['pin-tab', 'unsplit', 'close-tab']);
});

test('every menu item has a label in every language', () => {
  const targets = [
    { kind: 'link', open: true, moved: true }, { kind: 'link', open: false }, { kind: 'link', tile: true, open: true }, { kind: 'folder' }, { kind: 'tab' }, { kind: 'pair' }, { kind: 'link', open: true, split: true }, { kind: 'empty' }, { kind: 'empty', spaces: true }, { kind: 'space-folder' }, { kind: 'folder', stray: true },
  ];
  for (const target of targets) {
    for (const id of menuItems(target).items) {
      if (id === SEPARATOR) continue;
      for (const [language, strings] of Object.entries(STRINGS)) assert.equal(typeof strings('Tabbs').menu[id], 'string', `${language}: ${id}`);
    }
  }
});

test('"Открыть всё" asks in good Russian', () => {
  assert.equal(S.confirmOpenAll(11), 'Открыть 11 вкладок?');
  assert.equal(S.confirmOpenAll(21), 'Открыть 21 вкладку?');
  assert.equal(S.confirmOpenAll(23), 'Открыть 23 вкладки?');
});

test('folder contents read naturally in Russian', () => {
  assert.equal(S.folderContents({ links: 7, folders: 1 }), 'Внутри: 7 ссылок, 1 папка');
  assert.equal(S.folderContents({ links: 1, folders: 0 }), 'Внутри: 1 ссылка');
  assert.equal(S.folderContents({ links: 22, folders: 12 }), 'Внутри: 22 ссылки, 12 папок');
  assert.equal(S.folderContents({ links: 0, folders: 3 }), 'Внутри: 3 папки');
});

test('"Open all" and folder contents in English', () => {
  const S = STRINGS.en('Tabbs');
  assert.equal(S.confirmOpenAll(11), 'Open 11 tabs?');
  assert.equal(S.confirmOpenAll(1), 'Open 1 tab?');
  assert.equal(S.folderContents({ links: 7, folders: 1 }), 'Inside: 7 links, 1 folder');
  assert.equal(S.folderContents({ links: 1, folders: 0 }), 'Inside: 1 link');
  assert.equal(S.folderContents({ links: 0, folders: 3 }), 'Inside: 3 folders');
});

test('Arc import result reads naturally', () => {
  assert.equal(STRINGS.en('Tabbs').arcImport.done({ links: 26, folders: 6, failed: 0 }), 'Imported 26 links, 6 folders');
  assert.equal(STRINGS.en('Tabbs').arcImport.done({ links: 1, folders: 0, failed: 2 }), 'Imported 1 link, 2 skipped');
  assert.equal(STRINGS.ru('Tabbs').arcImport.done({ links: 26, folders: 6, failed: 0 }), 'Импортировано: 26 ссылок, 6 папок');
  assert.equal(STRINGS.ru('Tabbs').arcImport.done({ links: 21, folders: 1, failed: 0 }), 'Импортировано: 21 ссылка, 1 папка');
});

test('spaces: the space menu, the last space, a stray top-level folder', () => {
  assert.deepEqual(menuItems({ kind: 'space-folder' }).items, ['rename', 'change-icon', 'make-folder', SEPARATOR, 'new-space', SEPARATOR, 'delete-space']);
  assert.deepEqual([...menuItems({ kind: 'space-folder', only: true }).disabled].sort(), ['delete-space', 'make-folder']);
  assert.deepEqual(menuItems({ kind: 'folder', stray: true }).items.slice(0, 3), ['rename', 'change-icon', 'make-space']);
  assert.ok(!menuItems({ kind: 'folder' }).items.includes('make-space'));
});
