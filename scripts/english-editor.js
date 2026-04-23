/* --- scripts/english-editor.js --- */

let currentMode = 'words'; // 'words' or 'textbook'
let dataStore = { words: { sources: [] }, textbook: { sources: [] } };
let expandedKeys = new Set();

const ICONS = {
    folder: '<svg class="svg-icon" style="color:#64748b" viewBox="0 0 24 24"><path d="M10 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2h-8l-2-2z"/></svg>',
    file: '<svg class="svg-icon" style="color:#94a3b8" viewBox="0 0 24 24"><path d="M14 2H6c-1.1 0-1.99.9-1.99 2L4 20c0 1.1.89 2 1.99 2H18c1.1 0 2-.9 2-2V8l-6-6zm2 16H8v-2h8v2zm0-4H8v-2h8v2zm-3-5V3.5L18.5 9H13z"/></svg>',
    drag: '<svg class="svg-icon" viewBox="0 0 24 24"><path d="M11 18c0 1.1-.9 2-2 2s-2-.9-2-2 .9-2 2-2 2 .9 2 2zm-2-8c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0-6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm6 4c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm0 2c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0 6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z"/></svg>',
    plus: '<svg class="svg-icon" viewBox="0 0 24 24"><path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/></svg>'
};

async function init() {
    // 載入暫存或原始檔案
    const draftWords = localStorage.getItem('english_words_draft');
    const draftText = localStorage.getItem('english_textbook_draft');

    if (draftWords) dataStore.words = JSON.parse(draftWords);
    else dataStore.words = await (await fetch('https://raw.githubusercontent.com/coollearningtw/cool-learning-data/refs/heads/main/english.json')).json();

    if (draftText) dataStore.textbook = JSON.parse(draftText);
    else dataStore.textbook = await (await fetch('https://raw.githubusercontent.com/coollearningtw/cool-learning-data/refs/heads/main/english-textbook.json')).json();

    if (dataStore.words.sources.length) expandedKeys.add('source-0');
    render();
}

function switchTab(m) {
    currentMode = m;
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.toggle('active', b.id === `tab-${m}`));
    render();
}

function render() {
    const root = document.getElementById('editor-content');
    root.innerHTML = '';
    const currentDB = currentMode === 'words' ? dataStore.words : dataStore.textbook;

    currentDB.sources.forEach((src, sIdx) => {
        const srcKey = `source-${sIdx}`;
        const srcEl = document.createElement('div');
        srcEl.className = `source-block ${expandedKeys.has(srcKey) ? 'expanded' : ''}`;
        srcEl.innerHTML = `
            <div class="accordion-header" onclick="toggleKey('${srcKey}')">
                <div style="font-weight: 600; display:flex; align-items:center; gap:8px;">
                    ${ICONS.folder} ${src.name}
                </div>
                <div style="display:flex; gap:5px;">
                    <button class="btn-action" style="padding:4px 8px" onclick="event.stopPropagation(); editSrc(${sIdx})">改名</button>
                    <button class="btn-action" style="padding:4px 8px; color:#ef4444" onclick="event.stopPropagation(); delSrc(${sIdx})">刪除</button>
                </div>
            </div>
            <div class="lesson-container">
                ${src.lessons.map((l, lIdx) => {
                    const lKey = `l-${sIdx}-${lIdx}`;
                    const items = currentMode === 'words' ? l.vocabulary : l.sentences;
                    return `
                    <div class="lesson-block">
                        <div class="lesson-header" onclick="event.stopPropagation(); toggleKey('${lKey}')" style="cursor:pointer">
                            <div style="display:flex; align-items:center; gap:8px">
                                ${ICONS.file} L${l.lesson} ${l.title}
                            </div>
                            <button class="btn-action" style="padding:2px 6px; color:#ef4444; border:none" onclick="event.stopPropagation(); delLes(${sIdx},${lIdx})">✕</button>
                        </div>
                        <div style="display: ${expandedKeys.has(lKey) ? 'block' : 'none'}">
                            ${items.map((item, iIdx) => `
                                ${createSeparatorHtml(sIdx, lIdx, iIdx)}
                                <div class="data-item">
                                    <div class="drag-handle">${ICONS.drag}</div>
                                    <div style="flex:1">
                                        ${currentMode === 'words' ? `
                                            <div class="anno-grid">
                                                <div class="editable-cell" style="font-weight:600" onclick="startEdit(this,${sIdx},${lIdx},${iIdx},'word')">${item.word || '(Word)'}</div>
                                                <div class="editable-cell cell-pos" onclick="startEdit(this,${sIdx},${lIdx},${iIdx},'pos')">${item.pos || '(Pos)'}</div>
                                                <div class="editable-cell" onclick="startEdit(this,${sIdx},${lIdx},${iIdx},'chinese')">${item.chinese || '(Chinese)'}</div>
                                            </div>
                                        ` : `
                                            <div style="display:flex; flex-direction:column; gap:6px">
                                                <div class="editable-cell" onclick="startEdit(this,${sIdx},${lIdx},${iIdx},'en')">${item.en || '(English Content)'}</div>
                                                <div class="editable-cell cell-trans" onclick="startEdit(this,${sIdx},${lIdx},${iIdx},'ch')">${item.ch || '(Chinese Translation)'}</div>
                                            </div>
                                        `}
                                    </div>
                                    <button class="btn-action" style="border:none; color:#ef4444" onclick="delItem(${sIdx},${lIdx},${iIdx})">✕</button>
                                </div>
                            `).join('')}
                            ${createSeparatorHtml(sIdx, lIdx, items.length)}
                        </div>
                    </div>`;
                }).join('')}
                <button class="btn-action" style="margin-top:15px; width:100%; justify-content:center; border-style:dashed" onclick="addLes(${sIdx})">${ICONS.plus} 新增課程單元</button>
            </div>
        `;
        root.appendChild(srcEl);
    });
}

