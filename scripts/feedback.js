document.addEventListener('DOMContentLoaded', () => {
    // === DOM 元素 ===
    const fab = document.getElementById('feedback-fab');
    const modalOverlay = document.getElementById('feedback-modal-overlay');
    const closeBtn = document.getElementById('feedback-close-btn');
    const form = document.getElementById('feedback-form');
    const submitBtn = document.getElementById('feedback-submit-btn');
    const successMsg = document.getElementById('feedback-success-msg');
    const closeSuccessBtn = document.getElementById('feedback-close-success-btn');
    
    // 表單欄位
    const typeSelect = document.getElementById('feedback-type');
    const cascadingContainer = document.getElementById('cascading-dropdowns');
    const sourceSelect = document.getElementById('feedback-source');
    const lessonSelect = document.getElementById('feedback-lesson');
    const wordSelect = document.getElementById('feedback-word');
    const detailsTextarea = document.getElementById('feedback-details');
    const scopeHiddenInput = document.getElementById('feedback-scope-hidden');

    let englishDataCache = null; // 用於快取英文資料

    // === 函式 ===

    // 顯示/隱藏 Modal
    const showModal = () => modalOverlay.classList.add('show');
    const hideModal = () => {
        modalOverlay.classList.remove('show');
        // 延遲重置表單，讓關閉動畫更流暢
        setTimeout(resetForm, 300);
    };

    // 重置表單到初始狀態
    const resetForm = () => {
        form.reset();
        form.style.display = 'block';
        successMsg.style.display = 'none';
        cascadingContainer.style.display = 'none';
        sourceSelect.innerHTML = '<option>選擇版本...</option>';
        lessonSelect.innerHTML = '<option>選擇課別...</option>';
        wordSelect.innerHTML = '<option>選擇單字...</option>';
        sourceSelect.disabled = true;
        lessonSelect.disabled = true;
        wordSelect.disabled = true;
        submitBtn.disabled = false;
        submitBtn.textContent = '送出回報';
    };

    // 載入英文資料 (JSON)
    async function loadEnglishData() {
        if (englishDataCache) {
            return englishDataCache;
        }
        try {
            const response = await fetch('https://raw.githubusercontent.com/coollearningtw/cool-learning-data/refs/heads/main/english.json'); // 注意路徑
            const data = await response.json();
            englishDataCache = data.sources || [];
            return englishDataCache;
        } catch (error) {
            console.error('無法載入英文資料:', error);
            return [];
        }
    }

    // 填充下拉選單
    function populateSelect(selectElement, options, placeholder) {
        selectElement.innerHTML = `<option value="" disabled selected>${placeholder}</option>`;
        options.forEach(option => {
            const opt = document.createElement('option');
            opt.value = option.value;
            opt.textContent = option.text;
            selectElement.appendChild(opt);
        });
        selectElement.disabled = false;
    }

    // 更新勘誤範圍的隱藏欄位值
    function updateScopeHiddenInput() {
        const source = sourceSelect.options[sourceSelect.selectedIndex]?.text || 'N/A';
        const lesson = lessonSelect.options[lessonSelect.selectedIndex]?.text || 'N/A';
        const word = wordSelect.options[wordSelect.selectedIndex]?.text || 'N/A';

        if (source === '選擇版本...') {
            scopeHiddenInput.value = 'N/A';
            return;
        }
        
        let scopeText = `版本: ${source}`;
        if (lesson !== '選擇課別...') {
            scopeText += ` | 課別: ${lesson}`;
        }
        if (word !== '選擇單字...') {
            scopeText += ` | 單字: ${word}`;
        }
        scopeHiddenInput.value = scopeText;
    }

    // === 事件監聽 ===

    // 開關 Modal
    fab.addEventListener('click', showModal);
    closeBtn.addEventListener('click', hideModal);
    closeSuccessBtn.addEventListener('click', hideModal);
    modalOverlay.addEventListener('click', (e) => {
        if (e.target === modalOverlay) {
            hideModal();
        }
    });

    // 處理回報類型變更
    typeSelect.addEventListener('change', async () => {
        if (typeSelect.value === '內容勘誤 (單字、翻譯錯誤等)') {
            cascadingContainer.style.display = 'block';
            const data = await loadEnglishData();
            const sourceOptions = data.map(source => ({ value: source.name, text: source.name }));
            populateSelect(sourceSelect, sourceOptions, '選擇版本...');
        } else {
            cascadingContainer.style.display = 'none';
        }
    });

    // 處理版本選擇
    sourceSelect.addEventListener('change', async () => {
        const selectedSource = sourceSelect.value;
        wordSelect.innerHTML = '<option>選擇單字...</option>';
        wordSelect.disabled = true;

        const data = await loadEnglishData();
        const source = data.find(s => s.name === selectedSource);
        if (source && source.lessons) {
            const lessonOptions = source.lessons.map(l => ({ value: l.lesson, text: `${l.title}` }));
            populateSelect(lessonSelect, lessonOptions, '選擇課別...');
        }
        updateScopeHiddenInput();
    });

    // 處理課別選擇
    lessonSelect.addEventListener('change', async () => {
        const selectedSource = sourceSelect.value;
        const selectedLesson = parseInt(lessonSelect.value);

        const data = await loadEnglishData();
        const source = data.find(s => s.name === selectedSource);
        if (source) {
            const lesson = source.lessons.find(l => l.lesson === selectedLesson);
            if (lesson && lesson.vocabulary) {
                const wordOptions = lesson.vocabulary.map(v => ({ value: v.word, text: v.word }));
                populateSelect(wordSelect, wordOptions, '選擇單字...');
            }
        }
        updateScopeHiddenInput();
    });

    // 單字選擇後更新隱藏欄位
    wordSelect.addEventListener('change', updateScopeHiddenInput);

    // 表單提交
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        submitBtn.disabled = true;
        submitBtn.textContent = '傳送中...';

        const formUrl = 'https://docs.google.com/forms/d/e/1FAIpQLSfIHMhn7pWnxM68taU2qtreZaNzgaoTx7lLOv0QVAH0Oji86g/formResponse';
        const formData = new FormData(form);
        
        // 確保即使勘誤範圍未選，也有預設值
        if (typeSelect.value !== '內容勘誤 (單字、翻譯錯誤等)') {
             scopeHiddenInput.value = 'N/A (非內容勘誤)';
        } else {
            updateScopeHiddenInput();
        }

        try {
            await fetch(formUrl, {
                method: 'POST',
                body: formData,
                mode: 'no-cors' // 必須使用 no-cors 模式
            });
            // 提交成功
            form.style.display = 'none';
            successMsg.style.display = 'block';

        } catch (error) {
            // 提交失敗
            console.error('表單提交失敗:', error);
            alert('提交失敗，請檢查您的網路連線或稍後再試。');
            submitBtn.disabled = false;
            submitBtn.textContent = '送出回報';
        }
    });
});