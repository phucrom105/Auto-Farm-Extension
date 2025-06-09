// popup.js - Enhanced version with better state persistence
// Cải thiện việc lưu và khôi phục trạng thái khi gặp vấn đề connection

// Communication với background script với timeout và retry
function sendToBackground(action, data = {}, retries = 2) {
  return new Promise(async (resolve, reject) => {
    for (let attempt = 0; attempt < retries; attempt++) {
      try {
        const timeout = setTimeout(() => {
          throw new Error('Background communication timeout');
        }, 5000);
        
        const response = await new Promise((res, rej) => {
          chrome.runtime.sendMessage({ action, ...data }, (response) => {
            clearTimeout(timeout);
            
            if (chrome.runtime.lastError) {
              rej(chrome.runtime.lastError);
            } else if (response?.success !== false) {
              res(response);
            } else {
              rej(new Error(response?.error || 'Unknown error'));
            }
          });
        });
        
        return resolve(response);
        
      } catch (error) {
        console.warn(`❌ Background communication attempt ${attempt + 1} failed:`, error);
        
        if (attempt === retries - 1) {
          return reject(error);
        }
        
        // Wait before retry
        await new Promise(resolve => setTimeout(resolve, 500 * (attempt + 1)));
      }
    }
  });
}

const inputMap = {
  toggle1: 'autoPlantInputs',
  toggle2: 'autoBuySeedInputs', 
  toggle3: 'autoCookInputs',
  toggle4: 'autoChopInputs',
};

// Flag để track việc đang load state (tránh override không mong muốn)
let isLoadingState = false;


// Lưu trạng thái toggle vào storage với timestamp
async function saveToggleStates(source = 'user') {
  if (isLoadingState) {
    console.log('⚠️ Skip saving while loading state');
    return;
  }
  
  try {
    const toggleStates = {};
    let isRunning = false;
    
    // Thu thập trạng thái hiện tại của tất cả toggle
    ['toggle1', 'toggle2', 'toggle3', 'toggle4'].forEach(toggleId => {
      const toggleBtn = document.getElementById(toggleId);
      if (toggleBtn) {
        toggleStates[toggleId] = toggleBtn.classList.contains('on');
      }
    });
    
    // Thu thập trạng thái start button
    const startBtn = document.getElementById('startBtn');
    if (startBtn) {
      isRunning = startBtn.classList.contains('on');
    }
    
    const timestamp = Date.now();
    
    // Lưu vào chrome storage với timestamp và source
    await chrome.storage.local.set({
      'popup_toggleStates': toggleStates,
      'popup_isRunning': isRunning,
      'popup_stateLastSaved': timestamp,
      'popup_stateSource': source,
      'popup_stateVersion': timestamp // Version để detect conflicts
    });
    
    console.log(`💾 Toggle states saved to storage (${source}):`, { 
      toggleStates, 
      isRunning, 
      timestamp: new Date(timestamp).toLocaleTimeString() 
    });
    
  } catch (error) {
    console.error('❌ Error saving toggle states:', error);
  }
}

// Khôi phục trạng thái toggle từ storage với version check
async function restoreToggleStatesFromStorage() {
  try {
    const result = await chrome.storage.local.get([
      'popup_toggleStates',
      'popup_isRunning', 
      'popup_stateLastSaved',
      'popup_stateSource',
      'popup_stateVersion'
    ]);
    
    if (!result.popup_toggleStates) {
      console.log('📦 No toggle states found in storage');
      return false;
    }
    
    const toggleStates = result.popup_toggleStates;
    const isRunning = result.popup_isRunning || false;
    const lastSaved = result.popup_stateLastSaved;
    const source = result.popup_stateSource || 'unknown';
    
    if (lastSaved) {
      const timeAgo = Date.now() - lastSaved;
      console.log(`📅 Restoring toggle states saved ${Math.round(timeAgo/1000)}s ago (source: ${source})`);
    }
    
    const labels = {
      toggle1: '🌱 Auto Plant',
      toggle2: '🛒 Auto Buy Seed',
      toggle3: '🍳 Auto Cook',
      toggle4: '🪓 Auto Chop'
    };
    
    isLoadingState = true;
    
    // Khôi phục từng toggle
    Object.entries(toggleStates).forEach(([toggleId, isOn]) => {
      const toggleBtn = document.getElementById(toggleId);
      if (toggleBtn) {
        toggleBtn.classList.remove('on', 'off');
        toggleBtn.classList.add(isOn ? 'on' : 'off');
        toggleBtn.textContent = `${labels[toggleId]}: ${isOn ? "ON" : "OFF"}`;
        
        const inputId = inputMap[toggleId];
        if (inputId) {
          toggleInputVisibility(toggleId, inputId);
        }
        
        console.log(`🔄 Restored ${labels[toggleId]}: ${isOn ? "ON" : "OFF"}`);
      }
    });
    
    // Khôi phục start button
    const startBtn = document.getElementById('startBtn');
    if (startBtn) {
      startBtn.classList.remove('on', 'off');
      startBtn.classList.add(isRunning ? 'on' : 'off');
      startBtn.textContent = isRunning ? "🚀 Start: ON" : "🚀 Start: OFF";
      console.log(`🔄 Restored Start button: ${isRunning ? "ON" : "OFF"}`);
    }
    
    isLoadingState = false;
    
    console.log('✅ Toggle states restored from storage successfully');
    return { success: true, version: result.popup_stateVersion, source };
    
  } catch (error) {
    console.error('❌ Error restoring toggle states from storage:', error);
    isLoadingState = false;
    return false;
  }
}

