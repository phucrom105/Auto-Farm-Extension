    let seedOrder = [];
    let seedBuy = [];
    const delayActionMenu = 500; //Fire pit -> choose dish
    const delayCookCollectAdd = 200; //Cook -> Cook -> Collect -> Collect -> Add to queue -> Add to queue

  async function randomDelayBetweenFunctions() {
    const delay = 200;
    console.log(`⏳ Chờ ${delay / 1000} giây trước khi chạy hàm tiếp theo...`);
    await new Promise((resolve) => setTimeout(resolve, delay));
  }


  //Hàm Plating 
  async function handlePlantingPhase(seedOrder) {
    console.log("🌱 === BẮT ĐẦU GIAI ĐOẠN TRỒNG CÂY ===");
    
    const maxPlantingTime = 4 * 60 * 1000; // Tối đa 4 phút
    const checkInterval = 5000; // Kiểm tra mỗi 15 giây
    const startTime = Date.now();
    
    let consecutiveNoPlantCount = 0;
    const maxNoPlantLimit = 1;
    
    while (Date.now() - startTime < maxPlantingTime) {
      const elapsedMinutes = Math.floor((Date.now() - startTime) / 60000);
      console.log(`🌱 Kiểm tra ô trồng... (đã chạy ${elapsedMinutes} phút)`);

      let hasPlantAction = false;

      try {
        // QUAN TRỌNG: Chỉ chọn seed 1 lần ở đây
        await selectSeed(seedOrder);
        await randomDelayBetweenFunctions();
        
        // Xử lý trồng cây KHÔNG chọn seed
        const plantResult = await handlePlantClick(); // Hàm mới không chọn seed
        
        // Kiểm tra xem có trồng được cây không
        let images = Array.from(document.querySelectorAll("img")).filter(
          (img) => img.src.includes("plant.png") || img.src.includes("soil2.png")
        );
        
        if (images.length > 0) {
          hasPlantAction = true;
          console.log(`✅ Còn ${images.length} ô có thể trồng/xử lý`);
        } else {
          console.log("🚫 Không còn ô để trồng cây");
        }
        
        await randomDelayBetweenFunctions();
      } catch (error) {
        console.error("❌ Lỗi trong quá trình trồng cây:", error);
      }

      // Cập nhật bộ đếm
      if (hasPlantAction) {
        consecutiveNoPlantCount = 0;
        console.log("🔄 Có ô để trồng, tiếp tục kiểm tra...");
      } else {
        consecutiveNoPlantCount++;
        console.log(`⚠️ Không có ô để trồng (${consecutiveNoPlantCount}/${maxNoPlantLimit})`);
      }

      // Nếu không có ô để trồng quá nhiều lần, chuyển sang giai đoạn chặt cây
      if (consecutiveNoPlantCount >= maxNoPlantLimit) {
        console.log("⚠️ Không còn ô để trồng cây!");
        break;
      }

      console.log("⏳ Chờ 5 giây trước khi kiểm tra ô trồng tiếp theo...");
      await new Promise((resolve) => setTimeout(resolve, checkInterval));
    }
    
    if (Date.now() - startTime >= maxPlantingTime) {
      console.log(`⏰ Đã đạt thời gian tối đa cho giai đoạn trồng cây (${maxPlantingTime / 60000} phút)`);
    }
    
    console.log("🌱 === HOÀN THÀNH GIAI ĐOẠN TRỒNG CÂY ===");
  }


  // Giai đoạn chặt cây - chỉ chạy 1 lần sau khi trồng xong
  async function handleTreeChoppingPhase() {
    console.log("🌲 === BẮT ĐẦU GIAI ĐOẠN CHẶT CÂY ===");
    
    try {
      await handleTreeChop(); // Chặt tất cả cây có thể
    } catch (error) {
      console.error("❌ Lỗi trong quá trình chặt cây:", error);
    }
    
    console.log("🌲 === HOÀN THÀNH GIAI ĐOẠN CHẶT CÂY ===");
  }

 


async function handlePlantClick() {
  console.log("🔍 Kiểm tra tất cả ảnh plant.png hoặc soil2.png...");

  let images = Array.from(document.querySelectorAll("img")).filter(
    (img) => img.src.includes("plant.png") || img.src.includes("soil2.png")
  );

  if (images.length === 0) {
    console.log("✅ Không còn ảnh cần xử lý, dừng lại!");
    return;
  }

  images = images.sort(() => Math.random() - 0.5);

  for (const img of images) {
    const parent = img.closest("div");
    if (!parent) continue;

    if (img.src.includes("plant.png")) {
      console.log("🌱 Click vào plant.png");
      simulateRandomClick(img);

      await new Promise((resolve) => setTimeout(resolve, 300));

      const newImg = parent.querySelector("img");
      if (newImg && newImg.src.includes("soil2.png")) {
        console.log("🟤 Đã đổi thành soil2.png, tiếp tục click...");
        await clickSoil2(newImg);
      } else {
        console.log("🌱 Vẫn là plant.png, click lần nữa...");
        simulateRandomClick(img);
        await new Promise((resolve) => setTimeout(resolve, 300));
      }
    } else if (img.src.includes("soil2.png")) {
      console.log("🟤 Tìm thấy soil2.png, xử lý từng cái một...");
      await clickSoil2(img);
    }

    const fixedContainer = document.querySelector(
      ".fixed.inset-0.overflow-y-auto"
    );
    if (fixedContainer) {
      console.log("🔄 Phát hiện menu đặc biệt, xử lý tiếp...");
      await handleFixedElement();
      await randomDelayBetweenFunctions();
      await handleMoonSeekers();
      console.log("✅ Hoàn thành xử lý menu.");
    }

    await randomDelayBetweenFunctions();
  }
}

function findMarketImage() {
  console.log("🔍 Đang tìm kiếm Market...");
  
  // Tìm cả hai loại market có thể có
  const marketImage = document.querySelector("img[src*='market.webp'], img[src*='bettys_market.png']");
  
  if (marketImage) {
    const marketType = marketImage.src.includes('market.webp') ? 'market.webp' : 'bettys_market.png';
    return marketImage;
  } else {
    console.log("❌ Không tìm thấy Market");
    return null;
  }
}

