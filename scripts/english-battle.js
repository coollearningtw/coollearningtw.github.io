/**
 * 酷學習 - 單字知識王 Live 核心邏輯
 * 處理房間創建、加入驗證、題目同步、即時計分與雙人回合同步
 */

let myChannel;
let roomId, myName;
let isHost = false;
let quizPool = [];
let currentIndex = 0;
let numQuestions = 10;

// 回合同步狀態
let myDone = false, oppDone = false;
let canClick = false;
let timeLeft = 10, timerInterval;
let myScore = 0, oppScore = 0;
let myCombo = 0, oppCombo = 0;
let selectedScope = []; // 格式: [{source: "版本名", lessons: [1, 2]}]

document.addEventListener('DOMContentLoaded', () => {
    // 初始化時如果是創建視圖，載入單字範圍
    // 注意：switchView 函式會在切換時觸發 loadScope
});

// ==========================================
// 1. 視圖切換與範圍選擇
// ==========================================

function switchView(id) {
    document.querySelectorAll('.view-section').forEach(v => v.classList.remove('active-view'));
    const target = document.getElementById(id);
    if (target) target.classList.add('active-view');
    
    if (id === 'view-create') loadScope();
}

/** 載入教材 JSON 並生成選擇清單 */
async function loadScope() {
    const listEl = document.getElementById('scope-list');
    if (!listEl) return;
    
    try {
        const res = await fetch('https://raw.githubusercontent.com/coollearningtw/cool-learning-data/refs/heads/main/english.json');
        const data = await res.json();
        listEl.innerHTML = '';
        
        data.sources.forEach(src => {
            const group = document.createElement('div');
            group.className = 'version-group';
            let chips = src.lessons.map(l => 
                `<div class="chip" onclick="toggleChip(this, '${src.name}', ${l.lesson})">${l.title}</div>`
            ).join('');
            group.innerHTML = `<span class="version-name">${src.name}</span><div class="lesson-chips">${chips}</div>`;
            listEl.appendChild(group);
        });
    } catch (err) {
        listEl.innerText = "無法載入單字庫，請檢查網路連線。";
    }
}

function toggleChip(el, srcName, lesNum) {
    el.classList.toggle('selected');
    let version = selectedScope.find(v => v.source === srcName);
    if (!version) {
        version = { source: srcName, lessons: [] };
        selectedScope.push(version);
    }
    if (el.classList.contains('selected')) {
        version.lessons.push(lesNum);
    } else {
        version.lessons = version.lessons.filter(n => n !== lesNum);
    }
}

function setNum(n, el) {
    numQuestions = n;
    document.querySelectorAll('.num-btn').forEach(b => b.classList.remove('active'));
    el.classList.add('active');
}

// ==========================================
// 2. 房間管理 (Supabase Table 交互)
// ==========================================

/** 房主：創建房間並寫入資料表 */
async function createRoom() {
    const nameInp = document.getElementById('host-name');
    myName = nameInp.value.trim() || "房主";
    
    if (selectedScope.every(s => s.lessons.length === 0)) {
        return alert("請至少選擇一個課次作為比賽範圍！");
    }

    // 生成六位數碼
    roomId = Math.floor(100000 + Math.random() * 900000).toString();
    document.getElementById('display-code').innerText = roomId;
    
    const supabase = window.supabaseClient;
    const { error } = await supabase.from('active_rooms').insert([{
        room_code: roomId,
        host_name: myName,
        settings: { scope: selectedScope, num: numQuestions },
        status: 'waiting'
    }]);

    if (error) {
        console.error(error);
        return alert("創房失敗，請檢查資料庫 RLS 設定。");
    }
    
    isHost = true;
    startConnection();
}

/** 加入者：搜尋房間並驗證是否存在 */
async function joinRoom() {
    const codeInp = document.getElementById('input-code');
    const nameInp = document.getElementById('joiner-name');
    roomId = codeInp.value.trim();
    myName = nameInp.value.trim() || "挑戰者";

    if (roomId.length !== 6) return alert("請輸入 6 位數房間代碼");

    const supabase = window.supabaseClient;
    const btn = document.getElementById('btn-search');
    btn.disabled = true;
    btn.innerText = "搜尋中...";

    // 向 Supabase 查詢代碼
    const { data, error } = await supabase
        .from('active_rooms')
        .select('*')
        .eq('room_code', roomId);
    
    if (error || !data || data.length === 0) {
        btn.disabled = false;
        btn.innerText = "搜尋並進入房間";
        return alert("❌ 找不到該房間！請確認代碼是否正確。");
    }

    // 成功查到房間，讀取房主預設好的設定
    const roomData = data[0];
    numQuestions = roomData.settings.num;
    selectedScope = roomData.settings.scope;
    isHost = false;
    
    document.getElementById('display-code').innerText = roomId;
    startConnection();
}

