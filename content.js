// Default work hours (9 AM to 5 PM)
let workStartTime = '09:00';
let workEndTime = '17:00';

// Load settings
function loadSettings() {
  chrome.storage.sync.get(['startTime', 'endTime'], function(result) {
    if (result.startTime) {
      workStartTime = result.startTime;
    }
    if (result.endTime) {
      workEndTime = result.endTime;
    }
    updateProgressBar(); // Update after loading settings
  });
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

  // Create progress bar
  const bar = document.createElement("div");
  bar.id = "day-progress-bar";
  container.appendChild(bar);

  // Create time info
  const timeInfo = document.createElement("div");
  timeInfo.id = "day-progress-time-info";
  container.appendChild(timeInfo);

  // Create progress percentage indicator
  const progressPercent = document.createElement("div");
  progressPercent.id = "day-progress-percentage";
  progressPercent.style.position = "absolute";
  progressPercent.style.left = "50%";
  progressPercent.style.top = "6px";
  progressPercent.style.transform = "translateX(-50%)";
  progressPercent.style.fontSize = "11px";
  progressPercent.style.color = "#333";
  progressPercent.style.fontFamily = "Arial, sans-serif";
  progressPercent.style.fontWeight = "bold";
  container.appendChild(progressPercent);

  // Create settings button with Material Design icon
  const settingsBtn = document.createElement("div");
  settingsBtn.id = "day-progress-settings-btn";
  settingsBtn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <circle cx="12" cy="12" r="3"></circle>
    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path>
  </svg>`;
  settingsBtn.title = "Work Hours Settings";
  settingsBtn.addEventListener("click", toggleSettingsPanel);
  container.appendChild(settingsBtn);

  // Create settings panel (initially hidden)
  const settingsPanel = document.createElement("div");
  settingsPanel.id = "day-progress-settings-panel";
  settingsPanel.style.display = "none";

  // Panel title
  const panelTitle = document.createElement("div");
  panelTitle.textContent = "Work Hours";
  panelTitle.style.fontSize = "14px";
  panelTitle.style.fontWeight = "500";
  panelTitle.style.marginBottom = "10px";
  panelTitle.style.color = "#202124";
  settingsPanel.appendChild(panelTitle);

  // Start time input
  const startLabel = document.createElement("label");
  startLabel.textContent = "Start time";
  startLabel.setAttribute("for", "day-progress-start-time");
  settingsPanel.appendChild(startLabel);

  const startInput = document.createElement("input");
  startInput.type = "time";
  startInput.id = "day-progress-start-time";
  startInput.value = workStartTime;
  settingsPanel.appendChild(startInput);

  // End time input
  const endLabel = document.createElement("label");
  endLabel.textContent = "End time";
  endLabel.setAttribute("for", "day-progress-end-time");
  settingsPanel.appendChild(endLabel);

  const endInput = document.createElement("input");
  endInput.type = "time";
  endInput.id = "day-progress-end-time";
  endInput.value = workEndTime;
  settingsPanel.appendChild(endInput);

  // Save button
  const saveBtn = document.createElement("button");
  saveBtn.textContent = "Save";
  saveBtn.addEventListener("click", saveSettings);
  settingsPanel.appendChild(saveBtn);

  container.appendChild(settingsPanel);

  // Ensure the container is added to the document body
  document.body.insertBefore(container, document.body.firstChild);

  // Debug log to check if element is created
  console.log("Progress bar container created:", container);
}

function toggleSettingsPanel() {
  const panel = document.getElementById("day-progress-settings-panel");
  if (panel) {
    if (panel.style.display === "none") {
      panel.style.display = "block";
    } else {
      panel.style.display = "none";
    }
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

      // Show saved message
      const panel = document.getElementById("day-progress-settings-panel");
      const savedMsgContainer = document.createElement("div");
      savedMsgContainer.style.display = "flex";
      savedMsgContainer.style.alignItems = "center";
      savedMsgContainer.style.marginTop = "10px";

      // Checkmark icon
      const checkIcon = document.createElement("span");
      checkIcon.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#4285F4" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <polyline points="20 6 9 17 4 12"></polyline>
      </svg>`;
      savedMsgContainer.appendChild(checkIcon);

      const savedMsg = document.createElement("span");
      savedMsg.textContent = "Settings saved";
      savedMsg.style.color = "#4285F4";
      savedMsg.style.marginLeft = "5px";
      savedMsg.style.fontSize = "13px";
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
  if (!minutes || minutes < 0) {
    console.error("Invalid minutes:", minutes);
    return "0h";
  }
  const hours = Math.floor(minutes / 60);
  const mins = Math.floor(minutes % 60);
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
  const totalWorkMinutes = endTimeInMinutes - startTimeInMinutes;
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
    progress = (elapsedWorkMinutes / totalWorkMinutes) * 100;
    remainingMinutes = totalWorkMinutes - elapsedWorkMinutes;
    console.log("工作已进行:", elapsedWorkMinutes, "分钟, 进度:", progress.toFixed(2) + "%");
    console.log("剩余工作时间:", remainingMinutes, "分钟");
  }

  const bar = document.getElementById("day-progress-bar");
  const timeInfo = document.getElementById("day-progress-time-info");
  const percentDisplay = document.getElementById("day-progress-percentage");

  if (bar && timeInfo) {
    // 应用进度百分比到进度条 - 确保可见
    bar.style.width = `${Math.max(progress, 0.5)}%`;

    // 计算并显示时间信息
    const totalHours = formatHoursMinutes(totalWorkMinutes);
    const remainingTime = formatHoursMinutes(remainingMinutes);

    timeInfo.textContent = `Total: ${totalHours} | Remaining: ${remainingTime}`;

    // 显示进度百分比
    if (percentDisplay) {
      percentDisplay.textContent = `${Math.round(progress)}%`;
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
