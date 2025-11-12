// 历史记录模块
export function initHistory() {
    renderHistory();
    
    // 搜索功能
    document.getElementById('history_search').addEventListener('input', function() {
        const searchTerm = this.value.toLowerCase();
        filterHistory(searchTerm);
    });
    
    // 清空历史记录
    document.getElementById('clear_history').addEventListener('click', function() {
        if (confirm('确定要清空所有历史记录吗？')) {
            localStorage.removeItem('audioHistory');
            renderHistory();
        }
    });
}

// 保存到历史记录
export function saveToHistory(text, audioPath, voiceName) {
    // 获取当前时间
    const now = new Date();
    const formattedDate = now.toLocaleString();
    
    // 创建历史记录项
    const historyItem = {
        id: Date.now(),
        text: text,
        audioPath: audioPath,
        voiceName: voiceName,
        date: formattedDate,
        speed: 1.0 // 默认语速
    };
    
    // 从本地存储获取现有历史记录
    let history = JSON.parse(localStorage.getItem('audioHistory')) || [];
    
    // 添加新记录
    history.unshift(historyItem); // 添加到开头
    
    // 保存回本地存储
    localStorage.setItem('audioHistory', JSON.stringify(history));
    
    // 更新历史记录页面
    renderHistory();
}

// 渲染历史记录
function renderHistory() {
    const history = JSON.parse(localStorage.getItem('audioHistory')) || [];
    const container = document.getElementById('history_list');
    
    container.innerHTML = '';
    
    if (history.length === 0) {
        container.innerHTML = `
            <div class="empty-history">
                <i class="fa fa-history"></i>
                <p>暂无历史记录</p>
                <p class="text-sm mt-2">生成的音频将保存在这里</p>
            </div>
        `;
        return;
    }
    
    // 创建网格容器
    const gridContainer = document.createElement('div');
    gridContainer.className = 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6';
    
    history.forEach(item => {
        const historyItem = document.createElement('div');
        historyItem.className = 'history-item bg-ink-light rounded-lg border border-gold/10 p-4 hover:border-gold/30 transition-all duration-300';
        historyItem.setAttribute('data-id', item.id);
        
        // 截断过长的文本
        const truncatedText = item.text.length > 100 ? item.text.substring(0, 100) + '...' : item.text;
        
        historyItem.innerHTML = `
            <div class="history-header mb-3 flex justify-between items-start">
                <div class="history-info">
                    <div class="history-title text-gold font-medium text-sm mb-1">${item.voiceName}</div>
                </div>
                <div class="history-date text-silver/60 text-xs text-right">
                    ${item.date}
                </div>
            </div>
            
            <div class="history-text text-silver text-sm mb-4 h-12 overflow-hidden">
                ${truncatedText}
            </div>
            
            <div class="history-audio">
                <div class="custom-audio-player">
                    <div class="flex items-center space-x-3 mb-3">
                        <button class="history-play-btn w-8 h-8 rounded-full bg-gold/20 flex items-center justify-center text-gold hover:bg-gold/30 transition-colors" data-id="${item.id}">
                            <i class="fa fa-play text-xs"></i>
                        </button>
                        <div class="flex-1 h-1 bg-ink rounded-full overflow-hidden">
                            <div class="history-progress-bar h-full gold-flow w-0"></div>
                        </div>
                        <span class="history-time-display text-xs text-silver/70 min-w-[70px]">00:00</span>
                    </div>
                    
                    <div class="flex items-center justify-between mt-3">
                        <div>
                            <button class="history-download-btn flex items-center space-x-1 hover:text-gold transition-colors text-xs" data-id="${item.id}" data-speed="1.0">
                                <i class="fa fa-download"></i>
                                <span>下载</span>
                            </button>
                        </div>
                        <div class="flex items-center space-x-2">
                            <button class="delete-history-btn text-silver/60 hover:text-red-400 transition-colors text-xs" data-id="${item.id}" title="删除">
                                <i class="fa fa-trash"></i>
                            </button>
                        </div>
                    </div>
                    
                    <audio class="history-audio-element hidden" data-id="${item.id}" src="${item.audioPath}"></audio>
                </div>
            </div>
        `;
        
        gridContainer.appendChild(historyItem);
    });
    
    container.appendChild(gridContainer);
    
    // 添加事件监听
    attachHistoryEventListeners();
    setupHistoryAudioEvents();
}

