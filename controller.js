// controller.js - Enhanced version with auto-save and robust data persistence
// Tự động lưu dữ liệu input và xử lý mất kết nối background

// Communication với background script với timeout và retry
function sendToBackground(action, data = {}, retries = 2) {
  return new Promise(async (resolve, reject) => {
    for (let attempt = 1; attempt <= retries; attempt++) {
      try {
        const timeout = setTimeout(() => {
          reject(new Error(`Background communication timeout (attempt ${attempt})`));
        }, 5000);
        
        chrome.runtime.sendMessage({ action, ...data }, (response) => {
          clearTimeout(timeout);
          
          if (chrome.runtime.lastError) {
            if (attempt === retries) {
              reject(chrome.runtime.lastError);
            }
            return; // Try next attempt
          } else if (response?.success) {
            resolve(response);
          } else if (response?.success === false) {
            reject(new Error(response?.error || 'Unknown error'));
          } else {
            // Assume success if no explicit false
            resolve(response || { success: true });
          }
        });
        
        break; // Success, exit retry loop
        
      } catch (error) {
        console.warn(`⚠️ Background communication attempt ${attempt} failed:`, error);
        
        if (attempt === retries) {
          reject(error);
        } else {
          // Wait before retry
          await new Promise(resolve => setTimeout(resolve, 200 * attempt));
        }
      }
    }
  });
}


// ============ STATE MANAGEMENT với AUTO-SAVE ============
let currentState = {
  isRunning: false,
  toggleStates: {
    toggle1: false,
    toggle2: false,
    toggle3: false,
    toggle4: false
  },
  automationSettings: {
    seedOrder: [],
    seedBuy: [],
    dishNumber: 0,
    delayMinutes: 0,
    delaySeconds: 30,
    autoBuyIfOutOfStock: false
  }
};

// Input fields mapping for auto-save
const inputFieldsMap = {
  'seedOrderInput': 'seedOrder',
  'seedBuyInput': 'seedBuy',
  'dishNumberInput': 'dishNumber',
  'delayMinutes': 'delayMinutes',
  'delaySeconds': 'delaySeconds',
  'autoBuyIfOutOfStock': 'autoBuyIfOutOfStock'
};

// Auto-save debounced function
let autoSaveTimeout = null;
function scheduleAutoSave() {
  if (autoSaveTimeout) {
    clearTimeout(autoSaveTimeout);
  }
  
  autoSaveTimeout = setTimeout(() => {
    autoSaveCurrentInputs();
  }, 1000); // Lưu sau 1 giây khi người dùng ngừng nhập
}

// Tự động lưu tất cả input hiện tại
async function autoSaveCurrentInputs() {
  try {
    const settings = await collectCurrentSettings();
    
    // Lưu vào chrome storage trực tiếp (primary)
    await chrome.storage.local.set({
      'controller_seedOrderInput': settings.seedOrderStr,
      'controller_seedBuyInput': settings.seedBuyStr,
      'controller_dishNumberInput': settings.dishNumber.toString(),
      'controller_delayMinutes': settings.delayMinutes.toString(),
      'controller_delaySeconds': settings.delaySeconds.toString(),
      'controller_autoBuyIfOutOfStock': settings.autoBuyIfOutOfStock,
      'controller_lastSaved': Date.now(),
      'controller_automationSettings': settings // Lưu toàn bộ settings
    });
    
    // Update local state
    currentState.automationSettings = {
      seedOrder: parseInputArray(settings.seedOrderStr),
      seedBuy: parseInputArray(settings.seedBuyStr),
      dishNumber: settings.dishNumber,
      delayMinutes: settings.delayMinutes,
      delaySeconds: settings.delaySeconds,
      autoBuyIfOutOfStock: settings.autoBuyIfOutOfStock
    };
    
    console.log('💾 Auto-saved controller inputs to storage:', settings);
    
    // Cố gắng sync với background (không quan trọng nếu fail)
    try {
      await sendToBackground('UPDATE_SETTINGS', { 
        settings: currentState.automationSettings 
      });
      console.log('✅ Also synced to background');
    } catch (bgError) {
      console.warn('⚠️ Background sync failed (not critical):', bgError);
    }
    
    // Show auto-save indicator
    showAutoSaveIndicator();
    
  } catch (error) {
    console.error('❌ Auto-save failed:', error);
  }
}

