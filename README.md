Auto Farm Extension.
Nếu extension ko chạy hãy reset(F5) lại web game


async function buyAxes(toBuy) {
  console.log(`🛒 Bắt đầu mua ${toBuy} rìu...`);

  try {
    const craftContainer = await findCraftContainer();
    if (!craftContainer) {
      console.log("❌ Không tìm thấy khu vực craft trong Market.");
      return false;
    }

    const buttons = Array.from(craftContainer.querySelectorAll("button"));
    const buy1Button = buttons.find(btn =>
      btn.textContent.trim().includes("1") ||
      btn.textContent.trim().toLowerCase().includes("craft 1")
    );
    const buy10Button = buttons.find(btn =>
      btn.textContent.trim().includes("10") ||
      btn.textContent.trim().toLowerCase().includes("craft 10")
    );

    if (!buy1Button && !buy10Button) {
      console.log("❌ Không tìm thấy nút mua 1 hoặc 10 rìu.");
      return false;
    }

    let purchased = 0;

    // Tính toán số lần mua lô 10 và lẻ sao cho không vượt quá toBuy
    const maxTens = Math.floor(toBuy / 10);
    const maxOnes = toBuy % 10;

    // Mua rìu theo lô 10 ưu tiên trước
    for (let i = 0; i < maxTens; i++) {
      if (!buy10Button) break;
      if (purchased + 10 > toBuy) {
        console.log(`⚠️ Không mua vượt quá ${toBuy} rìu, dừng lô 10.`);
        break;
      }
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

    // Mua từng chiếc rìu lẻ còn lại
    for (let i = 0; i < maxOnes; i++) {
      if (!buy1Button) break;
      if (purchased + 1 > toBuy) {
        console.log(`⚠️ Đã mua đủ rìu ${toBuy}, dừng mua lẻ.`);
        break;
      }
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

    console.log(`🎉 Hoàn tất! Đã mua tổng cộng ${purchased}/${toBuy} rìu.`);
    return purchased === toBuy;

  } catch (error) {
    console.error("❌ Lỗi khi mua rìu:", error);
    return false;
  }
}
