/**
 * 酷學習通用工具函式庫 (utils.js)
 * 功能：Markdown 解析、Ruby 漢字標註、語法/情境標籤、語音合成 (TTS)
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
 * 1. 日語/註釋：[漢字|讀音] -> 自動轉為 <ruby> 或 [文字|編號] -> 註釋
 * 2. 語法結構：{動詞搭配} -> 顯示為程式碼風格標籤
 * 3. 情境標註：[!口語] -> 顯示為語境提示標籤
 * 4. 基礎 Markdown：粗體、螢光筆、刪除線、底線、書名號
 */
function parseMarkdown(text) {
    if (!text) return '';
    let html = escapeHtml(text);

    // 1. [A|B] 語法：日語 Ruby 或 國文註釋 (後者為純數字時)
    html = html.replace(/\[(.*?)\|(.*?)\]/g, (match, p1, p2) => {
        if (/^\d+$/.test(p2)) {
            return `<span class="anno-link" data-id="${p2}">${p1}<sup class="anno-no">${p2}</sup></span>`;
        }
        return `<ruby>${p1}<rt>${p2}</rt></ruby>`;
    });

    // 2. [!情境標註] (例如：[!正式]、[!口語]、[!美式])
    html = html.replace(/\[\!(.*?)\]/g, '<span class="md-context">$1</span>');

    // 3. {語法/搭配詞} (例如：{to + Ving}、{the database})
    html = html.replace(/\{(.*?)\}/g, '<span class="md-tag">$1</span>');

    // 4. 超連結 [文字](連結) 或 [文字](連結|blank)
    html = html.replace(/\[(.*?)\]\((.*?)(\|blank)?\)/g, (match, text, url, blank) => {
        const target = blank ? ' target="_blank"' : '';
        return `<a href="${url}"${target} class="md-link">${text}</a>`;
    });

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

    // 10. 書名號 ~w(text)w~
    html = html.replace(/~w\((.*?)\)w~/g, '<span class="md-bookname">$1</span>');

    // 11. 換行處理
    html = html.replace(/\n/g, '<br>');

    return html;
}

/**
 * 清除 Markdown 與標籤符號 (供 TTS 語音朗讀使用)
 * 確保語音引擎不會讀出標點符號或註記代碼
 */
function stripMarkdown(text) {
    if (!text) return '';
    return text
        // [漢字|假名] 只保留漢字部分
        .replace(/\[(.*?)\|(.*?)\]/g, '$1')
        // [!情境] 只保留內容
        .replace(/\[\!(.*?)\]/g, '$1')
        // {搭配詞} 只保留內容
        .replace(/\{(.*?)\}/g, '$1')
        // 移除其餘格式符號
        .replace(/\*\*(.*?)\*\*/g, '$1')
        .replace(/\*(.*?)\*/g, '$1')
        .replace(/==(.*?)==/g, '$1')
        .replace(/~~(.*?)~~/g, '$1')
        .replace(/__(.*?)__/g, '$1')
        .replace(/~w\((.*?)\)w~/g, '$1');
}

/**
 * 統一語音發音函式
 * @param {string} text - 要朗讀的文字
 * @param {string} lang - 語系 (預設 zh-TW, 英語請傳 en-US, 日語請傳 ja-JP)
 * @param {number} rate - 語速 (0.1 ~ 10)
 * @param {function} callback - 朗讀結束後的回到函式
 */
function speak(text, lang = 'zh-TW', rate = 1.0, callback = null) {
    if (!window.speechSynthesis) return;
    
    // 停止當前正在播放的所有聲音
    window.speechSynthesis.cancel();

    // 清理 Markdown 標籤，避免發音出錯
    const cleanText = stripMarkdown(text);
    const utterance = new SpeechSynthesisUtterance(cleanText);
    
    // 自動尋找最佳語音對象 (部分瀏覽器支援度不同)
    const voices = window.speechSynthesis.getVoices();
    const selectedVoice = voices.find(v => v.lang.includes(lang));
    
    if (selectedVoice) utterance.voice = selectedVoice;
    utterance.lang = lang;
    utterance.rate = rate;

    if (callback) {
        utterance.onend = callback;
    }

    window.speechSynthesis.speak(utterance);
}

/**
 * 網路狀態監控
 */
window.addEventListener('offline', () => {
    // 若有離線頁面則導向離線頁面
    if (typeof window.location.href !== 'undefined' && !window.location.href.includes('offline.html')) {
        console.warn("網路已斷開");
    }
});

/**
 * 初始化語音清單 (針對 Chrome 等需要非同步加載語音的瀏覽器)
 */
window.speechSynthesis.onvoiceschanged = () => {
    console.log("語音引擎已就緒");
};