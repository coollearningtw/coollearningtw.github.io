window.DownloadManager = (function() {
    
    const KEYS = (sub) => ({
        shelf: sub === 'english' ? 'course_shelves' : 'chinese_shelves',
        downloaded: sub === 'english' ? 'english_downloads' : 'chinese_downloads',
        cloudField: sub === 'english' ? 'english_shelves' : 'chinese_shelves',
        cloudDLField: sub === 'english' ? 'english_downloaded_list' : 'chinese_downloaded_list',
        catalogUrl: `https://raw.githubusercontent.com/coollearningtw/cool-learning-data/refs/heads/main/${sub}-catalog.json`
    });

    /** 1. 彈出多選書架選擇器 */
    async function askShelfAndDownload(subject, lessons) {
        const k = KEYS(subject);
        const modal = document.getElementById('shelf-modal');
        const listRoot = document.getElementById('shelf-list');
        const confirmBtn = document.getElementById('btn-confirm-dl');
        
        if (!lessons || lessons.length === 0) return alert("未選取任何課程！");

        // 取得當前書架 (優先嘗試雲端)
        let shelves = [];
        const { data: { user } } = await window.supabaseClient.auth.getUser();
        if (user) {
            const { data } = await window.supabaseClient
                .from('user_progress')
                .select(k.cloudField)
                .eq('user_id', user.id)
                .maybeSingle();
            shelves = data ? data[k.cloudField] : [];
        } else {
            shelves = JSON.parse(localStorage.getItem(k.shelf) || '[]');
        }

        if (!shelves || shelves.length === 0) {
            alert("請先返回選課頁面建立至少一個書架！");
            location.href = subject === 'english' ? 'english-materials.html' : 'chinese-materials.html';
            return;
        }

        // 渲染書架選取清單
        listRoot.innerHTML = '';
        const selectedShelves = new Set();
        const CHECK_SVG = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="4"><polyline points="20 6 9 17 4 12"></polyline></svg>`;

        shelves.forEach(s => {
            const row = document.createElement('div');
            row.className = 'shelf-row';
            row.innerHTML = `
                <div class="ui-checkbox" id="chk-shelf-${s.id}">${CHECK_SVG}</div>
                <span style="font-weight:bold; color:#1e293b;">${s.name}</span>
            `;
            row.onclick = () => {
                const chk = row.querySelector('.ui-checkbox');
                if (selectedShelves.has(s.id)) {
                    selectedShelves.delete(s.id);
                    chk.classList.remove('checked');
                } else {
                    selectedShelves.add(s.id);
                    chk.classList.add('checked');
                }
            };
            listRoot.appendChild(row);
        });

        // 綁定確認下載按鈕
        confirmBtn.onclick = async () => {
            if (selectedShelves.size === 0) return alert("請選擇要存入的書架！");
            confirmBtn.disabled = true;
            confirmBtn.innerText = "處理中...";
            await executeMultiDownload(subject, Array.from(selectedShelves), lessons);
            confirmBtn.disabled = false;
            confirmBtn.innerText = "確認下載";
        };

        modal.style.display = 'flex';
    }

    /** 2. 執行批次寫入 (書架 + 下載清單) */
    async function executeMultiDownload(subject, shelfIds, lessons) {
        const k = KEYS(subject);
        const { data: { user } } = await window.supabaseClient.auth.getUser();
        
        let allShelves = [];
        let dlList = [];

        // A. 讀取最新狀態 (確保不覆蓋雲端現有資料)
        if (user) {
            const { data } = await window.supabaseClient
                .from('user_progress')
                .select(`${k.cloudField}, ${k.cloudDLField}`)
                .eq('user_id', user.id)
                .maybeSingle();
            
            allShelves = data?.[k.cloudField] || [];
            dlList = data?.[k.cloudDLField] || [];
        } else {
            allShelves = JSON.parse(localStorage.getItem(k.shelf) || '[]');
            dlList = JSON.parse(localStorage.getItem(k.downloaded) || '[]');
        }

        // B. 更新選中的書架內容
        shelfIds.forEach(id => {
            const shelf = allShelves.find(s => s.id === id);
            if (shelf) {
                if (!shelf.courses) shelf.courses = [];
                lessons.forEach(newL => {
                    const exists = shelf.courses.some(c => c.source === newL.source && c.lesson === newL.lesson);
                    if (!exists) shelf.courses.push(newL);
                });
            }
        });

        // C. 更新下載清單 (為了讓 Materials 頁面顯示)
        lessons.forEach(l => {
            if (!dlList.some(d => d.source === l.source && d.lesson === l.lesson)) {
                dlList.push({ source: l.source, lesson: l.lesson });
            }
        });

        // D. 存回儲存體
        try {
            if (user) {
                const { error } = await window.supabaseClient.from('user_progress').upsert({
                    user_id: user.id,
                    [k.cloudField]: allShelves,
                    [k.cloudDLField]: dlList,
                    updated_at: new Date().toISOString()
                }, { onConflict: 'user_id' });
                
                if (error) throw error;
            }

            // 同步回 LocalStorage
            localStorage.setItem(k.shelf, JSON.stringify(allShelves));
            localStorage.setItem(k.downloaded, JSON.stringify(dlList));

            alert(`✅ 成功下載 ${lessons.length} 個課程項目！`);
            document.getElementById('shelf-modal').style.display = 'none';

            // 如果在下載頁面，清除勾選
            if (window.selectedIndices) {
                window.selectedIndices.clear();
                if (typeof window.updateUI === 'function') window.updateUI();
            }

        } catch (err) {
            console.error("下載系統發生錯誤:", err);
            alert("❌ 下載失敗：" + err.message);
        }
    }

    /** 3. 代碼兌換 */
    async function redeemCode(subject, code) {
        const k = KEYS(subject);
        try {
            const res = await fetch(k.catalogUrl + '?t=' + Date.now());
            const catalog = await res.json();
            const match = (catalog.hidden_contents || []).find(h => h.code.toUpperCase() === code.trim().toUpperCase());
            
            if (match) {
                alert(`✨ 兌換成功：${match.name}`);
                await askShelfAndDownload(subject, match.lessons);
            } else {
                alert("❌ 找不到此代碼，請確認輸入是否正確。");
            }
        } catch (e) {
            alert("❌ 兌換失敗，請確認網路連線。");
        }
    }

    return { askShelfAndDownload, redeemCode };
})();