// chọn hạt giống
async function selectSeed(seedOrder) {
  console.log("🛒 Đang tìm Market...");

  const marketImage = findMarketImage();

  marketImage.click();
  console.log("✅ Đã click vào Market");

  await new Promise((resolve) => setTimeout(resolve, 1000));

  const seedElements = document.querySelectorAll(
    ".fixed.inset-0.overflow-y-auto .flex.flex-wrap.mb-2 > .relative"
  );
  if (seedElements.length === 0) {
    console.log("❌ Không tìm thấy danh sách hạt giống, dừng lại!");
    return;
  }

  for (let seedIndex of seedOrder) {
    let seedElement = seedElements[seedIndex - 1];
    if (!seedElement) {
      console.log(`⚠️ Hạt giống số ${seedIndex} không tồn tại trong danh sách!`);
      continue;
    }

    let stockDiv = seedElement.querySelector(
      ".w-fit.justify-center.flex.items-center.text-xs"
    );
    let stockText = stockDiv?.textContent?.trim() || "0";
    let match = stockText.match(/(\d+)/);
    let stockValue = match ? parseInt(match[1]) : 0;

    if (stockValue <= 0) {
      console.log(`❌ Hết hạt giống số ${seedIndex}`);

      // Lấy automationSettings từ storage local thay vì gọi background
      const { automationSettings } = await chrome.storage.local.get("automationSettings");
      if (automationSettings?.autoBuyIfOutOfStock) {
        console.log(`🛒 Đang thử mua lại seed ${seedIndex}...`);
        
        // GỌI TRỰC TIẾP HÀM handleBuySeed thay vì qua background
        await handleBuySeed([seedIndex]);

        await new Promise((resolve) => setTimeout(resolve, 2000)); // Tăng thời gian chờ

        // Refresh lại danh sách seed elements sau khi mua
        const updatedSeedElements = document.querySelectorAll(
          ".fixed.inset-0.overflow-y-auto .flex.flex-wrap.mb-2 > .relative"
        );
        let updatedSeedElement = updatedSeedElements[seedIndex - 1];
        if (!updatedSeedElement) {
          console.log(`❌ Không tìm thấy lại seed ${seedIndex} sau khi mua.`);
          continue;
        }

        let updatedStockDiv = updatedSeedElement.querySelector(
          ".w-fit.justify-center.flex.items-center.text-xs"
        );
        let updatedStockText = updatedStockDiv?.textContent?.trim() || "0";
        let updatedMatch = updatedStockText.match(/(\d+)/);
        let updatedStockValue = updatedMatch ? parseInt(updatedMatch[1]) : 0;

        if (updatedStockValue <= 0) {
          console.log(`🚫 Đã thử mua nhưng seed ${seedIndex} vẫn hết hàng. Chuyển sang seed khác...`);
          continue;
        } else {
          console.log(`✅ Mua thành công seed ${seedIndex}, stock hiện tại: ${updatedStockValue}`);

          // Chọn seed sau khi mua thành công
          const cropImage = updatedSeedElement.querySelector("img[src*='crop.png']");
          if (cropImage) {
            cropImage.click();
            console.log(`🌱 Đã chọn lại seed ${seedIndex} sau khi mua`);
          }

          // Đóng market
          setTimeout(() => {
            const closeButton = document.querySelector(
              "img[src='https://sunflower-land.com/game-assets/icons/close.png']"
            );
            if (closeButton) {
              closeButton.click();
              console.log("❌ Đã đóng Market");
            }
          }, 500);

          await randomDelayBetweenFunctions();
          return;
        }
      } else {
        console.log("⚠️ Không tự mua lại vì chưa bật autoBuyIfOutOfStock");
        continue;
      }
    }

    // Nếu còn hàng từ đầu
    const cropImage = seedElement.querySelector("img[src*='crop.png']");
    if (!cropImage) {
      console.log(`⚠️ Không tìm thấy ảnh crop.png trong seed ${seedIndex}, bỏ qua.`);
      continue;
    }

    cropImage.click();
    console.log(`✅ Đã chọn hạt giống số ${seedIndex} (stock: ${stockValue})`);

    setTimeout(() => {
      const closeButton = document.querySelector(
        "img[src='https://sunflower-land.com/game-assets/icons/close.png']"
      );
      if (closeButton) {
        closeButton.click();
        console.log("❌ Đã đóng Market");
      }
    }, 500);

    await randomDelayBetweenFunctions();
    return;
  }

  console.log("❌ Tất cả hạt giống trong danh sách đều hết hàng hoặc không hợp lệ!");
}



// Tìm container chứa các nút Buy 
async function findBuyContainer() {
  const selectors = [
    "div.flex.space-x-1.sm\\:space-x-0.sm\\:space-y-1.sm\\:flex-col.w-full",
    "[class*='buy']",
    "div:has(button)",
    ".market-buy",
    ".buy-section"
  ];

  for (const selector of selectors) {
    try {
      const container = document.querySelector(selector);
      if (container && container.querySelectorAll("button").length > 0) {
        const hasBuyButton = Array.from(container.querySelectorAll("button")).some(btn =>
          btn.textContent.toLowerCase().includes("buy")
        );
        if (hasBuyButton) return container;
      }
    } catch (e) {
      continue;
    }
  }

  const allButtons = Array.from(document.querySelectorAll("button"));
  const buyButton = allButtons.find(btn =>
    btn.textContent.toLowerCase().includes("buy")
  );

  if (buyButton) {
    let parent = buyButton.parentElement;
    while (parent && parent !== document.body) {
      const buttonsInParent = parent.querySelectorAll("button").length;
      if (buttonsInParent >= 2) {
        return parent;
      }
      parent = parent.parentElement;
    }
    return buyButton.parentElement;
  }

  return null;
}

function isSoldOutVisible() {
  return Array.from(document.querySelectorAll("*"))
    .some(el => {
      try {
        return (
          el.textContent.toLowerCase().includes("sold out") &&
          getComputedStyle(el).backgroundColor.includes("rgb(228, 59, 68)")
        );
      } catch {
        return false;
      }
    });
}


// Kiểm tra và xử lý popup xác nhận
async function handleConfirmationPopup() {
  try {
  
    // Chờ popup load hoàn toàn
    await new Promise(r => setTimeout(r, 400));
    
    let confirmButton = null;
    
    // PHƯƠNG PHÁP ĐƠN GIẢN: Tìm nút Buy thứ 4 (nút xác nhận trong popup)
    
    const allButtons = Array.from(document.querySelectorAll('button'));
    const visibleBuyButtons = [];
    
    // Lọc tất cả nút Buy hiển thị
    allButtons.forEach((btn, index) => {
      const rect = btn.getBoundingClientRect();
      const text = btn.textContent.trim();
      
      if (rect.width > 0 && rect.height > 0 && !btn.disabled) {
        // Nút có chứa từ "Buy" hoặc có pattern "Buy X"
        if (text.toLowerCase().includes('buy') || text.match(/^Buy\s+\d+$/)) {
          visibleBuyButtons.push({
            button: btn,
            text: text,
            index: index
          });
        }
      }
    });
    
    console.log(`📋 Tìm thấy ${visibleBuyButtons.length} nút Buy hiển thị:`);
    visibleBuyButtons.forEach((btn, i) => {
      console.log(`   ${i + 1}. "${btn.text}"`);
    });
    
    // Nút thứ 4 (index 3) chính là nút xác nhận trong popup
    if (visibleBuyButtons.length >= 4) {
      confirmButton = visibleBuyButtons[3].button; // Index 3 = nút thứ 4
      console.log(`🎯 Tìm thấy nút Buy thứ 4 (xác nhận): "${confirmButton.textContent.trim()}"`);
    }
    // Fallback: Nếu chỉ có 3 nút, tìm nút mới nhất (không phải Cancel)
    else if (visibleBuyButtons.length === 3) {
      // Có thể nút thứ 3 chính là nút xác nhận
      const lastBuyButton = visibleBuyButtons[2].button;
      
      // Kiểm tra xem có nút Cancel không
      const hasCancelButton = allButtons.some(btn => {
        const rect = btn.getBoundingClientRect();
        return rect.width > 0 && rect.height > 0 && 
               btn.textContent.toLowerCase().includes('cancel');
      });
      
      if (hasCancelButton) {
        confirmButton = lastBuyButton;
        console.log(`🎯 Fallback: Chọn nút Buy cuối cùng làm nút xác nhận: "${confirmButton.textContent.trim()}"`);
      }
    }
    
    // Fallback cuối cùng: Tìm nút Buy mới xuất hiện (không phải Cancel)
    if (!confirmButton) {
      console.log("🔍 Fallback: Tìm nút Buy mới xuất hiện trong popup...");
      
      // Tìm container có cả Buy và Cancel
      const containers = Array.from(document.querySelectorAll('div'));
      
      for (const container of containers) {
        const containerButtons = Array.from(container.querySelectorAll('button'));
        const visibleContainerButtons = containerButtons.filter(btn => {
          const rect = btn.getBoundingClientRect();
          return rect.width > 0 && rect.height > 0 && !btn.disabled;
        });
        
        if (visibleContainerButtons.length >= 2) {
          const hasCancel = visibleContainerButtons.some(btn => 
            btn.textContent.toLowerCase().includes('cancel')
          );
          
          const buyButtons = visibleContainerButtons.filter(btn => 
            btn.textContent.toLowerCase().includes('buy') && 
            !btn.textContent.toLowerCase().includes('cancel')
          );
          
          if (hasCancel && buyButtons.length > 0) {
            // Chọn nút Buy cuối cùng trong container này
            confirmButton = buyButtons[buyButtons.length - 1];
            console.log(`🎯 Tìm thấy nút xác nhận trong container: "${confirmButton.textContent.trim()}"`);
            break;
          }
        }
      }
    }
    
    // Thực hiện click nút xác nhận
    if (confirmButton) {
      const buttonText = confirmButton.textContent.trim();
      console.log(`🎯 SẼ CLICK NÚT XÁC NHẬN: "${buttonText}"`);
      
      // Đảm bảo nút visible và scroll vào view
      confirmButton.scrollIntoView({ 
        behavior: 'smooth', 
        block: 'center',
        inline: 'center'
      });
      
      await new Promise(r => setTimeout(r, 300));
      
      // Click nút xác nhận
      let clickSuccess = false;
      
      try {
        confirmButton.click();
        console.log(`🖱️ Đã click nút xác nhận: "${buttonText}"`);
        clickSuccess = true;
      } catch (error) {
        console.log(`⚠️ Click thường thất bại, thử click với event:`, error.message);
        
        try {
          const clickEvent = new MouseEvent('click', {
            bubbles: true,
            cancelable: true,
            view: window
          });
          confirmButton.dispatchEvent(clickEvent);
          console.log(`🖱️ Đã click với event: "${buttonText}"`);
          clickSuccess = true;
        } catch (error2) {
          console.log(`❌ Cả hai cách click đều thất bại:`, error2.message);
        }
      }
      
      if (clickSuccess) {
        // Chờ popup đóng
        await new Promise(r => setTimeout(r, 500));
        
        // Kiểm tra popup đã đóng
        let popupClosed = false;
        for (let i = 0; i < 10; i++) {
          if (!isConfirmationPopupVisible()) {
            popupClosed = true;
            break;
          }
          await new Promise(r => setTimeout(r, 100));
        }
        
        if (popupClosed) {
          console.log("✅ XÁC NHẬN MUA THÀNH CÔNG - Popup đã đóng");
        } else {
          console.log("⚠️ Popup vẫn hiển thị, nhưng có thể đã mua thành công");
        }
        
        return true;
      } else {
        console.log("❌ KHÔNG THỂ CLICK NÚT XÁC NHẬN");
        return false;
      }
    } else {
      console.log("❌ KHÔNG TÌM THẤY NÚT XÁC NHẬN");
      
      // Debug: Hiển thị tất cả nút hiện tại
      console.log("\n🔍 DEBUG: Tất cả nút hiển thị hiện tại:");
      const debugButtons = Array.from(document.querySelectorAll('button')).filter(btn => {
        const rect = btn.getBoundingClientRect();
        return rect.width > 0 && rect.height > 0;
      });
      
      debugButtons.forEach((btn, i) => {
        console.log(`   ${i + 1}. "${btn.textContent.trim()}" - Disabled: ${btn.disabled}`);
      });
      
      return false;
    }
    
  } catch (error) {
    console.error("❌ Lỗi khi xử lý popup xác nhận:", error);
    return false;
  }
}