// Auto-save debounced function để tránh lưu quá nhiều
let autoSaveTimeout = null;
function scheduleAutoSave() {
  if (autoSaveTimeout) {
    clearTimeout(autoSaveTimeout);
  }
  
  autoSaveTimeout = setTimeout(() => {
    autoSaveCurrentInputs();
  }, 1000); // Lưu sau 1 giây khi người dùng ngừng nhập
}

// Auto-save toggle states khi có thay đổi
let toggleSaveTimeout = null;
function scheduleToggleSave(source = 'user') {
  if (isLoadingState) {
    console.log('⚠️ Skip scheduling toggle save while loading');
    return;
  }
  
  if (toggleSaveTimeout) {
    clearTimeout(toggleSaveTimeout);
  }
  
  toggleSaveTimeout = setTimeout(() => {
    saveToggleStates(source);
  }, 300); // Lưu nhanh hơn cho toggle states
}

// Tự động lưu tất cả input hiện tại
async function autoSaveCurrentInputs() {
  try {
    const settings = await collectCurrentSettings();
    
    // Lưu vào chrome storage trực tiếp (không qua background)
    await chrome.storage.local.set({
      'popup_seedOrderInput': settings.seedOrderStr,
      'popup_seedBuyInput': settings.seedBuyStr,
      'popup_dishNumberInput': settings.dishNumber.toString(),
      'popup_delayMinutes': settings.delayMinutes.toString(),
      'popup_delaySeconds': settings.delaySeconds.toString(),
      'popup_autoBuyIfOutOfStock': settings.autoBuyIfOutOfStock,
      'popup_lastSaved': Date.now()
    });
    
    console.log('💾 Auto-saved inputs to storage');
    
    // Cũng cố gắng lưu vào background (nhưng không quan trọng nếu fail)
    try {
      await sendToBackground('UPDATE_SETTINGS', { settings: {
        seedOrder: parseInputArray(settings.seedOrderStr),
        seedBuy: parseInputArray(settings.seedBuyStr),
        dishNumber: settings.dishNumber,
        delayMinutes: settings.delayMinutes,
        delaySeconds: settings.delaySeconds,
        autoBuyIfOutOfStock: settings.autoBuyIfOutOfStock
      }}, 1); // Chỉ 1 retry cho background sync
      console.log('✅ Also synced to background');
    } catch (bgError) {
      console.warn('⚠️ Background sync failed (not critical):', bgError);
    }
    
  } catch (error) {
    console.error('❌ Auto-save failed:', error);
  }
}

// Thu thập tất cả settings hiện tại từ form
async function collectCurrentSettings() {
  const seedOrderStr = document.getElementById('seedOrderInput')?.value || '';
  const seedBuyStr = document.getElementById('seedBuyInput')?.value || '';
  const dishNumberStr = document.getElementById('dishNumberInput')?.value || '0';
  const delayMinutesStr = document.getElementById('delayMinutes')?.value || '0';
  const delaySecondsStr = document.getElementById('delaySeconds')?.value || '30';
  const autoBuyIfOutOfStock = document.getElementById("autoBuyIfOutOfStock")?.checked || false;

  return {
    seedOrderStr,
    seedBuyStr,
    dishNumber: parseInt(dishNumberStr) || 0,
    delayMinutes: parseInt(delayMinutesStr) || 0,
    delaySeconds: parseInt(delaySecondsStr) || 30,
    autoBuyIfOutOfStock
  };
}

// Show/hide input containers based on toggle state
function toggleInputVisibility(toggleId, inputId) {
  const inputContainer = document.getElementById(inputId);
  if (!inputContainer) return;
  
  const toggleBtn = document.getElementById(toggleId);
  const isOn = toggleBtn ? toggleBtn.classList.contains('on') : false;
  inputContainer.style.display = isOn ? 'block' : 'none';
}

// Parse comma-separated string to array
function parseInputArray(str) {
  return str
    .split(',')
    .map(s => parseInt(s.trim()))
    .filter(n => !isNaN(n));
}