// Thu thập settings hiện tại từ các input
async function collectCurrentSettings() {
  const seedOrderInput = document.getElementById('seedOrderInput');
  const seedBuyInput = document.getElementById('seedBuyInput');
  const dishNumberInput = document.getElementById('dishNumberInput');
  const delayMinutesInput = document.getElementById('delayMinutes');
  const delaySecondsInput = document.getElementById('delaySeconds');
  const autoBuyCheckbox = document.getElementById('autoBuyIfOutOfStock');

  const seedOrderStr = seedOrderInput?.value || '';
  const seedBuyStr = seedBuyInput?.value || '';
  const dishNumberStr = dishNumberInput?.value || '0';
  const delayMinutesStr = delayMinutesInput?.value || '0';
  const delaySecondsStr = delaySecondsInput?.value || '30';
  const autoBuyIfOutOfStock = autoBuyCheckbox?.checked || false;

  return {
    seedOrderStr,
    seedBuyStr,
    dishNumber: parseInt(dishNumberStr) || 0,
    delayMinutes: parseInt(delayMinutesStr) || 0,
    delaySeconds: parseInt(delaySecondsStr) || 30,
    autoBuyIfOutOfStock
  };
}

// Parse comma-separated string to array
function parseInputArray(str) {
  if (!str) return [];
  return str
    .split(',')
    .map(s => parseInt(s.trim()))
    .filter(n => !isNaN(n));
}

// Show auto-save indicator
function showAutoSaveIndicator() {
  // Remove existing indicators
  const existingIndicators = document.querySelectorAll('.auto-save-indicator');
  existingIndicators.forEach(indicator => indicator.remove());
  
  const indicator = document.createElement('div');
  indicator.className = 'auto-save-indicator';
  indicator.innerHTML = '💾 Auto-saved';
  indicator.style.cssText = `
    position: fixed;
    top: 10px;
    right: 10px;
    background: #4CAF50;
    color: white;
    padding: 4px 8px;
    border-radius: 4px;
    font-size: 12px;
    z-index: 10000;
    opacity: 0;
    transition: opacity 0.3s;
  `;
  
  document.body.appendChild(indicator);
  
  // Show animation
  setTimeout(() => indicator.style.opacity = '1', 10);
  
  // Hide after 2 seconds
  setTimeout(() => {
    indicator.style.opacity = '0';
    setTimeout(() => {
      if (indicator.parentNode) {
        indicator.remove();
      }
    }, 300);
  }, 2000);
}

