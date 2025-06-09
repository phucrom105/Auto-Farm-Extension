// background.js - Enhanced với multi-tab support và background operation
// Extension hoạt động ngay cả khi chuyển tab hoặc minimize browser

let isRunning = false;
let automationSettings = {};
let toggleStates = {};
let targetTabId = null;
let targetTabUrl = null;

let timePlanting = 10;
let timeCooking = 6;
let timeChopping = 8;

// State backup để khôi phục khi gặp lỗi
let stateBackup = {
  isRunning: false,
  toggleStates: {},
  automationSettings: {},
  targetTabId: null,
  targetTabUrl: null
};

// Cờ flag để tránh restore backup ngay sau khi clear
let justCleared = false;

// Khởi tạo khi extension start
chrome.runtime.onStartup.addListener(async () => {
  console.log('🚀 Extension startup - Multi-tab recovery...');
  
   const { recentlyClear } = await chrome.storage.local.get(['recentlyClear']);
  if (recentlyClear) {
    console.log('🛑 Skipping startup logic due to recent CLEAR_SETTINGS');
    return;
  }


  try {
    await loadSavedState();
    
    // Nếu đang running, tìm và khôi phục target tab
    if (isRunning && targetTabUrl) {
      const foundTab = await findMatchingTab();
      if (foundTab && targetTabId) {
        setTimeout(() => {
          if (isRunning) {
            startBackgroundFarming();
          }
        }, 5000);
      } else {
        console.log('⚠️ No matching tab found, waiting for user to open game...');
        // Không tắt automation, chỉ đợi
      }
    }
    
    await createStateBackup();
  } catch (error) {
    console.error('❌ Startup error:', error);
    await restoreFromBackup('startup_error');
  }
});

chrome.runtime.onInstalled.addListener(async () => {
  console.log('📦 Extension installed/updated');
  await loadSavedState();
  await createStateBackup();
});

// Tạo backup của trạng thái hiện tại
async function createStateBackup() {
  stateBackup = {
    isRunning: isRunning,
    toggleStates: { ...toggleStates },
    automationSettings: { ...automationSettings },
    targetTabId: targetTabId,
    targetTabUrl: targetTabUrl,
    timestamp: Date.now()
  };
  
  await chrome.storage.local.set({
    'stateBackup': stateBackup
  });
  
  console.log('💾 State backup created:', stateBackup);
}

// Khôi phục từ backup khi gặp lỗi
async function restoreFromBackup(reason = 'unknown') {
  try {

     if (justCleared) {
      console.log('⏭️ Skip restore due to recent CLEAR_SETTINGS');
      return false; // tránh restore ngay sau clear
    }
    
    console.log(`🔄 Restoring from backup due to: ${reason}`);
    
    // Kiểm tra backup trong storage
    const result = await chrome.storage.local.get(['stateBackup']);
    console.log('📂 Backup found in storage:', result.stateBackup);
    
    if (result.stateBackup && result.stateBackup.timestamp) {
      const backupAge = Date.now() - result.stateBackup.timestamp;
      console.log(`⏰ Backup age: ${backupAge}ms (${Math.round(backupAge/1000)}s)`);
      
      if (backupAge < 10 * 60 * 1000) { // Backup không quá 10 phút
        stateBackup = result.stateBackup;
        console.log('📂 Using stored backup from', new Date(result.stateBackup.timestamp));
      } else {
        console.log('⚠️ Backup quá cũ, bỏ qua restore');
        return false;
      }
    } else {
      console.log('⚠️ Không có backup hợp lệ để restore');
      return false;
    }
    
    // KIỂM tra nếu backup chỉ chứa dữ liệu reset thì không restore
    if (!stateBackup.targetTabId && !stateBackup.targetTabUrl && 
        !stateBackup.isRunning && Object.keys(stateBackup.automationSettings).length === 0) {
      console.log('ℹ️ Backup chỉ chứa dữ liệu reset, bỏ qua restore');
      return false;
    }
    
    const wasRunning = isRunning;
    
    isRunning = stateBackup.isRunning;
    toggleStates = { ...stateBackup.toggleStates };
    automationSettings = { ...stateBackup.automationSettings };
    
    if (!targetTabId && stateBackup.targetTabId) {
      targetTabId = stateBackup.targetTabId;
      targetTabUrl = stateBackup.targetTabUrl;
    }
    
    await saveCurrentState();
    
    console.log('✅ State restored from backup:', {
      isRunning,
      toggleStates,
      targetTabId,
      targetTabUrl
    });
    
    if (isRunning && !wasRunning) {
      console.log('🔄 Attempting to resume farming after restoration...');
      setTimeout(() => {
        if (isRunning) {
          startBackgroundFarming();
        }
      }, 2000);
    }
    
    return true;
  } catch (error) {
    console.error('❌ Error restoring from backup:', error);
    return false;
  }
}