// Khôi phục dữ liệu input từ storage trước
async function restoreInputsFromStorage() {
  try {
    console.log('📂 Restoring inputs from storage...');
    
    const result = await chrome.storage.local.get([
      'popup_seedOrderInput',
      'popup_seedBuyInput', 
      'popup_dishNumberInput',
      'popup_delayMinutes',
      'popup_delaySeconds',
      'popup_autoBuyIfOutOfStock',
      'popup_lastSaved'
    ]);
    
    if (result.popup_lastSaved) {
      const lastSaved = new Date(result.popup_lastSaved);
      console.log('📅 Last saved:', lastSaved.toLocaleString());
    }
    
    // Khôi phục từng input
    if (result.popup_seedOrderInput !== undefined) {
      const seedOrderInput = document.getElementById('seedOrderInput');
      if (seedOrderInput) {
        seedOrderInput.value = result.popup_seedOrderInput;
        console.log('🌱 Restored seed order:', result.popup_seedOrderInput);
      }
    }
    
    if (result.popup_seedBuyInput !== undefined) {
      const seedBuyInput = document.getElementById('seedBuyInput');
      if (seedBuyInput) {
        seedBuyInput.value = result.popup_seedBuyInput;
        console.log('🛒 Restored seed buy:', result.popup_seedBuyInput);
      }
    }
    
    if (result.popup_dishNumberInput !== undefined) {
      const dishNumberInput = document.getElementById('dishNumberInput');
      if (dishNumberInput) {
        dishNumberInput.value = result.popup_dishNumberInput;
        console.log('🍳 Restored dish number:', result.popup_dishNumberInput);
      }
    }
    
    if (result.popup_delayMinutes !== undefined) {
      const delayMinutesInput = document.getElementById('delayMinutes');
      if (delayMinutesInput) {
        delayMinutesInput.value = result.popup_delayMinutes;
        console.log('⏱️ Restored delay minutes:', result.popup_delayMinutes);
      }
    }
    
    if (result.popup_delaySeconds !== undefined) {
      const delaySecondsInput = document.getElementById('delaySeconds');
      if (delaySecondsInput) {
        delaySecondsInput.value = result.popup_delaySeconds;
        console.log('⏱️ Restored delay seconds:', result.popup_delaySeconds);
      }
    }
    
    if (result.popup_autoBuyIfOutOfStock !== undefined) {
      const autoBuyCheckbox = document.getElementById("autoBuyIfOutOfStock");
      if (autoBuyCheckbox) {
        autoBuyCheckbox.checked = result.popup_autoBuyIfOutOfStock;
        console.log('☑️ Restored auto buy checkbox:', result.popup_autoBuyIfOutOfStock);
      }
    }
    
    console.log('✅ All inputs restored from storage');
    return true;
    
  } catch (error) {
    console.error('❌ Error restoring inputs from storage:', error);
    return false;
  }
}

// Load settings from background với smart fallback
async function loadSettings(retries = 2) {
  // Luôn khôi phục từ storage trước
  console.log('📂 Restoring inputs from storage first...');
  await restoreInputsFromStorage();
  
  // Sau đó thử sync với background
  for (let i = 0; i < retries; i++) {
    try {
      console.log(`📋 Syncing with background (attempt ${i + 1}/${retries})...`);
      
      if (i > 0) {
        await new Promise(resolve => setTimeout(resolve, 300 * i));
      }
      
      const state = await sendToBackground('GET_CURRENT_STATE', {}, 1);
      const settings = state.automationSettings || {};
      
      console.log('📋 Loaded settings from background:', settings);
      
      // Chỉ cập nhật nếu background có dữ liệu mới hơn
      let hasBackgroundData = false;
      
      if (settings.seedOrder && settings.seedOrder.length > 0) {
        const seedOrderInput = document.getElementById('seedOrderInput');
        if (seedOrderInput && seedOrderInput.value !== settings.seedOrder.join(',')) {
          seedOrderInput.value = settings.seedOrder.join(',');
          hasBackgroundData = true;
        }
      }
      
      if (settings.seedBuy && settings.seedBuy.length > 0) {
        const seedBuyInput = document.getElementById('seedBuyInput');
        if (seedBuyInput && seedBuyInput.value !== settings.seedBuy.join(',')) {
          seedBuyInput.value = settings.seedBuy.join(',');
          hasBackgroundData = true;
        }
      }
      
      if (settings.dishNumber) {
        const dishNumberInput = document.getElementById('dishNumberInput');
        if (dishNumberInput && dishNumberInput.value !== settings.dishNumber.toString()) {
          dishNumberInput.value = settings.dishNumber;
          hasBackgroundData = true;
        }
      }
      
      if (settings.delayMinutes !== undefined) {
        const delayMinutesInput = document.getElementById('delayMinutes');
        if (delayMinutesInput && delayMinutesInput.value !== settings.delayMinutes.toString()) {
          delayMinutesInput.value = settings.delayMinutes;
          hasBackgroundData = true;
        }
      }
      
      if (settings.delaySeconds !== undefined) {
        const delaySecondsInput = document.getElementById('delaySeconds');
        if (delaySecondsInput && delaySecondsInput.value !== settings.delaySeconds.toString()) {
          delaySecondsInput.value = settings.delaySeconds;
          hasBackgroundData = true;
        }
      }
      
      if (settings.autoBuyIfOutOfStock !== undefined) {
        const autoBuyCheckbox = document.getElementById("autoBuyIfOutOfStock");
        if (autoBuyCheckbox && autoBuyCheckbox.checked !== settings.autoBuyIfOutOfStock) {
          autoBuyCheckbox.checked = settings.autoBuyIfOutOfStock;
          hasBackgroundData = true;
        }
      }
      
      if (hasBackgroundData) {
        console.log('🔄 Updated inputs from background data');
        // Auto-save lại để đồng bộ
        scheduleAutoSave();
      }

      console.log('✅ Settings loaded successfully');
      return; // Success, break retry loop
      
    } catch (error) {
      console.error(`❌ Error syncing with background (attempt ${i + 1}):`, error);
      
      if (i === retries - 1) {
        console.log('⚠️ Background sync failed, using storage data only');
      }
    }
  }
}