// Khôi phục dữ liệu input từ storage
async function restoreInputsFromStorage() {
  try {
    console.log('📂 Restoring controller inputs from storage...');
    
    const result = await chrome.storage.local.get([
      'controller_seedOrderInput',
      'controller_seedBuyInput',
      'controller_dishNumberInput',
      'controller_delayMinutes',
      'controller_delaySeconds',
      'controller_autoBuyIfOutOfStock',
      'controller_automationSettings',
      'controller_lastSaved'
    ]);
    
    if (result.controller_lastSaved) {
      const lastSaved = new Date(result.controller_lastSaved);
      console.log('📅 Last saved:', lastSaved.toLocaleString());
    }
    
    // Khôi phục từng input nếu element tồn tại
    if (result.controller_seedOrderInput !== undefined) {
      const seedOrderInput = document.getElementById('seedOrderInput');
      if (seedOrderInput) {
        seedOrderInput.value = result.controller_seedOrderInput;
        console.log('🌱 Restored seed order:', result.controller_seedOrderInput);
      }
    }
    
    if (result.controller_seedBuyInput !== undefined) {
      const seedBuyInput = document.getElementById('seedBuyInput');
      if (seedBuyInput) {
        seedBuyInput.value = result.controller_seedBuyInput;
        console.log('🛒 Restored seed buy:', result.controller_seedBuyInput);
      }
    }
    
    if (result.controller_dishNumberInput !== undefined) {
      const dishNumberInput = document.getElementById('dishNumberInput');
      if (dishNumberInput) {
        dishNumberInput.value = result.controller_dishNumberInput;
        console.log('🍳 Restored dish number:', result.controller_dishNumberInput);
      }
    }
    
    if (result.controller_delayMinutes !== undefined) {
      const delayMinutesInput = document.getElementById('delayMinutes');
      if (delayMinutesInput) {
        delayMinutesInput.value = result.controller_delayMinutes;
        console.log('⏱️ Restored delay minutes:', result.controller_delayMinutes);
      }
    }
    
    if (result.controller_delaySeconds !== undefined) {
      const delaySecondsInput = document.getElementById('delaySeconds');
      if (delaySecondsInput) {
        delaySecondsInput.value = result.controller_delaySeconds;
        console.log('⏱️ Restored delay seconds:', result.controller_delaySeconds);
      }
    }
    
    if (result.controller_autoBuyIfOutOfStock !== undefined) {
      const autoBuyCheckbox = document.getElementById('autoBuyIfOutOfStock');
      if (autoBuyCheckbox) {
        autoBuyCheckbox.checked = result.controller_autoBuyIfOutOfStock;
        console.log('☑️ Restored auto buy checkbox:', result.controller_autoBuyIfOutOfStock);
      }
    }
    
    // Update local state with restored settings
    if (result.controller_automationSettings) {
      currentState.automationSettings = {
        ...currentState.automationSettings,
        ...result.controller_automationSettings
      };
      console.log('⚙️ Restored automation settings to local state');
    }
    
    console.log('✅ All controller inputs restored from storage');
    
  } catch (error) {
    console.error('❌ Error restoring controller inputs from storage:', error);
  }
}

// Load current state from background với enhanced fallback
async function loadCurrentState(retries = 3) {
  // Luôn khôi phục từ storage trước
  await restoreInputsFromStorage();
  
  for (let i = 0; i < retries; i++) {
    try {
      console.log(`📋 Loading current state from background (attempt ${i + 1}/${retries})...`);
      
      if (i > 0) {
        await new Promise(resolve => setTimeout(resolve, 200 * i));
      }
      
      const state = await sendToBackground('GET_CURRENT_STATE');
      
      if (state) {
        // Merge với local state, ưu tiên background data nếu có
        const previousState = { ...currentState };
        
        currentState = {
          isRunning: state.isRunning || state.startButtonOn || false,
          toggleStates: state.toggleStates || currentState.toggleStates,
          automationSettings: state.automationSettings || currentState.automationSettings
        };
        
        console.log('✅ State loaded successfully from background:', currentState);
        
        // Chỉ update UI nếu có thay đổi
        if (JSON.stringify(previousState) !== JSON.stringify(currentState)) {
          updateAllUI();
          
          // Sync input fields with background data nếu khác
          await syncInputFieldsWithBackgroundData(state.automationSettings);
        }
        
        return currentState;
      }
    } catch (error) {
      console.error(`❌ Error loading state from background (attempt ${i + 1}):`, error);
      if (i === retries - 1) {
        console.log('🔄 Using fallback: localStorage + current state');
        await loadFromLocalStorage();
      }
    }
  }
  return currentState;
}

(async () => {
  const state = await loadCurrentState();

  // Nếu isRunning bị false nhưng backup có thể còn
  if (!state.isRunning) {
    const result = await chrome.storage.local.get('stateBackup');
    if (result.stateBackup?.isRunning) {
      console.log('🔁 Triggering restore from backup due to unexpected OFF state...');
      await sendToBackground('RESTORE_FROM_BACKUP');
      await loadCurrentState(); // Load lại sau khôi phục
    }
  }
})();