// Load trạng thái đã lưu từ storage
async function loadSavedState() {
  try {
    const result = await chrome.storage.local.get([
      'isRunning', 'automationSettings', 'toggle1', 'toggle2', 'toggle3', 'toggle4', 
      'startButtonOn', 'targetTabId', 'targetTabUrl', 'stateBackup'
    ]);
    
    console.log('📋 Raw loaded data:', result);
    
    isRunning = result.isRunning || false;
    automationSettings = result.automationSettings || {};
    targetTabId = result.targetTabId || null;
    targetTabUrl = result.targetTabUrl || null;
    
    toggleStates = {
      toggle1: result.toggle1 || false,
      toggle2: result.toggle2 || false, 
      toggle3: result.toggle3 || false,
      toggle4: result.toggle4 || false
    };
    
    console.log('📋 Processed loaded state:', { 
      isRunning, 
      toggleStates, 
      automationSettings,
      targetTabId,
      targetTabUrl 
    });
    
    if (result.startButtonOn !== isRunning) {
      await chrome.storage.local.set({ startButtonOn: isRunning });
    }

    // Chỉ validate nếu đang chạy và có targetTab
    if (isRunning && targetTabId && targetTabUrl) {
      await validateTargetTab();
    }
    
  } catch (error) {
    console.error('❌ Error loading saved state:', error);
    
    // CHỈ restore nếu có lỗi thực sự, không phải sau khi clear
    const recentlyClear = await chrome.storage.local.get(['recentlyClear']);
    if (!recentlyClear.recentlyClear) {
      await restoreFromBackup('load_state_error');
    }
  }
}

// ===== KEY FIX: Enhanced tab validation và connection =====
async function validateTargetTab() {
  if (!targetTabId) return false;
  
  try {
    // Kiểm tra tab có tồn tại không
    const tab = await chrome.tabs.get(targetTabId);
    if (!tab) {
      console.log('⚠️ Target tab no longer exists');
      return await findMatchingTab();
    }
    
    // Kiểm tra URL có khớp không (domain level)
    if (targetTabUrl) {
      const targetDomain = new URL(targetTabUrl).hostname;
      const currentDomain = new URL(tab.url).hostname;
      
      if (targetDomain !== currentDomain) {
        console.log('⚠️ Target tab domain changed');
        return await findMatchingTab();
      }
    }
    
    // Test connection bằng cách ping (KHÔNG fail nếu không response)
    try {
      await Promise.race([
        chrome.tabs.sendMessage(targetTabId, { action: 'PING' }),
        new Promise((_, reject) => setTimeout(() => reject(new Error('ping_timeout')), 3000))
      ]);
      console.log('✅ Target tab connection confirmed');
    } catch (pingError) {
      console.log('⚠️ Target tab ping failed (tab may be inactive, continuing anyway)');
      // KHÔNG return false, vì tab có thể chỉ đang inactive
    }
    
    return true;
    
  } catch (error) {
    console.log('⚠️ Target tab validation failed:', error.message);
    return await findMatchingTab();
  }
}