async function validateAndSyncState() {
  try {
    console.log('🔍 Validating state consistency...');
    
    // Lấy state từ background
    const bgState = await sendToBackground('GET_CURRENT_STATE', {}, 1);
    
    // Lấy state từ storage
    const storageResult = await chrome.storage.local.get([
      'popup_toggleStates',
      'popup_isRunning'
    ]);
    
    // So sánh và resolve conflicts
    const bgToggles = bgState.toggleStates || {};
    const storageToggles = storageResult.popup_toggleStates || {};
    const bgRunning = bgState.isRunning || false;
    const storageRunning = storageResult.popup_isRunning || false;
    
    // Kiểm tra conflicts
    let hasConflict = false;
    
    // Conflict resolution: Background state wins nếu automation đang chạy
    if (bgRunning && !storageRunning) {
      console.log('⚠️ Conflict: Background running but storage says stopped');
      hasConflict = true;
    }
    
    if (!bgRunning && storageRunning) {
      console.log('⚠️ Conflict: Storage says running but background stopped');  
      hasConflict = true;
    }
    
    if (hasConflict) {
      console.log('🔧 Resolving state conflict - using background state');
      await forceUpdateUIFromBackground(bgState);
      return true;
    }
    
    return false;
    
  } catch (error) {
    console.error('❌ State validation failed:', error);
    return false;
  }
}

// Force update UI from background state
async function forceUpdateUIFromBackground(bgState) {
  try {
    isLoadingState = true;
    
    const toggleStates = bgState.toggleStates || {};
    const isRunning = bgState.isRunning || false;
    
    const labels = {
      toggle1: '🌱 Auto Plant',
      toggle2: '🛒 Auto Buy Seed', 
      toggle3: '🍳 Auto Cook',
      toggle4: '🪓 Auto Chop'
    };
    
    // Update toggle buttons
    Object.entries(toggleStates).forEach(([toggleId, isOn]) => {
      const toggleBtn = document.getElementById(toggleId);
      if (toggleBtn) {
        toggleBtn.classList.remove('on', 'off');
        toggleBtn.classList.add(isOn ? 'on' : 'off');
        toggleBtn.textContent = `${labels[toggleId]}: ${isOn ? "ON" : "OFF"}`;
        
        const inputId = inputMap[toggleId];
        if (inputId) {
          toggleInputVisibility(toggleId, inputId);
        }
      }
    });
    
    // Update start button
    const startBtn = document.getElementById('startBtn');
    if (startBtn) {
      startBtn.classList.remove('on', 'off');
      startBtn.classList.add(isRunning ? 'on' : 'off');
      startBtn.textContent = isRunning ? "🚀 Start: ON" : "🚀 Start: OFF";
    }
    
    // Save corrected state to storage
    await saveToggleStates('conflict_resolution');
    
    isLoadingState = false;
    console.log('✅ UI forcefully updated from background state');
    
  } catch (error) {
    console.error('❌ Force update failed:', error);
    isLoadingState = false;
  }
}

