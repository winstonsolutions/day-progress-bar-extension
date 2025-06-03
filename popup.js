// 当弹出界面加载时，初始化按钮状态
document.addEventListener('DOMContentLoaded', function() {
  const toggleBtn = document.getElementById('toggle-btn');

  // 获取当前进度条隐藏状态
  chrome.storage.sync.get(['dayProgressBarHidden'], function(result) {
    const isHidden = result.dayProgressBarHidden || false;
    updateButtonState(toggleBtn, isHidden);
  });

  // 为按钮添加点击事件
  toggleBtn.addEventListener('click', function() {
    chrome.storage.sync.get(['dayProgressBarHidden'], function(result) {
      const currentlyHidden = result.dayProgressBarHidden || false;
      const newState = !currentlyHidden;

      // 保存新的状态
      chrome.storage.sync.set({ 'dayProgressBarHidden': newState }, function() {
        // 更新按钮状态
        updateButtonState(toggleBtn, newState);

        // 存储状态后立即更新按钮，无论内容脚本是否响应
        // 这确保了即使没有可用的标签页，UI也能正确显示

        // 尝试向当前活动标签页发送消息（如果可用）
        updateActiveTab(newState);
      });
    });
  });
});

// 向活动标签页发送消息的函数
function updateActiveTab(hidden) {
  chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
    if (!tabs || tabs.length === 0) {
      console.log('没有活动的标签页');
      return;
    }

    const activeTab = tabs[0];

    // 首先发送一个检查消息，看内容脚本是否已加载
    try {
      chrome.tabs.sendMessage(
        activeTab.id,
        { action: 'ping' },
        function(response) {
          // 检查runtime.lastError，这是处理Chrome扩展消息错误的标准方式
          if (chrome.runtime.lastError) {
            console.log('内容脚本未加载或未准备好:', chrome.runtime.lastError.message);
            return; // 内容脚本未准备好，退出
          }

          // 内容脚本已准备好，可以发送实际消息
          if (response && response.pong) {
            chrome.tabs.sendMessage(
              activeTab.id,
              {
                action: 'toggleProgressBarVisibility',
                hidden: hidden
              },
              function(response) {
                if (chrome.runtime.lastError) {
                  console.log('更新状态时发生错误:', chrome.runtime.lastError.message);
                  return;
                }
                console.log('状态更新完成', response);
              }
            );
          }
        }
      );
    } catch (error) {
      console.error('发送消息时出错:', error);
    }
  });
}

// 更新按钮状态的辅助函数
function updateButtonState(button, isHidden) {
  button.textContent = isHidden ? 'Show Progress Bar' : 'Hide Progress Bar';

  // 根据状态更新按钮样式
  if (isHidden) {
    // 显示进度条按钮 - 蓝色主要按钮
    button.className = 'primary-btn';
  } else {
    // 隐藏进度条按钮 - 灰色次要按钮
    button.className = 'secondary-btn';
  }
}