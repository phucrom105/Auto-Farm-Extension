// popup.js - Enhanced với background sync
// Chỉ xử lý settings và sync với background script

// Communication với background script
function sendToBackground(action, data = {}) {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage({ action, ...data }, (response) => {
      if (chrome.runtime.lastError) {
        reject(chrome.runtime.lastError);
      } else if (response?.success !== false) {
        resolve(response);
      } else {
        reject(new Error(response?.error || 'Unknown error'));
      }
    });
  });
}

const inputMap = {
  toggle1: 'autoPlantInputs',
  toggle2: 'autoBuySeedInputs', 
  toggle3: 'autoCookInputs',
  toggle4: 'autoChopInputs',
};

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

// Load settings from background
async function loadSettings() {
  try {
    const state = await sendToBackground('GET_CURRENT_STATE');
    const settings = state.automationSettings || {};
    
    console.log('📋 Loading settings from background:', settings);
    
    // Load seed order
    const seedOrderInput = document.getElementById('seedOrderInput');
    if (seedOrderInput && settings.seedOrder) {
      seedOrderInput.value = settings.seedOrder.join(',');
    }
    
    // Load seed buy
    const seedBuyInput = document.getElementById('seedBuyInput');
    if (seedBuyInput && settings.seedBuy) {
      seedBuyInput.value = settings.seedBuy.join(',');
    }
    
    // Load dish number
    const dishNumberInput = document.getElementById('dishNumberInput');
    if (dishNumberInput && settings.dishNumber) {
      dishNumberInput.value = settings.dishNumber;
    }
  
    //load automation buy seed
    const autoBuyCheckbox = document.getElementById("autoBuyIfOutOfStock");
    if (autoBuyCheckbox && settings.autoBuyIfOutOfStock !== undefined) {
      autoBuyCheckbox.checked = settings.autoBuyIfOutOfStock;
    }
        
    
    // ✅ Thêm phần load delayMinutes và delaySeconds
    if (settings.delayMinutes !== undefined) {
    document.getElementById('delayMinutes').value = settings.delayMinutes;
    }
    if (settings.delaySeconds !== undefined) {
    document.getElementById('delaySeconds').value = settings.delaySeconds;
    }

  } catch (error) {
    console.error('❌ Error loading settings:', error);
  }
}

// Load toggle states from background
async function loadToggleStates() {
  try {
    const state = await sendToBackground('GET_CURRENT_STATE');
    const toggleStates = state.toggleStates || {};
    
    console.log('🔘 Loading toggle states from background:', toggleStates);
    
    Object.entries(toggleStates).forEach(([toggleId, isOn]) => {
      const toggleBtn = document.getElementById(toggleId);
      
      if (toggleBtn) {
        toggleBtn.classList.toggle('on', isOn);
        toggleBtn.classList.toggle('off', !isOn);
        
        // Update input visibility
        const inputId = inputMap[toggleId];
        if (inputId) {
          toggleInputVisibility(toggleId, inputId);
        }
      }
    });
    
  } catch (error) {
    console.error('❌ Error loading toggle states:', error);
  }
}

// Watch for toggle changes to update input visibility
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
}

// Save settings to background
async function saveSettings() {
  try {
    const seedOrderStr = document.getElementById('seedOrderInput')?.value || '';
    const seedBuyStr = document.getElementById('seedBuyInput')?.value || '';
    const dishNumber = parseInt(document.getElementById('dishNumberInput')?.value || '1');
    const autoBuyIfOutOfStock = document.getElementById("autoBuyIfOutOfStock")?.checked || false;

    // Parse and validate data
    const settings = {
      seedOrder: parseInputArray(seedOrderStr),
      seedBuy: parseInputArray(seedBuyStr),
      dishNumber: isNaN(dishNumber) ? 1 : dishNumber,
      autoBuyIfOutOfStock: !!autoBuyIfOutOfStock,
    };

    const delayMinutes = parseInt(document.getElementById('delayMinutes')?.value || '0');
    const delaySeconds = parseInt(document.getElementById('delaySeconds')?.value || '0');

    settings.delayMinutes = isNaN(delayMinutes) ? 0 : delayMinutes;
    settings.delaySeconds = isNaN(delaySeconds) ? 30 : delaySeconds;

    console.log('💾 Saving settings to background:', settings);

    // Send to background
    await sendToBackground('UPDATE_SETTINGS', { settings });
    
    console.log('✅ Settings saved successfully');
    alert('✅ Đã lưu settings thành công!');
    
  } catch (error) {
    console.error('❌ Error saving settings:', error);
    alert('❌ Lỗi khi lưu settings!');
  }
}

// Clear settings
async function clearSettings() {
  if (confirm('🗑️ Xóa tất cả settings đã lưu?')) {
    try {
      const emptySettings = {
        seedOrder: [],
        seedBuy: [],
        dishNumber: 1,
      };
      
      await sendToBackground('UPDATE_SETTINGS', { settings: emptySettings });
      
      // Clear input fields
      document.getElementById('seedOrderInput').value = '';
      document.getElementById('seedBuyInput').value = '';
      document.getElementById('dishNumberInput').value = '1';
      
      console.log('🗑️ Settings cleared');
      alert('🗑️ Đã xóa settings!');
      
    } catch (error) {
      console.error('❌ Error clearing settings:', error);
      alert('❌ Lỗi khi xóa settings!');
    }
  }
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', async () => {
  console.log('🎮 Enhanced Popup initializing...');
  
  // Load current state from background
  await Promise.all([
    loadSettings(),
    loadToggleStates()
  ]);
  

  // Đồng bộ lại UI toggle sau khi load xong
try {
  const state = await sendToBackground('GET_CURRENT_STATE');

  // Tự cập nhật toggle trạng thái bằng tay
  Object.entries(state.toggleStates || {}).forEach(([toggleId, isOn]) => {
    const btn = document.getElementById(toggleId);
    if (!btn) return;
    btn.classList.toggle("on", isOn);
    btn.classList.toggle("off", !isOn);
    const labels = {
      toggle1: '🌱 Auto Plant',
      toggle2: '🛒 Auto Buy Seed',
      toggle3: '🍳 Auto Cook',
      toggle4: '🪓 Auto Chop'
    };
    btn.textContent = `${labels[toggleId]}: ${isOn ? "ON" : "OFF"}`;
  });

  // Cập nhật nút Start (nếu bạn cần hiển thị thêm trong popup)
  const startBtn = document.getElementById("startBtn");
  if (startBtn) {
    const isRunning = state.isRunning || state.startButtonOn;
    startBtn.classList.toggle("on", isRunning);
    startBtn.classList.toggle("off", !isRunning);
    startBtn.textContent = isRunning ? "🚀 Start: ON" : "🚀 Start: OFF";
  }

} catch (err) {
  console.error('❌ Error syncing UI from background:', err);
}


  // Watch for toggle changes
  watchToggleChanges();
  
  // Setup save button
  const saveBtn = document.getElementById('saveBtn');
  if (saveBtn) {
    saveBtn.addEventListener('click', saveSettings);
  }
  
  // Setup clear button
  const clearBtn = document.getElementById('clearBtn');
  if (clearBtn) {
    clearBtn.addEventListener('click', clearSettings);
  }
  
  console.log('✅ Enhanced Popup initialized');
});

// Export debug utilities
window.popupDebug = {
  loadSettings,
  loadToggleStates,
  saveSettings,
  clearSettings,
  sendToBackground,
  getCurrentState: () => sendToBackground('GET_CURRENT_STATE')
};
