document.addEventListener('DOMContentLoaded', () => {
  function formatTotalTime(seconds) {
    let h = Math.floor(seconds / 3600);
    let m = Math.floor((seconds % 3600) / 60);
    let s = seconds % 60;
    if (h > 0) return `${h}h ${m}m ${s}s`;
    if (m > 0) return `${m}m ${s}s`;
    return `${s}s`;
  }

  const CACHE_KEY = 'cachedStats';

  function updateDisplayedStats(taskCount, totalWorkSeconds) {
    document.getElementById('statTasks').textContent = taskCount;
    document.getElementById('statTotal').textContent = formatTotalTime(totalWorkSeconds);
  }

  function cacheStats(taskCount, totalWorkSeconds) {
    chrome.storage.local.set({ [CACHE_KEY]: { taskCount, totalWorkSeconds } });
  }

  // Load cached stats immediately so values survive tab switches and popup reopens
  chrome.storage.local.get([CACHE_KEY], (data) => {
    const cached = data[CACHE_KEY];
    if (cached) {
      updateDisplayedStats(cached.taskCount, cached.totalWorkSeconds);
    }
  });

  // Fetch stats from page (poll every 1s while popup is open)
  function fetchStats() {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0]) {
        chrome.tabs.sendMessage(tabs[0].id, { action: 'get_stats' }, (response) => {
          if (chrome.runtime.lastError) return;
          if (response) {
            updateDisplayedStats(response.taskCount, response.totalWorkSeconds);
            cacheStats(response.taskCount, response.totalWorkSeconds);
          }
        });
      }
    });
  }
  fetchStats();
  setInterval(fetchStats, 1000);
  // Tab switching
  document.querySelectorAll('.tab-btn').forEach(button => {
    button.addEventListener('click', () => {
      const tab = button.dataset.tab;
      document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
      document.querySelectorAll('.tab-panel').forEach(panel => panel.classList.remove('active'));
      button.classList.add('active');
      document.getElementById('tab-' + tab).classList.add('active');
    });
  });

  const sizeSlider = document.getElementById('sizeSlider');
  const sizeValue = document.getElementById('sizeValue');
  const timerDurationInput = document.getElementById('timerDuration');
  const dailyResetHourInput = document.getElementById('dailyResetHour');
  const showTotalToggle = document.getElementById('showTotalToggle');
  const showTasksToggle = document.getElementById('showTasksToggle');
  const showBankToggle = document.getElementById('showBankToggle');
  const hideLabelsToggle = document.getElementById('hideLabelsToggle');
  const colorblindToggle = document.getElementById('colorblindToggle');

  // Toggle sections (collapsible)
  document.querySelectorAll('.toggle-section').forEach(header => {
    header.addEventListener('click', () => {
      const section = document.getElementById(header.dataset.target);
      section.classList.toggle('collapsed');
    });
  });

  chrome.storage.sync.get([
    'overlaySize', 'timerDuration', 'dailyResetHour',
    'showTotal', 'showTasks', 'showBank', 'hideLabels', 'colorblindMode'
  ], (data) => {
    const size = data.overlaySize !== undefined ? data.overlaySize : 100;
    const duration = data.timerDuration !== undefined ? data.timerDuration : 211;
    const resetHour = data.dailyResetHour !== undefined ? data.dailyResetHour : 0;

    sizeSlider.value = size;
    sizeValue.textContent = size + '%';
    timerDurationInput.value = duration;
    dailyResetHourInput.value = resetHour;
    
    if (data.showTotal !== undefined) showTotalToggle.checked = data.showTotal;
    if (data.showTasks !== undefined) showTasksToggle.checked = data.showTasks;
    if (data.showBank !== undefined) showBankToggle.checked = data.showBank;
    if (data.hideLabels !== undefined) hideLabelsToggle.checked = data.hideLabels;
    if (data.colorblindMode !== undefined) colorblindToggle.checked = data.colorblindMode;
  });

  // Widget visibility toggles
  showTotalToggle.addEventListener('change', () => {
    chrome.storage.sync.set({ showTotal: showTotalToggle.checked });
  });
  showTasksToggle.addEventListener('change', () => {
    chrome.storage.sync.set({ showTasks: showTasksToggle.checked });
  });
  showBankToggle.addEventListener('change', () => {
    chrome.storage.sync.set({ showBank: showBankToggle.checked });
  });
  hideLabelsToggle.addEventListener('change', () => {
    chrome.storage.sync.set({ hideLabels: hideLabelsToggle.checked });
  });
  colorblindToggle.addEventListener('change', () => {
    chrome.storage.sync.set({ colorblindMode: colorblindToggle.checked });
  });

  sizeSlider.addEventListener('input', () => {
    sizeValue.textContent = sizeSlider.value + '%';
  });
  sizeSlider.addEventListener('change', () => {
    chrome.storage.sync.set({ overlaySize: parseInt(sizeSlider.value, 10) });
  });

  timerDurationInput.addEventListener('change', () => {
    const duration = parseInt(timerDurationInput.value, 10) || 211;
    chrome.storage.sync.set({ timerDuration: duration });
  });

  dailyResetHourInput.addEventListener('change', () => {
    const hour = parseInt(dailyResetHourInput.value, 10) || 0;
    chrome.storage.sync.set({ dailyResetHour: Math.min(23, Math.max(0, hour)) });
  });

  // Default timer
  document.getElementById('defaultTimerBtn').addEventListener('click', () => {
    timerDurationInput.value = 211;
    chrome.storage.sync.set({ timerDuration: 211 });
  });

  // Custom Modal Logic
  const modalOverlay = document.getElementById('confirmModal');
  const confirmMsg = document.getElementById('confirmMsg');
  const confirmYes = document.getElementById('confirmYes');
  const confirmNo = document.getElementById('confirmNo');
  let currentConfirmCallback = null;

  function showConfirm(msg, isDanger, callback) {
    confirmMsg.textContent = msg;
    currentConfirmCallback = callback;
    
    if (isDanger) {
      confirmYes.classList.add('danger');
    } else {
      confirmYes.classList.remove('danger');
    }
    
    modalOverlay.classList.add('show');
  }

  confirmYes.addEventListener('click', () => {
    modalOverlay.classList.remove('show');
    if (currentConfirmCallback) currentConfirmCallback(true);
  });

  confirmNo.addEventListener('click', () => {
    modalOverlay.classList.remove('show');
    if (currentConfirmCallback) currentConfirmCallback(false);
  });

  // How to Use button
  document.getElementById('howToUseBtn').addEventListener('click', () => {
    chrome.tabs.create({ url: chrome.runtime.getURL('tutorial.html') });
  });

  // Add manual tasks
  document.getElementById('addTasksBtn').addEventListener('click', () => {
    const count = parseInt(document.getElementById('manualTaskCount').value, 10) || 1;
    const msg = count < 0 ? `Remove ${Math.abs(count)} task(s)?` : `Add ${count} task(s)?`;
    
    showConfirm(msg, count < 0, (confirmed) => {
      if (!confirmed) return;
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (tabs[0]) {
          chrome.tabs.sendMessage(tabs[0].id, { action: 'add_tasks', count });
        }
      });
    });
  });

  // Reset all button
  document.getElementById('resetAllBtn').addEventListener('click', () => {
    showConfirm('Reset all timer data? This cannot be undone.', true, (firstConfirm) => {
      if (!firstConfirm) return;
      showConfirm('Are you sure? All tasks, time, and bank will be zeroed.', true, (secondConfirm) => {
        if (!secondConfirm) return;
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
          if (tabs[0]) {
            chrome.tabs.sendMessage(tabs[0].id, { action: 'reset_all' });
          }
        });
      });
    });
  });
});
