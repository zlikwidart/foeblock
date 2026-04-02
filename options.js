const STORAGE_KEY = 'manualFoeUsernames';
const textarea = document.getElementById('foes');
const status = document.getElementById('status');
const saveButton = document.getElementById('save');

chrome.storage.sync.get({ [STORAGE_KEY]: '' }, (result) => {
  textarea.value = result[STORAGE_KEY];
});

saveButton.addEventListener('click', () => {
  chrome.storage.sync.set({ [STORAGE_KEY]: textarea.value }, () => {
    status.textContent = 'Saved.';
    setTimeout(() => {
      status.textContent = '';
    }, 1500);
  });
});