// Sync input fields với background data
async function syncInputFieldsWithBackgroundData(automationSettings) {
  if (!automationSettings) return;
  
  let hasUpdates = false;
  
  try {
    // Sync seed order
    if (automationSettings.seedOrder && automationSettings.seedOrder.length > 0) {
      const seedOrderInput = document.getElementById('seedOrderInput');
      const expectedValue = automationSettings.seedOrder.join(',');
      if (seedOrderInput && seedOrderInput.value !== expectedValue) {
        seedOrderInput.value = expectedValue;
        hasUpdates = true;
        console.log('🔄 Synced seed order from background:', expectedValue);
      }
    }
    
    // Sync seed buy
    if (automationSettings.seedBuy && automationSettings.seedBuy.length > 0) {
      const seedBuyInput = document.getElementById('seedBuyInput');
      const expectedValue = automationSettings.seedBuy.join(',');
      if (seedBuyInput && seedBuyInput.value !== expectedValue) {
        seedBuyInput.value = expectedValue;
        hasUpdates = true;
        console.log('🔄 Synced seed buy from background:', expectedValue);
      }
    }
    
    // Sync other fields
    const fieldsToSync = [
      { id: 'dishNumberInput', key: 'dishNumber', transform: String },
      { id: 'delayMinutes', key: 'delayMinutes', transform: String },
      { id: 'delaySeconds', key: 'delaySeconds', transform: String },
      { id: 'autoBuyIfOutOfStock', key: 'autoBuyIfOutOfStock', transform: Boolean, isCheckbox: true }
    ];
    
    fieldsToSync.forEach(({ id, key, transform, isCheckbox }) => {
      if (automationSettings[key] !== undefined) {
        const element = document.getElementById(id);
        if (element) {
          const expectedValue = transform(automationSettings[key]);
          const currentValue = isCheckbox ? element.checked : element.value;
          
          if (currentValue !== expectedValue) {
            if (isCheckbox) {
              element.checked = expectedValue;
            } else {
              element.value = expectedValue;
            }
            hasUpdates = true;
            console.log(`🔄 Synced ${key} from background:`, expectedValue);
          }
        }
      }
    });
    
    // Auto-save nếu có updates để đồng bộ storage
    if (hasUpdates) {
      scheduleAutoSave();
    }
    
  } catch (error) {
    console.error('❌ Error syncing input fields with background data:', error);
  }
}

// Fallback: Load from localStorage với improved handling
async function loadFromLocalStorage() {
  try {
    const result = await chrome.storage.local.get([
      'isRunning', 'startButtonOn', 'toggle1', 'toggle2', 'toggle3', 'toggle4', 
      'automationSettings'
    ]);
    
    currentState.isRunning = result.isRunning || result.startButtonOn || false;
    currentState.toggleStates = {
      toggle1: result.toggle1 || false,
      toggle2: result.toggle2 || false,
      toggle3: result.toggle3 || false,
      toggle4: result.toggle4 || false
    };
    
    // Merge với automation settings đã restore
    if (result.automationSettings) {
      currentState.automationSettings = {
        ...currentState.automationSettings,
        ...result.automationSettings
      };
    }
    
    console.log('📦 Loaded from localStorage as fallback:', currentState);
    updateAllUI();
  } catch (error) {
    console.error('❌ Error loading from localStorage:', error);
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
      // Lắng nghe các events
      input.addEventListener('input', scheduleAutoSave);
      input.addEventListener('change', scheduleAutoSave);
      input.addEventListener('blur', scheduleAutoSave);
      console.log(`👂 Auto-save listener added for ${inputId}`);
    }
  });
  
  // Checkbox riêng biệt
  const autoBuyCheckbox = document.getElementById('autoBuyIfOutOfStock');
  if (autoBuyCheckbox) {
    autoBuyCheckbox.addEventListener('change', () => {
      scheduleAutoSave();
      // Cũng xử lý visibility nếu Start đang chạy
      if (currentState.isRunning) {
        handleCheckboxVisibility(true);
      }
    });
    console.log('👂 Auto-save listener added for autoBuyIfOutOfStock');
  }
  
  console.log('✅ Auto-save listeners setup for all inputs');
}

// Update all UI components
function updateAllUI() {
  updateStartButton(currentState.isRunning);
  updateToggleButtons(currentState.toggleStates);
}

// Show notification
function showNotification(message, type = 'info') {
  const existingNotifications = document.querySelectorAll('.notification');
  existingNotifications.forEach(n => n.remove());
  
  const notification = document.createElement('div');
  notification.className = `notification ${type}`;
  notification.textContent = message;
  
  document.body.insertBefore(notification, document.body.firstChild);
  
  setTimeout(() => {
    if (notification.parentNode) {
      notification.remove();
    }
  }, 3000);
}

