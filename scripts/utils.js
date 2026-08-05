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
        // Build classes based on rules:
        // - If id is numeric -> text should be bold black, number (sup) blue
        // - If sup is '*' -> whole item black italic
        // - If text contains multiple words/characters -> mark as multi (blue bold later)
        const classes = ['anno-link'];
        if (/^\d+$/.test(id)) classes.push('anno-id-num');
        if (sup === '*') classes.push('anno-asterisk');
        if ((text || '').trim().length > 1 && /\s/.test(text)) classes.push('anno-multi');

        if (sup.startsWith('^')) {
            const renderedSup = sup.slice(1);
            return `<span class="${classes.join(' ')}" data-id="${id}">${text}<sup class="anno-no">${renderedSup}</sup></span>`;
        }
        // If sup is present, show it as superscript where appropriate; otherwise just append
        if (sup) {
            // If sup is numeric, keep as sup element so we can color it
            if (/^\d+$/.test(sup) || sup === '*') {
                return `<span class="${classes.join(' ')}" data-id="${id}">${text}<sup class="anno-no">${sup}</sup></span>`;
            }
            return `<span class="${classes.join(' ')}" data-id="${id}">${text}${sup}</span>`;
        }
        return `<span class="${classes.join(' ')}" data-id="${id}">${text}</span>`;
    }
    if (pipeIndexes.length === 1) {
        const first = pipeIndexes[0];
        const text = content.slice(0, first);
        const second = content.slice(first + 1);
        // single pipe: numeric -> annotation with sup (and id), otherwise ruby
        if (/^\d+$/.test(second)) {
            return `<span class="anno-link anno-id-num" data-id="${second}">${text}<sup class="anno-no">${second}</sup></span>`;
        }
        if (second === '*') {
            return `<span class="anno-link anno-asterisk">${text}</span>`;
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

    // 10. 程式碼片段 ```text```
    html = html.replace(/```([^`]+?)```/g, '<code class="md-code">$1</code>');

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
    // 強力抑制：若全域抑制旗標開啟，或剛剛點擊過標註，則不要朗讀
    try {
        if (window.__suppressSpeak) {
            if (callback) callback();
            return;
        }
        if (window.__lastAnnoClick && (Date.now() - window.__lastAnnoClick) < 800) {
            if (callback) callback();
            return;
        }
    } catch (e) {}

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
    // Post-process annotation links: group multi-part annotations and apply styles
    try {
        const annoEls = Array.from(document.querySelectorAll('.anno-link[data-id]'));
        const groups = {};
        annoEls.forEach(el => {
            const id = el.getAttribute('data-id');
            if (!groups[id]) groups[id] = [];
            groups[id].push(el);
            // star-marked anno-link should be black italic and not show trailing star
            const mainText = el.textContent || '';
            if (/\*+$/.test(mainText)) {
                el.classList.add('anno-asterisk');
                if (el.children.length === 0) {
                    el.textContent = mainText.replace(/\*+$/,'');
                } else {
                    el.innerHTML = el.innerHTML.replace(/\*+$/,'');
                }
            }
            // mark single-element multi-word items for later
            if (/\S+\s+\S+/.test(mainText)) {
                el.classList.add('anno-multi');
            }
        });

        Object.keys(groups).forEach(id => {
            const items = groups[id];
            // 如果同一 id 出現多於 1 個元素，整組都要變藍色粗體
            if (items.length > 1) {
                items.forEach(it => it.classList.add('anno-group'));
            }
            // 若單一元素但包含多字，也讓其呈現藍色粗體
            if (items.length === 1) {
                const txt = (items[0].textContent || '').trim();
                if (/\S+\s+\S+/.test(txt)) items[0].classList.add('anno-group');
            }
        });
        // Additional post-processing for annotation-like elements
        const extraNodes = Array.from(document.querySelectorAll('.anno-link, .word-chip, .example-word, .example-word-self'));
        extraNodes.forEach(el => {
            const txt = (el.textContent || '').trim();
            if (!txt) return;
            // trailing asterisk -> treat as anno-asterisk, remove trailing stars for clean display
            if (/\*+$/.test(txt)) {
                el.classList.add('anno-asterisk');
                if (el.children.length === 0) {
                    el.textContent = txt.replace(/\*+$/,'');
                } else {
                    el.innerHTML = el.innerHTML.replace(/\*+$/,'');
                }
            }
            // contains digits -> mark as anno-id-num and wrap digits in <sup class="anno-no">
            if (/\d/.test(txt)) {
                el.classList.add('anno-id-num');
                try {
                    el.innerHTML = el.innerHTML.replace(/(\d+)/g, '<sup class="anno-no">$1</sup>');
                } catch (e) {}
            }
            // multi-word
            if (/\S+\s+\S+/.test(txt)) {
                el.classList.add('anno-multi', 'anno-group');
            }
        });
    } catch (e) {
        console.warn('anno-group postprocess failed', e);
    }

    // Function to process a single annotation-like node (used by MutationObserver)
    function processAnnoNode(el) {
        if (!el || !el.textContent) return;
        const original = el.textContent.trim();
        if (!original) return;
        // trailing asterisk
        if (/\*+$/.test(original)) {
            el.classList.add('anno-asterisk');
            // remove trailing asterisks from visible text
            // preserve existing innerHTML structure when possible
            if (el.children.length === 0) el.textContent = original.replace(/\*+$/,'');
            else el.innerHTML = el.innerHTML.replace(/\*+$/,'');
        }
        // digits -> wrap in sup
        if (/\d/.test(original)) {
            el.classList.add('anno-id-num');
            try {
                el.innerHTML = el.innerHTML.replace(/(\d+)/g, '<sup class="anno-no">$1</sup>');
            } catch(e) {}
        }
        // multi-word
        if (/\S+\s+\S+/.test(original)) {
            el.classList.add('anno-multi', 'anno-group');
        }
    }

    // Observe dynamic additions (English pages generate .word-chip after initial load)
    try {
        const observer = new MutationObserver(mutations => {
            for (const m of mutations) {
                if (m.type === 'childList' && m.addedNodes && m.addedNodes.length) {
                    m.addedNodes.forEach(node => {
                        if (!(node instanceof HTMLElement)) return;
                        if (node.matches && node.matches('.word-chip, .example-word, .example-word-self')) {
                            processAnnoNode(node);
                        }
                        // also check descendants
                        const found = node.querySelectorAll && node.querySelectorAll('.word-chip, .example-word, .example-word-self');
                        if (found && found.length) found.forEach(n => processAnnoNode(n));
                    });
                }
                if (m.type === 'characterData' && m.target && m.target.parentNode) {
                    const p = m.target.parentNode;
                    if (p.matches && p.matches('.word-chip, .example-word, .example-word-self')) processAnnoNode(p);
                }
            }
        });
        observer.observe(document.body, { childList: true, subtree: true, characterData: true });
    } catch (e) {
        console.warn('anno-group observer failed', e);
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

// 全域紀錄：最後一次在標註上點擊的時間（用來避免點擊標註時觸發朗讀）
window.__lastAnnoClick = 0;
// Record pointerdown (earlier than click) on annotation-like elements to better suppress immediate speak() calls
const ANNO_SELECTORS = '.anno-link, .word-chip, .example-word, .example-word-self';
document.addEventListener('pointerdown', (e) => {
    try {
        if (e.target && e.target.closest && e.target.closest(ANNO_SELECTORS)) {
            window.__lastAnnoClick = Date.now();
            // stronger suppression flag: set for a short window to completely block speak()
            try { window.__suppressSpeak = true; } catch (er) {}
            setTimeout(() => { try { window.__suppressSpeak = false; } catch(e){} }, 1200);
        }
    } catch (err) {
        // ignore
    }
}, true);
// fallback: also record click if pointerdown missed
document.addEventListener('click', (e) => {
    try {
        if (e.target && e.target.closest && e.target.closest(ANNO_SELECTORS)) {
            window.__lastAnnoClick = Date.now();
            try { window.__suppressSpeak = true; } catch (er) {}
            setTimeout(() => { try { window.__suppressSpeak = false; } catch(e){} }, 1200);
        }
    } catch (err) {
        // ignore
    }
}, true);