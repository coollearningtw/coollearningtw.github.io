/**
 * 酷學習廣場 - 核心邏輯 (scripts/community.js)
 * 修正版：解決按讚狀態消失問題
 */

const CommunityManager = {
    currentSubject: 'all',
    supabase: null,
    user: null,
    userLikes: new Set(), // 儲存當前用戶按過讚的貼文 ID (字串格式)

    /** 1. 初始化 */
    init: async function() {
        console.log("🚀 廣場系統啟動中...");
        this.supabase = window.supabaseClient;

        // 1. 獲取登入狀態
        const { data: { session } } = await this.supabase.auth.getSession();
        this.user = session ? session.user : null;

        // 2. 關鍵：如果已登入，必須先「等待」抓取按讚紀錄完成
        if (this.user) {
            await this.fetchUserLikes();
        }

        // 3. 綁定事件
        this.bindEvents();
        
        // 4. 開始抓取貼文 (此時 this.userLikes 已準備好)
        await this.fetchPosts(); 
        
        // 5. 設定實時更新
        this.setupRealtime();
    },

    /** 2. 綁定按鈕與彈窗事件 */
    bindEvents: function() {
        const submitBtn = document.getElementById('submit-post-btn');
        const openModalBtn = document.getElementById('open-post-modal');

        if (openModalBtn) {
            openModalBtn.onclick = () => {
                if (!this.user) {
                    alert('請先登入後再發布話題！');
                    window.location.href = '../auth/login.html';
                    return;
                }
                document.getElementById('post-modal').style.display = 'flex';
            };
        }

        if (submitBtn) {
            submitBtn.onclick = (e) => {
                e.preventDefault();
                this.handleCreatePost();
            };
        }
    },

    /** 3. 獲取用戶按過讚的清單 (修正型別處理) */
    fetchUserLikes: async function() {
        try {
            const { data, error } = await this.supabase
                .from('community_likes')
                .select('post_id')
                .eq('user_id', this.user.id);
            
            if (error) throw error;
            if (data) {
                // 將所有 ID 轉為字串存入 Set
                this.userLikes = new Set(data.map(l => String(l.post_id)));
                console.log("✅ 已同步用戶按讚紀錄:", this.userLikes.size);
            }
        } catch (e) { 
            console.error("❌ Likes sync failed:", e); 
        }
    },

    /** 4. 抓取貼文數據 (修正路徑與別名) */
    fetchPosts: async function() {
        const root = document.getElementById('feed-root');
        
        // 使用簡化的關聯名稱，確保 JSON 結構穩定
        let query = this.supabase
            .from('community_posts')
            .select(`
                *,
                profiles:author_id (username, avatar_url, role),
                community_likes (user_id),
                community_comments (id)
            `)
            .order('is_pinned', { ascending: false })
            .order('created_at', { ascending: false });

        if (this.currentSubject === 'official') {
            query = query.eq('type', 'official');
        } else if (this.currentSubject !== 'all') {
            query = query.eq('subject', this.currentSubject);
        }

        const { data: posts, error } = await query;

        if (error) {
            console.error("❌ 數據同步失敗:", error);
            root.innerHTML = `<div style="text-align:center; color:red; padding:40px;">同步失敗：${error.message}</div>`;
            return;
        }

        this.renderFeed(posts);
    },

    /** 5. 渲染列表 */
    renderFeed: function(posts) {
        const root = document.getElementById('feed-root');
        if (!posts || posts.length === 0) {
            root.innerHTML = `<div style="text-align:center; padding:100px 0; color:var(--text-sub); font-weight:bold; opacity:0.5;">目前此分類尚無討論內容</div>`;
            return;
        }
        root.innerHTML = posts.map(post => this.createPostCard(post)).join('');
    },

    /** 6. 建立貼文卡片 (修正狀態判斷) */
    createPostCard: function(post) {
        const author = post.profiles || {};
        const avatar = author.avatar_url || `https://api.dicebear.com/7.x/bottts/svg?seed=${post.author_id}`;
        
        // 關鍵：比對時確保 ID 是字串
        const isLiked = this.userLikes.has(String(post.id));
        const likeCount = post.community_likes ? post.community_likes.length : 0;
        const commentCount = post.community_comments ? post.community_comments.length : 0;
        const time = new Date(post.created_at).toLocaleDateString('zh-TW');

        const isMe = this.user && this.user.id === post.author_id;

        const iconMore = `<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="1"></circle><circle cx="12" cy="5" r="1"></circle><circle cx="12" cy="19" r="1"></circle></svg>`;
        const iconTime = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>`;
        const iconHeart = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path></svg>`;
        const iconChat = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg>`;

        return `
            <div class="post-card ${post.type === 'official' ? 'official-post' : ''}" 
                 id="post-${post.id}" 
                 onclick="CommunityManager.handleNavigate(event, '${post.id}', false)">
                
                <div class="post-options">
                    <button class="options-btn" onclick="CommunityManager.toggleMenu(event, '${post.id}')">
                        ${iconMore}
                    </button>
                    <div id="menu-${post.id}" class="options-menu">
                        ${isMe ? 
                            `<button class="menu-item delete" onclick="CommunityManager.handleDelete('${post.id}')">刪除話題</button>` : 
                            `<button class="menu-item" onclick="CommunityManager.handleReport('${post.id}')">內容檢舉</button>`
                        }
                    </div>
                </div>

                <div class="post-header">
                    <img src="${avatar}" class="author-avatar" alt="User">
                    <div class="author-info">
                        <div class="author-name">
                            <span>${escapeHtml(author.username || '學習者')}</span>
                            ${post.type === 'official' ? '<span class="badge badge-official">OFFICIAL</span>' : `<span class="badge badge-subject">${post.subject.toUpperCase()}</span>`}
                        </div>
                        <div class="post-meta">${iconTime}<span>${time}</span></div>
                    </div>
                </div>
                <div class="post-title">${escapeHtml(post.title)}</div>
                <div class="post-content">${parseMarkdown(post.content)}</div>
                
                <div class="post-footer">
                    <button class="action-btn ${isLiked ? 'liked' : ''}" 
                            onclick="CommunityManager.toggleLike(event, '${post.id}')">
                        ${iconHeart}
                        <span class="like-count">${likeCount}</span>
                    </button>
                    <button class="action-btn" 
                            onclick="CommunityManager.handleNavigate(event, '${post.id}', true)">
                        ${iconChat}
                        <span>${commentCount}</span>
                    </button>
                </div>
            </div>
        `;
    },

    /** 7. 跳轉邏輯 */
    handleNavigate: function(event, postId, shouldFocus = false) {
        if (event) event.stopPropagation();
        let url = `post.html?id=${postId}`;
        if (shouldFocus) url += `&action=comment`;
        window.location.href = url;
    },

    /** 8. 按讚邏輯 (強化錯誤回滾) */
    toggleLike: async function(event, postId) {
        event.stopPropagation();
        if (!this.user) return alert("登入後即可點讚！");

        const pid = String(postId);
        const isLiked = this.userLikes.has(pid);
        const card = document.getElementById(`post-${postId}`);
        if (!card) return;

        const btn = card.querySelector('.action-btn:first-child');
        const countSpan = btn.querySelector('.like-count');
        let currentCount = parseInt(countSpan.innerText);

        // --- 1. 立即修改 UI (Optimistic) ---
        if (isLiked) {
            this.userLikes.delete(pid);
            btn.classList.remove('liked');
            countSpan.innerText = Math.max(0, currentCount - 1);
            
            // --- 2. 非同步執行資料庫操作 ---
            const { error } = await this.supabase
                .from('community_likes')
                .delete()
                .match({ post_id: postId, user_id: this.user.id });
            
            if (error) {
                console.error("取消讚失敗:", error);
                // 失敗時回滾
                this.userLikes.add(pid);
                btn.classList.add('liked');
                countSpan.innerText = currentCount;
            }
        } else {
            this.userLikes.add(pid);
            btn.classList.add('liked');
            countSpan.innerText = currentCount + 1;

            const { error } = await this.supabase
                .from('community_likes')
                .insert([{ post_id: postId, user_id: this.user.id }]);
            
            if (error) {
                console.error("點讚失敗:", error);
                // 失敗時回滾
                this.userLikes.delete(pid);
                btn.classList.remove('liked');
                countSpan.innerText = currentCount;
                if (error.code === '23505') console.log("重複點讚已由資料庫阻擋");
            }
        }
    },

    /** 9. 選單邏輯與其他保持不變 */
    toggleMenu: function(event, postId) {
        event.stopPropagation();
        document.querySelectorAll('.options-menu').forEach(m => {
            if (m.id !== `menu-${postId}`) m.classList.remove('show');
        });
        const menu = document.getElementById(`menu-${postId}`);
        menu.classList.toggle('show');
        const close = () => { menu.classList.remove('show'); document.removeEventListener('click', close); };
        setTimeout(() => document.addEventListener('click', close), 10);
    },

    handleDelete: async function(postId) {
        if (!confirm("確定要移除這篇話題嗎？此動作無法撤銷。")) return;
        const { error } = await this.supabase.from('community_posts').delete().eq('id', postId);
        if (!error) {
            const card = document.getElementById(`post-${postId}`);
            card.style.transform = "scale(0.8) translateY(20px)";
            card.style.opacity = "0";
            setTimeout(() => card.remove(), 300);
        } else {
            alert("刪除失敗：" + error.message);
        }
    },

    handleReport: async function(postId) {
        if (!this.user) return alert("請登入後再進行檢舉。");
        if (!confirm("確定要檢舉此貼文嗎？管理員會進行審核。")) return;
        const { error } = await this.supabase.from('community_reports').insert([{ post_id: postId, reporter_id: this.user.id }]);
        if (error) alert("您已檢舉過此貼文，我們會盡快處理。");
        else alert("檢舉成功，感謝您的回饋。");
    },

    handleCreatePost: async function() {
        const titleInp = document.getElementById('post-title');
        const contentInp = document.getElementById('post-content');
        const subjectInp = document.getElementById('post-subject');
        const btn = document.getElementById('submit-post-btn');

        const title = titleInp.value.trim();
        const content = contentInp.value.trim();
        const subject = subjectInp.value;

        if (!title || !content) return alert("請填寫標題與內容！");

        btn.disabled = true;
        btn.innerText = "發送中...";

        const { error } = await this.supabase
            .from('community_posts')
            .insert([{
                author_id: this.user.id,
                title, content, subject,
                type: 'user'
            }]);

        if (error) {
            alert("發布失敗：" + error.message);
            btn.disabled = false;
            btn.innerText = "發布貼文";
        } else {
            titleInp.value = ''; contentInp.value = '';
            if (window.closeModal) window.closeModal();
            btn.disabled = false; btn.innerText = "發布貼文";
            await this.fetchPosts();
        }
    },

    switchFilter: function(subject, el) {
        this.currentSubject = subject;
        document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
        if (el) el.classList.add('active');
        this.fetchPosts();
    },

    setupRealtime: function() {
        this.supabase
            .channel('square_sync')
            .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'community_posts' }, () => {
                this.fetchPosts();
            })
            .subscribe();
    }
};

/** 全域方法掛載 */
window.switchFilter = (s, e) => CommunityManager.switchFilter(s, e);
window.CommunityManager = CommunityManager;

/** 啟動監測 */
document.addEventListener('DOMContentLoaded', () => {
    const check = setInterval(() => {
        if (window.supabaseClient) { 
            clearInterval(check); 
            CommunityManager.init(); 
        }
    }, 100);
});