// ===== KEY FIX: Improved tab finding =====
async function findMatchingTab() {
  try {
    const tabs = await chrome.tabs.query({});
    
    // Priority 1: Tìm tab với URL domain khớp
    if (targetTabUrl) {
      const targetDomain = new URL(targetTabUrl).hostname;
      
      for (const tab of tabs) {
        try {
          const tabDomain = new URL(tab.url).hostname;
          if (tabDomain === targetDomain && 
              (tab.url.includes('game') || tab.url.includes('farm') || tab.url.includes('play'))) {
            console.log('🔍 Found matching domain tab:', tab.id, tab.url);
            targetTabId = tab.id;
            targetTabUrl = tab.url;
            await saveCurrentState();
            await createStateBackup();
            return true;
          }
        } catch (e) {
          continue;
        }
      }
    }
    
    // Priority 2: Tìm tab game phổ biến
    const gameKeywords = ['game', 'farm', 'play', 'sunwin', 'fishing', 'casino'];
    for (const tab of tabs) {
      try {
        const url = tab.url.toLowerCase();
        if (gameKeywords.some(keyword => url.includes(keyword))) {
          console.log('🔍 Found potential game tab:', tab.id, tab.url);
          targetTabId = tab.id;
          targetTabUrl = tab.url;
          await saveCurrentState();
          await createStateBackup();
          return true;
        }
      } catch (e) {
        continue;
      }
    }
    
    console.log('❌ No suitable tab found');
    return false;
  } catch (error) {
    console.error('❌ Error finding matching tab:', error);
    return false;
  }
}

// Lưu trạng thái hiện tại
async function saveCurrentState() {
  try {
    await chrome.storage.local.set({
      isRunning,
      automationSettings,
      startButtonOn: isRunning,
      targetTabId,
      targetTabUrl,
      ...toggleStates
    });
    
    await createStateBackup();
    console.log('💾 State saved successfully');
  } catch (error) {
    console.error('❌ Error saving state:', error);
  }
}

// ===== KEY FIX: Enhanced message sending với retry và fallback =====
async function sendActionToTargetTab(action, data = {}) {
  let attempts = 0;
  const maxAttempts = 3;
  
  while (attempts < maxAttempts) {
    try {
      // Validate target tab trước mỗi lần gửi
      if (!await validateTargetTab()) {
        throw new Error("No valid target tab found");
      }
      
      console.log(`📤 Sending ${action} to tab ${targetTabId} (attempt ${attempts + 1})`);
      
      // Gửi message với timeout
      const result = await Promise.race([
        chrome.tabs.sendMessage(targetTabId, { action, data }),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Message timeout')), 15000)
        )
      ]);
      
      console.log(`📥 Success: ${action}`, result);
      return result;
      
    } catch (error) {
      attempts++;
      console.error(`❌ Attempt ${attempts} failed for ${action}:`, error.message);
      
      if (attempts >= maxAttempts) {
        // Thử tìm tab mới trước khi give up
        if (await findMatchingTab()) {
          console.log('🔄 Found new tab, retrying...');
          attempts = 0; // Reset attempts với tab mới
          continue;
        } else {
          console.error(`❌ All attempts failed for ${action}`);
          throw new Error(`Failed to send ${action} after ${maxAttempts} attempts`);
        }
      }
      
      // Đợi trước khi retry
      await new Promise(resolve => setTimeout(resolve, 2000 * attempts));
    }
  }
}

// ===== KEY FIX: Auto-detect và switch tab =====
async function setTargetTabFromCurrent() {
  try {
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tabs[0]?.id) {
      throw new Error("No active tab found");
    }
    
    targetTabId = tabs[0].id;
    targetTabUrl = tabs[0].url;
    
    console.log('🎯 Target tab set to:', targetTabId, targetTabUrl);
    await saveCurrentState();
    
    return { tabId: targetTabId, url: targetTabUrl };
  } catch (error) {
    console.error('❌ Error setting target tab:', error);
    throw error;
  }
}