// Update start button UI với enhanced logic
function updateStartButton(isRunning) {
  const startBtn = document.getElementById("startBtn");
  if (!startBtn) return;
  
  startBtn.classList.remove("on", "off");
  startBtn.classList.add(isRunning ? "on" : "off");
  startBtn.textContent = isRunning ? "🚀 Start: ON" : "🚀 Start: OFF";
  
  const statusIndicator = document.getElementById("statusIndicator");
  if (statusIndicator) {
    statusIndicator.classList.toggle("active", isRunning);
  }
  
  handleCheckboxVisibility(isRunning);
  
  console.log(`🔄 Start button updated: ${isRunning ? "ON" : "OFF"}`);
}

// Xử lý ẩn/hiện checkbox
function handleCheckboxVisibility(isStartRunning) {
  const autoPlantOptions = document.getElementById("autoPlantOptions");
  const autoBuyCheckbox = document.getElementById("autoBuyIfOutOfStock");
  
  if (!autoPlantOptions || !autoBuyCheckbox) return;
  
  autoPlantOptions.classList.remove('hidden', 'visible-checked', 'slide-in');
  
  if (isStartRunning) {
    if (autoBuyCheckbox.checked) {
      autoPlantOptions.style.display = "block";
      autoPlantOptions.classList.add('visible-checked', 'slide-in');
      console.log('🔄 Checkbox visible with highlight (checked and start running)');
    } else {
      autoPlantOptions.classList.add('hidden');
      setTimeout(() => {
        if (autoPlantOptions.classList.contains('hidden')) {
          autoPlantOptions.style.display = "none";
        }
      }, 400);
      console.log('🔄 Checkbox hidden with animation (unchecked and start running)');
    }
  } else {
    autoPlantOptions.style.display = "block";
    autoPlantOptions.classList.add('slide-in');
    console.log('🔄 Checkbox visible with animation (start not running)');
  }
}

// Update toggle buttons UI
function updateToggleButtons(toggleStates) {
  const labels = {
    toggle1: '🌱 Auto Plant',
    toggle2: '🛒 Auto Buy Seed', 
    toggle3: '🍳 Auto Cook',
    toggle4: '🪓 Auto Chop'
  };
  
  Object.entries(toggleStates).forEach(([toggleId, isOn]) => {
    const btn = document.getElementById(toggleId);
    if (!btn) {
      console.warn(`⚠️ Toggle button ${toggleId} not found`);
      return;
    }
    
    btn.classList.remove("on", "off");
    btn.classList.add(isOn ? "on" : "off");
    btn.textContent = `${labels[toggleId]}: ${isOn ? "ON" : "OFF"}`;
    
    console.log(`🔄 ${labels[toggleId]} updated: ${isOn ? "ON" : "OFF"}`);
  });
}

// Setup toggle với enhanced error handling và auto-save
function setupToggle(id, label) {
  const btn = document.getElementById(id);
  if (!btn) {
    console.warn(`⚠️ Toggle button ${id} not found during setup`);
    return;
  }

  btn.addEventListener('click', async () => {
    const wasOn = btn.classList.contains('on');
    const isOn = !wasOn;
    
    // Optimistic UI update
    btn.classList.remove('on', 'off');
    btn.classList.add(isOn ? 'on' : 'off');
    btn.textContent = `${label}: ${isOn ? "ON" : "OFF"}`;
    btn.disabled = true;
    
    try {
      // Auto-save current inputs before toggle
      await autoSaveCurrentInputs();
      
      // Update background state
      await sendToBackground('UPDATE_TOGGLE', { toggleId: id, isOn });
      
      // Update local state
      currentState.toggleStates[id] = isOn;
      
      // Auto-save state to storage
      await chrome.storage.local.set({ [id]: isOn });
      
      console.log(`✅ ${label} toggled to ${isOn ? "ON" : "OFF"}`);
      
    } catch (error) {
      console.error(`❌ Error toggling ${label}:`, error);
      
      // Revert UI
      btn.classList.remove('on', 'off');
      btn.classList.add(wasOn ? 'on' : 'off');
      btn.textContent = `${label}: ${wasOn ? "ON" : "OFF"}`;
      
      // Revert local state
      currentState.toggleStates[id] = wasOn;
      
      showNotification(`❌ Error toggling ${label}`, 'error');
    } finally {
      btn.disabled = false;
    }
  });
}