function createSeparatorHtml(sIdx, lIdx, iIdx) {
    return `<div class="insert-separator" onclick="addItem(${sIdx},${lIdx},${iIdx})"><div class="insert-line"></div><div style="color:#94a3b8; padding:0 10px; font-size:12px;">+ 插入</div><div class="insert-line"></div></div>`;
}

function toggleKey(k) { expandedKeys.has(k) ? expandedKeys.delete(k) : expandedKeys.add(k); render(); }

function startEdit(el, s, l, i, f) {
    if (el.querySelector('textarea')) return;
    const items = currentMode === 'words' ? dataStore.words.sources[s].lessons[l].vocabulary : dataStore.textbook.sources[s].lessons[l].sentences;
    const val = items[i][f] || '';
    el.innerHTML = `<textarea class="inline-textarea">${val}</textarea>`;
    const t = el.querySelector('textarea');
    t.focus();
    t.onblur = () => {
        items[i][f] = t.value;
        sync();
        render();
    };
}

function sync() {
    localStorage.setItem('english_words_draft', JSON.stringify(dataStore.words));
    localStorage.setItem('english_textbook_draft', JSON.stringify(dataStore.textbook));
    document.getElementById('status').innerText = '💾 已自動暫存';
}

function editSrc(s) {
    const db = currentMode === 'words' ? dataStore.words : dataStore.textbook;
    const n = prompt('版本名稱:', db.sources[s].name);
    if (n) { db.sources[s].name = n; sync(); render(); }
}

function delSrc(s) {
    const db = currentMode === 'words' ? dataStore.words : dataStore.textbook;
    if (confirm('確定刪除整個版本？')) { db.sources.splice(s, 1); sync(); render(); }
}

function addLes(s) {
    const db = currentMode === 'words' ? dataStore.words : dataStore.textbook;
    db.sources[s].lessons.push({ lesson: 1, title: 'New Lesson', vocabulary: [], sentences: [] });
    sync(); render();
}

function delLes(s, l) {
    const db = currentMode === 'words' ? dataStore.words : dataStore.textbook;
    if (confirm('確定刪除此課程？')) { db.sources[s].lessons.splice(l, 1); sync(); render(); }
}

function addItem(s, l, atIndex) {
    const db = currentMode === 'words' ? dataStore.words : dataStore.textbook;
    const arr = currentMode === 'words' ? db.sources[s].lessons[l].vocabulary : db.sources[s].lessons[l].sentences;
    const newItem = currentMode === 'words' ? { word: '', pos: '', chinese: '' } : { en: '', ch: '' };
    
    if (atIndex !== undefined) arr.splice(atIndex, 0, newItem);
    else arr.push(newItem);
    
    sync(); render();
}

function delItem(s, l, i) {
    const db = currentMode === 'words' ? dataStore.words : dataStore.textbook;
    const arr = currentMode === 'words' ? db.sources[s].lessons[l].vocabulary : db.sources[s].lessons[l].sentences;
    arr.splice(i, 1);
    sync(); render();
}

function addNewSource() {
    const db = currentMode === 'words' ? dataStore.words : dataStore.textbook;
    db.sources.push({ name: 'New Source', lessons: [] });
    sync(); render();
}

function resetDraft() {
    if (confirm('確定清除所有修改並還原？')) {
        localStorage.removeItem('english_words_draft');
        localStorage.removeItem('english_textbook_draft');
        location.reload();
    }
}

function downloadJSON() {
    const db = currentMode === 'words' ? dataStore.words : dataStore.textbook;
    const filename = currentMode === 'words' ? 'english.json' : 'english-textbook.json';
    const b = new Blob([JSON.stringify(db, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(b);
    a.download = filename;
    a.click();
}

init();