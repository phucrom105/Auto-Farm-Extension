// controller.js - Enhanced version với background communication và checkbox visibility logic
// Sync với background script để duy trì trạng thái

// Communication với background script
function sendToBackground(action, data = {}) {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage({ action, ...data }, (response) => {
      if (chrome.runtime.lastError) {
        reject(chrome.runtime.lastError);
      } else if (response?.success) {
        resolve(response);
      } else {
        reject(new Error(response?.error || 'Unknown error'));
      }
    });
  });
}

// Load current state from background
async function loadCurrentState() {
  try {
    const state = await sendToBackground('GET_CURRENT_STATE');
    console.log('📋 Loaded current state:', state);
    
    // Update UI based on current state
    updateStartButton(state.isRunning || state.startButtonOn);
    updateToggleButtons(state.toggleStates);
    
    return state;
  } catch (error) {
    console.error('❌ Error loading current state:', error);
    return null;
  }
}

// Update start button UI và xử lý visibility của checkbox
function updateStartButton(isRunning) {
  const startBtn = document.getElementById("startBtn");
  if (!startBtn) return;
  
  startBtn.classList.toggle("on", isRunning);
  startBtn.classList.toggle("off", !isRunning);
  startBtn.textContent = isRunning ? "🚀 Start: ON" : "🚀 Start: OFF";
  
  const statusIndicator = document.getElementById("statusIndicator");
  if (statusIndicator) {
    statusIndicator.classList.toggle("active", isRunning);
  }
  
  // Xử lý visibility của checkbox "Automation buy seed when sold out"
  handleCheckboxVisibility(isRunning);
}

// Xử lý ẩn/hiện checkbox dựa trên trạng thái Start và checkbox với smooth animation
function handleCheckboxVisibility(isStartRunning) {
  const autoPlantOptions = document.getElementById("autoPlantOptions");
  const autoBuyCheckbox = document.getElementById("autoBuyIfOutOfStock");
  
  if (!autoPlantOptions || !autoBuyCheckbox) return;
  
  // Remove previous classes
  autoPlantOptions.classList.remove('hidden', 'visible-checked', 'slide-in');
  
  if (isStartRunning) {
    // Nếu Start ON: ẩn checkbox trừ khi checkbox đang được checked
    if (autoBuyCheckbox.checked) {
      // Checkbox đang checked → hiện với special styling
      autoPlantOptions.style.display = "block";
      autoPlantOptions.classList.add('visible-checked', 'slide-in');
      console.log('🔄 Checkbox visible with highlight (checked and start running)');
    } else {
      // Checkbox không checked → ẩn với animation
      autoPlantOptions.classList.add('hidden');
      setTimeout(() => {
        if (autoPlantOptions.classList.contains('hidden')) {
          autoPlantOptions.style.display = "none";
        }
      }, 400); // Match CSS transition duration
      console.log('🔄 Checkbox hidden with animation (unchecked and start running)');
    }
  } else {
    // Nếu Start OFF: luôn hiện checkbox với animation
    autoPlantOptions.style.display = "block";
    autoPlantOptions.classList.add('slide-in');
    console.log('🔄 Checkbox visible with animation (start not running)');
  }
}

// Update toggle buttons UI
function updateToggleButtons(toggleStates) {
  Object.entries(toggleStates).forEach(([toggleId, isOn]) => {
    const btn = document.getElementById(toggleId);
    if (!btn) return;
    
    btn.classList.toggle("on", isOn);
    btn.classList.toggle("off", !isOn);
    
    // Update button text based on ID
    const labels = {
      toggle1: '🌱 Auto Plant',
      toggle2: '🛒 Auto Buy Seed', 
      toggle3: '🍳 Auto Cook',
      toggle4: '🪓 Auto Chop'
    };
    
    btn.textContent = `${labels[toggleId]}: ${isOn ? "ON" : "OFF"}`;
  });
}

// Setup toggle với background sync
function setupToggle(id, label) {
  const btn = document.getElementById(id);
  if (!btn) return;

  btn.addEventListener('click', async () => {
    const wasOn = btn.classList.contains('on');
    const isOn = !wasOn;
    
    try {
      // Update background state
      await sendToBackground('UPDATE_TOGGLE', { toggleId: id, isOn });
      
      // Update UI
      btn.classList.toggle('on', isOn);
      btn.classList.toggle('off', !isOn);
      btn.textContent = `${label}: ${isOn ? "ON" : "OFF"}`;
      
      console.log(`✅ ${label} toggled to ${isOn ? "ON" : "OFF"}`);
    } catch (error) {
      console.error(`❌ Error toggling ${label}:`, error);
      // Revert UI if background update failed
      btn.classList.toggle('on', wasOn);
      btn.classList.toggle('off', !wasOn);
      btn.textContent = `${label}: ${wasOn ? "ON" : "OFF"}`;
    }
  });
}