// Debug function - kiểm tra popup và các nút
function debugPopupButtons() {
  console.log("🔍 DEBUG POPUP: Kiểm tra tất cả nút trong popup...");
  
  const allButtons = Array.from(document.querySelectorAll('button'));
  const visibleButtons = allButtons.filter(btn => {
    const rect = btn.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0;
  });
  
  console.log(`📋 Tìm thấy ${visibleButtons.length} nút hiển thị:`);
  
  visibleButtons.forEach((btn, i) => {
    const text = btn.textContent.trim();
    const isDisabled = btn.disabled;
    const hasLightButton = btn.style.getPropertyValue('--button-image').includes('light_button.png');
    
    // Phân loại nút
    let category = "Khác";
    if (text.toLowerCase().includes('cancel')) {
      category = "Cancel";
    } else if (text.match(/^Buy\s+(\d+)$/)) {
      const quantity = parseInt(text.match(/\d+/)[0]);
      if (quantity === 1) {
        category = "Buy 1 (BỎ QUA)";
      } else if (quantity === 10) {
        category = "Buy 10 (BỎ QUA)";
      } else {
        category = `Buy ${quantity} (HỢP LỆ)`;
      }
    }
    
    console.log(`  ${i + 1}. "${text}" - ${category} - Disabled: ${isDisabled} - LightButton: ${hasLightButton}`);
  });
  
  // Tìm nút hợp lệ
  const validBuyButtons = visibleButtons.filter(btn => {
    const text = btn.textContent.trim();
    const match = text.match(/^Buy\s+(\d+)$/);
    if (match) {
      const quantity = parseInt(match[1]);
      return quantity > 1 && quantity !== 10 && !btn.disabled;
    }
    return false;
  });
  
  console.log(`\n🎯 Nút Buy hợp lệ (X > 1, X ≠ 10):`);
  if (validBuyButtons.length > 0) {
    validBuyButtons.forEach((btn, i) => {
      const quantity = parseInt(btn.textContent.match(/\d+/)[0]);
      console.log(`   ${i + 1}. "${btn.textContent.trim()}" - Số lượng: ${quantity} ✅`);
    });
    console.log(`\n⭐ SẼ CHỌN: "${validBuyButtons[0].textContent.trim()}"`);
  } else {
    console.log("   ❌ Không tìm thấy nút Buy hợp lệ!");
  }
  
  return validBuyButtons;
}


function isConfirmationPopupVisible() {
  try {
    const allButtons = Array.from(document.querySelectorAll('button'));
    const visibleButtons = allButtons.filter(btn => {
      const rect = btn.getBoundingClientRect();
      return rect.width > 0 && rect.height > 0;
    });
    
    // Đếm số nút Buy hiển thị
    const buyButtonCount = visibleButtons.filter(btn => 
      btn.textContent.toLowerCase().includes('buy')
    ).length;
    
    // Kiểm tra có nút Cancel không
    const hasCancelButton = visibleButtons.some(btn => 
      btn.textContent.toLowerCase().includes('cancel')
    );
    
    // Popup xuất hiện khi có >= 4 nút Buy HOẶC có Cancel + ít nhất 1 nút Buy
    const hasPopup = buyButtonCount >= 4 || (hasCancelButton && buyButtonCount >= 1);
    
    if (hasPopup) {
      console.log(`🔍 Popup detected: ${buyButtonCount} nút Buy, Cancel: ${hasCancelButton}`);
    }
    
    return hasPopup;
    
  } catch (error) {
    console.error("Lỗi khi kiểm tra popup:", error);
    return false;
  }
}


// Tìm nút Buy tốt nhất theo logic: Nút 3 (Buy All) -> Nút 2 (Buy 10 hoặc Buy X) -> Nút 1 (Buy 1)
async function findBestAvailableBuyButton() {
  // Tìm tất cả nút Buy theo class chính xác
  const buyButtonSelectors = [
    // Nút Buy với class cụ thể
    'button.w-full.p-1.text-sm[class*="justify-center"][class*="items-center"]',
    // Nút Buy trong container
    'div[class*="flex"][class*="space-x"] button',
    // Fallback selector
    'button'
  ];
  
  let allButtons = [];
  
  for (const selector of buyButtonSelectors) {
    try {
      const buttons = Array.from(document.querySelectorAll(selector));
      const buyButtons = buttons.filter(btn => {
        const text = btn.textContent.toLowerCase();
        return text.includes("buy") && !btn.disabled &&
               btn.getBoundingClientRect().width > 0 && 
               btn.getBoundingClientRect().height > 0;
      });
      
      if (buyButtons.length > 0) {
        allButtons = buyButtons;
        break;
      }
    } catch (e) {
      continue;
    }
  }
  
  if (allButtons.length === 0) {
    console.log("❌ Không tìm thấy nút Buy nào.");
    return null;
  }

  console.log(`🔍 Tìm thấy ${allButtons.length} nút Buy`);
  
  // Ưu tiên: Nút 3 (Buy All) -> Nút 2 (Buy 10/X) -> Nút 1 (Buy 1)
  
  // 1. Tìm nút thứ 3 (Buy All) - chỉ xuất hiện khi stock > 10
  if (allButtons.length >= 3) {
    const thirdButton = allButtons[2]; // Index 2 = nút thứ 3
    const thirdButtonText = thirdButton.textContent.toLowerCase().trim();
    
    // Nút thứ 3 có thể là "Buy All", "Buy [số lớn]", hoặc có class đặc biệt
    const isThirdButton = thirdButton.classList.contains('mt-1') || 
                         thirdButton.style.getPropertyValue('--button-image').includes('light_button.png') ||
                         thirdButtonText.includes('all') ||
                         /buy\s*\d{2,}/.test(thirdButtonText); // Buy với số >= 10
    
    if (isThirdButton) {
      console.log(`🎯 Ưu tiên nút thứ 3: ${thirdButton.textContent.trim()}`);
      return { 
        button: thirdButton, 
        quantity: 'all', 
        isThirdButton: true,
        buttonPosition: 3
      };
    }
  }
  
  // 2. Tìm nút thứ 2 (Buy 10 hoặc Buy X khi stock ≤ 10)
  if (allButtons.length >= 2) {
    const secondButton = allButtons[1]; // Index 1 = nút thứ 2
    const secondButtonText = secondButton.textContent.toLowerCase().trim();
    
    console.log(`🎯 Chọn nút thứ 2: ${secondButton.textContent.trim()}`);
    
    // Trích xuất số lượng từ text
    const quantityMatch = secondButtonText.match(/buy\s*(\d+)/);
    const quantity = quantityMatch ? parseInt(quantityMatch[1]) : 10;
    
    return { 
      button: secondButton, 
      quantity: quantity, 
      isThirdButton: false,
      buttonPosition: 2
    };
  }
  
  // 3. Fallback: Nút thứ 1 (Buy 1)
  if (allButtons.length >= 1) {
    const firstButton = allButtons[0]; // Index 0 = nút thứ 1
    console.log(`🎯 Fallback nút thứ 1: ${firstButton.textContent.trim()}`);
    
    return { 
      button: firstButton, 
      quantity: 1, 
      isThirdButton: false,
      buttonPosition: 1
    };
  }

  return null;
}

