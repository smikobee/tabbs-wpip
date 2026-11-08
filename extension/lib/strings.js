// All user-facing texts of the extension, in English and Russian (stage 7). Both
// dictionaries have the same keys. The panel picks one by the browser's language:
// strings(uiLanguage) — Russian for a Russian browser, English for any other.
// The manifest's texts (description, shortcut names) are in _locales/.
// The extension's name isn't written here: it is the manifest's "name" (lib/browser.js →
// appName), so the same code says Tabbs in the public build (scripts/public.mjs) and the
// author's own name in extension/. The dictionaries are built for it: strings(uiLanguage, app).

// The public build's name (scripts/public.mjs).
export const PUBLIC_NAME = 'Tabbs';

// The root folder is named like the extension, the same in every language. Without a stored
// id it is looked up by the extension's name, then by the public one (lib/root.js).
export const rootFolderTitles = (app) => [...new Set([app, PUBLIC_NAME])];

// The folder inside the root shown as tiles (lib/favorites.js), by language.
export const FAVORITES_FOLDERS = { en: 'Favorites', ru: 'Избранное' };

const en = (app) => ({
  appName: app,
  favoritesFolder: FAVORITES_FOLDERS.en,

  emptyRoot: 'Drop a tab from below the line or a link from the address bar here',
  rootMissing: `Can’t find the “${app}” folder`,
  createRoot: 'Create',
  emptyFolder: 'Empty',
  untitledFolder: 'Untitled',
  loadError: 'Couldn’t load bookmarks',

  closeTab: 'Close tab',
  closePair: 'Close both tabs',
  revertUrl: 'Back to saved URL',
  mute: 'Mute',
  unmute: 'Unmute',
  newTab: 'New tab',
  favoritesDrop: 'Drop here to add to Favorites',

  // The eyedropper at the bottom of the panel (stage 9).
  panelColor: {
    pick: 'Panel color',
    hint: 'Click the panel’s header',
    reset: 'Reset color',
  },

  miniPlayer: {
    label: 'Mini player',
    back: 'Back to the tab',
    play: 'Play',
    pause: 'Pause',
    rewind: 'Back 10 seconds',
    forward: 'Forward 10 seconds',
    mute: 'Mute the tab',
    unmute: 'Unmute the tab',
    close: 'Close the mini player',
    seek: 'Go to this moment',
    live: 'Live',
  },

  menu: {
    rename: 'Rename',
    'change-icon': 'Change icon',
    'edit-url': 'Edit URL',
    revert: 'Back to saved URL',
    'open-copy': 'Open copy in new tab',
    'close-link-tab': 'Close tab',
    unpin: 'Unpin',
    delete: 'Delete',
    'new-subfolder': 'New folder inside',
    'pin-current-here': 'Pin current tab here',
    'open-all': 'Open all',
    'close-all': 'Close all',
    'delete-folder': 'Delete folder',
    'pin-tab': 'Pin',
    'close-tab': 'Close',
    unsplit: 'Separate',
    'close-pair': 'Close both',
    'new-folder': 'New folder',
    'pin-current': 'Pin current tab',
    'import-arc': 'Import from Arc…',
    welcome: 'Welcome & setup',
    'enable-spaces': 'Turn on spaces…',
    'disable-spaces': 'Turn off spaces…',
    'enable-mini-player': 'Turn on mini player',
    'disable-mini-player': 'Turn off mini player',
    'make-space': 'Make it a space',
    'make-folder': 'Make it a folder in…',
    'delete-space': 'Delete space',
    'new-space': 'New space…',
  },

  // Spaces (stage 8).
  spaces: {
    bar: 'Spaces',
    untitled: 'Untitled space',
    firstDefault: 'Space 1',
    newSpace: 'New space',
    newDefault: 'New space',
    enableTitle: 'Turn on spaces',
    notProfiles: 'Unlike Arc, a space doesn’t switch browser profiles: logins, history and extensions are shared. A space only sorts your links and tabs.',
    makeSpaces: 'Make these folders spaces',
    rest: 'Everything else goes into the first space',
    firstField: 'Name of the first space',
    groupsWarning: 'Your tab groups will become part of spaces: tabs stay open, but the groups are dissolved.',
    bookmarksBar: 'Helium shows tab groups on the bookmarks bar. To keep spaces off it, turn off “Automatically pin new tab groups to the bookmarks bar” in Appearance settings.',
    turnOn: 'Turn on',
    noPermission: 'Spaces need permission to manage tab groups',
    disableTitle: 'Turn off spaces?',
    disableText: 'Spaces become ordinary folders, tabs stay open.',
    turnOff: 'Turn off',
    nameField: 'Name',
    iconPicker: 'Space icon',
    ownEmoji: 'Or type any emoji at the start of the name.',
    create: 'Create',
    renameTitle: 'Rename space',
    save: 'Save',
    deleteTitle: (name) => `Delete space “${name}”?`,
    tabsMove: (name) => `Open tabs move to “${name}”.`,
  },

  newFolderTitle: 'New folder',
  renameField: 'Name',
  urlField: 'URL',
  invalidUrl: 'That doesn’t look like a URL',

  iconPicker: 'Folder icon',
  otherEmoji: 'Other…',
  otherEmojiField: 'Emoji',
  // By the platform (lib/browser.js → platform); none where there is no emoji shortcut.
  emojiHint: { mac: '⌃⌘Space — emoji picker', win: 'Win + . — emoji panel' },
  notEmoji: 'That’s not an emoji',
  removeIcon: 'Remove icon',
  iconTabs: { pictograms: 'Icons', emoji: 'Emoji' },
  pictogramThemes: {
    work: 'Work',
    code: 'Code and tech',
    media: 'Media',
    study: 'Study',
    home: 'Home',
    travel: 'Travel',
    sport: 'Sport and health',
    money: 'Money',
    people: 'People',
    nature: 'Nature',
    other: 'Other',
  },

  confirmDeleteFolder: (name) => `Delete folder “${name}”?`,
  folderContents: ({ links, folders }) => {
    const parts = [];
    if (links) parts.push(`${links} ${links === 1 ? 'link' : 'links'}`);
    if (folders) parts.push(`${folders} ${folders === 1 ? 'folder' : 'folders'}`);
    return `Inside: ${parts.join(', ')}`;
  },
  confirmOpenAll: (n) => `Open ${n} ${n === 1 ? 'tab' : 'tabs'}?`,
  folderLabel: (name) => `Folder “${name}”`,
  confirmOpen: 'Open',
  cancel: 'Cancel',
  confirmDelete: 'Delete',

  removed: 'Deleted',
  unpinned: 'Unpinned',
  undo: 'Undo',

  // The welcome page (stage 7b). Setting names are as Helium shows them in this language.
  // **bold** and [link](action) — see lib/richtext.js; actions are in welcome.js.
  welcome: {
    title: `Welcome to ${app}`,
    intro: `A small extension for everyone who got used to tabs in Arc. ${app} adds a side panel: favorites on top, then your folders and links, and below the line — the other open tabs of the window.`,
    setupTitle: 'How to make it work',
    setupIntro: `${app} can’t change Helium’s settings, so here are a few simple steps:`,
    stepAppearance: 'Open the [Appearance](appearance) settings.',
    // What the toolbar link searches for in the settings: the row's name in Helium.
    toolbarSearch: 'Customize your toolbar',
    stepLayout: 'Set **Layout** to **Vertical**.',
    stepRightTabs: 'Turn on **Show vertical tabs on right side**.',
    stepFrameless: 'Turn on **Frameless mode** and **Always show the top bar**, turn off **Always show the sidebar**. Helium’s own tabs will hide and slide out at the edge of the window — you won’t need them.',
    stepPanelLeft: 'Further down, in **Side panel position**, set **Helium Panels** to **Left**.',
    stepBookmarksBar: 'Turn off **Automatically pin new tab groups to the bookmarks bar**, or your spaces show up on the bookmarks bar.',
    stepShortcut: (key) => `${app} now opens with **${key}** ([change](shortcuts)), so you can hide the puzzle icon if you like: [Customize your toolbar](toolbar) → **Toolbar** → turn off **Extensions**. Your extensions stay in the menu bar: Window → Extensions.`,
    stepNoShortcut: `Choose a [shortcut](shortcuts) for ${app}, then you can hide the puzzle icon if you like: [Customize your toolbar](toolbar) → **Toolbar** → turn off **Extensions**. Your extensions stay in the menu bar: Window → Extensions.`,
    stepsDone: 'Done. Nice work!',
    // Under the steps (stage 9): the eyedropper at the bottom of the panel.
    themeColor: 'Using a color theme in Helium? Click the eyedropper at the bottom of the panel, then click the panel’s header — the panel takes the same color. The dark theme switches by itself.',
    markDone: 'Mark as done',
    markNotDone: 'Mark as not done',
    spacesTitle: 'Spaces',
    spacesText: 'Like in Arc: separate sets of pinned links and open tabs — say, Work and Home. Switch with the icons at the bottom of the panel or by swiping sideways with two fingers. Favorites stay the same in every space.',
    spacesNotArc: 'Unlike Arc, a space doesn’t switch browser profiles: logins, history and extensions are shared. A space only sorts your links and tabs.',
    spacesPermission: `Spaces are off by default. When you turn them on, Helium asks to let ${app} manage tab groups — that’s where it keeps which tab belongs to which space. If you use tab groups yourself, keep spaces off.`,
    spacesButton: 'Turn on spaces',
    spacesOn: 'Spaces are on.',
    spacesKeys: (next, previous) => (next && previous
      ? `**${next}** / **${previous}** — the next and the previous space.`
      : next ? `**${next}** — the next space.` : `**${previous}** — the previous space.`),
    arcSpaces: 'With spaces on, Arc’s spaces can become spaces here too, or go into yours.',
    arcTitle: 'Import from Arc',
    arcChoose: `Click the button: Helium’s own import opens. Choose **Arc** with your name and click **Import**, and ${app} offers to sort the links into its folders.`,
    // Where the browser can't import from Arc itself (Brave, Edge): Arc's file by hand.
    arcChooseFile: 'Click the button below and choose Arc’s sidebar file:',
    arcHowTo: {
      mac: 'No need to look for it: **Choose file…** in the panel copies this path, and in the file window you press **⇧⌘G**, **⌘V**, **Return** and then **Open**. You can also drag the file into the panel.',
      win: 'In the file window, paste the folder’s path into the address bar and choose **StorableSidebar.json**. You can also drag the file into the panel.',
    },
    arcButton: 'Import from Arc',
    chapters: 'Chapters',
    chapterWelcome: 'Welcome',
    otherTitle: 'Other browsers',
    otherBrowsers: `${app} also works in Chrome, Brave, Edge and other Chromium browsers. Unfortunately, their own tab strip can’t be hidden.`,
    again: 'To see this page again: right-click empty space in the panel → Welcome & setup.',
  },

  // Import from Arc (stage 7b): the dialog in the panel. Arc's folder is ARC_FOLDER in lib/arc.js.
  arcImport: {
    title: 'Import from Arc',
    where: 'Choose Arc’s sidebar file:',
    howTo: {
      mac: '“Choose file…” copies this path. In the file window press ⇧⌘G, then ⌘V, Return and Open.',
      win: 'Paste the folder’s path into the address bar of the file window and choose StorableSidebar.json.',
    },
    drop: 'Or drag the file here.',
    choose: 'Choose file…',
    notArc: 'This isn’t Arc’s sidebar file.',
    adds: `Links are added to ${app}, nothing is deleted.`,
    favorites: (links) => `Favorites · ${count(links, 'link', 'links')}`,
    top: 'On top',
    none: 'Nothing',
    folders: 'As folders',
    space: (title, links) => `${title} · ${count(links, 'link', 'links')}`,
    untitled: 'Untitled space',
    spacesTitle: 'Spaces',
    intoNew: 'New space',
    into: (name) => `Into “${name}”`,
    intoLabel: (name) => `Where “${name}” goes`,
    import: 'Import',
    done: ({ links, folders, failed }) => [
      `Imported ${count(links, 'link', 'links')}`,
      folders ? count(folders, 'folder', 'folders') : '',
      failed ? `${failed} skipped` : '',
    ].filter(Boolean).join(', '),
  },

  // Helium's own import from Arc (after stage 8b): the hint while it runs, then sorting what
  // came into the root folder. The modes are where a space goes.
  arcSort: {
    hint: `Helium’s import has opened in a new tab. Choose “Arc” with your name (not __ARC_SYSTEM_PROFILE) and click Import. Then ${app} offers to sort the links.`,
    ok: 'OK',
    byFile: 'Choose Arc’s file by hand…',
    previous: 'Sort the last import',
    title: `Sort into ${app}`,
    intro: 'This came from Arc. Choose where each space goes: the links are moved, not copied.',
    spaceName: (n) => `Space ${n}`,
    nameLabel: (n) => `Name of space ${n}`,
    modeLabel: (n) => `Where space ${n} goes`,
    preview: (titles, links) => `${titles.join(', ')}${links > titles.length ? '…' : ''} · ${count(links, 'link', 'links')}`,
    noLinks: 'No pinned links',
    top: 'On top',
    folder: 'As a folder',
    space: 'As a space',
    skip: 'Skip',
    skipped: 'Skipped spaces stay in Helium’s “Imported from Arc” folder on the bookmarks bar.',
    sort: 'Sort',
    later: 'Not now',
    done: ({ links, folders }) => [
      `Sorted ${count(links, 'link', 'links')}`,
      folders ? count(folders, 'folder', 'folders') : '',
    ].filter(Boolean).join(', '),
  },
});

