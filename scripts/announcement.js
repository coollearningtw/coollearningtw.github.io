// --- scripts/announcement.js ---

document.addEventListener("DOMContentLoaded", () => {
    // 1. 定義資料路徑
    const JSON_PATH = 'https://raw.githubusercontent.com/coollearningtw/cool-learning-data/refs/heads/main/announcements.json';
    const STORAGE_KEY = 'anno_last_seen_interval'; // 儲存最後一次看到的時段起點

    // 2. 獲取當前時段的起點 (0:00 或 12:00)
    const getIntervalStart = () => {
        const now = new Date();
        const interval = new Date(now);
        interval.setMinutes(0, 0, 0);
        if (now.getHours() < 12) {
            interval.setHours(0);
        } else {
            interval.setHours(12);
        }
        return interval.getTime().toString();
    };

    // 3. 核心載入與判斷函式
    window.loadAndShowAnnouncements = (isManual = false) => {
        fetch(JSON_PATH + '?t=' + Date.now())
            .then(r => r.json())
            .then(data => {
                const validAnnos = filterValidAnnouncements(data.announcements);
                if (validAnnos.length > 0) {
                    const currentInterval = getIntervalStart();
                    const lastSeenInterval = localStorage.getItem(STORAGE_KEY);

                    // 如果是手動點擊，或者 當前時段大於上次看到的時段
                    if (isManual || currentInterval !== lastSeenInterval) {
                        new AnnouncementModal(validAnnos);
                        // 只有在自動彈出時才更新 localStorage，確保手動查看不影響下次自動彈出
                        if (!isManual) {
                            localStorage.setItem(STORAGE_KEY, currentInterval);
                        }
                    }
                }
            })
            .catch(err => console.error("公告載入失敗", err));
    };

    // 4. 網頁載入時執行自動檢查
    // 檢查是否為返回操作，避開重複觸發
    const navEntry = performance.getEntriesByType("navigation")[0];
    if (!(navEntry && navEntry.type === 'back_forward')) {
        window.loadAndShowAnnouncements(false);
    }
});

function filterValidAnnouncements(list) {
    if (!list) return [];
    const now = new Date();
    return list.filter(item => {
        const startDate = new Date(item.date);
        const endDate = new Date(startDate);
        endDate.setDate(startDate.getDate() + 7); // 預設顯示 7 天
        return now <= endDate;
    });
}

class AnnouncementModal {
    constructor(annos) {
        // 如果畫面上已經有公告，先移除
        const existing = document.querySelector('.anno-overlay');
        if (existing) existing.remove();

        this.annos = annos;
        this.currentIndex = 0;
        this.timer = null;
        this.isExpanded = false;
        this.autoPlayTime = 5000;
        
        this.createDOM();
        this.renderContent(0, 'init');
        
        if (this.annos.length > 1) {
            this.startAutoPlay();
        }
    }

    createDOM() {
        this.overlay = document.createElement('div');
        this.overlay.className = 'anno-overlay';
        this.overlay.innerHTML = `
            <div class="anno-card">
                ${this.annos.length > 1 ? `
                    <div class="nav-arrow nav-prev">❮</div>
                    <div class="nav-arrow nav-next">❯</div>
                    <div class="progress-bar-container"><div class="progress-bar"></div></div>
                ` : ''}
                
                <div id="anno-content-wrapper" title="點擊展開閱讀更多"></div>

                <div class="anno-footer" style="justify-content: center;">
                    <button class="btn-close">關閉視窗</button>
                </div>
            </div>
        `;
        document.body.appendChild(this.overlay);
        
        setTimeout(() => this.overlay.classList.add('show'), 50);

        this.wrapper = this.overlay.querySelector('#anno-content-wrapper');
        this.bar = this.overlay.querySelector('.progress-bar');
        
        this.overlay.querySelector('.btn-close').onclick = () => this.close();
        
        this.wrapper.onclick = () => {
            this.stopAutoPlay();
            this.wrapper.classList.add('expanded');
            this.wrapper.removeAttribute('title');
            this.isExpanded = true;
            if(this.bar) this.bar.parentElement.style.display = 'none';
        };

        if (this.annos.length > 1) {
            this.overlay.querySelector('.nav-prev').onclick = (e) => {
                e.stopPropagation();
                this.manualSwitch(-1);
            };
            this.overlay.querySelector('.nav-next').onclick = (e) => {
                e.stopPropagation();
                this.manualSwitch(1);
            };
        }
    }

    renderContent(index, direction) {
        const data = this.annos[index];
        let blocksHtml = '';
        if (data.blocks) {
            data.blocks.forEach(b => {
                blocksHtml += `
                    <div class="anno-block">
                        ${b.subtitle ? `<div class="anno-subtitle">${parseMarkdown(b.subtitle)}</div>` : ''}
                        ${b.text ? `<div class="anno-text">${parseMarkdown(b.text)}</div>` : ''}
                        ${b.image ? `<img src="${b.image}" class="anno-img">` : ''}
                    </div>
                `;
            });
        }

        const tagHtml = data.tag ? `<span class="anno-tag" style="background-color: ${data.tagColor || '#0b76d1'}">${data.tag}</span>` : '';

        const contentHTML = `
            ${data.cover ? `<img src="${data.cover}" class="anno-cover">` : ''}
            <div class="anno-body">
                <h2 class="anno-title">${tagHtml}${data.title}</h2>
                <div class="anno-date">(${index + 1}/${this.annos.length}) 發布日期：${data.date}</div>
                ${blocksHtml}
            </div>
        `;

        this.wrapper.innerHTML = contentHTML;
        this.wrapper.classList.remove('slide-in-right', 'slide-in-left');
        void this.wrapper.offsetWidth;

        if (direction === 'next') {
            this.wrapper.classList.add('slide-in-right');
        } else if (direction === 'prev') {
            this.wrapper.classList.add('slide-in-left');
        }
        
        this.wrapper.scrollTop = 0;
    }

    startAutoPlay() {
        if (this.isExpanded) return;
        this.stopAutoPlay();
        
        if(this.bar) {
            this.bar.style.transition = 'none';
            this.bar.style.width = '0%';
            setTimeout(() => {
                this.bar.style.transition = `width ${this.autoPlayTime}ms linear`;
                this.bar.style.width = '100%';
            }, 50);
        }

        this.timer = setTimeout(() => {
            this.nextSlide();
        }, this.autoPlayTime);
    }

    stopAutoPlay() {
        if (this.timer) clearTimeout(this.timer);
        if (this.bar) {
            this.bar.style.transition = 'none';
            this.bar.style.width = '0%';
        }
    }

    nextSlide() {
        this.currentIndex = (this.currentIndex + 1) % this.annos.length;
        this.renderContent(this.currentIndex, 'next');
        this.startAutoPlay();
    }

    manualSwitch(direction) {
        this.stopAutoPlay();
        if (direction === 1) {
            this.currentIndex = (this.currentIndex + 1) % this.annos.length;
            this.renderContent(this.currentIndex, 'next');
        } else {
            this.currentIndex = (this.currentIndex - 1 + this.annos.length) % this.annos.length;
            this.renderContent(this.currentIndex, 'prev');
        }
        if (!this.isExpanded) this.startAutoPlay();
    }

    close() {
        this.stopAutoPlay();
        this.overlay.classList.remove('show');
        setTimeout(() => this.overlay.remove(), 300);
    }
}

// 簡單 Markdown 轉換
function parseMarkdown(text) {
    if (!text) return "";
    return text
        .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
        .replace(/\*(.*?)\*/g, '<em>$1</em>');
}