async function safeClickButton(button, buttonName, isThirdButton = false, buttonPosition = 1) {
  try {
    if (!button) {
      console.log(`⚠️ Nút ${buttonName} không tồn tại.`);
      return false;
    }
    
    const rect = button.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) {
      console.log(`⚠️ Nút ${buttonName} không hiển thị.`);
      return false;
    }
    
    if (button.disabled) {
      console.log(`⚠️ Nút ${buttonName} bị vô hiệu hóa.`);
      return false;
    }
    
    // Scroll vào view trước khi click
    button.scrollIntoView({ behavior: 'smooth', block: 'center' });
    await new Promise(r => setTimeout(r, 200));
    
    button.click();
    console.log(`🖱️ Đã click nút ${buttonName} (vị trí ${buttonPosition}${isThirdButton ? ' - có popup' : ''})`);
    
    // Chỉ nút thứ 3 mới có popup xác nhận
    if (isThirdButton && buttonPosition === 3) {
      
      // Chờ popup xuất hiện với timeout dài hơn
      let popupAppeared = false;
      for (let i = 0; i < 15; i++) { // Tăng từ 10 lên 15 lần
        if (isConfirmationPopupVisible()) {
          popupAppeared = true;
          break;
        }
        await new Promise(r => setTimeout(r, 100));
      }
      
      if (!popupAppeared) {
        // Thử kiểm tra xem có thể đã mua thành công luôn
        await new Promise(r => setTimeout(r, 500));
        
        // Nếu vẫn không có popup, coi như thành công
        if (!isConfirmationPopupVisible()) {
          return true;
        }
      }
      
      // Xử lý popup nếu có
      if (popupAppeared || isConfirmationPopupVisible()) {
        const confirmed = await handleConfirmationPopup();
        if (!confirmed) {
          console.log(`⚠️ Không thể xác nhận mua ${buttonName}`);
          return false;
        }
        console.log("✅ Đã xác nhận mua thành công");
      }
    } else {
      // Nút 1 và 2 không có popup, chờ ngắn
      await new Promise(r => setTimeout(r, 200));
    }
    
    return true;
    
  } catch (error) {
    console.error(`❌ Lỗi khi click nút ${buttonName}:`, error);
    return false;
  }
}

// Kiểm tra stock hiện tại (nếu có thể)
function getCurrentStock() {
  try {
    const stockElements = document.querySelectorAll(".w-fit.justify-center.flex.items-center.text-xs");
    for (let el of stockElements) {
      const text = el.textContent;
      if (text.includes("Stock:")) {
        const match = text.match(/Stock:\s*(\d+)/);
        if (match) return parseInt(match[1]);
      }
    }
  } catch (e) {
    // Không thể đọc stock
  }
  return null;
}