// 添加历史记录事件监听
function attachHistoryEventListeners() {
    // 播放按钮
    document.querySelectorAll('.history-play-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            const id = this.getAttribute('data-id');
            toggleHistoryAudioPlayback(id);
        });
    });
    
    // 下载按钮
    document.querySelectorAll('.history-download-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            const id = this.getAttribute('data-id');
            const speed = parseFloat(this.getAttribute('data-speed'));
            downloadHistoryAudio(id, speed);
        });
    });
    
    // 删除按钮
    document.querySelectorAll('.delete-history-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            const id = this.getAttribute('data-id');
            deleteHistoryItem(id);
        });
    });
    
    // 进度条点击
    document.querySelectorAll('.history-item .history-progress-bar').forEach(bar => {
        bar.parentElement.addEventListener('click', function(e) {
            const id = this.closest('.history-item').getAttribute('data-id');
            const rect = this.getBoundingClientRect();
            const pos = (e.clientX - rect.left) / rect.width;
            seekHistoryAudio(id, pos);
        });
    });
}

// 切换历史记录音频的播放/暂停状态
function toggleHistoryAudioPlayback(id) {
    const audioElement = document.querySelector(`.history-audio-element[data-id="${id}"]`);
    const playBtn = document.querySelector(`.history-play-btn[data-id="${id}"]`);

    
    if (!audioElement || !playBtn) return;
    
    // 暂停其他正在播放的音频
    pauseAllOtherAudios(id);
    
    if (audioElement.paused) {
        audioElement.play()
            .then(() => {
                playBtn.innerHTML = '<i class="fa fa-pause"></i>';
                // 开始更新进度
                updateHistoryAudioProgress(id);
            })
            .catch(error => {
                console.error('播放失败:', error);
                alert('音频播放失败，请稍后再试');
            });
    } else {
        audioElement.pause();
        playBtn.innerHTML = '<i class="fa fa-play"></i>';
    }
}

// 暂停所有其他正在播放的音频
function pauseAllOtherAudios(currentId) {
    document.querySelectorAll('.history-audio-element').forEach(audio => {
        if (audio.getAttribute('data-id') !== currentId && !audio.paused) {
            audio.pause();
            const playBtn = document.querySelector(`.history-play-btn[data-id="${audio.getAttribute('data-id')}"]`);
            if (playBtn) {
                playBtn.innerHTML = '<i class="fa fa-play"></i>';
            }
        }
    });
}

// 更新历史记录音频的进度条和时间显示
function updateHistoryAudioProgress(id) {
    const audioElement = document.querySelector(`.history-audio-element[data-id="${id}"]`);
    const progressBar = document.querySelector(`.history-item[data-id="${id}"] .history-progress-bar`);
    const timeDisplay = document.querySelector(`.history-item[data-id="${id}"] .history-time-display`);
    
    if (!audioElement || !progressBar || !timeDisplay) return;
    
    // 如果音频已暂停，停止更新
    if (audioElement.paused) return;
    
    // 计算进度百分比
    const percent = (audioElement.currentTime / audioElement.duration) * 100;
    progressBar.style.width = `${percent}%`;
    
    // 更新时间显示
    timeDisplay.textContent = `${formatTime(audioElement.currentTime)} / ${formatTime(audioElement.duration)}`;
    
    // 继续更新
    requestAnimationFrame(() => updateHistoryAudioProgress(id));
}

