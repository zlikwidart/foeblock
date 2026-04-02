const API = globalThis.browser || globalThis.chrome;
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
  } catch (_) {}

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

  if (!response.ok) {
    throw new Error(`HTTP ${response.status} for ${url}`);
  }

  const text = await response.text();
  const doc = new DOMParser().parseFromString(text, 'text/html');
  return { response, doc, text };
}

function decodeHtmlEntities(str) {
  const textarea = document.createElement('textarea');
  textarea.innerHTML = str;
  return textarea.value;
}

function extractFoesFromDoc(doc, rawHtml = '') {
  const names = new Set();

  for (const opt of doc.querySelectorAll('select option')) {
    const text = normalizeName(opt.textContent);
    if (text) {
      names.add(text);
    }
  }

  if (!names.size && rawHtml) {
    const selectBlocks = [...rawHtml.matchAll(/<select[\s\S]*?>([\s\S]*?)<\/select>/gi)];

    for (const block of selectBlocks) {
      const inner = block[1] || '';
      for (const opt of inner.matchAll(/<option[^>]*>([\s\S]*?)<\/option>/gi)) {
        const text = normalizeName(
          decodeHtmlEntities(String(opt[1] || '').replace(/<[^>]+>/g, ''))
        );
        if (text) {
          names.add(text);
        }
      }
    }
  }

  return names;
}

async function loadFoes() {
  const combined = await getStoredManualFoes();

  for (const path of DEFAULT_ZEBRA_PATHS) {
    try {
      const { response, doc, text } = await fetchDocument(
        new URL(path, location.origin).href
      );

      const finalUrl = response.url || '';
      const pageText = normalizeName(text);

      if (
        finalUrl.includes('login') ||
        pageText.includes('you need to login') ||
        pageText.includes('you need to log in') ||
        pageText.includes('sign in')
      ) {
        continue;
      }

      const autoFoes = extractFoesFromDoc(doc, text);
      if (autoFoes.size) {
        for (const name of autoFoes) {
          combined.add(name);
        }
        break;
      }
    } catch (_) {
      // Ignore foe page load failures and fall back to the manual list.
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

  const clone = listInner.cloneNode(true);
  clone.querySelectorAll(
    '.topictitle, .pagination, .responsive-show, .topic-status, .icon, .rh_tag'
  ).forEach((el) => el.remove());

  const authorLink = clone.querySelector(
    'a.username, a.username-coloured, a[href*="memberlist.php"], a[href*="mode=viewprofile"]'
  );
  if (authorLink) {
    return normalizeName(authorLink.textContent);
  }

  const compact = clone.textContent.replace(/\s+/g, ' ').trim();
  const match = compact.match(/\bby\s+(.+?)\s+»\s+/i);
  return match && match[1] ? normalizeName(match[1]) : '';
}

function hideFoeThreads(foes) {
  for (const row of getTopicRows()) {
    const starter = extractStarterName(row);
    if (!starter) continue;

    if (foes.has(starter)) {
      row.style.display = 'none';
      row.dataset.foeThreadHidden = 'true';
    }
  }
}

async function applyFilter() {
  const foes = await loadFoes();
  hideFoeThreads(foes);
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
