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

function getStoredManualFoes() {
  return new Promise((resolve) => {
    chrome.storage.sync.get({ [STORAGE_KEY]: '' }, (result) => {
      resolve(new Set(parseManualList(result[STORAGE_KEY]).map(normalizeName)));
    });
  });
}

async function fetchDocument(url) {
  const response = await fetch(url, { credentials: 'include' });
  if (!response.ok) {
    throw new Error(`HTTP ${response.status} for ${url}`);
  }
  const text = await response.text();
  return new DOMParser().parseFromString(text, 'text/html');
}

function extractFoesFromDoc(doc) {
  const names = new Set();

  // Common phpBB patterns on the foes page.
  const selectors = [
    '.memberlist a.username',
    '.memberlist a.username-coloured',
    '#foes a.username',
    '#foes a.username-coloured',
    'select[name="foes[]"] option',
    '.panel a.username',
    '.panel a.username-coloured'
  ];

  for (const selector of selectors) {
    doc.querySelectorAll(selector).forEach((el) => {
      const text = normalizeName(el.textContent);
      if (text) names.add(text);
    });
  }

  // Fallback: look for links to member profiles inside a panel mentioning foes.
  if (!names.size) {
    const foePanels = [...doc.querySelectorAll('.panel, fieldset, .inner')].filter((el) =>
      /foe/i.test(el.textContent || '')
    );
    foePanels.forEach((panel) => {
      panel.querySelectorAll('a[href*="memberlist.php"], a[href*="mode=viewprofile"]').forEach((a) => {
        const text = normalizeName(a.textContent);
        if (text) names.add(text);
      });
    });
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
        autoFoes.forEach((name) => combined.add(name));
        break;
      }
    } catch (error) {
      // Try the next known phpBB foe URL.
      console.debug('Could not load foe list from', path, error);
    }
  }

  return combined;
}

function getTopicRows() {
  const selectors = [
    'ul.topiclist.topics > li.row',
    '.forumbg ul.topiclist.topics > li',
    '.topiclist.topics li.row',
    '.topiclist.topics li',
    'li.row',
    'tr'
  ];

  for (const selector of selectors) {
    const rows = [...document.querySelectorAll(selector)].filter((el) => {
      const txt = el.textContent || '';
      return /\bby\b/i.test(txt) && /Replies|Views|Last post/i.test(txt) === false;
    });
    if (rows.length) return rows;
  }

  return [];
}

function extractStarterName(row) {
  const preferredSelectors = [
    '.topic-poster',
    '.responsive-hide.left-box a.username',
    '.responsive-hide.left-box a.username-coloured',
    '.list-inner dd a.username',
    '.list-inner dd a.username-coloured',
    'a.username',
    'a.username-coloured'
  ];

  for (const selector of preferredSelectors) {
    const el = row.querySelector(selector);
    const text = normalizeName(el?.textContent);
    if (text) return text;
  }

  const raw = row.textContent || '';
  const byMatch = raw.match(/\bby\s+(.+?)\s+»/i);
  if (byMatch?.[1]) return normalizeName(byMatch[1]);

  return '';
}

function hideFoeThreads(foes) {
  if (!foes.size) return 0;
  let hidden = 0;

  for (const row of getTopicRows()) {
    const starter = extractStarterName(row);
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
  hideFoeThreads(foes);
}

const observer = new MutationObserver(() => {
  applyFilter().catch((error) => console.error('STLtoday Foe Thread Filter failed', error));
});

applyFilter().catch((error) => console.error('STLtoday Foe Thread Filter failed', error));
observer.observe(document.documentElement, { childList: true, subtree: true });
