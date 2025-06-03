// Default work hours (8 AM to 9 PM)
let workStartTime = '08:00';
let workEndTime = '21:00';

// Countdown timer variables
let countdownActive = false;
let countdownDurationMinutes = 0;
let countdownStartTimestamp = 0;
let countdownIntervalId = null;

// Subscription status
let isCountdownFeatureEnabled = false;

// Load settings
function loadSettings() {
  chrome.storage.sync.get(['startTime', 'endTime', 'countdownDuration', 'dayProgressBarHidden'], function(result) {
    if (result.startTime) {
      workStartTime = result.startTime;
      document.getElementById("day-progress-start-time").value = result.startTime;
    }
    if (result.endTime) {
      workEndTime = result.endTime;
      document.getElementById("day-progress-end-time").value = result.endTime;
    }
    if (result.countdownDuration) {
      countdownDurationMinutes = result.countdownDuration;
    }
    if (result.dayProgressBarHidden) {
      const progressBarContainer = document.getElementById("day-progress-bar-container");
      if (progressBarContainer) {
        progressBarContainer.style.display = "none";
      }

      // 更新按钮文本，如果按钮已经存在
      const hideBtn = document.getElementById("day-progress-hide-btn");
      if (hideBtn) {
        hideBtn.textContent = "Show";
        // 使用灰色次要按钮样式
        hideBtn.style.backgroundColor = "#f1f3f4";
        hideBtn.style.color = "#5f6368";
        hideBtn.style.flex = "1";
        hideBtn.style.height = "100%";
        hideBtn.style.lineHeight = "36px";
        hideBtn.style.margin = "0";
        hideBtn.style.padding = "0";
      }
    }
    updateProgressBar(); // Update after loading settings
  });

  // Check subscription status for countdown feature
  checkCountdownFeatureStatus();
}

// Check if countdown feature is enabled
function checkCountdownFeatureStatus() {
  chrome.runtime.sendMessage(
    { action: 'checkFeature', feature: 'countdown' },
    function(response) {
      if (response) {
        isCountdownFeatureEnabled = response.enabled;
        updateCountdownButtonVisibility();
      }
    }
  );
}

// Update countdown button visibility based on subscription status
function updateCountdownButtonVisibility() {
  const countdownBtn = document.getElementById("day-progress-countdown-btn");
  if (countdownBtn) {
    // Always show the countdown button regardless of subscription status
    countdownBtn.style.display = "block";
  }
}

// Show subscription upgrade prompt
function showSubscriptionPrompt() {
  const container = document.createElement("div");
  container.id = "day-progress-subscription-prompt";
  container.style.position = "fixed";
  container.style.bottom = "50px";
  container.style.left = "50%";
  container.style.transform = "translateX(-50%)";
  container.style.backgroundColor = "rgba(255, 255, 255, 0.98)";
  container.style.boxShadow = "0 4px 16px rgba(0, 0, 0, 0.2)";
  container.style.borderRadius = "8px";
  container.style.padding = "20px";
  container.style.maxWidth = "350px";
  container.style.zIndex = "2147483647";
  container.style.fontFamily = "'Google Sans', Roboto, Arial, sans-serif";
  container.style.border = "1px solid rgba(0, 0, 0, 0.1)";

  const title = document.createElement("h3");
  title.textContent = "Premium Feature";
  title.style.margin = "0 0 8px 0";
  title.style.color = "#1a73e8";
  title.style.fontSize = "18px";
  container.appendChild(title);

  const message = document.createElement("p");
  message.textContent = "Unlock the countdown timer and boost your productivity. Try it free for 30 days, then $1.99/month.";
  message.style.margin = "0 0 16px 0";
  message.style.fontSize = "14px";
  message.style.lineHeight = "1.5";
  message.style.color = "#202124";
  container.appendChild(message);

  const buttonGroup = document.createElement("div");
  buttonGroup.style.display = "flex";
  buttonGroup.style.gap = "8px";

  const closeButton = document.createElement("button");
  closeButton.textContent = "Not Now";
  closeButton.style.padding = "10px 16px";
  closeButton.style.backgroundColor = "#f1f3f4";
  closeButton.style.border = "none";
  closeButton.style.borderRadius = "4px";
  closeButton.style.cursor = "pointer";
  closeButton.style.flexGrow = "1";
  closeButton.style.fontSize = "14px";
  closeButton.addEventListener("click", () => {
    container.remove();
  });
  buttonGroup.appendChild(closeButton);

  const trialButton = document.createElement("button");
  trialButton.textContent = "Start Free Trial";
  trialButton.style.padding = "10px 16px";
  trialButton.style.backgroundColor = "#1a73e8";
  trialButton.style.color = "#fff";
  trialButton.style.border = "none";
  trialButton.style.borderRadius = "4px";
  trialButton.style.cursor = "pointer";
  trialButton.style.flexGrow = "1";
  trialButton.style.fontSize = "14px";
  trialButton.style.fontWeight = "500";
  trialButton.addEventListener("click", () => {
    chrome.runtime.sendMessage({ action: 'openSubscription' });
    container.remove();
  });
  buttonGroup.appendChild(trialButton);

  container.appendChild(buttonGroup);
  document.body.appendChild(container);
}