// Mua seed tự động từ danh sách seedBuy - PHIÊN BẢN CẢI TIẾN CHO NHIỀU NÚT BUY
async function handleBuySeed(seedBuy) {
  console.log("🛒 Đang tìm Market...");

  const marketImage = document.querySelector("img[src*='market.webp']");
  if (!marketImage) {
    console.log("❌ Không tìm thấy Market, dừng lại!");
    return;
  }

  marketImage.click();
  console.log("✅ Đã click vào Market");
  await new Promise(resolve => setTimeout(resolve, 1000));

  const seedElements = document.querySelectorAll(
    ".fixed.inset-0.overflow-y-auto .flex.flex-wrap.mb-2 > .relative"
  );
  if (seedElements.length === 0) {
    console.log("❌ Không tìm thấy danh sách hạt giống, dừng lại!");
    return;
  }

  for (let seedIndex of seedBuy) {
    const seedElement = seedElements[seedIndex - 1];
    if (!seedElement) {
      console.log(`⚠️ Hạt giống số ${seedIndex} không tồn tại!`);
      continue;
    }

    let cropImage = seedElement.querySelector("img[src*='crop.png']");
    if (!cropImage) {
      console.log(`⚠️ Không tìm thấy ảnh crop.png trong hạt giống số ${seedIndex}, bỏ qua.`);
      continue;
    }

    cropImage.click();
    console.log(`✅ Đã chọn hạt giống số ${seedIndex}`);
    await new Promise(r => setTimeout(r, 500));

    // Kiểm tra Sold Out ngay sau khi click
    if (isSoldOutVisible()) {
      console.log(`🛑 Hạt giống số ${seedIndex} đã Sold Out từ đầu.`);
      continue;
    }

    console.log(`💰 Bắt đầu mua hạt giống số ${seedIndex} cho đến khi Sold Out...`);
    
    let consecutiveFailures = 0;
    const maxFailures = 8;
    let buyCount = 0;

    while (!isSoldOutVisible()) {
      // TÌM LẠI NÚT MỖI LẦN để đảm bảo có nút phù hợp nhất
      const buttonInfo = await findBestAvailableBuyButton();
      
      if (!buttonInfo) {
        consecutiveFailures++;
        console.log(`⚠️ Không tìm thấy nút Buy khả dụng (lần ${consecutiveFailures}/${maxFailures})`);
        
        if (consecutiveFailures >= maxFailures) {
          console.log(`⛔ Dừng mua seed ${seedIndex} do không tìm thấy nút Buy sau ${maxFailures} lần thử.`);
          break;
        }
        
        await new Promise(r => setTimeout(r, 500));
        continue;
      }

      const { button: availableButton, quantity, isThirdButton, buttonPosition } = buttonInfo;
      const buttonLabel = availableButton.textContent.trim();
      
      // Chỉ nút thứ 3 mới cần popup xác nhận
      const clicked = await safeClickButton(availableButton, buttonLabel, isThirdButton, buttonPosition);

      if (clicked) {
        buyCount++;
        consecutiveFailures = 0;
        
        // Log progress với thông tin chi tiết
        const currentStock = getCurrentStock();
        const quantityText = quantity === 'all' ? 'ALL' : quantity;
        
        if (currentStock !== null) {
          console.log(`📦 Đã mua ${buyCount} lần (${quantityText} mỗi lần, nút ${buttonPosition}), Stock còn: ${currentStock}`);
        } else {
          console.log(`📦 Đã mua ${buyCount} lần bằng ${buttonLabel} (nút ${buttonPosition})`);
        }
      } else {
        consecutiveFailures++;
        console.log(`⚠️ Click không thành công (lần ${consecutiveFailures}/${maxFailures})`);
        
        if (consecutiveFailures >= maxFailures) {
          console.log(`⛔ Dừng mua seed ${seedIndex} do quá nhiều lần click không thành công.`);
          break;
        }
      }

      // Kiểm tra sold out sau mỗi lần mua
      if (isSoldOutVisible()) {
        console.log(`🎉 Seed ${seedIndex} đã SOLD OUT! Tổng cộng mua ${buyCount} lần.`);
        break;
      }

      // Delay tùy thuộc vào vị trí nút: nút 3 cần thời gian xử lý popup
      const delay = buttonPosition === 3 ? 600 : (buttonPosition === 2 ? 300 : 250);
      await new Promise(r => setTimeout(r, delay));
    }

    console.log(`✅ Hoàn thành mua seed ${seedIndex}`);
    await new Promise(r => setTimeout(r, 400));
  }
  
  console.log("🎊 Hoàn thành tất cả việc mua seeds!");
}
  
  

  async function checkAndBuyAxes(neededAxes) {
    console.log("🔍 Kiểm tra số rìu trong Market...");

    try {
      // Bước 1: Mở Market bằng cách click vào ảnh "workbench.png"
      console.log("📂 Đang mở Market...");
      const workbenchImg = document.querySelector("img[src*='workbench.png']");
      if (!workbenchImg) {
        console.log("❌ Không tìm thấy Workbench để mở Market.");
        return false;
      }
      
      workbenchImg.click();
      console.log("✅ Đã click vào Workbench.");
      await new Promise(r => setTimeout(r, 2000)); // Tăng thời gian chờ để Market load hoàn toàn

      // Bước 2: Đợi Market load và kiểm tra số lượng rìu
      const currentAxes = await getCurrentAxeCountInMarket();
      if (currentAxes === null) {
        console.log("❌ Không thể xác định số lượng rìu trong Market.");
        await closeMenu();
        return false;
      }

      console.log(`🔢 Số lượng rìu hiện có trong Market: ${currentAxes}, cần: ${neededAxes}`);

      if (currentAxes >= neededAxes) {
        console.log("✅ Số rìu hiện có đủ để chặt cây.");
        await closeMenu();
        return true;
      }

      // Bước 3: Mua rìu còn thiếu
      const axesToBuy = neededAxes - currentAxes;
      console.log(`🛒 Cần mua thêm ${axesToBuy} rìu...`);
      const success = await buyAxes(axesToBuy);
      
      await closeMenu();
      return success;

    } catch (error) {
      console.error("❌ Lỗi trong quá trình kiểm tra/mua rìu:", error);
      await closeMenu();
      return false;
    }
  }

  // Hàm kiểm tra số lượng rìu trong Market - chỉ tìm trong div.relative chứa ảnh rìu
  async function getCurrentAxeCountInMarket() {
    try {
      console.log("🔍 Đang tìm rìu trong Market...");
      
      // Chờ thêm để đảm bảo Market đã load
      await new Promise(r => setTimeout(r, 1000));

      
      const axeContainers = Array.from(document.querySelectorAll("div.relative"))
        .filter(div => {
          // Kiểm tra xem div có chứa ảnh rìu không
          const imgInContainer = div.querySelector("img[src*='axe']");
          if (!imgInContainer) return false;

          // Kiểm tra src của ảnh để đảm bảo đó là rìu (không phải pickaxe, battle axe...)
          const imgSrc = imgInContainer.src || imgInContainer.getAttribute('src') || '';
          const isAxeImage = imgSrc.includes('axe') && 
                            !imgSrc.includes('wood_pickaxe') && 
                            !imgSrc.includes('stone_pickaxe') &&  
                            !imgSrc.includes('iron_pickaxe') &&
                            !imgSrc.includes('gold_pickaxe');

          if (isAxeImage) {
            const style = window.getComputedStyle(div);
            const width = parseFloat(style.width);
            const height = parseFloat(style.height);
            return true;
          }
          
          return false;
        });

      if (axeContainers.length === 0) {
        console.log("❌ Không tìm thấy div.relative chứa ảnh rìu trong Market.");
        return 0;
      }

      // Lấy container đầu tiên (thường chỉ có 1)
      const axeContainer = axeContainers[0];
      const axeImg = axeContainer.querySelector("img[src*='axe']");
      

      // Tìm số lượng trong chính container này
      const axeCount = await getNumberFromAxeContainer(axeContainer, axeImg);
      if (axeCount !== null) {
        return axeCount;
      }

      // Nếu không tìm thấy, thử click để hiển thị tooltip
      const clickCount = await getAxeCountByClick(axeImg);
      if (clickCount !== null) {
        return clickCount;
      }

      console.log("⚠️ Không xác định được số lượng rìu. Giả định là 0.");
      return 0;

    } catch (error) {
      console.error("❌ Lỗi trong getCurrentAxeCountInMarket:", error);
      return null;
    }
  }

  // Hàm lấy số lượng từ container chứa rìu - tối ưu hóa chỉ tìm trong div.relative đó
  async function getNumberFromAxeContainer(axeContainer, axeImg) {
    try {
      
      // Log thông tin container để debug
      const containerInfo = {
        className: axeContainer.className,
        innerHTML: axeContainer.innerHTML.substring(0, 200) + "...",
        childrenCount: axeContainer.children.length
      };

      // Phương pháp 1: Tìm số trong direct children (con trực tiếp của div.relative)
      const directNumbers = Array.from(axeContainer.children)
        .filter(child => {
          // Loại trừ element ảnh
          if (child.tagName === 'IMG' || child === axeImg) {
            console.log("❌ Bỏ qua IMG element");
            return false;
          }
          
          const text = child.textContent.trim();
          const isNumber = /^\d+$/.test(text);
          const value = parseInt(text);
          
          return isNumber && value > 0 && value <= 999;
        })
        .map(el => ({
          element: el,
          value: parseInt(el.textContent.trim()),
          text: el.textContent.trim(),
          tagName: el.tagName
        }));

      if (directNumbers.length > 0) {
        
        // Nếu chỉ có 1 số, đó chính là số lượng rìu
        if (directNumbers.length === 1) {
          return directNumbers[0].value;
        }
        
        // Nếu có nhiều số, chọn số nhỏ nhất (thường là số lượng item)
        const result = Math.min(...directNumbers.map(item => item.value));
        return result;
      }

      // Phương pháp 2: Tìm trong tất cả text nodes bên trong container (không phải IMG)

      const allTextNodes = [];
      
      function collectTextNodes(node) {
        if (node.nodeType === Node.TEXT_NODE) {
          const text = node.textContent.trim();
          if (/^\d+$/.test(text)) {
            const value = parseInt(text);
            if (value > 0 && value <= 999) {
              allTextNodes.push({
                text: text,
                value: value,
                parentTag: node.parentElement?.tagName || 'UNKNOWN'
              });
            }
          }
        } else if (node.nodeType === Node.ELEMENT_NODE && node.tagName !== 'IMG') {
          for (const child of node.childNodes) {
            collectTextNodes(child);
          }
        }
      }
      
      collectTextNodes(axeContainer);
      
      if (allTextNodes.length > 0) {
        console.log(`✅ Tìm thấy ${allTextNodes.length} số trong text nodes:`, allTextNodes);
        
        // Chọn số nhỏ nhất
        const result = Math.min(...allTextNodes.map(n => n.value));
        console.log(`✅ Số lượng rìu từ text nodes: ${result}`);
        return result;
      }

      // Phương pháp 3: Tìm bất kỳ element nào chứa chỉ số (không phải IMG)
      console.log("🔍 Tìm element chứa chỉ số...");
      const numberElements = Array.from(axeContainer.querySelectorAll("*"))
        .filter(el => {
          if (el.tagName === 'IMG' || el === axeImg) return false;
          
          const text = el.textContent.trim();
          const hasOnlyNumber = /^\d+$/.test(text);
          const value = parseInt(text);
          
          return hasOnlyNumber && value > 0 && value <= 999;
        })
        .map(el => ({
          element: el,
          value: parseInt(el.textContent.trim()),
          text: el.textContent.trim(),
          tagName: el.tagName,
          className: el.className
        }));

      if (numberElements.length > 0) {
        console.log(`✅ Tìm thấy ${numberElements.length} element chứa số:`, 
          numberElements.map(n => `${n.value} (${n.tagName}.${n.className})`));
        
        // Chọn số nhỏ nhất
        const result = Math.min(...numberElements.map(n => n.value));
        console.log(`✅ Số lượng rìu từ number elements: ${result}`);
        return result;
      }

      console.log("⚠️ Không tìm thấy số lượng trong container chứa rìu.");
      return null;

    } catch (error) {
      console.error("❌ Lỗi trong getNumberFromAxeContainer:", error);
      return null;
    }
  }

  // Hàm lấy số lượng bằng cách click vào rìu
  async function getAxeCountByClick(axeImg) {
    try {
      console.log("🖱️ Thử click vào rìu để hiển thị số lượng...");
      
      // Lưu snapshot trước khi click
      const beforeNumbers = captureNumbersSnapshot();
      
      // Click vào rìu
      axeImg.click();
      await new Promise(r => setTimeout(r, 1000));
      
      // Lưu snapshot sau khi click
      const afterNumbers = captureNumbersSnapshot();
      
      // Tìm vị trí của rìu
      const axeRect = axeImg.getBoundingClientRect();
      
      // Tìm số mới xuất hiện gần rìu
      const newNumbers = afterNumbers.filter(afterItem => {
        // Kiểm tra xem số này có tồn tại trước đó không
        const existedBefore = beforeNumbers.some(beforeItem => 
          beforeItem.text === afterItem.text &&
          Math.abs(beforeItem.left - afterItem.left) < 5 &&
          Math.abs(beforeItem.top - afterItem.top) < 5
        );
        
        if (existedBefore) return false;
        
        // Kiểm tra khoảng cách với rìu
        const distance = Math.sqrt(
          Math.pow(afterItem.left - axeRect.left, 2) + 
          Math.pow(afterItem.top - axeRect.top, 2)
        );
        
        return distance < 200 && afterItem.value > 0 && afterItem.value <= 999;
      });

      // Click ra ngoài để ẩn tooltip
      document.body.click();
      await new Promise(r => setTimeout(r, 500));

      if (newNumbers.length > 0) {
        // Chọn số gần nhất với rìu
        const closest = newNumbers.reduce((prev, curr) => {
          const prevDist = Math.sqrt(
            Math.pow(prev.left - axeRect.left, 2) + 
            Math.pow(prev.top - axeRect.top, 2)
          );
          const currDist = Math.sqrt(
            Math.pow(curr.left - axeRect.left, 2) + 
            Math.pow(curr.top - axeRect.top, 2)
          );
          return currDist < prevDist ? curr : prev;
        });
        
        console.log(`✅ Tìm thấy số lượng rìu từ click: ${closest.value}`);
        return closest.value;
      }

      return null;
    } catch (error) {
      console.error("❌ Lỗi trong getAxeCountByClick:", error);
      return null;
    }
  }

  // Hàm lấy số từ parent hoặc sibling elements
  async function getNumberFromParentSiblings(container) {
    try {
      // Kiểm tra parent elements
      let parent = container.parentElement;
      for (let i = 0; i < 3 && parent; i++) {
        const numbers = Array.from(parent.querySelectorAll("*"))
          .filter(el => {
            const text = el.textContent.trim();
            return /^\d+$/.test(text) && !container.contains(el);
          })
          .map(el => parseInt(el.textContent.trim()))
          .filter(num => num > 0 && num <= 999);

        if (numbers.length > 0) {
          const result = Math.min(...numbers);
          console.log(`✅ Tìm thấy số lượng từ parent level ${i + 1}: ${result}`);
          return result;
        }
        
        parent = parent.parentElement;
      }

      // Kiểm tra sibling elements
      if (container.parentElement) {
        const siblings = Array.from(container.parentElement.children)
          .filter(el => el !== container);
        
        for (const sibling of siblings) {
          const text = sibling.textContent.trim();
          if (/^\d+$/.test(text)) {
            const num = parseInt(text);
            if (num > 0 && num <= 999) {
              console.log(`✅ Tìm thấy số lượng từ sibling: ${num}`);
              return num;
            }
          }
        }
      }

      return null;
    } catch (error) {
      console.error("❌ Lỗi trong getNumberFromParentSiblings:", error);
      return null;
    }
  }

  // Hàm helper để capture snapshot các số trên màn hình
  function captureNumbersSnapshot() {
    return Array.from(document.querySelectorAll("*"))
      .map(el => {
        const text = el.textContent.trim();
        if (!/^\d+$/.test(text)) return null;
        
        try {
          const rect = el.getBoundingClientRect();
          return {
            text: text,
            value: parseInt(text),
            left: rect.left,
            top: rect.top,
            element: el
          };
        } catch {
          return null;
        }
      })
      .filter(item => item && item.value > 0 && item.value <= 9999);
  }

  async function buyAxes(toBuy) {
    console.log(`🛒 Bắt đầu mua ${toBuy} rìu...`);

    try {
      const craftContainer = await findCraftContainer();
      if (!craftContainer) {
        console.log("❌ Không tìm thấy khu vực craft trong Market.");
        return false;
      }

      const buttons = Array.from(craftContainer.querySelectorAll("button"));
      const craftButtons = buttons.filter(btn => {
        const text = btn.textContent.trim().toLowerCase();
        return text.includes("craft") || /^\d+$/.test(text);
      });

      const buy1Button = craftButtons.find(btn =>
        btn.textContent.trim().includes("1") ||
        btn.textContent.trim().toLowerCase().includes("craft 1")
      );

      const buy10Button = craftButtons.find(btn =>
        btn.textContent.trim().includes("10") ||
        btn.textContent.trim().toLowerCase().includes("craft 10")
      );

      let purchased = 0;

      // Tính toán số lần cần mua
      const tens = Math.floor(toBuy / 10);
      const ones = toBuy % 10;

      // Mua từng lô 10
      for (let i = 0; i < tens; i++) {
        if (!buy10Button) break;
        const success = await safeClickButton(buy10Button, "Craft 10");
        if (success) {
          purchased += 10;
          console.log(`✅ Đã mua 10 rìu (${purchased}/${toBuy})`);
          await new Promise(r => setTimeout(r, 1200));
        } else {
          console.warn("⚠️ Mua 10 thất bại, dừng lại.");
          break;
        }
      }

      // Mua lẻ từng cái còn lại
      for (let i = 0; i < ones; i++) {
        if (!buy1Button) break;
        const success = await safeClickButton(buy1Button, "Craft 1");
        if (success) {
          purchased += 1;
          console.log(`✅ Đã mua 1 rìu (${purchased}/${toBuy})`);
          await new Promise(r => setTimeout(r, 800));
        } else {
          console.warn("⚠️ Mua 1 thất bại, dừng lại.");
          break;
        }
      }

      console.log(`🎉 Hoàn tất! Đã mua ${purchased}/${toBuy} rìu.`);
      return purchased === toBuy;

    } catch (error) {
      console.error("❌ Lỗi khi mua rìu:", error);
      return false;
    }
  }


  // Hàm tìm container chứa craft buttons
  async function findCraftContainer() {
    const selectors = [
      "div.flex.space-x-1.sm\\:space-x-0.sm\\:space-y-1.sm\\:flex-col.w-full",
      "[class*='craft']",
      "[class*='button']",
      "div:has(button)",
      ".market-craft",
      ".craft-section"
    ];

    // Thử các selector phổ biến
    for (const selector of selectors) {
      try {
        const container = document.querySelector(selector);
        if (container && container.querySelectorAll("button").length > 0) {
          return container;
        }
      } catch (e) {
        continue;
      }
    }

    // Fallback: tìm container chứa button có text "craft"
    const allButtons = Array.from(document.querySelectorAll("button"));
    const craftButton = allButtons.find(btn => 
      btn.textContent.toLowerCase().includes("craft")
    );
    
    if (craftButton) {
      // Tìm container cha gần nhất chứa nhiều button
      let parent = craftButton.parentElement;
      while (parent && parent !== document.body) {
        const buttonsInParent = parent.querySelectorAll("button").length;
        if (buttonsInParent >= 2) {
          return parent;
        }
        parent = parent.parentElement;
      }
      return craftButton.parentElement;
    }

    return null;
  }

  

  // Hàm đóng menu
  async function closeMenu() {
    try {
      // Tìm nút close hoặc click ra ngoài
      const closeButton = document.querySelector("button[aria-label='close']") ||
                        document.querySelector("button:has(svg)") ||
                        document.querySelector(".close-button");
      
      if (closeButton) {
        closeButton.click();
      } else {
        // Click ra ngoài để đóng menu
        document.body.click();
      }
      
      await new Promise(r => setTimeout(r, 1000));
      console.log("✅ Đã đóng Market.");
    } catch (error) {
      console.error("❌ Lỗi khi đóng menu:", error);
    }
  }

 // Hàm helper để kiểm tra xem img có phải là cây không (hỗ trợ tất cả mùa)