// Load toggle states với smart restoration
async function loadToggleStates(retries = 2) {
  // Luôn khôi phục từ storage trước
  console.log('📦 Restoring toggle states from storage first...');
  const restoredFromStorage = await restoreToggleStatesFromStorage();

   // Validate state consistency
  const hasConflict = await validateAndSyncState();
  if (hasConflict) {
    console.log('🔧 State conflict resolved, skipping background sync');
    return;
  }
  
  // Sau đó thử sync với background  
  for (let i = 0; i < retries; i++) {
    try {
      console.log(`🔘 Syncing toggle states with background (attempt ${i + 1}/${retries})...`);
      
      if (i > 0) {
        await new Promise(resolve => setTimeout(resolve, 500 * i));
      }
      
      const state = await sendToBackground('GET_CURRENT_STATE', {}, 1);
      const toggleStates = state.toggleStates || {};
      const isRunning = state.isRunning || state.startButtonOn || false;
      
      console.log('🔘 Loaded toggle states from background:', toggleStates);
      console.log('🚀 Loaded start state from background:', isRunning);
      
      // Update toggle buttons
      const labels = {
        toggle1: '🌱 Auto Plant',
        toggle2: '🛒 Auto Buy Seed',
        toggle3: '🍳 Auto Cook',
        toggle4: '🪓 Auto Chop'
      };
      
      let hasBackgroundData = false;
      
      Object.entries(toggleStates).forEach(([toggleId, isOn]) => {
        const toggleBtn = document.getElementById(toggleId);
        
        if (toggleBtn) {
          const currentState = toggleBtn.classList.contains('on');
          
          // Chỉ update nếu khác với trạng thái hiện tại
          if (currentState !== isOn) {
            toggleBtn.classList.remove('on', 'off');
            toggleBtn.classList.add(isOn ? 'on' : 'off');
            toggleBtn.textContent = `${labels[toggleId]}: ${isOn ? "ON" : "OFF"}`;
            
            const inputId = inputMap[toggleId];
            if (inputId) {
              toggleInputVisibility(toggleId, inputId);
            }
            
            hasBackgroundData = true;
            console.log(`🔄 Updated ${labels[toggleId]}: ${isOn ? "ON" : "OFF"}`);
          }
        }
      });
      
      // Update start button
      const startBtn = document.getElementById("startBtn");
      if (startBtn) {
        const currentRunning = startBtn.classList.contains('on');
        
        if (currentRunning !== isRunning) {
          startBtn.classList.remove('on', 'off');
          startBtn.classList.add(isRunning ? 'on' : 'off');
          startBtn.textContent = isRunning ? "🚀 Start: ON" : "🚀 Start: OFF";
          hasBackgroundData = true;
          console.log(`🔄 Updated Start button: ${isRunning ? "ON" : "OFF"}`);
        }
      }
      
      if (hasBackgroundData) {
        // Lưu trạng thái mới vào storage
        scheduleToggleSave();
      }
      
      console.log('✅ Toggle states synced successfully');
      return;
      
    } catch (error) {
      console.error(`❌ Error syncing toggle states with background (attempt ${i + 1}):`, error);
      
      if (i === retries - 1) {
        if (restoredFromStorage) {
          console.log('⚠️ Background sync failed, using storage data');
        } else {
          console.log('❌ Both background and storage failed, using defaults');
          await setDefaultToggleStates();
        }
      }
    }
  }
}

// Set default toggle states nếu không có dữ liệu nào
async function setDefaultToggleStates() {
  const labels = {
    toggle1: '🌱 Auto Plant',
    toggle2: '🛒 Auto Buy Seed',
    toggle3: '🍳 Auto Cook',
    toggle4: '🪓 Auto Chop'
  };
  
  ['toggle1', 'toggle2', 'toggle3', 'toggle4'].forEach(toggleId => {
    const toggleBtn = document.getElementById(toggleId);
    if (toggleBtn) {
      toggleBtn.classList.remove('on', 'off');
      toggleBtn.classList.add('off');
      toggleBtn.textContent = `${labels[toggleId]}: OFF`;
      
      const inputId = inputMap[toggleId];
      if (inputId) {
        toggleInputVisibility(toggleId, inputId);
      }
    }
  });
  
  const startBtn = document.getElementById("startBtn");
  if (startBtn) {
    startBtn.classList.remove('on', 'off');
    startBtn.classList.add('off');
    startBtn.textContent = "🚀 Start: OFF";
  }
  
  console.log('🔄 Set default toggle states');
}