function createTimeInputGroup(labelText, inputId, value) {
  const container = document.createElement('div');
  container.className = 'time-input-group';
  container.style.marginBottom = '12px';

  const label = document.createElement('label');
  label.textContent = labelText;
  label.setAttribute('for', inputId);
  label.style.display = 'block';
  label.style.marginBottom = '6px';
  label.style.fontSize = '12px';
  label.style.color = '#5f6368';
  label.style.fontWeight = '500';

  const inputWrapper = document.createElement('div');
  inputWrapper.style.position = 'relative';
  inputWrapper.style.display = 'flex';
  inputWrapper.style.alignItems = 'center';

  const input = document.createElement('input');
  input.type = 'time';
  input.id = inputId;
  input.value = value;
  input.style.width = '100%';
  input.style.padding = '6px 10px';
  input.style.borderRadius = '4px';
  input.style.border = '1px solid rgba(0, 0, 0, 0.15)';
  input.style.fontSize = '13px';
  input.style.fontFamily = '\'Google Sans\', Roboto, Arial, sans-serif';
  input.style.outline = 'none';
  input.style.boxSizing = 'border-box';

  // Add keypress event listener for Enter key
  if (inputId === "day-progress-end-time") {
    input.addEventListener('keypress', function(event) {
      if (event.key === 'Enter') {
        event.preventDefault();
        saveSettings();
      }
    });
  }

  inputWrapper.appendChild(input);

  container.appendChild(label);
  container.appendChild(inputWrapper);

  return {container, input};
}

