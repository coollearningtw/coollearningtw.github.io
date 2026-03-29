document.addEventListener("DOMContentLoaded", () => {
    const JSON_PATH = 'data/announcements.json';
    const STORAGE_KEY = 'anno_hide_date'; 

    // 1. 檢查是否為「直接進入」(非返回)
    const navEntry = performance.getEntriesByType("navigation")[0];
    if (navEntry && navEntry.type === 'back_forward') {
        return; 
    }

    // 2. 檢查今日不再顯示
    const todayStr = new Date().toISOString().split('T')[0];
    if (localStorage.getItem(STORAGE_KEY) === todayStr) {
        return;
    }

    // 3. 載入並渲染
    fetch(JSON_PATH)
        .then(r => r.json())
        .then(data => {
            const validAnnos = filterValidAnnouncements(data.announcements);
            if (validAnnos.length > 0) {
                new AnnouncementModal(validAnnos);
            }
        })
        .catch(err => console.error("公告載入失敗", err));
});

function filterValidAnnouncements(list) {
    if (!list) return [];
    const now = new Date();
    return list.filter(item => {
        const startDate = new Date(item.date);
        const endDate = new Date(startDate);
        endDate.setDate(startDate.getDate() + 7); // 截止日期 = date + 7天
        return now <= endDate; // 在截止日期之前都顯示
    });
}

// 使用 Class 封裝邏輯
class AnnouncementModal {
    constructor(annos) {
        this.annos = annos;
        this.currentIndex = 0;
        this.timer = null;
        this.progressTimer = null;
        this.isExpanded = false;
        this.autoPlayTime = 5000; // 5秒
        
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

                <div class="anno-footer">
                    <label class="dont-show-row">
                        <input type="checkbox" id="anno-no-show"> 今日不再顯示
                    </label>
                    <button class="btn-close">關閉</button>
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

        const startDate = new Date(data.date);
        const endDate = new Date(startDate);
        endDate.setDate(startDate.getDate() + 7);

        const contentHTML = `
            ${data.cover ? `<img src="${data.cover}" class="anno-cover">` : ''}
            <div class="anno-body">
                <h2 class="anno-title">${data.title}</h2>
                <div class="anno-date">(${index + 1}/${this.annos.length})</div>
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

        if (!this.isExpanded) {
            this.startAutoPlay();
        }
    }

    close() {
        const checkbox = this.overlay.querySelector('#anno-no-show');
        if (checkbox && checkbox.checked) {
            const todayStr = new Date().toISOString().split('T')[0];
            localStorage.setItem('anno_hide_date', todayStr);
        }
        this.stopAutoPlay();
        this.overlay.classList.remove('show');
        setTimeout(() => this.overlay.remove(), 300);
    }
}

// 簡單的 Markdown 轉換器 (可依需求擴充)
function parseMarkdown(text) {
    return text
        .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
        .replace(/\*(.*?)\*/g, '<em>$1</em>');
}
