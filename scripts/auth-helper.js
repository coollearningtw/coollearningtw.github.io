/**
 * 酷學習 - 全域身分驗證與資料同步輔助 (scripts/auth-helper.js)
 * 處理：登入監聽、頁首頭像渲染、頁面保護、以及「下載清單」雲端同步。
 */

(function() {
    // 確保全域 SupabaseClient 實例存在
    if (!window.supabaseClient) {
        console.error("AuthHelper 載入失敗：請先引入 supabase-config.js");
        return;
    }

    const supabase = window.supabaseClient;

    // 計算相對路徑首碼
    function getRootPrefix() {
        const path = window.location.pathname;
        const subfolders = ['/tools/', '/english/', '/chinese/', '/japanese/', '/chess/', '/science/', '/community/', '/admin/', '/auth/'];
        for (const folder of subfolders) {
            if (path.includes(folder)) return '../';
        }
        return './';
    }

    // 動態注入頭像樣式
    function injectStyles() {
        if (document.getElementById('auth-helper-styles')) return;
        const style = document.createElement('style');
        style.id = 'auth-helper-styles';
        style.textContent = `
            .header-user-badge {
                display: flex; align-items: center; gap: 8px;
                color: var(--primary, #0b76d1); font-weight: bold;
                font-size: 0.95rem; padding: 4px 10px; border-radius: 20px;
                transition: background 0.2s, transform 0.1s;
            }
            .header-user-badge:hover { background: var(--primary-light, #e3f2fd); transform: translateY(-1px); }
            .header-avatar {
                width: 32px; height: 32px; border-radius: 50%;
                object-fit: cover; border: 2px solid var(--primary-light, #e3f2fd);
                box-shadow: 0 2px 4px rgba(0,0,0,0.1); background: #f1f5f9;
            }
            @media (max-width: 500px) { .header-username { display: none !important; } }
        `;
        document.head.appendChild(style);
    }

    const AuthHelper = {
        rootPrefix: getRootPrefix(),

        // 需要登入才能存取的頁面
        isPageProtected: function() {
            const path = window.location.pathname;
            const protectedPages = ['profile.html', 'notebook.html', 'download.html'];
            return protectedPages.some(page => path.includes(page));
        },

        /**
         * 核心功能：同步雲端下載清單到本地
         * 確保使用者換裝置後，選課頁面依然能看到已下載的課程
         */
        syncDownloadedList: async function(user) {
            if (!user) return;
            try {
                const { data, error } = await supabase
                    .from('user_progress')
                    .select('english_downloaded_list, chinese_downloaded_list')
                    .eq('user_id', user.id)
                    .single();

                if (error) throw error;

                if (data) {
                    // 同步到 LocalStorage 供各科目 Materials 頁面過濾使用
                    if (data.english_downloaded_list) {
                        localStorage.setItem('english_downloads', JSON.stringify(data.english_downloaded_list));
                    }
                    if (data.chinese_downloaded_list) {
                        localStorage.setItem('chinese_downloads', JSON.stringify(data.chinese_downloaded_list));
                    }
                    console.log("☁️ 雲端下載清單同步完成");
                }
            } catch (e) {
                console.warn("無法獲取雲端下載資料：", e);
            }
        },

        logout: async function() {
            await supabase.auth.signOut();
            sessionStorage.removeItem('global_user_logged_in');
            window.location.href = this.rootPrefix + 'auth/login.html';
        },

        /** 更新 Header (僅在首頁執行) */
        updateHeader: async function(user) {
            const path = window.location.pathname;
            const isIndexPage = path.endsWith('/') || path.endsWith('/index.html') || (!path.includes('.html') && path.split('/').length <= 2);

            if (!isIndexPage) return;

            const headerRight = document.querySelector('.header-right');
            if (!headerRight) return;

            if (user) {
                try {
                    const { data: profile } = await supabase.from('profiles').select('username, avatar_url').eq('id', user.id).single();
                    const nickname = profile?.username || user.email.split('@')[0];
                    const avatarUrl = profile?.avatar_url || `https://api.dicebear.com/7.x/bottts/svg?seed=${user.id}`;
                    
                    headerRight.innerHTML = `
                        <a href="${this.rootPrefix}profile.html" class="header-user-badge" style="text-decoration:none;">
                            <img src="${avatarUrl}" class="header-avatar" alt="頭像" />
                            <span class="header-username">${nickname}</span>
                        </a>
                    `;
                } catch (e) {
                    headerRight.innerHTML = `<a href="${this.rootPrefix}profile.html" class="btn-tool-text">個人檔案</a>`;
                }
            } else {
                headerRight.innerHTML = `<a href="${this.rootPrefix}auth/login.html" class="btn-tool-text">登入 / 註冊</a>`;
            }
        },

        init: async function() {
            injectStyles();
            const { data: { user } } = await supabase.auth.getUser();
            
            this.updateHeader(user);

            if (user) {
                await this.syncDownloadedList(user);
            }

            if (this.isPageProtected() && !user) {
                window.location.href = this.rootPrefix + 'auth/login.html';
            }
        }
    };

    // 監聽狀態改變
    supabase.auth.onAuthStateChange(async (event, session) => {
        const user = session ? session.user : null;
        if (event === 'SIGNED_IN') {
            sessionStorage.setItem('global_user_logged_in', 'true');
            AuthHelper.updateHeader(user);
            await AuthHelper.syncDownloadedList(user);
        } else if (event === 'SIGNED_OUT') {
            sessionStorage.removeItem('global_user_logged_in');
            AuthHelper.updateHeader(null);
            // 登出時清空本地下載紀錄 (選擇性，若希望訪客也能看則不刪除)
            // localStorage.removeItem('english_downloads');
            // localStorage.removeItem('chinese_downloads');
            if (AuthHelper.isPageProtected()) {
                window.location.href = AuthHelper.rootPrefix + 'auth/login.html';
            }
        }
    });

    window.AuthHelper = AuthHelper;
    document.addEventListener('DOMContentLoaded', () => AuthHelper.init());
})();