function createProgressBar() {
  // 检查并移除任何已有的进度条
  const existingContainer = document.getElementById("day-progress-bar-container");
  if (existingContainer) {
    existingContainer.remove();
  }

  // Create container
  const container = document.createElement("div");
  container.id = "day-progress-bar-container";

  // Create progress bar first (as background)
  const bar = document.createElement("div");
  bar.id = "day-progress-bar";
  container.appendChild(bar);

  // Create countdown progress bar (on top of day progress bar)
  const countdownBar = document.createElement("div");
  countdownBar.id = "day-progress-countdown-bar";
  container.appendChild(countdownBar);

  // Create settings button with clock icon
  const settingsBtn = document.createElement("div");
  settingsBtn.id = "day-progress-settings-btn";
  settingsBtn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <circle cx="12" cy="12" r="10"></circle>
    <polyline points="12 6 12 12 16 14"></polyline>
  </svg>`;
  settingsBtn.title = "Work Hours Settings";
  settingsBtn.addEventListener("click", toggleSettingsPanel);
  container.appendChild(settingsBtn);

  // Create countdown timer button
  const countdownBtn = document.createElement("div");
  countdownBtn.id = "day-progress-countdown-btn";
  countdownBtn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <circle cx="12" cy="13" r="8"></circle>
    <path d="M12 9v4l1.5 1.5"></path>
    <path d="M12 1v2"></path>
    <path d="M16.5 7.5l-1.5-1.5"></path>
  </svg>`;
  countdownBtn.title = "Set Countdown Timer";
  countdownBtn.addEventListener("click", handleCountdownClick);
  container.appendChild(countdownBtn);

  // 创建时间范围容器
  const timeRangeContainer = document.createElement("div");
  timeRangeContainer.id = "day-progress-time-range";

  // 创建开始时间显示
  const startTimeDisplay = document.createElement("span");
  startTimeDisplay.id = "day-progress-start-time-display";

  // 创建百分比显示
  const progressPercent = document.createElement("span");
  progressPercent.id = "day-progress-percentage";

  // 创建结束时间显示
  const endTimeDisplay = document.createElement("span");
  endTimeDisplay.id = "day-progress-end-time-display";

  // 添加到时间范围容器
  timeRangeContainer.appendChild(startTimeDisplay);
  timeRangeContainer.appendChild(progressPercent);
  timeRangeContainer.appendChild(endTimeDisplay);

  // 添加到主容器
  container.appendChild(timeRangeContainer);

  // Create time info (right aligned)
  const timeInfo = document.createElement("div");
  timeInfo.id = "day-progress-time-info";
  container.appendChild(timeInfo);

  // Create settings panel (initially hidden)
  const settingsPanel = document.createElement("div");
  settingsPanel.id = "day-progress-settings-panel";
  settingsPanel.style.display = "none";

  // Panel title
  const panelTitle = document.createElement("div");
  panelTitle.textContent = "Work Hours";
  panelTitle.style.fontSize = "16px";
  panelTitle.style.fontWeight = "500";
  panelTitle.style.marginBottom = "14px";
  panelTitle.style.color = "#202124";
  settingsPanel.appendChild(panelTitle);

  // Create time input components
  const startTimeGroup = createTimeInputGroup("Start time", "day-progress-start-time", workStartTime);
  const endTimeGroup = createTimeInputGroup("End time", "day-progress-end-time", workEndTime);

  settingsPanel.appendChild(startTimeGroup.container);
  settingsPanel.appendChild(endTimeGroup.container);

  // Button container for Save and Hide buttons - 完全重构确保对齐
  const buttonContainer = document.createElement("div");
  buttonContainer.style.display = "flex";
  buttonContainer.style.gap = "10px";
  buttonContainer.style.marginTop = "10px";
  buttonContainer.style.alignItems = "stretch"; // 拉伸对齐子元素
  buttonContainer.style.height = "36px"; // 明确容器高度

  // 创建通用按钮样式函数，确保两个按钮完全一致
  function createStyledButton(id, text, clickHandler, isSecondary = false) {
    const button = document.createElement("button");
    button.id = id;
    button.textContent = text;
    button.style.flex = "1";
    button.style.backgroundColor = isSecondary ? "#f1f3f4" : "#4285F4";
    button.style.color = isSecondary ? "#5f6368" : "white";
    button.style.border = "none";
    button.style.borderRadius = "4px";
    button.style.cursor = "pointer";
    button.style.fontWeight = "500";
    button.style.fontSize = "14px";
    button.style.height = "100%"; // 使用容器的100%高度
    button.style.lineHeight = "36px";
    button.style.margin = "0";
    button.style.padding = "0";
    button.style.textAlign = "center";
    button.addEventListener("click", clickHandler);
    return button;
  }

  // Save button - 蓝色主按钮
  const saveBtn = createStyledButton("day-progress-save-btn", "Save", saveSettings, false);
  buttonContainer.appendChild(saveBtn);

  // Hide button - 灰色次要按钮，类似Reset按钮样式
  const hideBtn = createStyledButton("day-progress-hide-btn", "Hide", toggleProgressBarVisibility, true);
  buttonContainer.appendChild(hideBtn);

  settingsPanel.appendChild(buttonContainer);

  container.appendChild(settingsPanel);

  // Create countdown panel (initially hidden)
  const countdownPanel = document.createElement("div");
  countdownPanel.id = "day-progress-countdown-panel";
  countdownPanel.style.position = "absolute";
  countdownPanel.style.bottom = "28px";
  countdownPanel.style.left = "40px";
  countdownPanel.style.background = "white";
  countdownPanel.style.padding = "16px";
  countdownPanel.style.borderRadius = "8px";
  countdownPanel.style.border = "1px solid rgba(0, 0, 0, 0.12)";
  countdownPanel.style.boxShadow = "0 -2px 10px rgba(0, 0, 0, 0.1)";
  countdownPanel.style.zIndex = "1000000";
  countdownPanel.style.display = "none";
  countdownPanel.style.flexDirection = "column";
  countdownPanel.style.width = "210px";
  countdownPanel.style.pointerEvents = "auto";
  countdownPanel.style.fontFamily = "'Google Sans', Roboto, Arial, sans-serif";

  // Panel title
  const countdownTitle = document.createElement("div");
  countdownTitle.textContent = "Countdown Timer";
  countdownTitle.style.fontSize = "16px";
  countdownTitle.style.fontWeight = "500";
  countdownTitle.style.marginBottom = "10px";
  countdownTitle.style.color = "#202124";
  countdownTitle.style.display = "flex";
  countdownTitle.style.alignItems = "center";
  countdownTitle.style.gap = "8px";

  // Add Pro badge
  const proBadge = document.createElement("span");
  proBadge.textContent = "PRO";
  proBadge.style.fontSize = "11px";
  proBadge.style.fontWeight = "bold";
  proBadge.style.color = "#fff";
  proBadge.style.backgroundColor = "#1a73e8"; // Google blue
  proBadge.style.padding = "3px 8px";
  proBadge.style.borderRadius = "10px";
  proBadge.style.cursor = "pointer";
  proBadge.style.boxShadow = "0 1px 3px rgba(0,0,0,0.12)";
  proBadge.style.transition = "all 0.2s ease";
  proBadge.title = "Click to start free trial";

  // Add hover effect
  proBadge.addEventListener("mouseenter", () => {
    proBadge.style.backgroundColor = "#0b57d0"; // Darker blue on hover
    proBadge.style.boxShadow = "0 2px 4px rgba(0,0,0,0.2)";
  });

  proBadge.addEventListener("mouseleave", () => {
    proBadge.style.backgroundColor = "#1a73e8";
    proBadge.style.boxShadow = "0 1px 3px rgba(0,0,0,0.12)";
  });

  proBadge.addEventListener("click", () => {
    chrome.runtime.sendMessage({ action: 'openSubscription' });
    const panel = document.getElementById("day-progress-countdown-panel");
    if (panel) {
      panel.style.display = "none";
      document.removeEventListener('click', closeCountdownPanelOnClickOutside);
    }
  });

  countdownTitle.appendChild(proBadge);
  countdownPanel.appendChild(countdownTitle);

  // Quick duration buttons
  const quickButtonsContainer = document.createElement("div");
  quickButtonsContainer.style.display = "grid";
  quickButtonsContainer.style.gridTemplateColumns = "repeat(3, 1fr)";
  quickButtonsContainer.style.gap = "8px";
  quickButtonsContainer.style.marginBottom = "8px";
  quickButtonsContainer.style.textAlign = "center";

  // Reduced to only 3 preset options as requested
  const durations = [5, 10, 25];
  durations.forEach(duration => {
    const button = document.createElement("button");
    button.textContent = `${duration}m`;
    button.className = "countdown-quick-button";
    button.style.textAlign = "center";
    button.style.padding = "6px 10px";
    button.style.borderRadius = "4px";
    button.style.border = "1px solid rgba(0, 0, 0, 0.15)";
    button.style.fontSize = "13px";
    button.style.backgroundColor = "#f1f3f4";
    button.style.cursor = "pointer";
    button.addEventListener("click", () => startCountdown(duration));
    quickButtonsContainer.appendChild(button);
  });

  countdownPanel.appendChild(quickButtonsContainer);

  // Create a container for all controls (input + buttons)
  const allControlsContainer = document.createElement("div");
  allControlsContainer.style.display = "flex";
  allControlsContainer.style.flexDirection = "column";
  allControlsContainer.style.gap = "8px";

  // Create a grid layout with 2 columns for custom input and start button
  const inputRowContainer = document.createElement("div");
  inputRowContainer.style.display = "grid";
  inputRowContainer.style.gridTemplateColumns = "1fr 1fr";
  inputRowContainer.style.gap = "8px";
  inputRowContainer.style.marginBottom = "8px";

  // Custom duration input with minute indicator
  const inputWrapper = document.createElement("div");
  inputWrapper.style.position = "relative";
  inputWrapper.style.width = "100%";
  inputWrapper.style.display = "flex";
  inputWrapper.style.alignItems = "center";

  const customDurationInput = document.createElement("input");
  customDurationInput.type = "number";
  customDurationInput.id = "countdown-custom-duration";
  customDurationInput.min = "1";
  customDurationInput.max = "180";
  customDurationInput.placeholder = "Minutes";
  customDurationInput.value = "1"; // Default value
  customDurationInput.style.width = "100%";
  customDurationInput.style.padding = "6px 10px";
  customDurationInput.style.borderRadius = "4px";
  customDurationInput.style.border = "1px solid rgba(0, 0, 0, 0.15)";
  customDurationInput.style.fontSize = "13px";
  customDurationInput.style.fontFamily = "'Google Sans', Roboto, Arial, sans-serif";
  customDurationInput.style.boxSizing = "border-box";
  customDurationInput.style.textAlign = "center"; // 将数字居中
  customDurationInput.style.paddingRight = "20px"; // 为后缀留出空间

  // Add minute suffix
  const minuteSuffix = document.createElement("span");
  minuteSuffix.textContent = "m";
  minuteSuffix.style.position = "absolute";
  minuteSuffix.style.right = "10px";
  minuteSuffix.style.top = "50%";
  minuteSuffix.style.transform = "translateY(-50%)";
  minuteSuffix.style.pointerEvents = "none";
  minuteSuffix.style.color = "#5f6368";
  minuteSuffix.style.fontSize = "13px";

  inputWrapper.appendChild(customDurationInput);
  inputWrapper.appendChild(minuteSuffix);

  // Add keypress event listener for Enter key
  customDurationInput.addEventListener('keypress', function(event) {
    if (event.key === 'Enter') {
      const duration = parseInt(customDurationInput.value);
      if (!isNaN(duration) && duration > 0) {
        startCountdown(duration);
      }
    }
  });

  // Start button
  const startButton = document.createElement("button");
  startButton.textContent = "Start";
  startButton.id = "countdown-start-custom";
  startButton.style.padding = "6px 10px";
  startButton.style.backgroundColor = "#4285F4";
  startButton.style.color = "white";
  startButton.style.border = "none";
  startButton.style.borderRadius = "4px";
  startButton.style.cursor = "pointer";
  startButton.style.fontWeight = "500";
  startButton.style.fontSize = "14px";
  startButton.addEventListener("click", () => {
    const duration = parseInt(customDurationInput.value);
    if (!isNaN(duration) && duration > 0) {
      startCountdown(duration);
    }
  });

  // Add input and start button to their container
  inputRowContainer.appendChild(inputWrapper);
  inputRowContainer.appendChild(startButton);
  allControlsContainer.appendChild(inputRowContainer);

  // Control buttons container - Reset and Stop buttons
  const controlButtonsContainer = document.createElement("div");
  controlButtonsContainer.style.display = "grid";
  controlButtonsContainer.style.gridTemplateColumns = "1fr 1fr";
  controlButtonsContainer.style.gap = "8px";

  // Reset button - now on the left
  const resetButton = document.createElement("button");
  resetButton.textContent = "Reset";
  resetButton.id = "countdown-reset";
  resetButton.style.padding = "6px 10px";
  resetButton.style.backgroundColor = "#f1f3f4";
  resetButton.style.color = "#5f6368";
  resetButton.style.border = "none";
  resetButton.style.borderRadius = "4px";
  resetButton.style.cursor = "pointer";
  resetButton.style.fontWeight = "500";
  resetButton.style.fontSize = "14px";
  resetButton.addEventListener("click", resetCountdown);

  // Stop button - now on the right
  const stopButton = document.createElement("button");
  stopButton.textContent = "Stop";
  stopButton.id = "countdown-stop";
  stopButton.style.padding = "6px 10px";
  stopButton.style.backgroundColor = "#ea4335";
  stopButton.style.color = "white";
  stopButton.style.border = "none";
  stopButton.style.borderRadius = "4px";
  stopButton.style.cursor = "pointer";
  stopButton.style.fontWeight = "500";
  stopButton.style.fontSize = "14px";
  stopButton.addEventListener("click", stopCountdown);

  // Add buttons to control container (Reset first, then Stop)
  controlButtonsContainer.appendChild(resetButton);
  controlButtonsContainer.appendChild(stopButton);

  allControlsContainer.appendChild(controlButtonsContainer);
  countdownPanel.appendChild(allControlsContainer);

  container.appendChild(countdownPanel);

  // Ensure the container is added to the document body
  document.body.insertBefore(container, document.body.firstChild);

  // Debug log to check if element is created
  console.log("Progress bar container created:", container);

  // Update countdown button visibility based on subscription status
  updateCountdownButtonVisibility();

  // 检查是否应该隐藏进度条
  chrome.storage.sync.get(['dayProgressBarHidden'], function(result) {
    if (result.dayProgressBarHidden) {
      container.style.display = "none";
    }
  });
}