function isTreeImage(imgSrc) {
  if (!imgSrc) return false;
  
  const treeSources = [
    'spring_spring_tree.webp',
    'summer_spring_tree.webp', 
    'autumn_spring_tree.webp',
    'winter_spring_tree.webp',
    'spring_basic_tree.webp'
  ];
  
  return treeSources.some(treeSource => imgSrc.includes(treeSource));
}

function getSeasonFromTreeSrc(treeSrc) {
  if (treeSrc.startsWith('spring_')) return 'spring';
  if (treeSrc.startsWith('summer_')) return 'summer';
  if (treeSrc.startsWith('autumn_')) return 'autumn';
  if (treeSrc.startsWith('winter_')) return 'winter';
  return 'unknown';
}

// Hàm tìm tất cả cây hiện có trên màn hình
function findAllTrees() {
  const trees = Array.from(document.querySelectorAll("img"))
    .filter(img => {
      const src = img.src || img.getAttribute('src') || '';
      return isTreeImage(src);
    });
  return trees;
}

// Cập nhật hàm handleTreeChop để sử dụng findAllTrees
async function handleTreeChop() {
  console.log("🌲 Bắt đầu chặt cây (hỗ trợ tất cả mùa)...");

  let attempt = 0;
  const maxAttempts = 3;

  while (attempt < maxAttempts) {
    attempt++;
    console.log(`🔄 Lần thử ${attempt}/${maxAttempts}`);

    // Quét lại cây hiện có (tất cả mùa)
    const trees = findAllTrees();
    if (trees.length === 0) {
      console.log("✅ Không còn cây nào để chặt!");
      break;
    }

    console.log(`🌳 Tìm thấy ${trees.length} cây cần chặt...`);

    // Chuẩn bị rìu (1 rìu cho 1 cây)
    const totalAxesNeeded = trees.length;
    const hasEnoughAxes = await checkAndBuyAxes(totalAxesNeeded);
    
    if (!hasEnoughAxes) {
      console.log("❌ Không đủ rìu, bỏ qua lần thử này.");
      continue;
    }

    // Chặt từng cây
    for (let i = 0; i < trees.length; i++) {
      const tree = trees[i];
      
      // Kiểm tra cây vẫn tồn tại
      if (!document.body.contains(tree)) {
        console.log(`⚠️ Cây thứ ${i + 1} đã biến mất, bỏ qua.`);
        continue;
      }

      // Xác định loại cây ĐÚNG CÁCH
      const treeSrc = tree.src || tree.getAttribute('src') || '';
      const fileName = treeSrc.split('/').pop() || '';
      const season = getSeasonFromTreeSrc(fileName);

      console.log(`🪓 Chặt cây thứ ${i + 1}/${trees.length} (mùa ${season})...`);
      
      const success = await chopSingleTree(tree, i + 1, season);
      if (!success) {
        console.log(`❌ Không thể chặt cây thứ ${i + 1}`);
      }
      
      // Nghỉ giữa các cây
      await new Promise(resolve => setTimeout(resolve, 800));
    }

    // Chờ một chút trước khi kiểm tra lại
    await new Promise(resolve => setTimeout(resolve, 2000));
  }

  console.log("🏁 Hoàn thành quá trình chặt cây!");
}