const ru = (app) => ({
  appName: app,
  favoritesFolder: FAVORITES_FOLDERS.ru,

  emptyRoot: 'Перетащите сюда вкладку из-под черты или адрес из адресной строки',
  rootMissing: `Папка „${app}“ не найдена`,
  createRoot: 'Создать',
  emptyFolder: 'Пусто',
  untitledFolder: 'Без названия',
  loadError: 'Не удалось загрузить закладки',

  closeTab: 'Закрыть вкладку',
  closePair: 'Закрыть обе вкладки',
  revertUrl: 'Вернуть исходный адрес',
  mute: 'Выключить звук',
  unmute: 'Включить звук',
  newTab: 'Новая вкладка',
  favoritesDrop: 'Перетащите сюда — в Избранное',

  panelColor: {
    pick: 'Цвет панели',
    hint: 'Кликните по заголовку панели',
    reset: 'Сбросить цвет',
  },

  miniPlayer: {
    label: 'Мини-плеер',
    back: 'Вернуться во вкладку',
    play: 'Воспроизвести',
    pause: 'Пауза',
    rewind: 'Назад на 10 секунд',
    forward: 'Вперёд на 10 секунд',
    mute: 'Выключить звук вкладки',
    unmute: 'Включить звук вкладки',
    close: 'Закрыть мини-плеер',
    seek: 'Перейти к этому моменту',
    live: 'Эфир',
  },

  menu: {
    rename: 'Переименовать',
    'change-icon': 'Сменить значок',
    'edit-url': 'Изменить адрес',
    revert: 'Вернуть исходный адрес',
    'open-copy': 'Открыть копию в новой вкладке',
    'close-link-tab': 'Закрыть вкладку',
    unpin: 'Открепить',
    delete: 'Удалить',
    'new-subfolder': 'Новая папка внутри',
    'pin-current-here': 'Закрепить сюда текущую вкладку',
    'open-all': 'Открыть всё',
    'close-all': 'Закрыть всё',
    'delete-folder': 'Удалить папку',
    'pin-tab': 'Закрепить',
    'close-tab': 'Закрыть',
    unsplit: 'Разъединить',
    'close-pair': 'Закрыть обе',
    'new-folder': 'Новая папка',
    'pin-current': 'Закрепить текущую вкладку',
    'import-arc': 'Импорт из Arc…',
    welcome: 'Приветствие и настройка',
    'enable-spaces': 'Включить пространства…',
    'disable-spaces': 'Выключить пространства…',
    'enable-mini-player': 'Включить мини-плеер',
    'disable-mini-player': 'Выключить мини-плеер',
    'make-space': 'Сделать пространством',
    'make-folder': 'Сделать папкой в…',
    'delete-space': 'Удалить пространство',
    'new-space': 'Новое пространство…',
  },

  spaces: {
    bar: 'Пространства',
    untitled: 'Без названия',
    firstDefault: 'Пространство 1',
    newSpace: 'Новое пространство',
    newDefault: 'Новое пространство',
    enableTitle: 'Включить пространства',
    notProfiles: 'В отличие от Arc, пространство не переключает профиль браузера: входы на сайты, история и расширения общие. Пространство только раскладывает ссылки и вкладки.',
    makeSpaces: 'Сделать пространствами',
    rest: 'Остальное — в первое пространство',
    firstField: 'Название первого пространства',
    groupsWarning: 'Ваши группы вкладок станут частью пространств: вкладки останутся открытыми, но группы распустятся.',
    bookmarksBar: 'Helium показывает группы вкладок на панели закладок. Чтобы пространств там не было, выключите «Автоматически закреплять новые группы вкладок на панели закладок» в настройках «Внешний вид».',
    turnOn: 'Включить',
    noPermission: 'Без разрешения на группы вкладок пространства не включить',
    disableTitle: 'Выключить пространства?',
    disableText: 'Пространства станут обычными папками, вкладки останутся открытыми.',
    turnOff: 'Выключить',
    nameField: 'Название',
    iconPicker: 'Значок пространства',
    ownEmoji: 'Или впишите любое эмодзи в начало названия.',
    create: 'Создать',
    renameTitle: 'Переименовать пространство',
    save: 'Сохранить',
    deleteTitle: (name) => `Удалить пространство „${name}“?`,
    tabsMove: (name) => `Открытые вкладки переедут в „${name}“.`,
  },

  newFolderTitle: 'Новая папка',
  renameField: 'Название',
  urlField: 'Адрес',
  invalidUrl: 'Это не похоже на адрес',

  iconPicker: 'Значок папки',
  otherEmoji: 'Другой…',
  otherEmojiField: 'Эмодзи',
  emojiHint: { mac: '⌃⌘Пробел — палитра эмодзи', win: 'Win + . — панель эмодзи' },
  notEmoji: 'Это не эмодзи',
  removeIcon: 'Убрать значок',
  iconTabs: { pictograms: 'Значки', emoji: 'Эмодзи' },
  pictogramThemes: {
    work: 'Работа',
    code: 'Код и техника',
    media: 'Медиа',
    study: 'Учёба',
    home: 'Дом и быт',
    travel: 'Путешествия',
    sport: 'Спорт и здоровье',
    money: 'Деньги',
    people: 'Общение',
    nature: 'Природа',
    other: 'Разное',
  },

  confirmDeleteFolder: (name) => `Удалить папку „${name}“?`,
  folderContents: ({ links, folders }) => {
    const parts = [];
    if (links) parts.push(`${links} ${plural(links, 'ссылка', 'ссылки', 'ссылок')}`);
    if (folders) parts.push(`${folders} ${plural(folders, 'папка', 'папки', 'папок')}`);
    return `Внутри: ${parts.join(', ')}`;
  },
  confirmOpenAll: (n) => `Открыть ${n} ${plural(n, 'вкладку', 'вкладки', 'вкладок')}?`,
  folderLabel: (name) => `Папка „${name}“`,
  confirmOpen: 'Открыть',
  cancel: 'Отмена',
  confirmDelete: 'Удалить',

  removed: 'Удалено',
  unpinned: 'Откреплено',
  undo: 'Вернуть',

  welcome: {
    title: `Добро пожаловать в ${app}`,
    intro: `Это небольшое расширение для всех, кто привык к вкладкам в Arc. ${app} добавляет боковую панель: наверху избранное, ниже папки и ссылки, а под чертой — остальные открытые вкладки окна.`,
    setupTitle: 'Как всё настроить',
    setupIntro: `${app} не может менять настройки Helium, поэтому несколько простых шагов:`,
    stepAppearance: 'Откройте настройки [«Внешний вид»](appearance).',
    toolbarSearch: 'Настройка панели инструментов',
    stepLayout: 'В **«Ориентация»** выберите **«Вертикальная»**.',
    stepRightTabs: 'Включите **«Показывать вертикальные вкладки справа»**.',
    stepFrameless: 'Включите **«Безрамочный режим»** и **«Всегда показывать верхнюю панель»**, выключите **«Всегда показывать боковую панель»**. Родные вкладки Helium спрячутся и будут выезжать у края окна — они вам больше не понадобятся.',
    stepPanelLeft: 'Ниже, в **«Расположение боковой панели»**, у настройки **«Панели Helium»** выберите **«Слева»**.',
    stepBookmarksBar: 'Выключите **«Автоматически закреплять новые группы вкладок на панели закладок»** — иначе пространства появятся на панели закладок.',
    stepShortcut: (key) => `${app} теперь открывается клавишами **${key}** ([изменить](shortcuts)), так что значок пазла можно спрятать: [«Настройка панели инструментов»](toolbar) → **«Панель инструментов»** → выключите **«Расширения»**. Сами расширения останутся в меню: «Окно» → «Расширения».`,
    stepNoShortcut: `Назначьте ${app} [клавиши](shortcuts), и значок пазла можно будет спрятать: [«Настройка панели инструментов»](toolbar) → **«Панель инструментов»** → выключите **«Расширения»**. Сами расширения останутся в меню: «Окно» → «Расширения».`,
    stepsDone: 'Готово, отличная работа!',
    themeColor: 'Цветная тема в Helium? Нажмите пипетку внизу панели и кликните по заголовку панели — панель возьмёт тот же цвет. Тёмная тема переключается сама.',
    markDone: 'Отметить как сделанное',
    markNotDone: 'Снять отметку',
    spacesTitle: 'Пространства',
    spacesText: 'Как в Arc: отдельные наборы закреплённых ссылок и открытых вкладок — например, «Работа» и «Дом». Переключаются иконками внизу панели или свайпом двумя пальцами вбок. Избранное во всех пространствах общее.',
    spacesNotArc: 'В отличие от Arc, пространство не переключает профиль браузера: входы на сайты, история и расширения общие. Пространство только раскладывает ссылки и вкладки.',
    spacesPermission: `По умолчанию выключены. Когда вы их включите, Helium попросит разрешить ${app} управлять группами вкладок — в них хранится, какая вкладка к какому пространству относится. Если вы сами пользуетесь группами вкладок, лучше не включать.`,
    spacesButton: 'Включить пространства',
    spacesOn: 'Пространства включены.',
    spacesKeys: (next, previous) => (next && previous
      ? `**${next}** / **${previous}** — следующее и предыдущее пространство.`
      : next ? `**${next}** — следующее пространство.` : `**${previous}** — предыдущее пространство.`),
    arcSpaces: 'При включённых пространствах пространства Arc могут стать пространствами и здесь или лечь в ваши.',
    arcTitle: 'Импорт из Arc',
    arcChoose: `Нажмите кнопку — откроется импорт Helium. Выберите **Arc** с вашим именем и нажмите **«Импорт»**, а ${app} предложит разложить ссылки по своим папкам.`,
    arcChooseFile: 'Нажмите кнопку ниже и выберите файл сайдбара Arc:',
    arcHowTo: {
      mac: 'Искать его не нужно: «Выбрать файл…» в панели скопирует этот путь, а в окне выбора останется нажать **⇧⌘G**, **⌘V**, **Return** и **«Открыть»**. Можно и перетащить файл в панель.',
      win: 'В окне выбора вставьте путь к папке в адресную строку и выберите **StorableSidebar.json**. Можно и перетащить файл в панель.',
    },
    arcButton: 'Импортировать из Arc',
    chapters: 'Главы',
    chapterWelcome: 'Добро пожаловать',
    otherTitle: 'Другие браузеры',
    otherBrowsers: `${app} работает и в Chrome, Brave, Edge и других браузерах на Chromium. Но их родные вкладки, к сожалению, не спрятать.`,
    again: 'Открыть эту страницу снова: правый клик по пустому месту панели → «Приветствие и настройка».',
  },

  arcImport: {
    title: 'Импорт из Arc',
    where: 'Выберите файл сайдбара Arc:',
    howTo: {
      mac: '«Выбрать файл…» скопирует этот путь. В окне выбора нажмите ⇧⌘G, затем ⌘V, Return и «Открыть».',
      win: 'Вставьте путь к папке в адресную строку окна выбора и выберите StorableSidebar.json.',
    },
    drop: 'Или перетащите файл сюда.',
    choose: 'Выбрать файл…',
    notArc: 'Это не файл сайдбара Arc.',
    adds: `Ссылки добавятся в ${app}, ничего не удалится.`,
    favorites: (links) => `Избранное · ${links} ${plural(links, 'ссылка', 'ссылки', 'ссылок')}`,
    top: 'Наверху',
    none: 'Ничего',
    folders: 'Папками',
    space: (title, links) => `${title} · ${links} ${plural(links, 'ссылка', 'ссылки', 'ссылок')}`,
    untitled: 'Без названия',
    spacesTitle: 'Пространства',
    intoNew: 'Новое пространство',
    into: (name) => `В „${name}“`,
    intoLabel: (name) => `Куда „${name}“`,
    import: 'Импортировать',
    done: ({ links, folders, failed }) => [
      `Импортировано: ${links} ${plural(links, 'ссылка', 'ссылки', 'ссылок')}`,
      folders ? `${folders} ${plural(folders, 'папка', 'папки', 'папок')}` : '',
      failed ? `пропущено: ${failed}` : '',
    ].filter(Boolean).join(', '),
  },

  arcSort: {
    hint: `В новой вкладке открылся импорт Helium. Выберите «Arc» с вашим именем (не __ARC_SYSTEM_PROFILE) и нажмите «Импорт». Потом ${app} предложит разложить ссылки.`,
    ok: 'Понятно',
    byFile: 'Выбрать файл Arc вручную…',
    previous: 'Разложить прошлый импорт',
    title: `Разложить по ${app}`,
    intro: 'Это пришло из Arc. Выберите, куда положить каждое пространство: ссылки переносятся, а не копируются.',
    spaceName: (n) => `Пространство ${n}`,
    nameLabel: (n) => `Название пространства ${n}`,
    modeLabel: (n) => `Куда пространство ${n}`,
    preview: (titles, links) => `${titles.join(', ')}${links > titles.length ? '…' : ''} · ${links} ${plural(links, 'ссылка', 'ссылки', 'ссылок')}`,
    noLinks: 'Нет закреплённых ссылок',
    top: 'Наверху',
    folder: 'Папкой',
    space: 'Пространством',
    skip: 'Пропустить',
    skipped: 'Пропущенные останутся в папке «Импортировано из Arc» на панели закладок.',
    sort: 'Разложить',
    later: 'Не сейчас',
    done: ({ links, folders }) => [
      `Разложено: ${links} ${plural(links, 'ссылка', 'ссылки', 'ссылок')}`,
      folders ? `${folders} ${plural(folders, 'папка', 'папки', 'папок')}` : '',
    ].filter(Boolean).join(', '),
  },
});

// "1 link", "2 links".
const count = (n, one, many) => `${n} ${n === 1 ? one : many}`;

// 1 ссылка, 2 ссылки, 5 ссылок; 11–14 — always the third form.
function plural(n, one, few, many) {
  const tens = n % 100;
  const units = n % 10;
  if (tens >= 11 && tens <= 14) return many;
  if (units === 1) return one;
  if (units >= 2 && units <= 4) return few;
  return many;
}

// Each language's dictionary for the extension's name: STRINGS.ru('Tabbs').
export const STRINGS = { en, ru };

// "ru", "ru-RU", "ru_RU" → Russian; anything else (or nothing) → English.
export function pickLanguage(uiLanguage) {
  return /^ru(?:[-_]|$)/i.test(uiLanguage ?? '') ? 'ru' : 'en';
}

// The texts in the browser's language, with `app` — the extension's name — in them.
export const strings = (uiLanguage, app) => STRINGS[pickLanguage(uiLanguage)](app);

// A favorites folder may be named in any of the languages: a Russian "Избранное" stays
// tiles when the browser is switched to English.
export const FAVORITES_TITLES = Object.values(FAVORITES_FOLDERS);
