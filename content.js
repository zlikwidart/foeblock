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
  const response = await fetch(url, {
    credentials: 'include',
    redirect: 'follow'
  });

  const text = await response.text();
  const doc = new DOMParser().parseFromString(text, 'text/html');

  console.debug('[STLtoday foe filter] fetched:', {
    requestedUrl: url,
    finalUrl: response.url,
    status: response.status,
    title: doc.title
  });

  return { response, doc, text };
}

function decodeHtmlEntities(str) {
  const textarea = document.createElement('textarea');
  textarea.innerHTML = str;
  return textarea.value;
}

function extractFoesFromDoc(doc, rawHtml = '') {
  const names = new Set();

  // DOM-based parse first
  for (const opt of doc.querySelectorAll('select option')) {
    const text = normalizeName(opt.textContent);
    if (text) names.add(text);
  }

  // Raw HTML fallback if DOM parse found nothing
  if (!names.size && rawHtml) {
    const selectBlocks = [
      ...rawHtml.matchAll(/<select[\s\S]*?>([\s\S]*?)<\/select>/gi)
    ];

    for (const block of selectBlocks) {
      const inner = block[1] || '';
      for (const opt of inner.matchAll(/<option[^>]*>([\s\S]*?)<\/option>/gi)) {
        const text = normalizeName(
          decodeHtmlEntities(
            String(opt[1] || '').replace(/<[^>]+>/g, '')
          )
        );
        if (text) names.add(text);
      }
    }
  }

  console.debug('[STLtoday foe filter] auto foes found:', [...names]);
  return names;
}

async function loadFoes() {
  const combined = await getStoredManualFoes();

  for (const path of DEFAULT_ZEBRA_PATHS) {
    try {
      const { response, doc, text } = await fetchDocument(new URL(path, location.origin).href);

      // Logged out / redirected / access failure detection
      const finalUrl = response.url || '';
      const pageText = normalizeName(text);

      if (
        finalUrl.includes('login') ||
        pageText.includes('you need to login') ||
        pageText.includes('you need to log in') ||
        pageText.includes('login to') ||
        pageText.includes('sign in')
      ) {
        console.debug('[STLtoday foe filter] foe page appears to require login:', finalUrl);
        continue;
      }

      const autoFoes = extractFoesFromDoc(doc, text);
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

  // Work from a clone so we can strip mobile/extra UI that may contain last-post info
  const clone = listInner.cloneNode(true);

  // Remove title, pagination, icons, and responsive/mobile blocks that can contain last-post text
  clone.querySelectorAll(
    '.topictitle, .pagination, .responsive-show, .topic-status, .icon, .rh_tag'
  ).forEach((el) => el.remove());

  // Prefer the first username that appears in the remaining author/date line
  const authorLink = clone.querySelector('a.username, a.username-coloured, a[href*="memberlist.php"], a[href*="mode=viewprofile"]');
  if (authorLink) {
    return normalizeName(authorLink.textContent);
  }

  // Fallback: parse "by NAME » DATE" from the stripped text
  const compact = clone.textContent.replace(/\s+/g, ' ').trim();
  const match = compact.match(/\bby\s+(.+?)\s+»\s+/i);
  if (match && match[1]) {
    return normalizeName(match[1]);
  }

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