// ==========================================
// 3. 即時對戰連線 (Supabase Realtime)
// ==========================================

function startConnection() {
    switchView('view-lobby');
    document.getElementById('lobby-my-name').innerText = myName;

    const supabase = window.supabaseClient;
    myChannel = supabase.channel(`battle_${roomId}`, {
        config: { presence: { key: myName } }
    });

    myChannel
        .on('presence', { event: 'sync' }, () => {
            const state = myChannel.presenceState();
            const players = Object.keys(state);
            
            if (players.length === 2) {
                const opp = players.find(p => p !== myName);
                document.getElementById('opp-slot').classList.add('active');
                document.getElementById('lobby-opp-name').innerText = opp;
                document.getElementById('lobby-status').innerText = "⚔️ 雙方已就緒，即將開戰...";
                
                // 房主負責發題並廣播
                if (isHost) prepareAndSyncQuiz();
            }
        })
        .on('broadcast', { event: 'sync_quiz' }, (payload) => {
            if (!isHost) {
                quizPool = payload.payload.quiz;
                startCountdown();
            }
        })
        .on('broadcast', { event: 'report_stat' }, (payload) => {
            if (payload.payload.user !== myName) {
                oppScore = payload.payload.score;
                oppDone = payload.payload.isDone;
                oppCombo = payload.payload.combo;
                updateArenaUI();
                checkRoundSync(); // 檢查是否可以跳下一題
            }
        })
        .subscribe(async (status) => {
            if (status === 'SUBSCRIBED') await myChannel.track({ online_at: new Date().toISOString() });
        });
}

/** 房主從教材庫挑選題目並傳給挑戰者 */
async function prepareAndSyncQuiz() {
    const res = await fetch('https://raw.githubusercontent.com/coollearningtw/cool-learning-data/refs/heads/main/english.json');
    const data = await res.json();
    let allWords = [];
    
    data.sources.forEach(src => {
        const scope = selectedScope.find(s => s.source === src.name);
        if (scope) {
            src.lessons.forEach(l => {
                if (scope.lessons.includes(l.lesson)) allWords.push(...l.vocabulary);
            });
        }
    });

    // 隨機抽題並洗牌
    quizPool = allWords.sort(() => 0.5 - Math.random()).slice(0, numQuestions);
    
    // 透過頻道傳送給對手
    myChannel.send({
        type: 'broadcast',
        event: 'sync_quiz',
        payload: { quiz: quizPool }
    });
    
    startCountdown();
}

// ==========================================
// 4. 遊戲核心循環
// ==========================================

function startCountdown() {
    const overlay = document.getElementById('game-overlay');
    const main = document.getElementById('over-main');
    overlay.style.display = 'flex';
    let sec = 3;
    const cd = setInterval(() => {
        sec--;
        if (sec > 0) main.innerText = sec;
        else {
            clearInterval(cd);
            main.innerText = "GO!";
            setTimeout(() => {
                overlay.style.display = 'none';
                switchView('view-arena');
                initArenaUI();
                nextRound();
            }, 800);
        }
    }, 1000);
}

function initArenaUI() {
    document.getElementById('arena-my-name').innerText = myName;
    document.getElementById('arena-opp-name').innerText = document.getElementById('lobby-opp-name').innerText;
}

function nextRound() {
    if (currentIndex >= quizPool.length) return showResult();
    
    // 重置單回合狀態
    myDone = false; 
    oppDone = false; 
    canClick = true; 
    timeLeft = 10;
    
    updateArenaUI();
    renderQuestion();
    startTimer();
    syncMyStatus();
}

