/**
 * 酷學習 - Supabase 全域設定檔
 * 存放路徑: scripts/supabase-config.js
 * 
 * 注意：此腳本必須在 HTML 中於 Supabase CDN 之後引入
 */

// 1. 請填入你的專案資訊 (從 Supabase -> Settings -> API 取得)
const SB_URL = 'https://bbpdtlnwwnusdnypwxzw.supabase.co';
const SB_KEY = 'sb_publishable_okSipt-ZRhsObjEdyOxv8Q_tTyfXPyZ';

// 2. 初始化客戶端並掛載到 window 物件，供全站頁面使用
(function() {
    // 檢查 Supabase SDK 是否已載入
    if (window.supabase && window.supabase.createClient) {
        try {
            // 建立連線實例
            const _supabase = window.supabase.createClient(SB_URL, SB_KEY);
            
            // 存放到 window.supabaseClient，避免與 SDK 的 window.supabase 名稱衝突
            window.supabaseClient = _supabase;

            console.log("✅ Supabase 連線已成功初始化");
        } catch (err) {
            console.error("❌ Supabase 初始化過程中發生錯誤:", err);
        }
    } else {
        console.error("❌ 找不到 Supabase SDK。請確保 HTML 已引入 <script src='https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2'></script>");
    }
})();