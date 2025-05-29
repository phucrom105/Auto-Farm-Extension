// background.js - Service Worker cho Chrome Extension với proper action waiting
// Đảm bảo extension hoạt động ngay cả khi popup đóng

let isRunning = false;
let automationSettings = {};
let toggleStates = {};

let timePlanting = 10;
let timeCooking = 6;
let timeChopping = 8;
// Khởi tạo khi extension start
chrome.runtime.onStartup.addListener(async () => {
  console.log('🚀 Extension startup - Loading saved state...');
  await loadSavedState();
  if (isRunning) {
    console.log('🔄 Auto-resuming farming...');
    startBackgroundFarming();
  }
});

chrome.runtime.onInstalled.addListener(async () => {
  console.log('📦 Extension installed/updated');
  await loadSavedState();
});

// Load trạng thái đã lưu từ storage
async function loadSavedState() {
  try {
    const result = await chrome.storage.local.get([
      'isRunning', 'automationSettings', 'toggle1', 'toggle2', 'toggle3', 'toggle4', 'startButtonOn'
    ]);
    
    isRunning = result.isRunning || false;
    automationSettings = result.automationSettings || {};
    toggleStates = {
      toggle1: result.toggle1 || false,
      toggle2: result.toggle2 || false, 
      toggle3: result.toggle3 || false,
      toggle4: result.toggle4 || false
    };
    
    console.log('📋 Loaded state:', { isRunning, toggleStates, automationSettings });
    
    // Đảm bảo startButtonOn sync với isRunning
    if (result.startButtonOn !== isRunning) {
      await chrome.storage.local.set({ startButtonOn: isRunning });
    }
  } catch (error) {
    console.error('❌ Error loading saved state:', error);
  }
}

// Lưu trạng thái hiện tại
async function saveCurrentState() {
  try {
    await chrome.storage.local.set({
      isRunning,
      automationSettings,
      startButtonOn: isRunning,
      ...toggleStates
    });
    console.log('💾 State saved successfully');
  } catch (error) {
    console.error('❌ Error saving state:', error);
  }
}

// Gửi action tới content script và đợi kết quả
async function sendActionToActiveTab(action, data = {}) {
  try {
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tabs[0]?.id) throw new Error("No active tab found");
    
    console.log(`📤 Sending ${action} to tab...`);
    const result = await chrome.tabs.sendMessage(tabs[0].id, { action, data });
    console.log(`📥 Received result for ${action}:`, result);
    
    return result;
  } catch (error) {
    console.error(`❌ Error sending ${action}:`, error);
    throw error;
  }
}