// Setup start button với enhanced logic và auto-save
function setupStartButton() {
  const startBtn = document.getElementById("startBtn");
  if (!startBtn) {
    console.warn('⚠️ Start button not found during setup');
    return;
  }

  startBtn.addEventListener("click", async () => {
    const wasRunning = startBtn.classList.contains("on");
    const willRun = !wasRunning;
    
    startBtn.disabled = true;
    startBtn.textContent = willRun ? "⏳ Starting..." : "⏳ Stopping...";
    
    try {
      // Auto-save current settings before start/stop
      console.log('💾 Auto-saving settings before start/stop...');
      await autoSaveCurrentInputs();
      
      if (willRun) {
        // Auto buy seed logic if enabled
        if (currentState.toggleStates?.toggle2) {
          console.log('🛒 Auto buying seeds before start...');
          try {
            await sendToBackground('AUTO_BUY_SEED');
            
            // Turn off auto buy seed after buying
            await sendToBackground('UPDATE_TOGGLE', { toggleId: 'toggle2', isOn: false });
            currentState.toggleStates.toggle2 = false;
            
            const toggle2 = document.getElementById("toggle2");
            if (toggle2) {
              toggle2.classList.remove("on");
              toggle2.classList.add("off");
              toggle2.textContent = "🛒 Auto Buy Seed: OFF";
            }
          } catch (buyError) {
            console.warn('⚠️ Auto buy seed failed:', buyError);
          }
        }
        
        await sendToBackground('START_AUTOMATION');
        console.log('🚀 Automation started via background');
      } else {
        await sendToBackground('STOP_AUTOMATION');
        console.log('🛑 Automation stopped via background');
      }
      
      // Update state and storage
      currentState.isRunning = willRun;
      await chrome.storage.local.set({ 
        isRunning: willRun,
        startButtonOn: willRun 
      });
      
      updateStartButton(willRun);
      
    } catch (error) {
      console.error('❌ Error toggling automation:', error);
      showNotification('❌ Error toggling automation: ' + error.message, 'error');
      updateStartButton(wasRunning);
      
      // Revert local state
      currentState.isRunning = wasRunning;
    } finally {
      startBtn.disabled = false;
    }
  });
}

// Test connection function
async function testConnection() {
  try {
    const state = await sendToBackground('GET_CURRENT_STATE');
    if (state) {
      console.log('✅ Background connection OK');
      return true;
    }
  } catch (error) {
    console.error('❌ Background connection failed:', error);
    return false;
  }
}

// Periodic state sync để đảm bảo consistency
async function periodicSync() {
  try {
    const freshState = await sendToBackground('GET_CURRENT_STATE');
    if (freshState) {
      // Check for state drift
      const hasStateDrift = freshState.isRunning !== currentState.isRunning ||
          JSON.stringify(freshState.toggleStates) !== JSON.stringify(currentState.toggleStates);
      
      const hasSettingsDrift = freshState.automationSettings && 
          JSON.stringify(freshState.automationSettings) !== JSON.stringify(currentState.automationSettings);
      
      if (hasStateDrift || hasSettingsDrift) {
        console.log('🔄 State drift detected, syncing...');
        
        const previousState = { ...currentState };
        
        currentState = {
          isRunning: freshState.isRunning || freshState.startButtonOn || false,
          toggleStates: freshState.toggleStates || currentState.toggleStates,
          automationSettings: freshState.automationSettings || currentState.automationSettings
        };
        
        // Update UI if changed
        if (JSON.stringify(previousState) !== JSON.stringify(currentState)) {
          updateAllUI();
        }
        
        // Sync input fields if settings changed
        if (hasSettingsDrift) {
          await syncInputFieldsWithBackgroundData(freshState.automationSettings);
        }
      }
    }
  } catch (error) {
    console.warn('⚠️ Periodic sync failed (not critical):', error);
  }
}