// Enhanced delay function
async function delayWithProgress(seconds, actionName = 'action') {
  console.log(`⏳ Waiting ${seconds}s for ${actionName}...`);
  
  for (let i = 0; i < seconds && isRunning && isLoopRunning; i++) {
    const remaining = seconds - i;
    if (remaining % 10 === 0 || remaining <= 5) {
      console.log(`⌛ ${actionName}: ${remaining}s remaining...`);
    }
    
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Kiểm tra storage state mỗi 3 giây
    if (i % 3 === 0) {
      try {
        const currentState = await chrome.storage.local.get(['isRunning', 'targetTabId']);
        if (!currentState.isRunning || currentState.targetTabId === null) {
          console.log(`🛑 External stop detected during ${actionName} delay`);
          isRunning = false;
          isLoopRunning = false;
          break;
        }
      } catch (e) {
        // Ignore check errors
      }
    }
  }
  
  if (isRunning && isLoopRunning) {
    console.log(`✅ ${actionName} completed`);
  } else {
    console.log(`🛑 ${actionName} interrupted`);
  }
}

let isLoopRunning = false;
// ===== KEY FIX: Enhanced farming loop với better error handling =====
async function startBackgroundFarming() {
  console.log('🌾 Starting enhanced multi-tab farming...');

  if (isLoopRunning) {
    console.log('⚠️ Farming loop already running. Skipping...');
    return;
  }
  
  // KIỂM TRA lại trạng thái từ storage trước khi bắt đầu
  const currentState = await chrome.storage.local.get(['isRunning', 'targetTabId', 'targetTabUrl']);
  if (!currentState.isRunning) {
    console.log('🛑 isRunning = false in storage, aborting farming');
    return;
  }
  
  isLoopRunning = true;
  
  await createStateBackup();
  
  // Nếu không có target tab, thử tìm hoặc set từ current
  if (!targetTabId) {
    console.log('⚠️ No target tab, attempting to find or set...');
    try {
      if (!await findMatchingTab()) {
        await setTargetTabFromCurrent();
      }
    } catch (error) {
      console.error('❌ Cannot establish target tab:', error);
      isLoopRunning = false;
      
      // Retry sau 30 giây
      setTimeout(() => {
        if (isRunning) {
          console.log('🔄 Retrying farming setup...');
          startBackgroundFarming();
        }
      }, 30000);
      return;
    }
  }
  
  let consecutiveErrors = 0;
  const maxConsecutiveErrors = 8;
  
  while (isRunning && isLoopRunning) {
    try {
      // KIỂM TRA trạng thái từ storage mỗi chu kỳ
      const stateCheck = await chrome.storage.local.get(['isRunning', 'targetTabId']);
      if (!stateCheck.isRunning) {
        console.log('🛑 External stop detected from storage');
        isRunning = false;
        break;
      }
      
      // Nếu targetTabId bị reset về null thì dừng
      if (stateCheck.targetTabId === null && targetTabId === null) {
        console.log('🛑 Target tab cleared, stopping farming');
        isRunning = false;
        break;
      }
      
      await loadSavedState(); // Sync state
      
      console.log('🔄 === MULTI-TAB FARMING CYCLE START ===');
      console.log(`🎯 Target: Tab ${targetTabId} (${targetTabUrl})`);
      
      consecutiveErrors = 0;
      
      // Auto Buy Seed (one-time)
      if (toggleStates.toggle2 && automationSettings.seedBuy?.length > 0) {
        console.log('🛒 Auto Buy Seed');
        try {
          const buyResult = await sendActionToTargetTab("buySeed", automationSettings.seedBuy);
          if (buyResult?.success) {
            console.log('✅ Seeds purchased');
            await delayWithProgress(3, 'seed purchase');
          }
          
          // Tắt toggle sau khi mua
          toggleStates.toggle2 = false;
          await chrome.storage.local.set({ toggle2: false });
          await saveCurrentState();
          console.log('🔄 Auto Buy disabled after purchase');
          
        } catch (err) {
          console.error("❌ Error in auto buy seed:", err);
          try {
            await sendActionToTargetTab("SHOW_LOG", {
              text: `❌ Lỗi mua seed: ${err.message}`
            });
          } catch (logErr) {
            console.error("❌ Cannot show log:", logErr);
          }
        }
      }
      
      // Kiểm tra lại trạng thái trước mỗi action
      if (!isRunning || !isLoopRunning) break;
      
      // Auto Plant
      if (toggleStates.toggle1 && automationSettings.seedOrder?.length > 0) {
        console.log('🌱 Step 2: Auto plant execution');
        try {
          const plantResult = await sendActionToTargetTab("plant", automationSettings.seedOrder);
          if (plantResult?.success) {
            console.log('✅ Planting completed successfully');
            await delayWithProgress(timePlanting, 'planting process');
          } else {
            console.log('⚠️ Planting may not have completed fully');
            await delayWithProgress(3, 'planting fallback');
          }
        } catch (err) {
          console.error("❌ Error in auto plant:", err);
          try {
            await sendActionToTargetTab("SHOW_LOG", {
              text: `❌ Lỗi trồng cây: ${err.message}`
            });
          } catch (logErr) {
            console.error("❌ Cannot show log:", logErr);
          }
        }
      }
      
      // Kiểm tra lại trạng thái
      if (!isRunning || !isLoopRunning) break;
      
      // Auto Cook
      if (toggleStates.toggle3 && automationSettings.dishNumber) {
        console.log('🍳 Step 3: Auto cook execution');
        try {
          const cookResult = await sendActionToTargetTab("cook", automationSettings.dishNumber);
          if (cookResult?.success) {
            console.log('✅ Cooking completed successfully');  
            await delayWithProgress(timeCooking, 'cooking process');
          } else {
            console.log('⚠️ Cooking may not have completed fully');
            await delayWithProgress(3, 'cooking fallback');
          }
        } catch (err) {
          console.error("❌ Error in auto cook:", err);
          try {
            await sendActionToTargetTab("SHOW_LOG", {
              text: `❌ Lỗi nấu ăn: ${err.message}`
            });
          } catch (logErr) {
            console.error("❌ Cannot show log:", logErr);
          }
        }
      }
      
      // Kiểm tra lại trạng thái
      if (!isRunning || !isLoopRunning) break;
      
      // Auto Chop
      if (toggleStates.toggle4) {
        console.log('🪓 Step 4: Auto chop execution');
        try {
          const chopResult = await sendActionToTargetTab("chop");
          if (chopResult?.success) {
            console.log('✅ Chopping completed successfully');
            await delayWithProgress(timeChopping, 'chopping process');
          } else {
            console.log('⚠️ Chopping may not have completed fully');
            await delayWithProgress(3, 'chopping fallback');
          }
        } catch (err) {
          console.error("❌ Error in auto chop:", err);
          try {
            await sendActionToTargetTab("SHOW_LOG", {
              text: `❌ Lỗi chặt cây: ${err.message}`
            });
          } catch (logErr) {
            console.error("❌ Cannot show log:", logErr);
          }
        }
      }
      
      console.log('✅ === FARMING CYCLE COMPLETED ===');
      
      // Kiểm tra lại trạng thái trước delay
      if (!isRunning || !isLoopRunning) break;
      
      // Cycle delay
      const delayMinutes = parseInt(automationSettings.delayMinutes) || 0;
      const delaySeconds = parseInt(automationSettings.delaySeconds) || 30;
      const cycleDelay = delayMinutes * 60 + delaySeconds;
      
      await logToTargetTab(
        delayMinutes > 0 
          ? `⏳ Đợi ${delayMinutes}m ${delaySeconds}s đến chu kỳ mới...`
          : `⏳ Đợi ${delaySeconds}s đến chu kỳ mới...`
      );

      // Enhanced cycle delay với state monitoring
      for (let i = 0; i < cycleDelay && isRunning && isLoopRunning; i++) {
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // Check state every 5 seconds
        if (i % 5 === 0) {
          try {
            const currentState = await chrome.storage.local.get(['isRunning', 'targetTabId']);
            if (!currentState.isRunning || currentState.targetTabId === null) {
              console.log('🛑 External stop detected during delay');
              isRunning = false;
              isLoopRunning = false;
              break;
            }
          } catch (e) {
            console.error('❌ State check error:', e);
          }
        }
      }
      
    } catch (error) {
      consecutiveErrors++;
      console.error(`❌ Farming cycle error (${consecutiveErrors}/${maxConsecutiveErrors}):`, error.message);
      
      // Kiểm tra nếu error do targetTab bị clear
      if (error.message.includes('No valid target tab') || !targetTabId) {
        console.log('🛑 Target tab cleared, stopping farming');
        break;
      }
      
      if (consecutiveErrors >= maxConsecutiveErrors) {
        console.log('🚨 Too many errors, attempting recovery...');
        
        const restored = await restoreFromBackup('consecutive_errors');
        if (restored && await findMatchingTab()) {
          consecutiveErrors = 0;
          console.log('✅ Recovery successful');
        } else {
          console.log('❌ Recovery failed, longer pause...');
          await new Promise(resolve => setTimeout(resolve, 120000)); // 2 phút
          consecutiveErrors = Math.max(0, consecutiveErrors - 3);
        }
      } else {
        // Exponential backoff
        await new Promise(resolve => setTimeout(resolve, 5000 * Math.pow(2, consecutiveErrors - 1)));
      }
    }
  }
  
  console.log('🛑 Multi-tab farming stopped');
  isLoopRunning = false;
}

