// 当弹出界面加载时，初始化按钮状态
document.addEventListener('DOMContentLoaded', function() {
  const toggleBtn = document.getElementById('toggle-btn');
  const settingsLink = document.getElementById('settings-link');

  // 获取当前进度条隐藏状态
  chrome.storage.sync.get(['dayProgressBarHidden'], function(result) {
    const isHidden = result.dayProgressBarHidden || false;
    toggleBtn.textContent = isHidden ? 'Show Progress Bar' : 'Hide Progress Bar';
  });

  // 为按钮添加点击事件
  toggleBtn.addEventListener('click', function() {
    chrome.storage.sync.get(['dayProgressBarHidden'], function(result) {
      const currentlyHidden = result.dayProgressBarHidden || false;
      const newState = !currentlyHidden;

      // 保存新的状态
      chrome.storage.sync.set({ 'dayProgressBarHidden': newState }, function() {
        // 更新按钮文本
        toggleBtn.textContent = newState ? 'Show Progress Bar' : 'Hide Progress Bar';

        // 向当前活动标签页发送消息，通知内容脚本更新显示状态
        chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
          if (tabs[0]) {
            chrome.tabs.sendMessage(tabs[0].id, {
              action: 'toggleProgressBarVisibility',
              hidden: newState
            });
          }
        });
      });
    });
  });

  // 为设置链接添加点击事件
  settingsLink.addEventListener('click', function() {
    chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
      if (tabs[0]) {
        chrome.tabs.sendMessage(tabs[0].id, { action: 'openSettingsPanel' });
        window.close(); // 关闭弹出窗口
      }
    });
  });
});