// Handle start button click với state persistence
async function handleStartButtonClick() {
  const startBtn = document.getElementById('startBtn');
  const isCurrentlyOn = startBtn.classList.contains('on');
  
  try {
    // Validate toggle states before starting
    if (!isCurrentlyOn) {
      const activeToggles = ['toggle1', 'toggle2', 'toggle3', 'toggle4'].filter(id => {
        const btn = document.getElementById(id);
        return btn && btn.classList.contains('on');
      });
      
      if (activeToggles.length === 0) {
        showTemporaryMessage('⚠️ Vui lòng bật ít nhất một chức năng auto!', 'error');
        return;
      }
      
      console.log('🚀 Starting automation with features:', activeToggles);
    }
    
    // Send command to background
    if (isCurrentlyOn) {
      await sendToBackground('STOP_AUTOMATION');
      console.log('⏹️ Sent stop command to background');
    } else {
      await sendToBackground('START_AUTOMATION');
      console.log('▶️ Sent start command to background');
    }
    
    // Wait a bit for background to process
    await new Promise(resolve => setTimeout(resolve, 500));
    
    // Force validation and sync
    const hasConflict = await validateAndSyncState();
    if (!hasConflict) {
      // Reload states để update UI
      await loadToggleStates(1);
    }
    
    console.log('✅ Start/Stop toggle completed');
    
  } catch (error) {
    console.error('❌ Error toggling start:', error);
    showTemporaryMessage('❌ Lỗi khi thay đổi trạng thái start', 'error');
    
    // Force reload states on error
    setTimeout(() => {
      loadToggleStates(1);
    }, 1000);
  }
}


// Setup auto-save listeners cho tất cả input
function setupAutoSaveListeners() {
  const inputIds = [
    'seedOrderInput',
    'seedBuyInput', 
    'dishNumberInput',
    'delayMinutes',
    'delaySeconds'
  ];
  
  inputIds.forEach(inputId => {
    const input = document.getElementById(inputId);
    if (input) {
      // Lắng nghe cả input và change events
      input.addEventListener('input', scheduleAutoSave);
      input.addEventListener('change', scheduleAutoSave);
      input.addEventListener('blur', scheduleAutoSave); // Khi rời khỏi input
    }
  });
  
  // Checkbox riêng biệt
  const autoBuyCheckbox = document.getElementById("autoBuyIfOutOfStock");
  if (autoBuyCheckbox) {
    autoBuyCheckbox.addEventListener('change', scheduleAutoSave);  
  }
  
  console.log('👂 Auto-save listeners setup for all inputs');
}

// Watch for toggle changes to update input visibility và auto-save
function watchToggleChanges() {
  const observer = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
      if (mutation.type === 'attributes' && 
          mutation.attributeName === 'class' &&
          mutation.target.id.startsWith('toggle')) {
        
        const toggleId = mutation.target.id;
        const inputId = inputMap[toggleId];
        if (inputId) {
          toggleInputVisibility(toggleId, inputId);
        }
        
        // Auto-save toggle states khi có thay đổi
        scheduleToggleSave();
      }
    });
  });

  // Observe all toggle buttons
  ['toggle1', 'toggle2', 'toggle3', 'toggle4'].forEach(id => {
    const element = document.getElementById(id);
    if (element) {
      observer.observe(element, { attributes: true });
    }
  });
  
  // Observe start button
  const startBtn = document.getElementById('startBtn');
  if (startBtn) {
    observer.observe(startBtn, { attributes: true });
  }
}

// Save settings to background
async function saveSettings() {
  try {
    const seedOrderStr = document.getElementById('seedOrderInput')?.value || '';
    const seedBuyStr = document.getElementById('seedBuyInput')?.value || '';
    const dishNumber = parseInt(document.getElementById('dishNumberInput')?.value || '0');
    const autoBuyIfOutOfStock = document.getElementById("autoBuyIfOutOfStock")?.checked || false;

    // Parse and validate data
    const settings = {
      seedOrder: parseInputArray(seedOrderStr),
      seedBuy: parseInputArray(seedBuyStr),
      dishNumber: isNaN(dishNumber) ? 0 : dishNumber,
      autoBuyIfOutOfStock: !!autoBuyIfOutOfStock,
    };

    const delayMinutes = parseInt(document.getElementById('delayMinutes')?.value || '0');
    const delaySeconds = parseInt(document.getElementById('delaySeconds')?.value || '0');

    settings.delayMinutes = isNaN(delayMinutes) ? 0 : delayMinutes;
    settings.delaySeconds = isNaN(delaySeconds) ? 30 : delaySeconds;

    console.log('💾 Saving settings to background:', settings);

    // Send to background
    await sendToBackground('UPDATE_SETTINGS', { settings });
    
    // Also save to storage immediately
    await autoSaveCurrentInputs();
    
    console.log('✅ Settings saved successfully');
    showTemporaryMessage('✅ Đã lưu settings thành công!', 'success');
    
  } catch (error) {
    console.error('❌ Error saving settings:', error);
    showTemporaryMessage('❌ Lỗi khi lưu settings!', 'error');
  }
}