// Helper function để log an toàn
async function logToTargetTab(message) {
  try {
    await sendActionToTargetTab("SHOW_LOG", { text: message });
  } catch (e) {
    console.log('⚠️ Cannot send log to target tab:', message);
  }
}

// ===== KEY FIX: Enhanced tab event listeners =====
chrome.tabs.onRemoved.addListener(async (tabId) => {
  if (tabId === targetTabId) {
    console.log('⚠️ Target tab closed, searching replacement...');
    const found = await findMatchingTab();
    if (!found && isRunning) {
      console.log('⚠️ No replacement found, automation continues but waiting for suitable tab');
    }
  }
});

chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  if (tabId === targetTabId && changeInfo.status === 'complete') {
    console.log('🔄 Target tab reloaded, re-validating...');
    await validateTargetTab();
  }
  
  // Auto-detect new game tabs
  if (changeInfo.status === 'complete' && !targetTabId && isRunning) {
    const url = tab.url?.toLowerCase() || '';
    const gameKeywords = ['game', 'farm', 'play', 'sunwin', 'fishing'];
    if (gameKeywords.some(keyword => url.includes(keyword))) {
      console.log('🎮 Auto-detected new game tab:', tab.id);
      targetTabId = tab.id;
      targetTabUrl = tab.url;
      await saveCurrentState();
    }
  }
});