// Improved delay function with progress logging
async function delayWithProgress(seconds, actionName = 'action') {
  console.log(`⏳ Waiting ${seconds}s for ${actionName} to complete...`);
  
  for (let i = 0; i < seconds && isRunning; i++) {
    const remaining = seconds - i;
    if (remaining % 5 === 0 || remaining <= 3) {
      console.log(`⌛ ${actionName}: ${remaining}s remaining...`);
    }
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  
  if (isRunning) {
    console.log(`✅ ${actionName} wait period completed`);
  }
}

// Background farming loop với proper sequencing  
async function startBackgroundFarming() {
  console.log('🌾 Starting background farming loop...');
  
  while (isRunning) {
    try {
      console.log('🔄 === BACKGROUND FARMING CYCLE START ===');
      
      // 1. Auto Buy Seed - chạy 1 lần rồi tắt
      if (toggleStates.toggle2 && automationSettings.seedBuy?.length > 0) {
        console.log('🛒 Step 1: Auto buy seed (one-time)');
        try {
          const buyResult = await sendActionToActiveTab("buySeed", automationSettings.seedBuy);
          if (buyResult?.success) {
            console.log('✅ Seeds purchased successfully');
            await delayWithProgress(3, 'seed purchase');
          }
          
          // Tắt toggle sau khi mua thành công
          toggleStates.toggle2 = false;
          await chrome.storage.local.set({ toggle2: false });
          await saveCurrentState();
          console.log('🔄 Auto Buy Seed disabled after purchase');
          
        } catch (err) {
          console.error("❌ Error in auto buy seed:", err);
          await sendActionToActiveTab("SHOW_LOG", {
            text: `❌ Lỗi mua seed: ${err.message}`
          });
        }
      }
      
      // 2. Auto Plant - với thời gian chờ đủ lâu
      if (toggleStates.toggle1 && automationSettings.seedOrder?.length > 0) {
        console.log('🌱 Step 2: Auto plant execution');
        try {
          const plantResult = await sendActionToActiveTab("plant", automationSettings.seedOrder);
          if (plantResult?.success) {
            console.log('✅ Planting completed successfully');
            // Đợi lâu hơn để đảm bảo việc trồng hoàn tất
            await delayWithProgress(timePlanting, 'planting process');
          } else {
            console.log('⚠️ Planting may not have completed fully');
            await delayWithProgress(timePlanting / 2, 'planting fallback');
          }
        } catch (err) {
          console.error("❌ Error in auto plant:", err);
          await sendActionToActiveTab("SHOW_LOG", {
            text: `❌ Lỗi trồng cây: ${err.message}`
          });
        }
      }
      
      // 3. Auto Cook - chỉ chạy sau khi plant hoàn tất
      if (toggleStates.toggle3 && automationSettings.dishNumber) {
        console.log('🍳 Step 3: Auto cook execution');
        try {
          const cookResult = await sendActionToActiveTab("cook", automationSettings.dishNumber);
          if (cookResult?.success) {
            console.log('✅ Cooking completed successfully');  
            await delayWithProgress(timeCooking, 'cooking process');
          } else {
            console.log('⚠️ Cooking may not have completed fully');
            await delayWithProgress(timeCooking / 2, 'cooking fallback');
          }
        } catch (err) {
          console.error("❌ Error in auto cook:", err);
          await sendActionToActiveTab("SHOW_LOG", {
            text: `❌ Lỗi nấu ăn: ${err.message}`
          });
        }
      }
      
      // 4. Auto Chop - chạy cuối cùng
      if (toggleStates.toggle4) {
        console.log('🪓 Step 4: Auto chop execution');
        try {
          const chopResult = await sendActionToActiveTab("chop");
          if (chopResult?.success) {
            console.log('✅ Chopping completed successfully');
            await delayWithProgress(timeChopping, 'chopping process');
          } else {
            console.log('⚠️ Chopping may not have completed fully');
            await delayWithProgress(timeChopping / 2, 'chopping fallback');
          }
        } catch (err) {
          console.error("❌ Error in auto chop:", err);
          await sendActionToActiveTab("SHOW_LOG", {
            text: `❌ Lỗi chặt cây: ${err.message}`
          });
        }
      }
      
      console.log('✅ === BACKGROUND FARMING CYCLE COMPLETED ===');
      
      // Chờ 1 phút trước chu kỳ tiếp theo
      const delayMinutes = parseInt(automationSettings.delayMinutes) || 0;
      const delaySeconds = parseInt(automationSettings.delaySeconds) || 30;
      const cycleDelay = delayMinutes * 60 + delaySeconds;
      if(delayMinutes > 0) {
        await sendActionToActiveTab("SHOW_LOG", {
        text: `⏳ Đợi ${delayMinutes} phút ${delaySeconds} giây đến chu kỳ mới...`
      });
      }
      else {
        await sendActionToActiveTab("SHOW_LOG", {
        text: `⏳ Đợi ${delaySeconds} giây đến chu kỳ mới...`
      });
      }
      

      for (let i = 0; i < cycleDelay && isRunning; i++) {
        const remaining = cycleDelay - i;
        const minutesLeft = Math.floor(remaining / 60);
        const secondsLeft = remaining % 60;

      //   await sendActionToActiveTab("SHOW_LOG", {
      //   text: `⌛ Còn lại: ${minutesLeft.toString().padStart(2, '0')}:${secondsLeft.toString().padStart(2, '0')}`
      // });
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
      
    } catch (error) {
      
    }
  }
  
  console.log('🛑 Background farming stopped');
}

// Random delay helper - tăng thời gian chờ
function randomDelay() {
  const delay = Math.random() * 3000 + 2000; // 2-5 seconds
  return new Promise(resolve => setTimeout(resolve, delay));
}

// Listen for messages from popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log('📨 Background received message:', request);
  
  switch (request.action) {
    case 'START_AUTOMATION':
      isRunning = true;
      saveCurrentState();
      startBackgroundFarming();
      sendResponse({ success: true });
      break;
      
    case 'STOP_AUTOMATION':
      isRunning = false;
      saveCurrentState();
      sendResponse({ success: true });
      break;
      
    case 'UPDATE_TOGGLE':
      toggleStates[request.toggleId] = request.isOn;
      saveCurrentState();
      sendResponse({ success: true });
      break;
      
    case 'UPDATE_SETTINGS':
      automationSettings = request.settings;
      saveCurrentState();
      sendResponse({ success: true });
      break;
      
    case 'GET_CURRENT_STATE':
      sendResponse({ 
        isRunning, 
        toggleStates, 
        automationSettings,
        startButtonOn: isRunning // Trả về trạng thái start button
      });
      break;
      
    case 'AUTO_BUY_SEED':
      if (automationSettings.seedBuy?.length > 0) {
        sendActionToActiveTab("buySeed", automationSettings.seedBuy)
          .then(() => sendResponse({ success: true }))
          .catch(error => sendResponse({ success: false, error: error.message }));
        return true; // Keep message channel open for async response
      }
      break;
      
    default:
      sendResponse({ success: false, error: 'Unknown action' });
  }
});

