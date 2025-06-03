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

        // 向当前活动标签页发送消息，通知内容脚本更新显示状态
        chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
          if (tabs[0]) {
            try {
              chrome.tabs.sendMessage(
                tabs[0].id,
                {
                  action: 'toggleProgressBarVisibility',
                  hidden: newState
                },
                // 添加回调函数处理响应
                function(response) {
                  // 即使没有响应或发生错误，也不中断操作
                  console.log('状态更新完成', response);
                }
              );
            } catch (error) {
              // 捕获并记录任何错误
              console.error('发送消息时出错:', error);
            }
          }
        });
      });
    });
  });
});

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