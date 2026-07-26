/**
 * 酷學習通用工具函式庫 (utils.js)
 * 核心功能：Markdown 解析、Ruby 漢字標註、語音合成 (TTS)、假名顯示控制
 */

/**
 * 轉義 HTML 特殊字元，防止 XSS 攻擊
 */
function escapeHtml(text) {
    if (!text) return "";
    return String(text)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

/**
 * 通用 Markdown 解析器
 * 擴充功能說明：
 * 1. 日語/註釋：[漢字|讀音] -> 自動轉為 <ruby>漢字<rt>讀音</rt></ruby>
 * 2. 語法結構：{動詞搭配} -> 顯示為程式碼風格標籤
 * 3. 情境標註：[!口語] -> 顯示為語境提示標籤
 * 4. 基礎 Markdown：粗體 (**)、斜體 (*)、螢光筆 (==)、刪除線 (~~)、底線 (__ / ✨新增)
 */
function parseMarkdown(text) {
    if (!text) return '';
    let html = escapeHtml(text);

    // 1. [A|B] 語法：優先判斷是否為國文註釋 (B為純數字)，否則視為日語 Ruby
    html = html.replace(/\[(.*?)\|(.*?)\]/g, (match, p1, p2) => {
        if (/^\d+$/.test(p2)) {
            return `<span class="anno-link" data-id="${p2}">${p1}<sup class="anno-no">${p2}</sup></span>`;
        }
        return `<ruby>${p1}<rt>${p2}</rt></ruby>`;
    });

    // 2. [!情境標註] (例如：[!正式]、[!動漫用語])
    html = html.replace(/\[\!(.*?)\]/g, '<span class="md-context">$1</span>');

    // 3. {語法/搭配詞} (例如：{～て形}、{V-dict})
    html = html.replace(/\{(.*?)\}/g, '<span class="md-tag">$1</span>');

    // 4. 超連結 [文字](連結)
    html = html.replace(/\[(.*?)\]\((.*?)\)/g, '<a href="$2" class="md-link">$1</a>');

    // 5. 粗體 **text**
    html = html.replace(/\*\*(.*?)\*\*/gs, '<span class="md-bold">$1</span>');

    // 6. 斜體 *text*
    html = html.replace(/\*(.*?)\*/gs, '<span class="md-italic">$1</span>');

    // 7. 螢光筆 ==text==
    html = html.replace(/==(.*?)==/gs, '<span class="md-highlight">$1</span>');

    // 8. 刪除線 ~~text~~
    html = html.replace(/~~(.*?)~~/gs, '<span class="md-strike">$1</span>');

    // 9. 底線 __text__
    html = html.replace(/__(.*?)__/g, '<span class="md-underline">$1</span>');

    // 10. 換行處理
    html = html.replace(/\n/g, '<br>');

    return html;
}

/**
 * 清除 Markdown 與標籤符號 (供 TTS 語音朗讀使用)
 * 確保語音引擎不會讀出標點符號或註記代碼，日語會保留漢字部分
 */
function stripMarkdown(text) {
    if (!text) return '';
    return text
        // [漢字|假名] 在朗讀時只保留漢字部分，讓 TTS 根據上下文判斷讀音
        .replace(/\[(.*?)\|(.*?)\]/g, '$1')
        .replace(/\[\!(.*?)\]/g, '')
        .replace(/\{(.*?)\}/g, '$1')
        .replace(/\*\*(.*?)\*\*/g, '$1')
        .replace(/\*(.*?)\*/g, '$1')
        .replace(/==(.*?)==/g, '$1')
        .replace(/~~(.*?)~~/g, '$1')
        .replace(/__(.*?)__/g, '$1');
}

/**
 * 統一語音發音函式
 * @param {string} text - 要朗讀的文字
 * @param {string} lang - 語系 (zh-TW, en-US, ja-JP)
 * @param {number} rate - 語速 (日語初學建議 0.7~0.9)
 * @param {function} callback - 朗讀結束後的回到函式
 */
function speak(text, lang = 'zh-TW', rate = 1.0, callback = null) {
    if (!window.speechSynthesis) return;
    
    // 停止當前正在播放的所有聲音
    window.speechSynthesis.cancel();

    const cleanText = stripMarkdown(text);
    const utterance = new SpeechSynthesisUtterance(cleanText);
    
    // 獲取系統可用語音清單
    const voices = window.speechSynthesis.getVoices();
    
    // 嘗試尋找對應語系的優質語音 (優先尋找 Google 或 Microsoft 的在線語音)
    let selectedVoice = voices.find(v => v.lang === lang && (v.name.includes('Google') || v.name.includes('Online')));
    if (!selectedVoice) selectedVoice = voices.find(v => v.lang.includes(lang.split('-')[0]));
    
    if (selectedVoice) utterance.voice = selectedVoice;
    utterance.lang = lang;
    utterance.rate = rate;

    if (callback) {
        utterance.onend = callback;
    }

    window.speechSynthesis.speak(utterance);
}

/**
 * 全域日語假名切換開關 (Furigana Toggle)
 * 作用：在 body 上切換 'hide-furigana' class，配合 CSS 隱藏 <rt> 標籤
 */
function toggleGlobalFurigana() {
    const isHidden = document.body.classList.toggle('hide-furigana');
    // 儲存設定至本地，讓使用者重新整理頁面後依然生效
    localStorage.setItem('setting_hide_furigana', isHidden);
    
    // 如果頁面上有對應的按鈕，更新其文字
    const btn = document.getElementById('btn-toggle-ruby');
    if (btn) btn.innerText = isHidden ? "顯示假名" : "隱藏假名";
    
    return isHidden;
}

// 初始化：載入使用者的顯示設定
document.addEventListener('DOMContentLoaded', () => {
    const hidePref = localStorage.getItem('setting_hide_furigana') === 'true';
    if (hidePref) {
        document.body.classList.add('hide-furigana');
        const btn = document.getElementById('btn-toggle-ruby');
        if (btn) btn.innerText = "顯示假名";
    }
});

/**
 * 初始化語音清單 (針對 Chrome 等需要非同步加載語音的瀏覽器)
 */
if (window.speechSynthesis) {
    window.speechSynthesis.onvoiceschanged = () => {
        console.log("語音引擎已就緒，可用語音數:", window.speechSynthesis.getVoices().length);
    };
}