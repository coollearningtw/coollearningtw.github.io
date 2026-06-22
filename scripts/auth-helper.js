/**
 * 酷學習 - 全域身分驗證輔助指令碼 (scripts/auth-helper.js)
 * 處理全站登入狀態監聽、頁首動態渲染與頁面路由保護
 */

(function() {
    // 確保全域 SupabaseClient 實例存在
    if (!window.supabaseClient) {
        console.error("AuthHelper 載入失敗：請先引入 supabase-config.js");
        return;
    }

    const supabase = window.supabaseClient;

    // 計算相對於根目錄的定位首碼，防止子資料夾連結失效
    function getRootPrefix() {
        const path = window.location.pathname;
        const subfolders = ['/tools/', '/english/', '/chinese/', '/japanese/', '/chess/', '/science/', '/admin/', '/auth/'];
        for (const folder of subfolders) {
            if (path.includes(folder)) return '../';
        }
        return './';
    }

    // 動態注入頭像與響應式隱藏文字的 CSS 樣式 (僅在首頁有作用)
    function injectStyles() {
        if (document.getElementById('auth-helper-styles')) return;
        const style = document.createElement('style');
        style.id = 'auth-helper-styles';
        style.textContent = `
            .header-user-badge {
                display: flex;
                align-items: center;
                gap: 8px;
                color: var(--primary, #0b76d1);
                font-weight: bold;
                font-size: 0.95rem;
                padding: 4px 10px;
                border-radius: 20px;
                transition: background 0.2s, transform 0.1s;
            }
            .header-user-badge:hover {
                background: var(--primary-light, #e3f2fd);
                transform: translateY(-1px);
            }
            .header-avatar {
                width: 32px;
                height: 32px;
                border-radius: 50%;
                object-fit: cover;
                border: 2px solid var(--primary-light, #e3f2fd);
                box-shadow: 0 2px 4px rgba(0,0,0,0.1);
                background: #f1f5f9;
            }
            @media (max-width: 500px) {
                .header-username {
                    display: none !important;
                }
            }
        `;
        document.head.appendChild(style);
    }

    const AuthHelper = {
        // 取得根目錄路徑
        rootPrefix: getRootPrefix(),

        // 判斷當前頁面是否需要強制登入身分驗證 (路由保護機制)
        isPageProtected: function() {
            const path = window.location.pathname;
            const protectedPages = ['profile.html', 'notebook.html', 'admin-editor', 'chinese-editor'];
            return protectedPages.some(page => path.includes(page));
        },

        // 強制保護頁面 (手動呼叫)
        protectPage: async function() {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) {
                window.location.href = this.rootPrefix + 'auth/login.html';
            }
        },

        // 登出帳號並清理 Session
        logout: async function() {
            const { error } = await supabase.auth.signOut();
            if (error) {
                console.error("登出發生錯誤:", error);
            }
            sessionStorage.removeItem('global_user_logged_in');
            window.location.href = this.rootPrefix + 'auth/login.html';
        },

        // 動態更新全站共用 Header 的右側區塊 (已限制僅限首頁修改)
        updateHeader: async function(user) {
            const path = window.location.pathname;
            
            // 核心安全檢驗：判斷當前是否在首頁 (根目錄 / 或 index.html)
            const isIndexPage = path.endsWith('/') || 
                                path.endsWith('/index.html') || 
                                (!path.includes('.html') && 
                                 !path.includes('/tools/') && 
                                 !path.includes('/english/') && 
                                 !path.includes('/chinese/') && 
                                 !path.includes('/japanese/') && 
                                 !path.includes('/chess/') && 
                                 !path.includes('/science/') && 
                                 !path.includes('/admin/') && 
                                 !path.includes('/auth/'));

            // 如果不是首頁，絕對不要修改 .header-right，百分之百保留原頁面設計的所有按鈕！
            if (!isIndexPage) {
                return;
            }

            const headerRight = document.querySelector('.header-right');
            if (!headerRight) return;

            if (user) {
                try {
                    // 已登入首頁：讀取使用者資料並在首頁顯示頭像
                    const { data: profile, error } = await supabase
                        .from('profiles')
                        .select('username, avatar_url')
                        .eq('id', user.id)
                        .single();

                    if (error) throw error;

                    const nickname = (profile && profile.username) ? profile.username : (user.email.split('@')[0]);
                    const avatarUrl = (profile && profile.avatar_url) ? profile.avatar_url : `https://api.dicebear.com/7.x/bottts/svg?seed=${user.id}`;
                    
                    headerRight.innerHTML = `
                        <a href="${this.rootPrefix}profile.html" class="header-user-badge" style="text-decoration:none;">
                            <img src="${avatarUrl}" class="header-avatar" alt="頭像" />
                            <span class="header-username">${nickname}</span>
                        </a>
                    `;
                } catch (e) {
                    const fallbackName = user.email.split('@')[0];
                    const fallbackAvatar = `https://api.api.dicebear.com/7.x/bottts/svg?seed=${user.id}`;
                    headerRight.innerHTML = `
                        <a href="${this.rootPrefix}profile.html" class="header-user-badge" style="text-decoration:none;">
                            <img src="${fallbackAvatar}" class="header-avatar" alt="頭像" />
                            <span class="header-username">${fallbackName}</span>
                        </a>
                    `;
                }
            } else {
                // 未登入首頁：顯示登入/註冊按鈕
                headerRight.innerHTML = `
                    <a href="${this.rootPrefix}auth/login.html" class="btn-tool-text" style="text-decoration:none;">登入 / 註冊</a>
                `;
            }
        },

        // 初始化驗證
        init: async function() {
            // 注入 RWD 樣式
            injectStyles();

            const { data: { user } } = await supabase.auth.getUser();
            
            // 更新 Header UI (如果是首頁會自動渲染)
            this.updateHeader(user);

            // 如果是保護頁面且未登入，立刻重導向至登入頁
            if (this.isPageProtected() && !user) {
                window.location.href = this.rootPrefix + 'auth/login.html';
            }
        }
    };

    // 監聽 Supabase 全域身分驗證事件 (自動同步首頁 UI)
    supabase.auth.onAuthStateChange((event, session) => {
        const user = session ? session.user : null;
        if (event === 'SIGNED_IN') {
            sessionStorage.setItem('global_user_logged_in', 'true');
            AuthHelper.updateHeader(user);
        } else if (event === 'SIGNED_OUT') {
            sessionStorage.removeItem('global_user_logged_in');
            AuthHelper.updateHeader(null);
            if (AuthHelper.isPageProtected()) {
                window.location.href = AuthHelper.rootPrefix + 'auth/login.html';
            }
        }
    });

    window.AuthHelper = AuthHelper;

    document.addEventListener('DOMContentLoaded', () => {
        AuthHelper.init();
    });

})();