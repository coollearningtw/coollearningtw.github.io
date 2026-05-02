/**
 * 酷學習管理後台 - 統一鎖定系統邏輯
 * 建議存放在 ../scripts/admin-lock.js 或 admin-auth.js
 */
(function() {
    const SECRET_KEY = "admin123"; // 在此統一管理管理員密碼
    const UNLOCK_STORAGE_KEY = 'global_editor_unlocked';

    // 等待 DOM 載入後執行
    document.addEventListener('DOMContentLoaded', () => {
        const mask = document.getElementById('page-lock-mask');
        const icon = document.getElementById('lock-icon');

        if (!mask || !icon) {
            console.warn("鎖定系統：找不到 #page-lock-mask 或 #lock-icon，功能可能無法正常運作。");
            return;
        }

        let clicks = 0;
        let timer = null;

        /**
         * 執行解鎖動作
         * @param {boolean} fast 是否跳過動畫效果 (用於初始化檢測)
         */
        function performUnlock(fast) {
            if (fast) mask.style.transition = "none";
            mask.classList.add('unlocked-hidden');
            document.body.classList.remove('locked-scrolling');
            // 使用 sessionStorage，關閉瀏覽器後需重新登入，較為安全
            sessionStorage.setItem(UNLOCK_STORAGE_KEY, 'true');
        }

        // 初始化檢測：如果已經解鎖過，直接移除遮罩
        if (sessionStorage.getItem(UNLOCK_STORAGE_KEY) === 'true') {
            performUnlock(true);
        } else {
            // 確保鎖定狀態下無法捲動
            document.body.classList.add('locked-scrolling');
        }

        // 鎖定圖示點擊事件
        icon.addEventListener('click', (e) => {
            e.stopPropagation();
            clicks++;
            clearTimeout(timer);
            
            // 400 毫秒內連續點擊才計數
            timer = setTimeout(() => { clicks = 0; }, 400);

            if (clicks === 3) {
                const pw = prompt("請輸入管理員解鎖密碼：");
                if (pw === SECRET_KEY) {
                    performUnlock(false);
                } else if (pw !== null) {
                    alert("密碼錯誤，拒絕訪問。");
                }
                clicks = 0;
            }
        });
    });
})();