// Toggle validation
async function checkToggle() {
  await loadSavedState();
  
  const errorMessages = [];
  const allTogglesOff = !toggleStates.toggle1 && !toggleStates.toggle2 && !toggleStates.toggle3 && !toggleStates.toggle4;
  
  if (allTogglesOff) {
    isRunning = false;
    await chrome.storage.local.set({ isRunning: false, startButtonOn: false });
    await logToTargetTab("⚠️ Không có chế độ nào được bật. Automation đã dừng.");
    return { success: false, error: "Không có chế độ tự động nào được bật", autoStopped: true };
  }

  let hasValidToggle = false;

  if (toggleStates.toggle1) {
    if (!automationSettings.seedOrder || automationSettings.seedOrder.length === 0) {
      errorMessages.push("❌ Auto Plant thiếu seedOrder");
    } else {
      hasValidToggle = true;
    }
  }

  if (toggleStates.toggle2) {
    if (!automationSettings.seedBuy || automationSettings.seedBuy.length === 0) {
      errorMessages.push("❌ Auto Buy Seed thiếu seedBuy");
    } else {
      hasValidToggle = true;
    }
  }

  if (toggleStates.toggle3) {
    if (!automationSettings.dishNumber || automationSettings.dishNumber === "0") {
      errorMessages.push("❌ Auto Cook chưa chọn món");
    } else {
      hasValidToggle = true;
    }
  }

  if (toggleStates.toggle4) {
    hasValidToggle = true;
  }

  if (errorMessages.length > 0) {
    await logToTargetTab(errorMessages.join('\n') + '\n⚠️ Kiểm tra cấu hình!');
  }

  return { success: hasValidToggle, errors: errorMessages };
}


