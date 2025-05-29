// content.js - Enhanced content script for Sunflower Land automation
console.log("🌻 Sunflower Land Automation Content Script đã được inject!");

// Inject helper functions into page context
function injectGameHelpers() {
  const script = document.createElement('script');
  script.textContent = `
    // Helper functions injected into page context
    window.gameHelpers = {
      // Utility functions
      waitForElement: (selector, timeout = 5000) => {
        return new Promise((resolve, reject) => {
          const element = document.querySelector(selector);
          if (element) return resolve(element);
          
          const observer = new MutationObserver(() => {
            const element = document.querySelector(selector);
            if (element) {
              observer.disconnect();
              resolve(element);
            }
          });
          
          observer.observe(document.body, { childList: true, subtree: true });
          setTimeout(() => {
            observer.disconnect();
            reject(new Error('Element not found: ' + selector));
          }, timeout);
        });
      },

      // Random delay function
      randomDelay: (min = 1000, max = 3000) => {
        const delay = Math.floor(Math.random() * (max - min + 1)) + min;
        return new Promise(resolve => setTimeout(resolve, delay));
      },

      // Click with human-like behavior
      humanClick: async (element) => {
        if (!element) return false;
        
        // Scroll element into view
        element.scrollIntoView({ behavior: 'smooth', block: 'center' });
        await new Promise(resolve => setTimeout(resolve, 500));
        
        // Add slight random offset to click position
        const rect = element.getBoundingClientRect();
        const x = rect.left + (rect.width * (0.3 + Math.random() * 0.4));
        const y = rect.top + (rect.height * (0.3 + Math.random() * 0.4));
        
        // Create mouse events
        const mouseDown = new MouseEvent('mousedown', {
          clientX: x, clientY: y, bubbles: true
        });
        const mouseUp = new MouseEvent('mouseup', {
          clientX: x, clientY: y, bubbles: true
        });
        const click = new MouseEvent('click', {
          clientX: x, clientY: y, bubbles: true
        });
        
        element.dispatchEvent(mouseDown);
        await new Promise(resolve => setTimeout(resolve, 50 + Math.random() * 100));
        element.dispatchEvent(mouseUp);
        element.dispatchEvent(click);
        
        return true;
      },

      // Find and click elements by various selectors
      findAndClick: async (selectors) => {
        if (typeof selectors === 'string') selectors = [selectors];
        
        for (const selector of selectors) {
          try {
            const element = document.querySelector(selector);
            if (element && element.offsetParent !== null) {
              await this.humanClick(element);
              return true;
            }
          } catch (e) {
            console.warn('Selector failed:', selector, e);
          }
        }
        return false;
      },

      // Log game state for debugging
      logGameState: () => {
        console.log('🎮 Current Game State:', {
          url: window.location.href,
          title: document.title,
          visibleElements: {
            plants: document.querySelectorAll('[data-testid*="plant"], .plant, [class*="plant"]').length,
            trees: document.querySelectorAll('[data-testid*="tree"], .tree, [class*="tree"]').length,
            cooking: document.querySelectorAll('[data-testid*="cook"], .cook, [class*="cook"]').length,
            seeds: document.querySelectorAll('[data-testid*="seed"], .seed, [class*="seed"]').length
          }
        });
      }
    };
    
    console.log('🔧 Game helpers injected successfully!');
  `;
  
  (document.head || document.documentElement).appendChild(script);
  script.remove();
}


// Console command injection for advanced debugging
function injectConsoleCommands() {
  const script = document.createElement('script');
  script.textContent = `
    // Debug commands for console
    window.debugSunflower = {
      findPlants: () => {
        const selectors = ['[data-testid*="plant"]', '.plant', '[class*="plant"]'];
        return selectors.map(sel => ({
          selector: sel,
          elements: Array.from(document.querySelectorAll(sel))
        }));
      },
      
      findTrees: () => {
        const selectors = ['[data-testid*="tree"]', '.tree', '[class*="tree"]'];
        return selectors.map(sel => ({
          selector: sel,
          elements: Array.from(document.querySelectorAll(sel))
        }));
      },
      
      findCooking: () => {
        const selectors = ['[data-testid*="cook"]', '.cook', '[class*="kitchen"]'];
        return selectors.map(sel => ({
          selector: sel,
          elements: Array.from(document.querySelectorAll(sel))
        }));
      },
      
      highlightElements: (selector) => {
        document.querySelectorAll(selector).forEach(el => {
          el.style.border = '3px solid red';
          el.style.backgroundColor = 'rgba(255,0,0,0.2)';
        });
      },
      
      clearHighlights: () => {
        document.querySelectorAll('*').forEach(el => {
          el.style.border = '';
          el.style.backgroundColor = '';
        });
      }
    };
    
    console.log('🐛 Debug commands available: window.debugSunflower');
  `;
  
  (document.head || document.documentElement).appendChild(script);
  script.remove();
}

// Message listener from extension popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  (async () => {
    try {
      let result = false;

      switch (request.action) {
        case "plant":
          result = await handlePlantingPhase(request.data);
          break;
        case "chop":
          result = await handleTreeChoppingPhase();
          break;
        case "cook":
          result = await handleCooking(request.data);
          break;
        case "buySeed":
          result = await handleBuySeed(request.data);
          break;
        case "debug":
          window.gameHelpers?.logGameState();
          result = true;
          break;
        default:
          console.warn("⚠️ Unknown action:", request.action);
          sendResponse({ success: false, error: "Unknown action" });
          return;
      }

      sendResponse({ success: result });

    } catch (err) {
      console.error("❌ Lỗi trong content.js:", err);
      sendResponse({ success: false, error: err.message });
    }
  })();

  return true; // ⬅️ QUAN TRỌNG: cho phép sendResponse chạy async
});


// Initialize when DOM is ready
function initializeContentScript() {
  console.log("🚀 Initializing Sunflower Land automation...");
  
  
  // Inject game helpers
  injectGameHelpers();
  
  // Inject debug commands
  injectConsoleCommands();
  
  // Log game state
  setTimeout(() => {
    if (window.gameHelpers) {
      window.gameHelpers.logGameState();
    }
  }, 2000);
  
  console.log("✅ Content script initialized successfully!");
}



// Wait for DOM to be ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initializeContentScript);
} else {
  initializeContentScript();
}



chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === "SHOW_LOG") {
    console.log(` ${message.data?.text}`);
  }
});