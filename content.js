(function() {
    // Prevent multiple injections
    if (window.hasInjectedCountdownTimer) return;
    window.hasInjectedCountdownTimer = true;

    const savedDuration = localStorage.getItem('ext_timer_duration');
    const INITIAL_TIME = savedDuration !== null ? parseInt(savedDuration, 10) : 211;
    let savedTime = localStorage.getItem('ext_time_left');
    let timeLeft = savedTime !== null ? parseInt(savedTime, 10) : INITIAL_TIME;
    let timerInterval = null;
    let isPaused = localStorage.getItem('ext_is_paused') === 'true';
    let currentId = localStorage.getItem('ext_current_id') || null;
    let taskCount = parseInt(localStorage.getItem('ext_task_count') || '0', 10);
    let timeBank = parseInt(localStorage.getItem('ext_time_bank') || '0', 10);
    let totalWorkSeconds = parseInt(localStorage.getItem('ext_total_work_seconds') || '0', 10);
    let timeSpentThisTask = 0;
    let timerDuration = INITIAL_TIME;
    let dailyResetHour = parseInt(localStorage.getItem('ext_daily_reset_hour') || '0', 10);
    let lastResetDate = localStorage.getItem('ext_last_reset_date') || null;
    
    // Widget visibility preferences (default to true)
    let showTotal = true;
    let showTasks = true;
    let showBank = true;
    let hideLabels = false;
    let colorblindMode = false;

    // Create Timer Element
    const timerEl = document.createElement('div');
    timerEl.id = 'custom-countdown-timer';
    if (isPaused) timerEl.classList.add('paused');
    document.body.appendChild(timerEl);

    // Load saved position
    const savedX = localStorage.getItem('ext_timer_x');
    const savedY = localStorage.getItem('ext_timer_y');
    if (savedX !== null && savedY !== null) {
        timerEl.style.left = savedX + 'px';
        timerEl.style.top = savedY + 'px';
        timerEl.style.right = 'auto';
        timerEl.style.bottom = 'auto';
    }

    function formatTotalTime(seconds) {
        let h = Math.floor(seconds / 3600);
        let m = Math.floor((seconds % 3600) / 60);
        if (h > 0) return `${h}h ${m}m`;
        return `${m}m`;
    }

    // Update display
    function updateDisplay() {
        const totalColor = colorblindMode ? '#FFB74D' : '#FFB74D';
        const tasksColor = colorblindMode ? '#4FC3F7' : '#81C784';
        const bankColor = colorblindMode ? '#CE93D8' : '#64B5F6';
        let timerColor = colorblindMode ? '#FFFFFF' : '#d4d4d8';
        if (timeLeft <= 0) {
            timerColor = colorblindMode ? '#FF5252' : '#e05555';
        } else if (timeLeft <= 10) {
            timerColor = colorblindMode ? '#FFF176' : '#e8a87c';
        }

        let html = '';
        
        if (showTotal) {
            html += `
              <div class="timer-section">
                <div class="timer-label${hideLabels ? ' hidden' : ''}">Total</div>
                <div class="timer-value" style="color: ${totalColor};">${formatTotalTime(totalWorkSeconds)}</div>
              </div>
            `;
        }

        if (showTasks) {
            html += `
              <div class="timer-section">
                <div class="timer-label${hideLabels ? ' hidden' : ''}">Tasks</div>
                <div class="timer-value" style="color: ${tasksColor};">${taskCount}</div>
              </div>
            `;
        }

        if (showBank) {
            html += `
              <div class="timer-section">
                <div class="timer-label${hideLabels ? ' hidden' : ''}">Bank</div>
                <div class="timer-value" style="color: ${bankColor};">${timeBank}s</div>
              </div>
            `;
        }

        html += `
          <div class="timer-section">
            <div class="timer-label${hideLabels ? ' hidden' : ''}">${isPaused ? 'PAUSED' : 'TIMER'}</div>
            <div class="timer-value" style="color: ${timerColor};">${timeLeft}</div>
          </div>
        `;

        timerEl.innerHTML = html;
    }

    // Timer logic
    function startTimer() {
        if (timerInterval) clearInterval(timerInterval);
        timerInterval = setInterval(() => {
            checkDailyReset();

            const idElement = document.querySelector('div._8m9f');
            const isInTask = idElement && idElement.innerText.trim() !== '';

            if (!isInTask) {
                timerEl.classList.add('paused');
                return;
            } else {
                if (isPaused) {
                    timerEl.classList.add('paused');
                } else {
                    timerEl.classList.remove('paused');
                }
            }

            if (!isPaused) {
                timeSpentThisTask++;

                if (timeLeft > 0) {
                    timeLeft--;
                    localStorage.setItem('ext_time_left', timeLeft);
                } else {
                    if (timeBank > 0) {
                        timeBank--;
                        localStorage.setItem('ext_time_bank', timeBank);
                    } else {
                        timeLeft--;
                        localStorage.setItem('ext_time_left', timeLeft);
                    }
                }

                updateDisplay();
            }
        }, 1000);
    }

    function resetTimer() {
        timeLeft = timerDuration;
        isPaused = false;
        timeSpentThisTask = 0;
        localStorage.setItem('ext_time_left', timeLeft);
        localStorage.setItem('ext_is_paused', 'false');
        timerEl.classList.remove('paused');
        updateDisplay();
        startTimer();
    }

    function checkDailyReset() {
        const now = new Date();
        const today = now.toDateString();
        const currentHour = now.getHours();

        if (lastResetDate !== today && currentHour >= dailyResetHour) {
            taskCount = 0;
            totalWorkSeconds = 0;
            timeBank = 0;
            timeSpentThisTask = 0;
            localStorage.setItem('ext_task_count', '0');
            localStorage.setItem('ext_total_work_seconds', '0');
            localStorage.setItem('ext_time_bank', '0');
            lastResetDate = today;
            localStorage.setItem('ext_last_reset_date', lastResetDate);
            resetTimer();
        }
    }

    function togglePause() {
        isPaused = !isPaused;
        localStorage.setItem('ext_is_paused', isPaused);
        if (isPaused) {
            timerEl.classList.add('paused');
        } else {
            timerEl.classList.remove('paused');
            updateDisplay();
        }
    }

    // Dragging Logic
    let isDragging = false;
    let hasDragged = false;
    let startX, startY;
    let offsetX, offsetY;

    timerEl.addEventListener('mousedown', (e) => {
        isDragging = true;
        hasDragged = false;
        startX = e.clientX;
        startY = e.clientY;
        const rect = timerEl.getBoundingClientRect();
        offsetX = e.clientX - rect.left;
        offsetY = e.clientY - rect.top;
        
        // Prevent text selection while dragging
        document.body.style.userSelect = 'none';
        timerEl.style.transition = 'none'; // Disable transition while dragging for smoothness
    });

    document.addEventListener('mousemove', (e) => {
        if (!isDragging) return;
        
        // Threshold to differentiate click vs drag
        if (Math.abs(e.clientX - startX) > 3 || Math.abs(e.clientY - startY) > 3) {
            hasDragged = true;
        }

        if (hasDragged) {
            // Calculate new position
            let newX = e.clientX - offsetX;
            let newY = e.clientY - offsetY;
            
            // Keep within bounds
            newX = Math.max(0, Math.min(window.innerWidth - timerEl.offsetWidth, newX));
            newY = Math.max(0, Math.min(window.innerHeight - timerEl.offsetHeight, newY));

            timerEl.style.left = newX + 'px';
            timerEl.style.top = newY + 'px';
            timerEl.style.right = 'auto'; // Disable initial right positioning
            timerEl.style.bottom = 'auto';
        }
    });

    document.addEventListener('mouseup', () => {
        if (isDragging) {
            isDragging = false;
            document.body.style.userSelect = '';
            timerEl.style.transition = 'background-color 0.2s ease, transform 0.1s'; // Restore transition
            
            if (hasDragged) {
                localStorage.setItem('ext_timer_x', timerEl.style.left.replace('px', ''));
                localStorage.setItem('ext_timer_y', timerEl.style.top.replace('px', ''));
            }
        }
    });

    // Click to pause/resume (left click)
    timerEl.addEventListener('click', (e) => {
        e.stopPropagation();
        if (hasDragged) return; // Ignore if it was a drag
        togglePause();
    });





    // Watch for ID changes
    function checkIdChange() {
        const idElement = document.querySelector('div._8m9f');
        if (idElement) {
            const newId = idElement.innerText.trim();
            if (newId && newId !== currentId) {
                currentId = newId;
                localStorage.setItem('ext_current_id', currentId);
                resetTimer();
            }
        }
    }

    setInterval(checkIdChange, 1000); // Check every second

    // Reset timer when navigating to homepage (URL without 'queue')
    function checkQueueReset() {
        if (!window.location.href.includes('queue')) {
            resetTimer();
        }
    }

    const originalPushState = history.pushState;
    const originalReplaceState = history.replaceState;

    history.pushState = function() {
        originalPushState.apply(this, arguments);
        checkQueueReset();
    };

    history.replaceState = function() {
        originalReplaceState.apply(this, arguments);
        checkQueueReset();
    };

    window.addEventListener('popstate', checkQueueReset);

    // Task completion: click on Continue button
    document.addEventListener('click', function(clickEvent) {
        const continueElement = clickEvent.target.closest('div.x6ikm8r.x10wlt62.x2b8uid.xlyipyv.xuxw1ft');
        if (!continueElement) return;
        if (continueElement.innerText.trim() !== 'Submit') return;

        const idElement = document.querySelector('div._8m9f');
        if (!idElement) return;

        const detectedId = idElement.innerText.trim();
        if (!detectedId) return;

        if (!currentId) {
            currentId = detectedId;
            localStorage.setItem('ext_current_id', currentId);
        }

        timeBank += timeLeft;
        localStorage.setItem('ext_time_bank', timeBank);

        taskCount++;
        localStorage.setItem('ext_task_count', taskCount);

        totalWorkSeconds += timeSpentThisTask;
        localStorage.setItem('ext_total_work_seconds', totalWorkSeconds);
        timeSpentThisTask = 0;

        updateDisplay();
    }, true); // capture phase to run before page navigation

    // Get the initial ID if it exists right away
    const initialIdElement = document.querySelector('div._8m9f');
    if (initialIdElement) {
        const detectedId = initialIdElement.innerText.trim();
        if (detectedId && detectedId !== currentId) {
            currentId = detectedId;
            localStorage.setItem('ext_current_id', currentId);
            resetTimer();
        } else if (detectedId === currentId) {
            currentId = detectedId;
            localStorage.setItem('ext_current_id', currentId);
        }
    }
    
    // Listen for popup actions
    if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.onMessage) {
        chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
            if (request.action === 'reset_time_bank') {
                timeBank = 0;
                localStorage.setItem('ext_time_bank', '0');
                updateDisplay();
            } else if (request.action === 'reset_all') {
                taskCount = 0;
                totalWorkSeconds = 0;
                timeSpentThisTask = 0;
                timeBank = 0;
                timeLeft = timerDuration;
                isPaused = false;
                localStorage.setItem('ext_task_count', '0');
                localStorage.setItem('ext_total_work_seconds', '0');
                localStorage.setItem('ext_time_bank', '0');
                localStorage.setItem('ext_time_left', timerDuration);
                localStorage.setItem('ext_is_paused', 'false');
                timerEl.classList.remove('paused');
                updateDisplay();
                startTimer();
            } else if (request.action === 'reset_timer') {
                resetTimer();
            } else if (request.action === 'add_tasks') {
                const count = request.count || 1;
                taskCount += count;
                totalWorkSeconds += timerDuration * count;
                localStorage.setItem('ext_task_count', taskCount);
                localStorage.setItem('ext_total_work_seconds', totalWorkSeconds);
                updateDisplay();
            } else if (request.action === 'get_stats') {
                sendResponse({ taskCount, totalWorkSeconds });
            }
        });
    }

    function setTimerDuration(duration) {
        timerDuration = parseInt(duration, 10) || 211;
        localStorage.setItem('ext_timer_duration', timerDuration);
        resetTimer();
    }
    
    // Manage overlay scale dynamically
    function setTimerScale(scalePercent) {
        timerEl.style.setProperty('--overlay-scale', scalePercent / 100);
    }

    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.sync) {
        chrome.storage.sync.get([
            'overlaySize', 'timerDuration', 'dailyResetHour',
            'showTotal', 'showTasks', 'showBank', 'hideLabels', 'colorblindMode'
        ], (data) => {
            if (data.overlaySize !== undefined) {
                setTimerScale(data.overlaySize);
            }
            if (data.timerDuration !== undefined) {
                timerDuration = parseInt(data.timerDuration, 10) || 211;
            }
            if (data.dailyResetHour !== undefined) {
                dailyResetHour = data.dailyResetHour;
                localStorage.setItem('ext_daily_reset_hour', dailyResetHour);
            }
            if (data.showTotal !== undefined) showTotal = data.showTotal;
            if (data.showTasks !== undefined) showTasks = data.showTasks;
            if (data.showBank !== undefined) showBank = data.showBank;
            if (data.hideLabels !== undefined) hideLabels = data.hideLabels;
            if (data.colorblindMode !== undefined) colorblindMode = data.colorblindMode;
            updateDisplay();
        });

        chrome.storage.onChanged.addListener((changes, namespace) => {
            if (namespace === 'sync') {
                if (changes.overlaySize) {
                    setTimerScale(changes.overlaySize.newValue);
                }
                if (changes.timerDuration) {
                    setTimerDuration(changes.timerDuration.newValue);
                }
                if (changes.dailyResetHour) {
                    dailyResetHour = changes.dailyResetHour.newValue;
                    localStorage.setItem('ext_daily_reset_hour', dailyResetHour);
                }
                let needsUpdate = false;
                if (changes.showTotal) { showTotal = changes.showTotal.newValue; needsUpdate = true; }
                if (changes.showTasks) { showTasks = changes.showTasks.newValue; needsUpdate = true; }
                if (changes.showBank) { showBank = changes.showBank.newValue; needsUpdate = true; }
                if (changes.hideLabels) { hideLabels = changes.hideLabels.newValue; needsUpdate = true; }
                if (changes.colorblindMode) { colorblindMode = changes.colorblindMode.newValue; needsUpdate = true; }
                if (needsUpdate) updateDisplay();
            }
        });
    }

    // Init
    if (!window.location.href.includes('queue')) {
        resetTimer();
    }
    updateDisplay();
    startTimer();
})();