// Setup all toggles
setupToggle('toggle1', '🌱 Auto Plant');
setupToggle('toggle2', '🛒 Auto Buy Seed');
setupToggle('toggle3', '🍳 Auto Cook');
setupToggle('toggle4', '🪓 Auto Chop');

// Setup start button với background communication
const startBtn = document.getElementById("startBtn");
if (startBtn) {
  startBtn.addEventListener("click", async () => {
    const wasRunning = startBtn.classList.contains("on");
    const willRun = !wasRunning;
    
    try {
      if (willRun) {
        // Nếu auto buy seed được bật, thực hiện mua seed trước
        const toggle2 = document.getElementById("toggle2");
        if (toggle2?.classList.contains("on")) {
          console.log('🛒 Auto buying seeds before start...');
          await sendToBackground('AUTO_BUY_SEED');
          
          // Tắt auto buy seed sau khi mua
          await sendToBackground('UPDATE_TOGGLE', { toggleId: 'toggle2', isOn: false });
          toggle2.classList.remove("on");
          toggle2.classList.add("off");
          toggle2.textContent = "🛒 Auto Buy Seed: OFF";
        }
        
        await sendToBackground('START_AUTOMATION');
        console.log('🚀 Automation started via background');
        
        // Lưu trạng thái start button vào storage
        chrome.storage.local.set({ startButtonOn: true });
      } else {
        await sendToBackground('STOP_AUTOMATION');
        console.log('🛑 Automation stopped via background');
        
        // Lưu trạng thái start button vào storage
        chrome.storage.local.set({ startButtonOn: false });
      }
      
      updateStartButton(willRun);
      
    } catch (error) {
      console.error('❌ Error toggling automation:', error);
      alert('❌ Lỗi khi thay đổi trạng thái automation!');
    }
  });
}

// Setup checkbox event listener để xử lý visibility
function setupCheckboxListener() {
  const autoBuyCheckbox = document.getElementById("autoBuyIfOutOfStock");
  if (!autoBuyCheckbox) return;
  
  autoBuyCheckbox.addEventListener('change', () => {
    console.log('🔄 Checkbox state changed:', autoBuyCheckbox.checked);
    
    // Chỉ cập nhật visibility nếu Start đang chạy
    const startBtn = document.getElementById("startBtn");
    if (startBtn?.classList.contains("on")) {
      handleCheckboxVisibility(true);
    }
    
    // Lưu trạng thái checkbox vào storage
    chrome.storage.local.set({ 
      autoBuyIfOutOfStock: autoBuyCheckbox.checked 
    });
  });
}

// Load trạng thái checkbox từ storage
function loadCheckboxState() {
  chrome.storage.local.get(['autoBuyIfOutOfStock'], (result) => {
    const autoBuyCheckbox = document.getElementById("autoBuyIfOutOfStock");
    if (autoBuyCheckbox && result.autoBuyIfOutOfStock !== undefined) {
      autoBuyCheckbox.checked = result.autoBuyIfOutOfStock;
      console.log('🔄 Restored checkbox state:', result.autoBuyIfOutOfStock);
    }
  });
}

// Test connection function
async function testConnection() {
  try {
    const state = await loadCurrentState();
    if (state) {
      console.log('✅ Background connection OK');
      return true;
    }
  } catch (error) {
    console.error('❌ Background connection failed:', error);
    return false;
  }
}

// Initialize when DOM loads
document.addEventListener('DOMContentLoaded', async () => {
  console.log('🎮 Enhanced Controller initializing...');
  
  // Setup checkbox listener
  setupCheckboxListener();
  
  // Load checkbox state
  loadCheckboxState();
  
  // Test connection and load state
  await testConnection();
  
  // Load trạng thái start button từ storage
  chrome.storage.local.get(['startButtonOn'], ({ startButtonOn }) => {
    if (startButtonOn !== undefined) {
      updateStartButton(startButtonOn);
      console.log('🔄 Restored start button state:', startButtonOn);
    }
  });
  
  // Setup periodic state sync (every 30 seconds)
  setInterval(async () => {
    try {
      await loadCurrentState();
    } catch (error) {
      console.error('❌ Periodic sync failed:', error);
    }
  }, 30000);
});

// Export debug object
window.controllerDebug = {
  loadCurrentState,
  sendToBackground,
  testConnection,
  updateUI: async () => {
    const state = await loadCurrentState();
    if (state) {
      updateStartButton(state.isRunning);
      updateToggleButtons(state.toggleStates);
    }
  },
  toggleCheckboxVisibility: () => {
    const startBtn = document.getElementById("startBtn");
    const isRunning = startBtn?.classList.contains("on") || false;
    handleCheckboxVisibility(isRunning);
  },
  getCheckboxState: () => {
    const checkbox = document.getElementById("autoBuyIfOutOfStock");
    return checkbox ? checkbox.checked : false;
  }
};

console.log('🎮 Enhanced Controller loaded');
console.log('🔧 Debug: window.controllerDebug');