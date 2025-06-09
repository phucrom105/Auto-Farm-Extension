// Lấy phiên bản hiện tại từ manifest.json
function getCurrentVersion() {
const manifest = chrome.runtime.getManifest();
return manifest.version || 'N/A';
}
// Hiển thị phiên bản hiện tại
function displayCurrentVersion() {
const currentVersion = getCurrentVersion();
const elem = document.getElementById('current-version-value');
elem.textContent = currentVersion;
}

// Hiển thị phiên bản gốc từ GitHub
    async function fetchOriginalVersion() {
      const elem = document.getElementById('original-version-value');
      const statusElem = document.getElementById('update-status');
      const cacheBuster = Date.now();
      const url = `https://raw.githubusercontent.com/phucrom105/Auto-Farm-Extension/master/manifest.json?cb=${cacheBuster}`;
      
      try {
        statusElem.textContent = 'Đang kiểm tra phiên bản mới...';
        const response = await fetch(url);
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }
        const text = await response.text();
        const remoteManifest = JSON.parse(text);
        const remoteVersion = remoteManifest.version || 'N/A';
        elem.textContent = remoteVersion;
        const currentVersion = getCurrentVersion();
        if (remoteVersion !== currentVersion) {
          statusElem.textContent = `⚠️ Có bản cập nhật mới: ${remoteVersion} (Bạn đang dùng: ${currentVersion})`;
        } else {
          statusElem.textContent = '✅ Phiên bản đang sử dụng là mới nhất.';
        }
        } catch (error) {
        elem.textContent = 'Không thể lấy phiên bản từ GitHub';
        statusElem.textContent = `❌ Lỗi khi kiểm tra cập nhật: ${error.message}`;
        console.error('Lỗi kiểm tra cập nhật:', error);
      }
    }

    displayCurrentVersion();
    fetchOriginalVersion();
    
    // Kiểm tra cập nhật lại mỗi 30 phút
    setInterval(fetchOriginalVersion, 30 * 60 * 1000);