// Cập nhật hàm chopSingleTree để xử lý tất cả mùa
async function chopSingleTree(treeElement, treeNumber, season) {
  try {
    console.log(`  🌳 Bắt đầu chặt cây số ${treeNumber} mùa ${season}`);
    
    // Click lần đầu vào cây gốc
    console.log(`    🪓 Click lần 1/3 vào cây mùa ${season}...`);
    treeElement.click();
    
    // Chờ 200ms và kiểm tra cây đã chuyển thành shake
    await new Promise(resolve => setTimeout(resolve, 200));
    
    // Sau click đầu, element chuyển thành background-image với shake_sheet
    let currentTree = findShakeTree(season);
    
    if (!currentTree) {
      console.log(`    ⚠️ Không tìm thấy shake tree mùa ${season} sau click đầu`);
      return false;
    }
    
    // Click lần 2 vào cây shake
    console.log(`    🪓 Click lần 2/3 vào cây mùa ${season}...`);
    currentTree.click();
    
    // Chờ 200ms
    await new Promise(resolve => setTimeout(resolve, 200));
    
    // Tìm lại cây shake cho lần click cuối
    currentTree = findShakeTree(season);
    
    if (!currentTree) {
      console.log(`    ✅ Cây mùa ${season} đã được chặt xong sau 2 lần click!`);
      return true;
    }
    
    // Click lần 3 vào cây shake
    console.log(`    🪓 Click lần 3/3 vào cây mùa ${season}...`);
    currentTree.click();
    
    // Chờ animation hoàn thành sau lần click cuối (400ms để đảm bảo)
    await new Promise(resolve => setTimeout(resolve, 700));
    
    // Kiểm tra cây shake đã bị xóa chưa
    const finalTree = findShakeTree(season);
    
    if (!finalTree) {
      console.log(`    ✅ Cây số ${treeNumber} mùa ${season} đã bị chặt thành công!`);
      return true;
    } else {
      console.log(`    ⚠️ Cây số ${treeNumber} mùa ${season} vẫn còn chưa chặt xong sau 3 lần click.`);
      return false;
    }

  } catch (error) {
    console.error(`    ❌ Lỗi khi chặt cây số ${treeNumber}:`, error);
    return false;
  }
}

// Cập nhật hàm findShakeTree để hỗ trợ tất cả mùa
function findShakeTree(season = null) {
  return Array.from(document.querySelectorAll('*')).find(el => {
    const style = window.getComputedStyle(el);
    if (!style.backgroundImage || !style.backgroundImage.includes('shake_sheet.webp')) {
      return false;
    }
    
    // Nếu không chỉ định mùa, tìm bất kì shake tree nào
    if (!season) {
      return true;
    }
    
    const shakePatterns = [
      `${season}_spring_trees_shake_sheet.webp`,  
      `${season}_basic_trees_shake_sheet.webp`   
    ];
    
    return shakePatterns.some(pattern => style.backgroundImage.includes(pattern));
  });
}



async function handleCooking(dishNumber = 1) {
  const firePitContainer = Array.from(
    document.querySelectorAll(".relative.w-full.h-full.cursor-pointer.hover\\:img-highlight")
  ).find((container) => {
    const img = container.querySelector("img");
    return img && img.src.includes("fire_pit.webp");
  });

  if (!firePitContainer) {
    console.log("🔥 Không tìm thấy Fire Pit, kiểm tra lại sau 10 giây...");
    return;
  }

  console.log("🔥 Tìm thấy Fire Pit! Click để mở menu nấu ăn...");
  firePitContainer.dispatchEvent(new MouseEvent("click", { bubbles: true }));

  await new Promise((resolve) => setTimeout(resolve, delayActionMenu));

  let recipeTitle = Array.from(
    document.querySelectorAll(".fixed.inset-0 .w-full")
  ).find((el) => el.textContent.trim() === "Recipes");

  if (!recipeTitle) {
    console.log("📦 Menu chưa mở (có thể đang thu hoạch), click lại Fire Pit...");
    const firePitContainer2 = Array.from(
      document.querySelectorAll(".relative.w-full.h-full.cursor-pointer.hover\\:img-highlight")
    ).find((container) => {
      const img = container.querySelector("img");
      return img && img.src.includes("fire_pit.webp");
    });

    if (firePitContainer2) {
      firePitContainer2.dispatchEvent(new MouseEvent("click", { bubbles: true }));
      await new Promise((resolve) => setTimeout(resolve, delayActionMenu));
      recipeTitle = Array.from(
        document.querySelectorAll(".fixed.inset-0 .w-full")
      ).find((el) => el.textContent.trim() === "Recipes");
    }
  }

  if (!recipeTitle) {
    console.log("❌ Không tìm thấy menu Recipes sau 2 lần thử, dừng lại...");
    return;
  }

  console.log("📜 Đã mở menu Recipes!");

  const recipeContainer = recipeTitle.nextElementSibling;
  if (!recipeContainer || !recipeContainer.classList.contains("flex")) {
    console.log("❌ Không tìm thấy danh sách món ăn.");
    return;
  }

  console.log(`🍽 Chọn món số ${dishNumber}`);

  const dishes = recipeContainer.querySelectorAll(".relative .cursor-pointer");
  if (dishes.length >= dishNumber) {
    dishes[dishNumber - 1].dispatchEvent(new MouseEvent("click", { bubbles: true }));
    console.log("✅ Đã chọn món ăn!");
  } else {
    console.log("❌ Không tìm thấy món ăn theo số đã chọn.");
    return;
  }

  await new Promise((resolve) => setTimeout(resolve, delayActionMenu));

  // Logic xử lý cooking
  let completedActions = 0;
  const maxActions = 10;

  while (completedActions < maxActions) {
    const cancelImages = Array.from(document.querySelectorAll(".fixed.inset-0 img"))
      .filter((img) => img.src.includes("cancel.png"));
    const confirmImages = Array.from(document.querySelectorAll(".fixed.inset-0 img"))
      .filter((img) => img.src.includes("confirm.png"));


    if (confirmImages.length === 0 && cancelImages.length === 0) {
      console.log("Thực hiện 1 Cook, 3 Add to queue");

      const cooked = await performCookingAction("Cook");
      if (cooked) completedActions++;
      else {
        console.log("❌ Không thể Cook, dừng.");
        break;
      }

      let addCount = 0;
      while (addCount < 3) {
        const added = await performCookingAction("Add to queue");
        if (added) {
          completedActions++;
          addCount++;
        } else {
          console.log("❌ Không thể Add to queue đủ 3 lần.");
          break;
        }
      }

      continue;
    }

    if (cancelImages.length >= 3) {
      console.log("❌ Đóng menu");
      break;
    }

    if (cancelImages.length >= 0 && cancelImages.length < 3) {
      console.log("📥 Ưu tiên Collect, sau đó Add to queue");

      const collected = await performCookingAction("Collect");
      if (collected) completedActions++;

      let cancelCount = Array.from(document.querySelectorAll(".fixed.inset-0 img"))
        .filter((img) => img.src.includes("cancel.png")).length;

      while (cancelCount < 3) {
        const added = await performCookingAction("Add to queue");
        if (added) {
          completedActions++;
        } else {
          console.log("❌ Không thể Add to queue tiếp.");
          break;
        }

        cancelCount = Array.from(document.querySelectorAll(".fixed.inset-0 img"))
          .filter((img) => img.src.includes("cancel.png")).length;

        if (cancelCount >= 3) break;
      }

      continue;
    }

    console.log("⚠️ Dừng cooking.");
    break;
  }

  console.log(`✅ Đã hoàn thành tổng cộng ${completedActions} hành động nấu ăn.`);
  await closeMenu();
}

