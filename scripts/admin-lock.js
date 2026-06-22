/**
 * 酷學習管理後台 - 統一管理員權限驗證系統 (自動相依性載入版)
 * 存放路徑: scripts/admin-lock.js
 */
(function() {
    // 核心安全政策：在驗證過關前，強迫鎖定頁面不允許滾動與互動
    document.addEventListener('DOMContentLoaded', () => {
        document.body.classList.add('locked-scrolling');
    });

    // 檢查並動態載入缺少的 Supabase 相依套件 (免去手動修改 7 個後台 HTML 檔案之不便)
    if (!window.supabaseClient) {
        console.log("偵測到網頁未載入 Supabase SDK，啟動自動安全載入模組...");
        
        // 1. 建立 Supabase SDK 載入
        const sdkScript = document.createElement('script');
        sdkScript.src = "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2";
        
        // 2. 建立連線設定檔載入 (後台網頁皆在 /admin 下，故使用 ../ 相對路徑)
        const configScript = document.createElement('script');
        configScript.src = "../scripts/supabase-config.js";

        sdkScript.onload = () => {
            document.head.appendChild(configScript);
            configScript.onload = () => {
                // 套件全數載入完成，執行權限校驗
                checkAdminAuth();
            };
        };
        document.head.appendChild(sdkScript);
    } else {
        // 如果頁面已手動引入，直接進行校驗
        checkAdminAuth();
    }

    /**
     * 核心安全檢查：非同步校驗當前使用者身分 (採用 getSession 極速還原)
     */
    async function checkAdminAuth() {
        const mask = document.getElementById('page-lock-mask');
        const supabase = window.supabaseClient;

        // 如果自動加載依然失敗，安全驅逐回首頁
        if (!supabase) {
            window.location.href = '../index.html';
            return;
        }

        try {
            // 1. 優先從瀏覽器本機快取中讀取 Session，速度極快
            const { data: { session }, error: sessionErr } = await supabase.auth.getSession();
            
            if (sessionErr || !session || !session.user) {
                // 完全未登入，直接驅逐至首頁
                window.location.href = '../index.html';
                return;
            }

            const user = session.user;

            // 2. 至 profiles 表查詢該用戶之系統角色 (role)
            const { data: profile, error: dbErr } = await supabase
                .from('profiles')
                .select('role')
                .eq('id', user.id)
                .single();

            if (dbErr) {
                console.error("讀取 profiles 權限表失敗：", dbErr);
                alert("權限驗證伺服器連線失敗，即將退回首頁！");
                window.location.href = '../index.html';
                return;
            }

            if (!profile || profile.role !== 'admin') {
                // 已登入但並非系統管理員 (admin)，彈出警告並驅逐至首頁
                alert("安全保護：您的帳號無此後台管理權限，即將退回首頁！");
                window.location.href = '../index.html';
                return;
            }

            // 3. 驗證通過：解鎖並隱藏 RLS 遮罩，開放後台功能
            if (mask) {
                mask.classList.add('unlocked-hidden');
            }
            document.body.classList.remove('locked-scrolling');

        } catch (err) {
            console.error("驗證機制發生異常:", err);
            window.location.href = '../index.html';
        }
    }
})();