// 格式化时间为 MM:SS 格式
function formatTime(seconds) {
    if (isNaN(seconds)) return "00:00";
    const minutes = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

// 音频跳转到指定位置
function seekHistoryAudio(id, position) {
    const audioElement = document.querySelector(`.history-audio-element[data-id="${id}"]`);
    if (!audioElement || isNaN(audioElement.duration)) return;
    
    // 计算目标时间
    const targetTime = position * audioElement.duration;
    audioElement.currentTime = targetTime;
    
    // 更新进度显示
    updateHistoryAudioProgress(id);
}

// 下载历史记录中的音频
function downloadHistoryAudio(id, speed) {
    const audioElement = document.querySelector(`.history-audio-element[data-id="${id}"]`);
    if (!audioElement || !audioElement.src) {
        alert('没有可下载的音频文件');
        return;
    }
    
    // 构建包含语速参数的下载链接
    const url = new URL(audioElement.src);
    url.searchParams.set('speed', speed);
    
    const a = document.createElement('a');
    a.href = url.toString();
    
    // 获取历史记录项以构建文件名
    const history = JSON.parse(localStorage.getItem('audioHistory')) || [];
    const item = history.find(item => item.id == id);
    
    if (item) {
        // 使用文本前几个字符作为文件名一部分
        const textPreview = item.text.substring(0, 10).replace(/\s+/g, '_');
        a.download = `history_${textPreview}_${speed}x.mp3`;
    } else {
        a.download = `history_audio_${id}_${speed}x.mp3`;
    }
    
    document.body.appendChild(a);
    a.click();
    setTimeout(() => document.body.removeChild(a), 100);
}

// 删除历史记录项
function deleteHistoryItem(id) {
    // 停止可能正在播放的音频
    const audioElement = document.querySelector(`.history-audio-element[data-id="${id}"]`);
    if (audioElement) {
        audioElement.pause();
    }
    
    // 从本地存储中删除
    let history = JSON.parse(localStorage.getItem('audioHistory')) || [];
    history = history.filter(item => item.id != id);
    localStorage.setItem('audioHistory', JSON.stringify(history));
    
    // 重新渲染历史记录
    renderHistory();
}

// 过滤历史记录
function filterHistory(searchTerm) {
    const historyItems = document.querySelectorAll('.history-item');
    
    historyItems.forEach(item => {
        const text = item.querySelector('.history-text').textContent.toLowerCase();
        const voiceName = item.querySelector('.history-title').textContent.toLowerCase();
        const date = item.querySelector('.history-date').textContent.toLowerCase();
        
        // 检查是否匹配搜索词
        const matches = text.includes(searchTerm) || 
                        voiceName.includes(searchTerm) || 
                        date.includes(searchTerm);
        
        // 显示或隐藏项目
        item.style.display = matches ? 'block' : 'none';
    });
}

// 为历史记录音频添加加载完成事件监听
function setupHistoryAudioEvents() {
    document.querySelectorAll('.history-audio-element').forEach(audio => {
        // 音频元数据加载完成后更新时间显示
        audio.addEventListener('loadedmetadata', function() {
            const id = this.getAttribute('data-id');
            const timeDisplay = document.querySelector(`.history-item[data-id="${id}"] .history-time-display`);
            if (timeDisplay) {
                timeDisplay.textContent = `00:00 / ${formatTime(this.duration)}`;
            }
        });
        
        // 音频播放结束后重置状态
        audio.addEventListener('ended', function() {
            const id = this.getAttribute('data-id');
            const playBtn = document.querySelector(`.history-play-btn[data-id="${id}"]`);
            const progressBar = document.querySelector(`.history-item[data-id="${id}"] .history-progress-bar`);
            
            if (playBtn) {
                playBtn.innerHTML = '<i class="fa fa-play"></i>';
            }
            
            if (progressBar) {
                progressBar.style.width = '0%';
            }
        });
    });
}