// Message listener
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log('📨 Message received:', request.action);
  
  switch (request.action) {
    case 'START_AUTOMATION':
      (async () => {
        try {
          await loadSavedState();
          
          const toggleCheck = await checkToggle();
          if (!toggleCheck.success) {
            sendResponse({ 
              success: false, 
              error: toggleCheck.error || "Toggle validation failed",
              autoStopped: toggleCheck.autoStopped || false,
              errors: toggleCheck.errors || []
            });
            return;
          }

          // Tự động tìm tab nếu chưa có
          if (!targetTabId) {
            if (!await findMatchingTab()) {
              await setTargetTabFromCurrent();
            }
          }
          
          isRunning = true;
          await saveCurrentState();
          startBackgroundFarming();
          sendResponse({ success: true, targetTabId });
          
        } catch (error) {
          console.error('❌ START_AUTOMATION error:', error);
          sendResponse({ success: false, error: error.message });
        }
      })();
      return true;
      
    case 'STOP_AUTOMATION':
      (async () => {
        isRunning = false;
        await saveCurrentState();
        sendResponse({ success: true });
      })();
      return true;
      
    case 'SET_TARGET_TAB':
      setTargetTabFromCurrent()
        .then((result) => sendResponse({ success: true, ...result }))
        .catch(error => sendResponse({ success: false, error: error.message }));
      return true;
      
    case 'GET_TARGET_TAB':
      sendResponse({ success: true, targetTabId, targetTabUrl });
      break;
      
    case 'UPDATE_TOGGLE':
      (async () => {
        await loadSavedState();
        toggleStates[request.toggleId] = request.isOn;
        await saveCurrentState();
        sendResponse({ success: true });
      })();
      return true;
      
    case 'UPDATE_SETTINGS':
      (async () => {
        await loadSavedState();
        automationSettings = { ...automationSettings, ...request.settings };
        await saveCurrentState();
        sendResponse({ success: true });
      })();
      return true;

    // TClear settings
    case 'CLEAR_SETTINGS':
      (async () => {
        try {
          console.log('🧹 CLEAR_SETTINGS bắt đầu...');
          
           justCleared = true; // Đánh dấu vừa clear

          await chrome.storage.local.set({ recentlyClear: true });
          // BƯỚC 1: Xóa hoàn toàn backup cũ trong storage TRƯỚC
          await chrome.storage.local.remove(['stateBackup']);
          console.log('🗑️ Đã xóa backup cũ trong storage');
           
          isRunning = false;
          isLoopRunning = false; // Dừng loop đang chạy

          // BƯỚC 2: Reset biến toggleStates trong memory
          toggleStates = {
            toggle1: false,
            toggle2: false,
            toggle3: false,
            toggle4: false
          };
          isRunning = false;
          targetTabId = null;
          targetTabUrl = null;
          automationSettings = {};

          // BƯỚC 3: Reset stateBackup object trong memory
          stateBackup = {
            isRunning: false,
            toggleStates: {
              toggle1: false,
              toggle2: false,
              toggle3: false,
              toggle4: false
            },
            automationSettings: {},
            targetTabId: null,
            targetTabUrl: null,
            timestamp: Date.now()
          };
          console.log('🔄 Đã reset stateBackup object:', stateBackup);

          // BƯỚC 4: Xóa tất cả storage
          await chrome.storage.local.remove([
            'toggle1', 'toggle2', 'toggle3', 'toggle4',
            'startButtonOn', 'isRunning', 
            'automationSettings', 'targetTabId', 'targetTabUrl',
            'popup_toggleStates', 'popup_isRunning',
            'controller_automationSettings',
            'controller_seedOrderInput', 'controller_seedBuyInput',
            'controller_dishNumberInput', 'controller_delayMinutes',
            'controller_delaySeconds', 'controller_autoBuyIfOutOfStock'
          ]);
          console.log('🗑️ Đã xóa tất cả storage');

          // BƯỚC 5: Lưu trạng thái mới (reset) vào storage
          await chrome.storage.local.set({
            isRunning: false,
            automationSettings: {},
            startButtonOn: false,
            targetTabId: null,
            targetTabUrl: null,
            toggle1: false,
            toggle2: false,
            toggle3: false,
            toggle4: false,
            stateBackup: stateBackup // Lưu backup mới
          });
          console.log('💾 Đã lưu trạng thái reset vào storage');

          // BƯỚC 6: Kiểm tra lại storage để đảm bảo
          const verification = await chrome.storage.local.get(['stateBackup', 'targetTabId', 'targetTabUrl']);
          console.log('✅ Verification after clear:', verification);

          // BƯỚC 7: Đặt flag tạm thời để tránh restore ngay sau clear

          setTimeout(async () => {
            justCleared = false;
            await chrome.storage.local.remove(['recentlyClear']);
            console.log('🔄 Clear protection flag removed');
          }, 30000); // 30 giây

          console.log('🧹 CLEAR_SETTINGS hoàn tất thành công');
          sendResponse({ success: true });

        } catch (err) {
          console.error('❌ CLEAR_SETTINGS thất bại:', err);
          sendResponse({ success: false, error: err.message });
        }
      })();
      return true;
      
    case 'GET_CURRENT_STATE':
      (async () => {
        await loadSavedState();
        sendResponse({ 
          isRunning, 
          toggleStates, 
          automationSettings,
          startButtonOn: isRunning,
          targetTabId,
          targetTabUrl
        });
      })();
      return true;
      
    case 'RESTORE_FROM_BACKUP':
      restoreFromBackup('manual_request')
        .then(restored => sendResponse({ success: restored }))
        .catch(error => sendResponse({ success: false, error: error.message }));
      return true;
      
    default:
      sendResponse({ success: false, error: 'Unknown action' });
  }
});

