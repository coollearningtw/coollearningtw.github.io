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
function preserveEscapedMarkdown(text) {
    const raw = [];
    let output = text
        // 先處理整個被跳脫的方括號內容，避免後續解析成註記或 Ruby
        .replace(/\\(\[.*?\])/g, (match, p1) => {
            const key = `@@RAW${raw.length}@@`;
            raw.push(p1);
            return key;
        })
        // 再處理單一被跳脫的 Markdown 字元
        .replace(/\\([*_~={}|\[\]`])/g, (match, p1) => {
            const key = `@@RAW${raw.length}@@`;
            raw.push(p1);
            return key;
        });
    return { output, raw };
}

function restoreEscapedMarkdown(text, raw) {
    return text.replace(/@@RAW(\d+)@@/g, (match, index) => raw[Number(index)] || '');
}

function parseBracketContent(content) {
    const pipeIndexes = [];
    for (let i = 0; i < content.length; i++) {
        if (content[i] === '|') pipeIndexes.push(i);
    }
    if (pipeIndexes.length >= 2) {
        const first = pipeIndexes[0];
        const last = pipeIndexes[pipeIndexes.length - 1];
        const text = content.slice(0, first);
        const sup = content.slice(first + 1, last);
        const id = content.slice(last + 1);
        if (!id) {
            return `[${content}]`;
        }
        if (sup.startsWith('^')) {
            const renderedSup = sup.slice(1);
            return `<span class="anno-link" data-id="${id}">${text}<sup class="anno-no">${renderedSup}</sup></span>`;
        }
        return `<span class="anno-link" data-id="${id}">${text}${sup}</span>`;
    }
    if (pipeIndexes.length === 1) {
        const first = pipeIndexes[0];
        const text = content.slice(0, first);
        const second = content.slice(first + 1);
        if (/^\d+$/.test(second)) {
            return `<span class="anno-link" data-id="${second}">${text}<sup class="anno-no">${second}</sup></span>`;
        }
        return `<ruby>${text}<rt>${second}</rt></ruby>`;
    }
    return `[${content}]`;
}

function stripBracketContent(content) {
    const pipeIndexes = [];
    for (let i = 0; i < content.length; i++) {
        if (content[i] === '|') pipeIndexes.push(i);
    }
    if (pipeIndexes.length >= 2) {
        const first = pipeIndexes[0];
        return content.slice(0, first);
    }
    if (pipeIndexes.length === 1) {
        const first = pipeIndexes[0];
        return content.slice(0, first);
    }
    return `[${content}]`;
}

function parseMarkdown(text) {
    if (!text) return '';
    const escaped = preserveEscapedMarkdown(text);
    let html = escapeHtml(escaped.output);

    // 1. 超連結 [文字](連結)
    html = html.replace(/\[(.*?)\]\((.*?)\)/g, '<a href="$2" class="md-link">$1</a>');

    // 2. [!情境標註] (例如：[!正式]、[!動漫用語])
    html = html.replace(/\[\!(.*?)\]/g, '<span class="md-context">$1</span>');

    // 3. [] 內如果有 2 個 | 就視為單字格式；1 個 | 則判斷是否為日文 Ruby 或註記
    html = html.replace(/\[([^\]]*?)\]/g, (match, content) => parseBracketContent(content));

    // 4. {語法/搭配詞} (例如：{～て形}、{V-dict})
    html = html.replace(/\{(.*?)\}/g, '<span class="md-tag">$1</span>');

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

    // 10. 程式碼片段 `text`
    html = html.replace(/`([^`]+?)`/g, '<code class="md-code">$1</code>');

    // 11. 換行處理
    html = html.replace(/\n/g, '<br>');

    html = restoreEscapedMarkdown(html, escaped.raw);
    return html;
}

/**
 * 清除 Markdown 與標籤符號 (供 TTS 語音朗讀使用)
 * 確保語音引擎不會讀出標點符號或註記代碼，日語會保留漢字部分
 */
function stripMarkdown(text) {
    if (!text) return '';
    const escaped = preserveEscapedMarkdown(text);
    let stripped = escaped.output
        .replace(/\[([^\]]*?)\]/g, (match, content) => stripBracketContent(content))
        .replace(/\[\!(.*?)\]/g, '')
        .replace(/\{(.*?)\}/g, '$1')
        .replace(/\*\*(.*?)\*\*/g, '$1')
        .replace(/\*(.*?)\*/g, '$1')
        .replace(/==(.*?)==/g, '$1')
        .replace(/~~(.*?)~~/g, '$1')
        .replace(/__(.*?)__/g, '$1')
        .replace(/`([^`]+?)`/g, '$1');
    return restoreEscapedMarkdown(stripped, escaped.raw);
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