// Clear settings
async function clearSettings() {
  if (confirm('🗑️ Xóa tất cả settings đã lưu?')) {
    try {
      const emptySettings = {
        seedOrder: [],
        seedBuy: [],
        dishNumber: 0,
        delayMinutes: 0,
        delaySeconds: 30,
        autoBuyIfOutOfStock: false
      };
      
      await sendToBackground('UPDATE_SETTINGS', { settings: emptySettings });
      
      // Clear local storage
      await chrome.storage.local.remove([
        'popup_seedOrderInput',
        'popup_seedBuyInput',
        'popup_dishNumberInput',
        'popup_delayMinutes',
        'popup_delaySeconds',
        'popup_autoBuyIfOutOfStock'
        ]);

      await sendToBackground('CLEAR_SETTINGS');
      
      await chrome.storage.local.set({
        userClearedState: true,
        lastClearTime: Date.now()
      });

      
      // Clear input fields
      document.getElementById('seedOrderInput').value = '';
      document.getElementById('seedBuyInput').value = '';
      document.getElementById('dishNumberInput').value = '0';
      document.getElementById('delayMinutes').value = '0';
      document.getElementById('delaySeconds').value = '30';
      
      const autoBuyCheckbox = document.getElementById("autoBuyIfOutOfStock");
      if (autoBuyCheckbox) {
        autoBuyCheckbox.checked = false;
      }
      
      // Reset toggle states
      await setDefaultToggleStates();
      
      console.log('🗑️ Settings cleared');
      showTemporaryMessage('🗑️ Đã xóa settings!', 'success');
      
    } catch (error) {
      console.error('❌ Error clearing settings:', error);
      showTemporaryMessage('❌ Lỗi khi xóa settings!', 'error');
    }
  }
}

// Show temporary message
function showTemporaryMessage(message, type = 'info') {
  // Remove existing messages
  const existingMessages = document.querySelectorAll('.temp-message');
  existingMessages.forEach(msg => msg.remove());
  
  const messageDiv = document.createElement('div');
  messageDiv.className = `temp-message ${type}`;
  messageDiv.textContent = message;
  messageDiv.style.cssText = `
    position: fixed;
    top: 10px;
    left: 50%;
    transform: translateX(-50%);
    padding: 8px 16px;
    border-radius: 4px;
    color: white;
    font-weight: bold;
    z-index: 10000;
    box-shadow: 0 4px 8px rgba(0,0,0,0.3);
    ${type === 'success' ? 'background: #4CAF50;' : 'background: #f44336;'}
  `;
  
  document.body.appendChild(messageDiv);
  
  setTimeout(() => {
    if (messageDiv.parentNode) {
      messageDiv.remove();
    }
  }, 3000);
}

// Periodic state check để đảm bảo đồng bộ
function startPeriodicStateCheck() {
  // Check mỗi 30 giây để đảm bảo trạng thái đồng bộ
  const intervalId = setInterval(async () => {
    try {
      console.log('🔄 Periodic state check...');
      await loadToggleStates(1); // Chỉ 1 retry để không spam
    } catch (error) {
      console.warn('⚠️ Periodic state check failed:', error);
    }
  }, 30000);
  
  // Cleanup when popup closes
  window.addEventListener('beforeunload', () => {
    clearInterval(intervalId);
  });
  
  console.log('⏰ Started periodic state check (every 30s)');
}



// Initialize when DOM is ready với improved loading sequence và state protection
document.addEventListener('DOMContentLoaded', async () => {
  console.log('🎮 Enhanced Popup initializing with improved state loading...');
  
  try {
    // QUAN TRỌNG: Luôn restore từ storage trước để bảo vệ trạng thái
    console.log('🛡️ Restoring states from storage first (protection mode)...');
    await restoreToggleStatesFromStorage();
    await restoreInputsFromStorage();
    
    // Setup auto-save listeners ngay sau khi restore
    setupAutoSaveListeners();
    
    // Đợi một chút để UI settle trước khi sync với background
    await new Promise(resolve => setTimeout(resolve, 200));
    
    // Chỉ sync với background nếu connection OK, không override storage states
    console.log('🔄 Attempting background sync (non-destructive)...');
    try {
      await loadToggleStates(1); // Chỉ 1 retry để không delay quá lâu
      await loadSettings(1);
    } catch (bgError) {
      console.warn('⚠️ Background sync failed, keeping storage states:', bgError);
      // KHÔNG làm gì cả - giữ nguyên trạng thái từ storage
    }
    
    // Watch for toggle changes sau khi đã load xong
    watchToggleChanges();
    
    // Setup buttons
    const saveBtn = document.getElementById('saveBtn');
    if (saveBtn) {
      saveBtn.addEventListener('click', saveSettings);
    }
    
    const clearBtn = document.getElementById('clearBtn');
    if (clearBtn) {
      clearBtn.addEventListener('click', clearSettings);
    }
    
    // Setup start button với protection
    const startBtn = document.getElementById('startBtn');
    if (startBtn) {
      startBtn.addEventListener('click', handleStartButtonClick);
    }
    
    // Start periodic state protection
    startPeriodicStateProtection();
    
    console.log('✅ Enhanced Popup initialized successfully with state protection');
    
  } catch (error) {
    console.error('❌ Popup initialization failed:', error);
    
    // Emergency fallback - chỉ dùng storage
    console.log('🚨 Emergency fallback - using storage only...');
    try {
      await restoreToggleStatesFromStorage();
      await restoreInputsFromStorage();
      setupAutoSaveListeners();
      watchToggleChanges();
      
      // Setup buttons trong fallback mode
      const saveBtn = document.getElementById('saveBtn');
      if (saveBtn) {
        saveBtn.addEventListener('click', saveSettings);
      }
      
      const clearBtn = document.getElementById('clearBtn');
      if (clearBtn) {
        clearBtn.addEventListener('click', clearSettings);
      }
      
      console.log('🛡️ Emergency fallback completed');
    } catch (fallbackError) {
      console.error('❌ Emergency fallback also failed:', fallbackError);
      // Set defaults as last resort
      await setDefaultToggleStates();
    }
  }
});