// Handle countdown button click with subscription check
function handleCountdownClick() {
  // Always show the countdown panel regardless of subscription status
  toggleCountdownPanel();
}

function toggleSettingsPanel() {
  const panel = document.getElementById("day-progress-settings-panel");
  if (panel) {
    if (panel.style.display === "none") {
      panel.style.display = "block";

      // Add click outside listener to close panel when clicking elsewhere
      setTimeout(() => {
        document.addEventListener('click', closeSettingsPanelOnClickOutside);
      }, 10);
    } else {
      panel.style.display = "none";
      // Remove the click outside listener when panel is manually closed
      document.removeEventListener('click', closeSettingsPanelOnClickOutside);
    }
  }
}

// Function to handle click outside the settings panel
function closeSettingsPanelOnClickOutside(event) {
  const panel = document.getElementById("day-progress-settings-panel");
  const settingsBtn = document.getElementById("day-progress-settings-btn");

  // If click is outside the panel and not on the settings button, close the panel
  if (panel && settingsBtn &&
      !panel.contains(event.target) &&
      !settingsBtn.contains(event.target)) {
    panel.style.display = "none";
    document.removeEventListener('click', closeSettingsPanelOnClickOutside);
  }
}

function saveSettings() {
  const startInput = document.getElementById("day-progress-start-time");
  const endInput = document.getElementById("day-progress-end-time");

  if (startInput && endInput) {
    const newStartTime = startInput.value;
    const newEndTime = endInput.value;

    chrome.storage.sync.set({
      startTime: newStartTime,
      endTime: newEndTime
    }, function() {
      workStartTime = newStartTime;
      workEndTime = newEndTime;
      updateProgressBar();

      // Remove the click outside listener
      document.removeEventListener('click', closeSettingsPanelOnClickOutside);

      // Show saved message
      const panel = document.getElementById("day-progress-settings-panel");
      const savedMsgContainer = document.createElement("div");
      savedMsgContainer.style.display = "flex";
      savedMsgContainer.style.alignItems = "center";
      savedMsgContainer.style.justifyContent = "center";
      savedMsgContainer.style.marginTop = "12px";
      savedMsgContainer.style.padding = "6px 0";
      savedMsgContainer.style.backgroundColor = "rgba(66, 133, 244, 0.1)";
      savedMsgContainer.style.borderRadius = "4px";

      // Checkmark icon
      const checkIcon = document.createElement("span");
      checkIcon.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#4285F4" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <polyline points="20 6 9 17 4 12"></polyline>
      </svg>`;
      savedMsgContainer.appendChild(checkIcon);

      const savedMsg = document.createElement("span");
      savedMsg.textContent = "Settings saved";
      savedMsg.style.color = "#4285F4";
      savedMsg.style.marginLeft = "5px";
      savedMsg.style.fontSize = "12px";
      savedMsgContainer.appendChild(savedMsg);

      panel.appendChild(savedMsgContainer);

      setTimeout(() => {
        savedMsgContainer.remove();
        toggleSettingsPanel(); // Hide panel after saving
      }, 1500);
    });
  }
}

function parseTimeToMinutes(timeString) {
  if (!timeString) {
    console.error("Invalid time string:", timeString);
    return 0;
  }
  const [hours, minutes] = timeString.split(':').map(Number);
  return (hours || 0) * 60 + (minutes || 0);
}

function formatHoursMinutes(minutes) {
  // 确保minutes是有效的数字
  if (isNaN(minutes) || minutes === null || minutes === undefined || minutes < 0) {
    console.error("Invalid minutes:", minutes);
    return "0h";
  }

  // 将minutes转换为整数
  minutes = Math.floor(minutes);

  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return `${hours}h${mins > 0 ? ` ${mins}m` : ''}`;
}

function formatTime(hours, minutes) {
  return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
}

function updateProgressBar() {
  // 获取当前时间和日期
  const now = new Date();
  const currentHours = now.getHours();
  const currentMinutes = now.getMinutes();
  const currentTimeInMinutes = currentHours * 60 + currentMinutes;

  // 记录详细的调试信息
  console.log("当前时间:", formatTime(currentHours, currentMinutes), now);
  console.log("工作起止时间:", workStartTime, "to", workEndTime);

  // 转换工作时间为分钟
  const startTimeInMinutes = parseTimeToMinutes(workStartTime);
  const endTimeInMinutes = parseTimeToMinutes(workEndTime);

  console.log("分钟表示 - 开始时间:", startTimeInMinutes, "分钟");
  console.log("分钟表示 - 结束时间:", endTimeInMinutes, "分钟");
  console.log("分钟表示 - 当前时间:", currentTimeInMinutes, "分钟");

  // 总工作时间（分钟）
  const totalWorkMinutes = Math.max(0, endTimeInMinutes - startTimeInMinutes);
  console.log("总工作时间:", totalWorkMinutes, "分钟");

  let progress = 0;
  let remainingMinutes = 0;

  // 根据当前时间计算进度
  if (currentTimeInMinutes < startTimeInMinutes) {
    // 工作时间前
    progress = 0;
    remainingMinutes = totalWorkMinutes;
    console.log("当前时间在工作时间之前");
  } else if (currentTimeInMinutes > endTimeInMinutes) {
    // 工作时间后
    progress = 100;
    remainingMinutes = 0;
    console.log("当前时间在工作时间之后");
  } else {
    // 工作时间中
    const elapsedWorkMinutes = currentTimeInMinutes - startTimeInMinutes;
    progress = totalWorkMinutes > 0 ? (elapsedWorkMinutes / totalWorkMinutes) * 100 : 0;
    remainingMinutes = totalWorkMinutes - elapsedWorkMinutes;
    console.log("工作已进行:", elapsedWorkMinutes, "分钟, 进度:", progress.toFixed(2) + "%");
    console.log("剩余工作时间:", remainingMinutes, "分钟");
  }

  const bar = document.getElementById("day-progress-bar");
  const timeInfo = document.getElementById("day-progress-time-info");
  const percentDisplay = document.getElementById("day-progress-percentage");
  const startTimeDisplay = document.getElementById("day-progress-start-time-display");
  const endTimeDisplay = document.getElementById("day-progress-end-time-display");

  if (bar && timeInfo) {
    // 应用进度百分比到进度条 - 确保可见
    bar.style.width = `${Math.max(progress, 0.5)}%`;

    // 计算并显示时间信息
    const totalHours = formatHoursMinutes(totalWorkMinutes);
    const remainingTime = formatHoursMinutes(remainingMinutes);

    timeInfo.textContent = `Total: ${totalHours} | Remaining: ${remainingTime}`;

    // If countdown is active, update it as well
    if (countdownActive) {
      updateCountdownProgress();
    }

    // 显示进度百分比和起止时间
    if (percentDisplay) {
      percentDisplay.textContent = `${Math.round(progress)}%`;
    }

    if (startTimeDisplay) {
      startTimeDisplay.textContent = workStartTime;
    }

    if (endTimeDisplay) {
      endTimeDisplay.textContent = workEndTime;
    }

    console.log("进度条和时间信息已更新");
  } else {
    console.error("找不到进度条元素");
    // 如果找不到元素，尝试重新创建
    createProgressBar();
  }
}

// 强制执行一次完整的DOM检查并重建进度条
function forceRebuildProgressBar() {
  console.log("强制重建进度条");

  // 删除所有可能已存在的进度条元素
  const existingContainer = document.getElementById("day-progress-bar-container");
  if (existingContainer) {
    existingContainer.remove();
  }

  // 重建并更新进度条
  createProgressBar();
  updateProgressBar();
}

function startProgressUpdater() {
  console.log("启动进度更新器...");

  // 等待页面完全加载
  if (document.readyState === "complete" || document.readyState === "interactive") {
    loadSettings();
    forceRebuildProgressBar();

    // 监听设置变更
    chrome.storage.onChanged.addListener(function(changes) {
      if (changes.startTime) {
        workStartTime = changes.startTime.newValue;
      }
      if (changes.endTime) {
        workEndTime = changes.endTime.newValue;
      }
      updateProgressBar();
    });

    // 更频繁地更新，确保可见性
    setInterval(updateProgressBar, 30000); // 每30秒更新一次
  } else {
    // 如果页面未完全加载，稍等片刻
    setTimeout(startProgressUpdater, 500);
  }
}

// 监听页面变化，确保进度条始终存在
document.addEventListener('DOMContentLoaded', forceRebuildProgressBar);
window.addEventListener('load', forceRebuildProgressBar);
window.addEventListener('focus', updateProgressBar); // 窗口获得焦点时更新

// 定期检查进度条是否存在，如果不存在则重建
setInterval(() => {
  if (!document.getElementById("day-progress-bar-container")) {
    forceRebuildProgressBar();
  }
}, 5000);

// 立即启动（如果页面已加载）
startProgressUpdater();

// 立即执行一次更新确保即时显示
setTimeout(updateProgressBar, 100);

function toggleCountdownPanel() {
  const panel = document.getElementById("day-progress-countdown-panel");
  if (panel) {
    if (panel.style.display === "none") {
      panel.style.display = "block";

      // Hide settings panel if open
      const settingsPanel = document.getElementById("day-progress-settings-panel");
      if (settingsPanel && settingsPanel.style.display !== "none") {
        settingsPanel.style.display = "none";
      }

      // Add click outside listener to close panel when clicking elsewhere
      setTimeout(() => {
        document.addEventListener('click', closeCountdownPanelOnClickOutside);
      }, 10);
    } else {
      panel.style.display = "none";
      // Remove the click outside listener when panel is manually closed
      document.removeEventListener('click', closeCountdownPanelOnClickOutside);
    }
  }
}

// Function to handle click outside the countdown panel
function closeCountdownPanelOnClickOutside(event) {
  const panel = document.getElementById("day-progress-countdown-panel");
  const countdownBtn = document.getElementById("day-progress-countdown-btn");

  // If click is outside the panel and not on the countdown button, close the panel
  if (panel && countdownBtn &&
      !panel.contains(event.target) &&
      !countdownBtn.contains(event.target)) {
    panel.style.display = "none";
    document.removeEventListener('click', closeCountdownPanelOnClickOutside);
  }
}

function startCountdown(durationMinutes) {
  if (!isCountdownFeatureEnabled) {
    // Show subscription prompt but don't close the countdown panel
    showSubscriptionPrompt();
    return;
  }

  countdownDurationMinutes = durationMinutes;
  countdownStartTimestamp = Date.now();
  countdownActive = true;

  // Save countdown duration in storage
  chrome.storage.sync.set({
    countdownDuration: durationMinutes
  });

  // Update UI
  updateCountdownProgress();

  // Hide panel after starting
  const panel = document.getElementById("day-progress-countdown-panel");
  if (panel) {
    panel.style.display = "none";
    document.removeEventListener('click', closeCountdownPanelOnClickOutside);
  }

  // Highlight countdown button
  const countdownBtn = document.getElementById("day-progress-countdown-btn");
  if (countdownBtn) {
    countdownBtn.classList.add("active");
  }

  // Clear any existing interval and set new one
  if (countdownIntervalId) {
    clearInterval(countdownIntervalId);
  }

  // Update every second
  countdownIntervalId = setInterval(() => {
    if (countdownActive) {
      updateCountdownProgress();
    } else {
      clearInterval(countdownIntervalId);
    }
  }, 1000);
}

function stopCountdown() {
  countdownActive = false;
  clearInterval(countdownIntervalId);

  // Update UI
  const countdownBar = document.getElementById("day-progress-countdown-bar");
  if (countdownBar) {
    countdownBar.style.width = "0%";
  }

  // Remove highlight from countdown button
  const countdownBtn = document.getElementById("day-progress-countdown-btn");
  if (countdownBtn) {
    countdownBtn.classList.remove("active");
  }

  // Hide countdown info
  const timeInfo = document.getElementById("day-progress-time-info");
  if (timeInfo) {
    // Remove countdown info if present
    const countdownInfo = timeInfo.querySelector(".countdown-info");
    if (countdownInfo) {
      countdownInfo.remove();
    }
  }

  // Hide panel
  const panel = document.getElementById("day-progress-countdown-panel");
  if (panel) {
    panel.style.display = "none";
  }
}

function resetCountdown() {
  if (countdownActive) {
    countdownStartTimestamp = Date.now();
    updateCountdownProgress();
  }
}

function updateCountdownProgress() {
  if (!countdownActive) return;

  const now = Date.now();
  const elapsedMs = now - countdownStartTimestamp;
  const totalDurationMs = countdownDurationMinutes * 60 * 1000;
  const remainingMs = Math.max(0, totalDurationMs - elapsedMs);

  // Calculate remaining time in minutes and seconds
  const remainingMinutes = Math.floor(remainingMs / 60000);
  const remainingSeconds = Math.floor((remainingMs % 60000) / 1000);

  // Calculate progress percentage (reversed for countdown)
  const progressPercent = 100 - (remainingMs / totalDurationMs * 100);

  // Update countdown bar width
  const countdownBar = document.getElementById("day-progress-countdown-bar");
  if (countdownBar) {
    countdownBar.style.width = `${progressPercent}%`;

    // Add a class if almost complete
    if (progressPercent > 80) {
      countdownBar.classList.add("almost-complete");
    } else {
      countdownBar.classList.remove("almost-complete");
    }
  }

  // Update time info to include countdown
  const timeInfo = document.getElementById("day-progress-time-info");
  if (timeInfo) {
    // Remove countdown info if present
    let countdownInfo = timeInfo.querySelector(".countdown-info");
    if (!countdownInfo) {
      countdownInfo = document.createElement("span");
      countdownInfo.className = "countdown-info";
      timeInfo.appendChild(countdownInfo);
    }

    // Format and display remaining time
    countdownInfo.textContent = ` | ⏱️ ${remainingMinutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  }

  // Check if countdown is complete
  if (remainingMs === 0) {
    countdownComplete();
  }
}

function countdownComplete() {
  countdownActive = false;
  clearInterval(countdownIntervalId);

  // Keep the countdown bar full for a moment
  setTimeout(() => {
    const countdownBar = document.getElementById("day-progress-countdown-bar");
    if (countdownBar) {
      countdownBar.classList.add("complete");

      // Show completion message in the bar
      const completionMessage = document.createElement("div");
      completionMessage.id = "countdown-completion-message";
      completionMessage.textContent = "Time's up!";
      document.getElementById("day-progress-bar-container").appendChild(completionMessage);

      // After showing complete state, remove it
      setTimeout(() => {
        countdownBar.style.width = "0%";
        countdownBar.classList.remove("complete", "almost-complete");

        // Remove highlight from countdown button
        const countdownBtn = document.getElementById("day-progress-countdown-btn");
        if (countdownBtn) {
          countdownBtn.classList.remove("active");
        }

        // Remove countdown info
        const timeInfo = document.getElementById("day-progress-time-info");
        if (timeInfo) {
          const countdownInfo = timeInfo.querySelector(".countdown-info");
          if (countdownInfo) {
            countdownInfo.remove();
          }
        }

        // Remove completion message
        const message = document.getElementById("countdown-completion-message");
        if (message) {
          message.classList.add("fade-out");
          setTimeout(() => {
            if (message.parentNode) {
              message.parentNode.removeChild(message);
            }
          }, 500);
        }
      }, 3000);
    }
  }, 500);
}

// Load settings and start progress updater when the content script runs
loadSettings();
startProgressUpdater();

// Check subscription status periodically (every hour)
setInterval(checkCountdownFeatureStatus, 60 * 60 * 1000);

/**
 * 切换进度条的可见性
 */
function toggleProgressBarVisibility(forceHidden) {
  const progressBarContainer = document.getElementById("day-progress-bar-container");
  if (progressBarContainer) {
    // 检查当前是否隐藏，或使用强制值
    const isHidden = forceHidden !== undefined ? !forceHidden : progressBarContainer.style.display === "none";

    // 保存隐藏状态到存储
    chrome.storage.sync.set({ "dayProgressBarHidden": !isHidden });

    // 更新按钮文本
    const hideBtn = document.getElementById("day-progress-hide-btn");
    if (hideBtn) {
      hideBtn.textContent = isHidden ? "Hide" : "Show";
      // 使用灰色次要按钮样式
      hideBtn.style.backgroundColor = "#f1f3f4";
      hideBtn.style.color = "#5f6368";
      hideBtn.style.flex = "1";
      hideBtn.style.height = "100%";
      hideBtn.style.lineHeight = "36px";
      hideBtn.style.margin = "0";
      hideBtn.style.padding = "0";
    }

    // 切换可见性
    progressBarContainer.style.display = isHidden ? "flex" : "none";

    // 关闭设置面板
    const settingsPanel = document.getElementById("day-progress-settings-panel");
    if (settingsPanel) {
      settingsPanel.style.display = "none";
      document.removeEventListener('click', closeSettingsPanelOnClickOutside);
    }
  }
}

// 在文件顶部添加消息监听器
chrome.runtime.onMessage.addListener(function(message, sender, sendResponse) {
  if (message.action === 'toggleProgressBarVisibility') {
    // 直接使用消息中传递的隐藏状态
    toggleProgressBarVisibility(message.hidden);
  } else if (message.action === 'openSettingsPanel') {
    const panel = document.getElementById("day-progress-settings-panel");
    if (panel) {
      panel.style.display = "block";
      // 添加点击外部关闭逻辑
      setTimeout(() => {
        document.addEventListener('click', closeSettingsPanelOnClickOutside);
      }, 10);
    }
  }
  return true; // 保持消息通道开放以异步响应
});
