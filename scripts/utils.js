/**
 * 通用 Markdown 解析器 (顯示用)
 * 支援: **粗體**, *斜體*, ==螢光筆==, ~~刪除線~~, __底線__, \n換行
 */
function escapeHtml(text) {
    if (!text) return "";
    return String(text).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
}

function parseMarkdown(text) {
  if (!text) return '';
  let html = escapeHtml(text);

  // 1. 註釋連結與編號：[文字|編號]
  html = html.replace(/\[(.*?)\|(.*?)\]/g,
    '<span class="anno-link" data-id="$2">$1<sup class="anno-no">$2</sup></span>');

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

  // 7. 底線 __text__（修正為非跨行匹配，適合地名）
  html = html.replace(/__(.*?)__/g, '<span class="md-underline">$1</span>');

  // 8. 最後統一處理換行：這一步最重要
  html = html.replace(/\n/g, '<br>');

  return html;
}

/**
 * 清除 Markdown 符號 (TTS 語音朗讀用)
 * 將 **text** 轉為 text，避免朗讀出符號
 */
function stripMarkdown(text) {
    if (!text) return '';
    return text
      .replace(/\*\*(.*?)\*\*/g, '$1')
      .replace(/\*(.*?)\*/g, '$1')
      .replace(/==(.*?)==/g, '$1')
      .replace(/~~(.*?)~~/g, '$1')
      .replace(/__(.*?)__/g, '$1');
}