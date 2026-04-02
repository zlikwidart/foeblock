const API = globalThis.browser || globalThis.chrome;
console.debug('[STLtoday foe filter] content.js version 3 loaded');

const STORAGE_KEY = 'manualFoeUsernames';
const DEFAULT_ZEBRA_PATHS = [
  '/forums/ucp.php?i=zebra&mode=foes',
  '/forums/ucp.php?i=ucp_zebra&mode=foes'
];

function normalizeName(name) {
  return (name || '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

function parseManualList(raw) {
  if (!raw) return [];
  return String(raw)
    .split(/[\n,]/)
    .map((s) => s.trim())
    .filter(Boolean);
}

function storageGet(defaults) {
  try {
    const out = API.storage.sync.get(defaults);
    if (out && typeof out.then === 'function') {
      return out;
    }
  } catch (e) {}

  return new Promise((resolve) => {
    API.storage.sync.get(defaults, (result) => resolve(result || defaults));
  });
}

async function getStoredManualFoes() {
  const result = (await storageGet({ [STORAGE_KEY]: '' })) || {};
  return new Set(parseManualList(result[STORAGE_KEY] || '').map(normalizeName));
}

async function fetchDocument(url) {
  const response = await fetch(url, { credentials: 'include' });
  if (!response.ok) throw new Error(`HTTP ${response.status} for ${url}`);
  const text = await response.text();
  return new DOMParser().parseFromString(text, 'text/html');
}

function extractFoesFromDoc(doc) {
  const names = new Set();

  const selectors = [
    '.memberlist a.username',
    '.memberlist a.username-coloured',
    '#foes a.username',
    '#foes a.username-coloured',
    'select[name="foes[]"] option'
  ];

  for (const selector of selectors) {
    for (const el of doc.querySelectorAll(selector)) {
      const text = normalizeName(el.textContent);
      if (text) names.add(text);
    }
  }

  return names;
}

async function loadFoes() {
  const combined = await getStoredManualFoes();

  for (const path of DEFAULT_ZEBRA_PATHS) {
    try {
      const doc = await fetchDocument(new URL(path, location.origin).href);
      const autoFoes = extractFoesFromDoc(doc);
      if (autoFoes.size) {
        for (const name of autoFoes) combined.add(name);
        break;
      }
    } catch (error) {
      console.debug('[STLtoday foe filter] Could not load foe list from', path, error);
    }
  }

  return combined;
}

function getTopicRows() {
  return [...document.querySelectorAll('ul.topiclist.topics > li.row')].filter(
    (row) => !row.classList.contains('header')
  );
}

function extractStarterName(row) {
  const listInner = row.querySelector('.list-inner');
  if (!listInner) return '';

  const profileLinks = [
    ...listInner.querySelectorAll('a[href*="memberlist.php"], a[href*="mode=viewprofile"]')
  ];

  for (const link of profileLinks) {
    const text = normalizeName(link.textContent);
    if (text) return text;
  }

  const compact = listInner.textContent.replace(/\s+/g, ' ').trim();

  let match = compact.match(/\bby\s+(.+?)\s+»\s+/i);
  if (match && match[1]) return normalizeName(match[1]);

  match = compact.match(/\bby\s+(.+?)\s+(?:Replies|Views|Last\s+post)\b/i);
  if (match && match[1]) return normalizeName(match[1]);

  return '';
}

function hideFoeThreads(foes) {
  let hidden = 0;

  for (const row of getTopicRows()) {
    const starter = extractStarterName(row);
    const title = row.querySelector('.topictitle')?.textContent?.trim() || '(no title)';

    console.debug('[STLtoday foe filter] row:', { title, starter });

    if (!starter) continue;

    if (foes.has(starter)) {
      row.style.display = 'none';
      row.dataset.foeThreadHidden = 'true';
      hidden += 1;
    }
  }

  return hidden;
}

async function applyFilter() {
  const foes = await loadFoes();
  const hidden = hideFoeThreads(foes);
  console.debug('[STLtoday foe filter] loaded foes:', [...foes], 'hidden:', hidden);
}

let applyTimer;
const observer = new MutationObserver(() => {
  clearTimeout(applyTimer);
  applyTimer = setTimeout(() => {
    applyFilter().catch((error) => console.error('[STLtoday foe filter] failed', error));
  }, 100);
});

applyFilter().catch((error) => console.error('[STLtoday foe filter] failed', error));
observer.observe(document.documentElement, { childList: true, subtree: true });