// ===== KEY FIX: Enhanced keepAlive system =====
chrome.alarms.create('keepAlive', { periodInMinutes: 0.3 });
chrome.alarms.create('tabMonitor', { periodInMinutes: 1 });
chrome.alarms.create('stateBackup', { periodInMinutes: 2 });

chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name === 'keepAlive') {
    console.log('💓 Service worker heartbeat');
  }
  
  if (alarm.name === 'tabMonitor') {
    // Monitor target tab health
    if (targetTabId && isRunning) {
      const isValid = await validateTargetTab();
      if (!isValid) {
        console.log('🔍 Tab monitor: searching for replacement...');
        await findMatchingTab();
      }
    }
  }
  
  if (alarm.name === 'stateBackup') {
    await createStateBackup();
  }
});

// Window focus handling
chrome.windows.onFocusChanged.addListener(async (windowId) => {
  if (windowId !== chrome.windows.WINDOW_ID_NONE && isRunning) {
    console.log('🔄 Window focus changed, syncing state...');
    await loadSavedState();
    await createStateBackup();
  }
});

// Debug object
globalThis.backgroundDebug = {
  getState: () => ({ 
    isRunning, 
    toggleStates, 
    automationSettings, 
    targetTabId, 
    targetTabUrl,
    stateBackup,
    isLoopRunning
  }),
  forceStart: () => {
    isRunning = true;
    saveCurrentState();
    startBackgroundFarming();
  },
  forceStop: () => {
    isRunning = false;
    saveCurrentState();
  },
  findTab: findMatchingTab,
  validateTab: validateTargetTab,
  setCurrentTab: setTargetTabFromCurrent,
  clearStorage: () => chrome.storage.local.clear(),
  createBackup: createStateBackup,
  restoreBackup: () => restoreFromBackup('manual'),
  getBackup: () => stateBackup,
   simulateError: () => {
    targetTabId = 999999; // Invalid tab ID
    console.log('🧪 Simulated error - invalid tab ID set');
  }
};

console.log('🌐 Enhanced Multi-tab Background Service Initialized');
console.log('🚀 Features: Multi-tab support, Auto tab detection, Background operation');
console.log('🔧 Debug: backgroundDebug object available');