const API = globalThis.browser || globalThis.chrome;
const STORAGE_KEY = 'manualFoeUsernames';

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

function storageSet(values) {
  try {
    const out = API.storage.sync.set(values);
    if (out && typeof out.then === 'function') {
      return out;
    }
  } catch (_) {}

  return new Promise((resolve) => {
    API.storage.sync.set(values, resolve);
  });
}

async function restoreOptions() {
  const result = await storageGet({ [STORAGE_KEY]: '' });
  document.getElementById('manualFoes').value = result[STORAGE_KEY] || '';
}

async function saveOptions() {
  const textarea = document.getElementById('manualFoes');
  const status = document.getElementById('status');

  await storageSet({ [STORAGE_KEY]: textarea.value });
  status.textContent = 'Saved.';
  setTimeout(() => {
    status.textContent = '';
  }, 1500);
}

document.addEventListener('DOMContentLoaded', restoreOptions);
document.getElementById('saveButton').addEventListener('click', () => {
  saveOptions().catch((error) => {
    console.error('[STLtoday foe filter] options save failed', error);
    document.getElementById('status').textContent = 'Save failed.';
  });
});
