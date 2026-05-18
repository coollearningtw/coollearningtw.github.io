/**
 * 酷學習通用工具函式庫 (utils.js)
 * 支援：Markdown 解析、Ruby 漢字標註、語音合成 (TTS)
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
 * 擴充功能：
 * 1. 日語標註：[漢字|讀音] -> 自動判斷，若後者為假名則轉為 <ruby>
 * 2. 國文註釋：[文字|編號] -> 若後者為數字則轉為註釋連結
 */
function parseMarkdown(text) {
    if (!text) return '';
    let html = escapeHtml(text);

    // 1. 核心處理：[A|B] 語法雙向支援 (日語 Ruby 或 國文註釋)
    html = html.replace(/\[(.*?)\|(.*?)\]/g, (match, p1, p2) => {
        // 判斷 p2 是否為純數字 (國文註釋編號)
        if (/^\d+$/.test(p2)) {
            return `<span class="anno-link" data-id="${p2}">${p1}<sup class="anno-no">${p2}</sup></span>`;
        }
        // 否則判斷為日語 Ruby (漢字註假名)
        return `<ruby>${p1}<rt>${p2}</rt></ruby>`;
    });

    // 2. 超連結 [文字](連結) 或 [文字](連結|blank)
    html = html.replace(/\[(.*?)\]\((.*?)(\|blank)?\)/g, (match, text, url, blank) => {
        const target = blank ? ' target="_blank"' : '';
        return `<a href="${url}"${target} class="md-link">${text}</a>`;
    });

    // 3. 粗體 **text**
    html = html.replace(/\*\*(.*?)\*\*/gs, '<span class="md-bold">$1</span>');

    // 4. 斜體 *text*
    html = html.replace(/\*(.*?)\*/gs, '<span class="md-italic">$1</span>');

    // 5. 螢光筆 ==text==
    html = html.replace(/==(.*?)==/gs, '<span class="md-highlight">$1</span>');

    // 6. 刪除線 ~~text~~
    html = html.replace(/~~(.*?)~~/gs, '<span class="md-strike">$1</span>');

    // 7. 底線 __text__
    html = html.replace(/__(.*?)__/g, '<span class="md-underline">$1</span>');

    // 8. 書名號 ~w(text)w~
    html = html.replace(/~w\((.*?)\)w~/g, '<span class="md-bookname">$1</span>');

    // 9. 換行處理
    html = html.replace(/\n/g, '<br>');

    return html;
}

/**
 * 清除 Markdown 與 Ruby 符號 (供 TTS 語音朗讀使用)
 * 確保語音不會讀出「中括號」或「假名註記」
 */
function stripMarkdown(text) {
    if (!text) return '';
    return text
        // 先處理 [漢字|假名]，只保留漢字
        .replace(/\[(.*?)\|(.*?)\]/g, '$1')
        // 處理其餘符號
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
 * @param {string} lang - 語系 (預設 zh-TW, 日語請傳 ja-JP, 英語請傳 en-US)
 * @param {number} rate - 語速 (0.1 ~ 10)
 * @param {function} callback - 朗讀結束後的回到函式
 */
function speak(text, lang = 'zh-TW', rate = 1.0, callback = null) {
    if (!window.speechSynthesis) return;
    
    // 停止當前所有發音
    window.speechSynthesis.cancel();

    // 清理 Markdown 標籤，避免發音錯誤
    const cleanText = stripMarkdown(text);
    const utterance = new SpeechSynthesisUtterance(cleanText);
    
    // 自動尋找最佳語音對象
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

// 監測網路狀態
window.addEventListener('offline', () => {
    window.location.href = '../offline.html';
});

// 當發音物件清單改變時重新初始化 (部分瀏覽器需要)
window.speechSynthesis.onvoiceschanged = () => {
    console.log("語音引擎已就緒");
};