function renderQuestion() {
    const q = quizPool[currentIndex];
    document.getElementById('q-word').innerText = q.word;
    document.getElementById('q-pos').innerText = q.pos || "";
    document.getElementById('arena-progress').innerText = `ROUND ${currentIndex + 1} / ${numQuestions}`;

    // 隨機生成 4 個選項
    let options = [q.chinese];
    while (options.length < 4) {
        let r = quizPool[Math.floor(Math.random() * quizPool.length)].chinese;
        if (!options.includes(r)) options.push(r);
    }
    options.sort(() => 0.5 - Math.random());

    const grid = document.getElementById('options-grid');
    grid.innerHTML = '';
    options.forEach(opt => {
        const b = document.createElement('button');
        b.className = 'opt-btn';
        b.innerText = opt;
        b.onclick = () => handleAnswer(opt, q.chinese, b);
        grid.appendChild(b);
    });
}

function handleAnswer(selected, correct, btn) {
    if (!canClick) return;
    canClick = false; 
    myDone = true;
    clearInterval(timerInterval); // 停止我的計時

    if (selected === correct) {
        // 計分：500(基礎) + 剩餘秒數*50 + Combo*50
        const bonus = Math.floor(timeLeft * 50) + (myCombo * 50);
        const earned = 500 + bonus;
        myScore += earned;
        myCombo++;
        if (btn) btn.classList.add('correct');
    } else {
        myCombo = 0;
        if (btn) btn.classList.add('wrong');
        // 自動標示正確答案
        Array.from(document.querySelectorAll('.opt-btn')).forEach(b => {
            if (b.innerText === correct) b.classList.add('correct');
        });
    }

    updateArenaUI();
    syncMyStatus();
    checkRoundSync();
}

function startTimer() {
    updateTimerVisual();
    timerInterval = setInterval(() => {
        timeLeft -= 0.1;
        if (timeLeft <= 0) {
            timeLeft = 0;
            clearInterval(timerInterval);
            if (!myDone) handleAnswer(null, quizPool[currentIndex].chinese, null); // 逾時強制答錯
        }
        updateTimerVisual();
    }, 100);
}

function updateTimerVisual() {
    document.getElementById('timer-num').innerText = Math.ceil(timeLeft);
    const offset = (timeLeft / 10) * 176;
    const circle = document.querySelector('#timer-svg circle');
    if (circle) circle.style.strokeDashoffset = 176 - offset;
}

/** 核心同步檢查：兩人都完成後 1.5 秒進入下一題 */
function checkRoundSync() {
    if (myDone && oppDone) {
        setTimeout(() => {
            currentIndex++;
            nextRound();
        }, 1500);
    }
}

/** 發送我的狀態給對手 */
function syncMyStatus() {
    if (myChannel) {
        myChannel.send({
            type: 'broadcast',
            event: 'report_stat',
            payload: { user: myName, score: myScore, combo: myCombo, isDone: myDone }
        });
    }
}

function updateArenaUI() {
    document.getElementById('my-score').innerText = myScore.toString().padStart(4, '0');
    document.getElementById('opp-score').innerText = oppScore.toString().padStart(4, '0');
    document.getElementById('dot-my').className = `status-dot ${myDone ? 'done' : ''}`;
    document.getElementById('dot-opp').className = `status-dot ${oppDone ? 'done' : ''}`;
}

// ==========================================
// 5. 遊戲結算
// ==========================================

async function showResult() {
    const overlay = document.getElementById('game-overlay');
    const main = document.getElementById('over-main');
    const sub = document.getElementById('over-sub');
    
    overlay.style.display = 'flex';
    if (myScore > oppScore) { 
        main.innerText = "🏆"; 
        sub.innerText = "你贏了！"; 
    } else if (myScore < oppScore) { 
        main.innerText = "💀"; 
        sub.innerText = "戰敗..."; 
    } else { 
        main.innerText = "🤝"; 
        sub.innerText = "平手！"; 
    }

    // 紀錄到排行榜
    window.supabaseClient.from('leaderboard').insert([{
        username: myName, 
        score: myScore, 
        room_code: roomId
    }]);

    // 房主負責關閉/清理資料庫房間紀錄
    if (isHost) {
        await window.supabaseClient.from('active_rooms').delete().eq('room_code', roomId);
    }

    // 顯示返回按鈕
    setTimeout(() => {
        const btn = document.createElement('button');
        btn.className = 'btn-battle btn-main';
        btn.innerText = "回到選單";
        btn.style.width = "200px";
        btn.onclick = () => location.reload();
        overlay.appendChild(btn);
    }, 2000);
}