// Load checkbox state function
async function loadCheckboxState() {
  try {
    const result = await chrome.storage.local.get([
      'controller_autoBuyIfOutOfStock',
      'autoBuyIfOutOfStock'
    ]);
    
    const autoBuyCheckbox = document.getElementById('autoBuyIfOutOfStock');
    if (autoBuyCheckbox) {
      const checkboxState = result.controller_autoBuyIfOutOfStock !== undefined ? 
        result.controller_autoBuyIfOutOfStock : result.autoBuyIfOutOfStock || false;
      
      autoBuyCheckbox.checked = checkboxState;
      console.log('☑️ Loaded checkbox state:', checkboxState);
      
      // Handle visibility based on current running state
      handleCheckboxVisibility(currentState.isRunning);
    }
  } catch (error) {
    console.error('❌ Error loading checkbox state:', error);
  }
}

// Setup checkbox listener function
function setupCheckboxListener() {
  const autoBuyCheckbox = document.getElementById('autoBuyIfOutOfStock');
  if (autoBuyCheckbox) {
    autoBuyCheckbox.addEventListener('change', () => {
      scheduleAutoSave();
      // Handle visibility when start is running
      if (currentState.isRunning) {
        handleCheckboxVisibility(true);
      }
    });
    console.log('👂 Checkbox listener setup');
  }
}

// Initialize when DOM loads với proper loading order
document.addEventListener('DOMContentLoaded', async () => {
  console.log('🎮 Enhanced Controller initializing with proper state management...');
  
  try {
    // 1. Test connection first
    const connectionOK = await testConnection();
    if (!connectionOK) {
      console.warn('⚠️ Background connection issues, using fallback');
    }
    
    // 2. Load current state (with retries and fallback)
    await loadCurrentState();
    
    // 3. Load checkbox state
    await loadCheckboxState();
    
    // 4. Setup auto-save listeners BEFORE other listeners
    setupAutoSaveListeners();
    
    // 5. Setup all event listeners AFTER state is loaded
    setupStartButton();
    setupToggle('toggle1', '🌱 Auto Plant');
    setupToggle('toggle2', '🛒 Auto Buy Seed');
    setupToggle('toggle3', '🍳 Auto Cook');
    setupToggle('toggle4', '🪓 Auto Chop');
    setupCheckboxListener();
    
    // 6. Setup periodic sync (every 10 seconds instead of 30)
    setInterval(periodicSync, 10000);
    
    console.log('✅ Enhanced Controller initialized successfully');
    
  } catch (error) { 
    console.error('❌ Controller initialization failed:', error);
    
    // Emergency fallback - setup basic functionality
    try {
      console.log('🚨 Using emergency fallback...');
      await restoreInputsFromStorage();
      setupAutoSaveListeners(); // Ensure auto-save still works
      setupStartButton();
      setupToggle('toggle1', '🌱 Auto Plant');
      setupToggle('toggle2', '🛒 Auto Buy Seed');
      setupToggle('toggle3', '🍳 Auto Cook');
      setupToggle('toggle4', '🪓 Auto Chop');
      setupCheckboxListener();
    } catch (fallbackError) {
      console.error('❌ Emergency fallback also failed:', fallbackError);
    }
  }
});

// Thêm sau phần DOMContentLoaded event listener

// Auto-save when page is about to unload
window.addEventListener('beforeunload', () => {
  console.log('💾 Controller page closing, final auto-save...');
  try {
    autoSaveCurrentInputs();
  } catch (error) {
    console.error('❌ Final auto-save failed:', error);
  }
});

// Auto-save when visibility changes (tab switching)
document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    console.log('💾 Controller tab hidden, auto-saving...');
    try {
      autoSaveCurrentInputs();
    } catch (error) {
      console.error('❌ Visibility change auto-save failed:', error);
    }
  }
});

// Export debug object
window.controllerDebug = {
  currentState: () => currentState,
  loadCurrentState,
  sendToBackground,
  testConnection,
  updateAllUI,
  forceSync: periodicSync,
  toggleCheckboxVisibility: () => {
    handleCheckboxVisibility(currentState.isRunning);
  },
  getCheckboxState: () => {
    const checkbox = document.getElementById("autoBuyIfOutOfStock");
    return checkbox ? checkbox.checked : false;
  }
};

console.log('🎮 Enhanced Controller loaded with state persistence');
console.log('🔧 Debug: window.controllerDebug available');