// Enhanced auto-save when popup is about to close với state protection
window.addEventListener('beforeunload', async () => {
  console.log('💾 Popup closing, saving current state...');
  
  try {
    // Lưu trạng thái hiện tại trước khi đóng
    await saveToggleStates('popup_close');
    await autoSaveCurrentInputs();
    
    // Đánh dấu popup đã đóng trong storage
    await chrome.storage.local.set({
      'popup_lastClosed': Date.now(),
      'popup_closedGracefully': true
    });
    
    console.log('✅ State saved before popup close');
  } catch (error) {
    console.error('❌ Error saving state before close:', error);
  }
});

// Periodic state protection để chống mất trạng thái
function startPeriodicStateProtection() {
  let protectionInterval = null;
  
  const protectState = async () => {
    try {
      // Validate state consistency every check
      await validateAndSyncState();
      
      // Existing protection logic...
      const result = await chrome.storage.local.get([
        'popup_stateLastSaved',
        'popup_lastClosed',
        'popup_closedGracefully'
      ]);
      
      const now = Date.now();
      const lastSaved = result.popup_stateLastSaved || 0;
      const timeSinceLastSave = now - lastSaved;
      
      // Nếu quá lâu không save (> 20s) và popup vẫn active
      if (timeSinceLastSave > 20000) {
        console.log('🛡️ Protective state save triggered');
        await saveToggleStates('protection');
        await autoSaveCurrentInputs();
      }
      
      // Enhanced connection check
      try {
        const response = await sendToBackground('PING', {}, 1);
        if (response && response.success) {
          console.log('💚 Background connection OK');
        } else {
          throw new Error('Invalid response');
        }
      } catch (connectionError) {
        console.warn('🔴 Background connection lost, running state validation...');
        await validateAndSyncState();
      }
      
    } catch (error) {
      console.warn('⚠️ State protection check failed:', error);
    }
  };
  
  // Chạy protection mỗi 10 giây (tăng tần suất)
  protectionInterval = setInterval(protectState, 10000);
  
  // Cleanup khi popup đóng
  window.addEventListener('beforeunload', () => {
    if (protectionInterval) {
      clearInterval(protectionInterval);
    }
  });
  
  console.log('🛡️ Enhanced state protection activated (every 10s)');
}

// Export debug utilities với state protection tools
window.popupDebug = {
  loadSettings,
  loadToggleStates,
  restoreInputsFromStorage,
  restoreToggleStatesFromStorage,
  autoSaveCurrentInputs,
  collectCurrentSettings,
  saveSettings,
  clearSettings,
  saveToggleStates,
  sendToBackground,
  getCurrentState: () => sendToBackground('GET_CURRENT_STATE'),
  forceReload: async () => {
    await loadToggleStates();
    await loadSettings();
  },
  showCurrentInputs: async () => {
    const settings = await collectCurrentSettings();
    console.log('📋 Current inputs:', settings);
    return settings;
  },
  // State protection tools
  forceStateProtection: async () => {
    await saveToggleStates('manual_protection');
    await autoSaveCurrentInputs();
    console.log('🛡️ Manual state protection executed');
  },
  showStorageState: async () => {
    const result = await chrome.storage.local.get();
    console.log('💾 Current storage state:', result);
    return result;
  },
  testConnection: async () => {
    try {
      const response = await sendToBackground('PING');
      console.log('✅ Connection test successful:', response);
      return true;
    } catch (error) {
      console.error('❌ Connection test failed:', error);
      return false;
    }
  }
};

console.log('🎮 Enhanced Popup loaded with state protection');
console.log('🔧 Debug: window.popupDebug available with protection tools');