// Hàm phụ trợ thực hiện hành động nấu ăn
async function performCookingAction(actionName) {
  const buttons = document.querySelectorAll(
    ".w-full.p-1.text-sm.object-contain.justify-center.items-center.hover\\:brightness-90"
  );

  const button = Array.from(buttons).find(
    (btn) => btn.innerText.trim() === actionName && !btn.disabled
  );

  if (button) {
    console.log(`🎯 Thực hiện: ${actionName}`);
    button.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    await new Promise((resolve) => setTimeout(resolve, delayCookCollectAdd));
    return true;
  } else {
    console.log(`❌ Không thể thực hiện: ${actionName}`);
    return false;
  }
}


  // Hàm đóng menu
  async function closeMenu() {
    await new Promise((resolve) => setTimeout(resolve, 1000));

    const closeButton = Array.from(
      document.querySelectorAll(".fixed.inset-0 .absolute.flex img")
    ).find(
      (img) =>
        img.src === "https://sunflower-land.com/game-assets/icons/close.png"
    );

    if (closeButton) {
      console.log("❌ Đóng menu bằng cách bấm vào nút X");
      closeButton.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    } else {
      console.log("⚠ Không tìm thấy nút X để đóng menu.");
    }
  }

  function simulateRandomClick(img) {
    const rect = img.getBoundingClientRect();
    const randomX = rect.left + Math.random() * rect.width;
    const randomY = rect.top + Math.random() * rect.height;

    console.log(
      `🎯 Click ngẫu nhiên vào X=${randomX.toFixed(2)}, Y=${randomY.toFixed(2)}`
    );

    img.dispatchEvent(
      new MouseEvent("click", {
        bubbles: true,
        clientX: randomX,
        clientY: randomY,
      })
    );
  }

  async function handleFixedElement() {
    console.log("📌 Phát hiện menu đặc biệt trên trang!");

    const parent = document.querySelector(".fixed .relative.w-full.rounded-md");
    if (!parent) return;

    console.log("📌 Đã tìm thấy phần tử cha.");

    // Lấy tất cả thẻ img bên trong
    const imgs = parent.querySelectorAll("img");
    if (imgs.length < 2) return;

    // Lấy tọa độ của ảnh thứ 2
    const img2 = imgs[1];
    const rect = img2.getBoundingClientRect();

    console.log(`🖱 Click vào ảnh tại X=${rect.left}, Y=${rect.top}`);
    img2.dispatchEvent(new MouseEvent("click", { bubbles: true }));

    // Bấm nút "Close"
    clickCloseButton();
  }

  async function handleMoonSeekers() {
    const moonSeekersSpan = document.querySelector(
      ".fixed .flex.flex-col.justify-center span.text-center.mb-2"
    );

    if (moonSeekersSpan) {
      const text = moonSeekersSpan.textContent.toLowerCase(); // Chuyển về chữ thường để kiểm tra
      console.log(`🔍 Phát hiện tiêu đề: "${text}"`);

      let validSizes = [];

      if (text.includes("moon seekers")) {
        console.log("🟠 Xử lý Moon Seekers...");
        validSizes = [
          { width: 13, height: 16 },
          { width: 12, height: 16 },
          { width: 16, height: 17 },
          { width: 15, height: 16 },
          { width: 15, height: 17 },
          { width: 96, height: 64 },
          { width: 18, height: 16 },
          { width: 22, height: 25 },
          { width: 18, height: 29 },
          { width: 20, height: 19 },
          { width: 33, height: 28 },
          { width: 29, height: 28 },
          { width: 25, height: 25 },
        ];
      } else if (text.includes("goblins")) {
        console.log("🟢 Xử lý goblins...");
        validSizes = [
          { width: 96, height: 64 },
          { width: 18, height: 16 },
          { width: 22, height: 25 },
          { width: 18, height: 29 },
          { width: 20, height: 19 },
          { width: 33, height: 28 },
          { width: 29, height: 28 },
          { width: 25, height: 25 },
          { width: 26, height: 21 },
          { width: 18, height: 12 },
          { width: 25, height: 27 },
          { width: 24, height: 21 },
          { width: 19, height: 21 },
        ];
      }

      if (validSizes.length > 0) {
        // Lấy danh sách ảnh cần kiểm tra
        const images = document.querySelectorAll(
          ".fixed .flex.flex-col.justify-center .flex.flex-wrap.justify-center.items-center img"
        );

        for (let img of images) {
          const width = img.naturalWidth;
          const height = img.naturalHeight;

          if (
            validSizes.some(
              (size) => size.width === width && size.height === height
            )
          ) {
            console.log(`🖱 Click vào ảnh có kích thước ${width}x${height}`);
            img.dispatchEvent(new MouseEvent("click", { bubbles: true }));

            // Chờ 500ms giữa mỗi lần click để đảm bảo hiệu ứng hoàn tất
            await new Promise((resolve) => setTimeout(resolve, 500));
          }
        }
      }

      // Gọi function bấm nút Close
      clickCloseButton();
    }
  }

  function clickCloseButton() {
    setTimeout(() => {
      const closeButton = Array.from(
        document.querySelectorAll(".fixed button")
      ).find((btn) => btn.textContent.trim() === "Close");

      if (closeButton) {
        console.log("❌ Click vào nút Close.");
        closeButton.dispatchEvent(new MouseEvent("click", { bubbles: true }));

        // Kiểm tra lại sau khi bấm Close
        setTimeout(() => {
          const remainingImages = Array.from(
            document.querySelectorAll("img")
          ).filter(
            (img) =>
              img.src.includes("plant.png") || img.src.includes("soil2.png")
          );

          if (remainingImages.length > 0) {
            console.log("🔄 Vẫn còn ảnh cần xử lý, tiếp tục...");
            handlePlantClick();
          } else {
            console.log("✅ Không còn ảnh cần xử lý, dừng lại!");
          }
        }, 1000); // Chờ 1 giây để trang cập nhật
      } else {
        console.log("⚠️ Không tìm thấy nút Close.");
      }
    }, 1000);
  }

  async function clickSoil2(soilImg) {
    console.log("🖱 Click vào soil2.png...");
    soilImg.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    await new Promise((resolve) => setTimeout(resolve, 300));
  }
  

  window.automationFunctions = {
  handlePlantingPhase,
  handleTreeChoppingPhase,
  handleCooking,
  handleBuySeed
};
  