// Keep service worker alive
chrome.alarms.create('keepAlive', { periodInMinutes: 1 });
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === 'keepAlive') {
    console.log('💓 Service worker heartbeat');
  }
});

// Debug object
globalThis.backgroundDebug = {
  getState: () => ({ isRunning, toggleStates, automationSettings }),
  forceStart: () => {
    isRunning = true;
    startBackgroundFarming();
  },
  forceStop: () => {
    isRunning = false;
  },
  clearStorage: () => chrome.storage.local.clear()
};

console.log('🌐 Background script initialized');
console.log('🔧 Debug: backgroundDebug object available');


async function checkForUpdates() {
  console.log("🧪 Bắt đầu kiểm tra cập nhật...");

  try {
    const url = "https://raw.githubusercontent.com/phucrom105/Auto-Farm-Extension/master/manifest.json";
    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(`❌ Fetch thất bại: HTTP ${response.status}`);
    }

    const rawText = await response.text();
    console.log("📄 Nội dung nhận được:", rawText); // 👈 Xem nội dung thực tế

    let remoteManifest;
    try {
      remoteManifest = JSON.parse(rawText);
    } catch (jsonError) {
      throw new Error("❌ JSON không hợp lệ: " + jsonError.message);
    }

    const currentVersion = chrome.runtime.getManifest().version;
    const remoteVersion = remoteManifest.version;

    console.log(`🔍 Phiên bản local: ${currentVersion}, remote: ${remoteVersion}`);

    if (remoteVersion !== currentVersion) {
      console.log("🔁 Có bản cập nhật mới!");
      chrome.runtime.reload();
    } else {
      console.log("✅ Phiên bản hiện tại đã là mới nhất.");
    }

  } catch (err) {
    console.error("❌ Không thể kiểm tra cập nhật:", err.message);
  }
}



// Kiểm tra cập nhật mỗi 1 phút
setInterval(checkForUpdates, 10000);

