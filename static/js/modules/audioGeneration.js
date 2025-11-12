// 音频生成模块
import { saveToHistory } from './history.js';
import { appState } from '../app.js';
import { logoutUser } from './AuthSystem.js';
import { showMessage } from './AuthSystem.js';

// 存储事件处理函数的引用，便于后续移除
const eventHandlers = {
    playButton: null,
    timeUpdate: null,
    progressClick: null,
    ended: null,
    speedControl: null,
    downloadBtn: null,
    retryBtn: null,
    waveformStyle: null
};

export function initAudioGeneration() {
    // 生成按钮点击事件
    const genButton = document.getElementById('gen_button');
    // 确保只绑定一次生成按钮事件
    if (!genButton._hasListener) {
        genButton.addEventListener('click', generateAudio);
        genButton._hasListener = true;
    }
    
    // 文本输入变化时更新分句
    const inputText = document.getElementById('input_text');
    if (!inputText._hasListener) {
        inputText.addEventListener('input', debounce(updateSegments, 500));
        inputText._hasListener = true;
    }
    
    // 分句最大Token数变化时更新分句
    const maxTextTokens = document.getElementById('max_text_tokens_per_segment');
    if (!maxTextTokens._hasListener) {
        maxTextTokens.addEventListener('input', function() {
            document.getElementById('max_text_tokens_value').textContent = this.value;
            updateSegments(); // 更新分句
        });
        maxTextTokens._hasListener = true;
    }

    // 波形风格切换按钮（如果存在）
    const waveformButtons = {
        mirrored: document.getElementById('btn-mirrored'),
        natural: document.getElementById('btn-natural'),
        symmetric: document.getElementById('btn-symmetric')
    };
    
    // 如果有波形切换按钮，则添加事件监听
    if (waveformButtons.mirrored) {
        let currentStyle = 'mirrored'; // 默认上下镜像
        
        Object.keys(waveformButtons).forEach(style => {
            if (waveformButtons[style]) {
                waveformButtons[style].addEventListener('click', function() {
                    // 更新按钮样式（选中态）
                    Object.values(waveformButtons).forEach(btn => {
                        if (btn) {
                            btn.classList.remove('bg-gold', 'text-gray-900');
                            btn.classList.add('bg-gray-700', 'text-white');
                        }
                    });
                    this.classList.remove('bg-gray-700', 'text-white');
                    this.classList.add('bg-gold', 'text-gray-900');
                    
                    // 切换波形风格
                    currentStyle = style;
                    const audioElement = document.getElementById('output_audio');
                    generateRandomWaveform(audioElement, 'output_audio_waveform', currentStyle);
                });
            }
        });
    }
}

// 更新分句结果
function updateSegments() {
    const text = document.getElementById('input_text').value;
    const maxTokens = document.getElementById('max_text_tokens_per_segment').value;
    const tableBody = document.getElementById('segments_table_body');
    
    if (!text.trim()) {
        tableBody.innerHTML = `
            <tr>
                <td colspan="3" class="py-4 px-3 text-center text-sm text-silver/60">输入铭文后显分句之果</td>
            </tr>
        `;
        return;
    }
    
    // 模拟调用后端API进行文本分句
    setTimeout(() => {
        // 简单的分句逻辑（实际项目中应由API返回）
        const segments = [];
        const words = text.split(/[，。,;.、？！\s]+/).filter(word => word.trim());
        
        let currentSegment = '';
        let currentTokens = 0;
        let index = 0;
        
        words.forEach(word => {
            const wordTokens = Math.ceil(word.length / 2); // 简单估算token数
            
            if (currentTokens + wordTokens > maxTokens) {
                // 当前段落已满，添加到结果
                if (currentSegment) {
                    segments.push({
                        index,
                        text: currentSegment,
                        tokens: currentTokens
                    });
                    index++;
                }
                // 开始新段落
                currentSegment = word;
                currentTokens = wordTokens;
            } else {
                // 添加到当前段落
                currentSegment += (currentSegment ? '，' : '') + word;
                currentTokens += wordTokens;
            }
        });
        
        // 添加最后一个段落
        if (currentSegment) {
            segments.push({
                index,
                text: currentSegment,
                tokens: currentTokens
            });
        }
        
        if (segments.length > 0) {
            let html = '';
            segments.forEach(segment => {
                html += `
                    <tr>
                        <td class="py-2 px-3 text-sm border-b border-gold/10">${segment.index + 1}</td>
                        <td class="py-2 px-3 text-sm border-b border-gold/10">${segment.text}</td>
                        <td class="py-2 px-3 text-sm border-b border-gold/10">${segment.tokens}</td>
                    </tr>
                `;
            });
            tableBody.innerHTML = html;
        } else {
            tableBody.innerHTML = `
                <tr>
                    <td colspan="3" class="py-4 px-3 text-center text-sm text-silver/60">无法解析文本，请检查输入</td>
                </tr>
            `;
        }
    }, 300);
}

// 生成音频
function generateAudio() {
    // 清理之前的事件监听器
    cleanupEventListeners();
    
    const text = document.getElementById('input_text').value;
    if (!text.trim()) {
        alert('请铸刻目标铭文');
        return;
    }
    if (!appState.user || !appState.token) {
        showMessage('请先登录后再使用生成功能', 'error');
        // 跳转到登录页面
        document.getElementById('auth-page').classList.remove('hidden');
        document.getElementById('current-page').classList.add('hidden');
        return;
    }
    // 检查是否选择了音色
    const promptAudioExample = document.getElementById('prompt_audio_example').value;
    const promptAudio = document.getElementById('prompt_audio');
    if (!promptAudioExample && (!promptAudio.files || promptAudio.files.length === 0)) {
        alert('请先选择或上传音色之范');
        return;
    }

    // 获取情绪控制方式（0=默认，1=调整情绪）
    const emoControlMethod = document.getElementById('emo_control_toggle').value;

    // 显示生成状态
    document.getElementById('output_container').classList.add('hidden');
    document.getElementById('generation_status').classList.remove('hidden');

    // 创建表单数据
    const formData = new FormData();
    formData.append('text', text);
    formData.append('emo_control_method', emoControlMethod);
    
    // 添加情感向量（如果启用）
    if (emoControlMethod == 1) {
        formData.append('vec1', document.getElementById('vec1').value);
        formData.append('vec2', document.getElementById('vec2').value);
        formData.append('vec3', document.getElementById('vec3').value);
        formData.append('vec4', document.getElementById('vec4').value);
        formData.append('vec5', document.getElementById('vec5').value);
        formData.append('vec6', document.getElementById('vec6').value);
        formData.append('vec7', document.getElementById('vec7').value);
        formData.append('vec8', document.getElementById('vec8').value);
    }
    
    // 添加高级参数
    formData.append('max_text_tokens_per_segment', document.getElementById('max_text_tokens_per_segment').value);
    formData.append('do_sample', document.getElementById('do_sample').checked ? 'true' : 'false');
    formData.append('top_p', document.getElementById('top_p').value);
    formData.append('top_k', document.getElementById('top_k').value);
    formData.append('temperature', document.getElementById('temperature').value);
    formData.append('length_penalty', document.getElementById('length_penalty').value);
    formData.append('num_beams', document.getElementById('num_beams').value);
    formData.append('repetition_penalty', document.getElementById('repetition_penalty').value);
    formData.append('max_mel_tokens', document.getElementById('max_mel_tokens').value);
    
    // 添加音频数据
    if (promptAudioExample) {
        formData.append('prompt_audio_example', promptAudioExample);
    } else if (promptAudio.files && promptAudio.files.length > 0) {
        formData.append('prompt_audio', promptAudio.files[0]);
    }

    // 调用后端API生成音频
    fetch('/generate', {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${appState.token}`
        },
        body: formData
    })
    .then(response => {
        if (response.status === 401) {
            // 处理未授权情况
            throw new Error('请先登录');
        }
        if (!response.ok) {
            throw new Error('生成音频失败');
        }
        return response.json();
    })
    .then(data => {
        // 隐藏生成状态
        document.getElementById('generation_status').classList.add('hidden');
        
        if (data.status === 'success' && data.audio_path) {
            // 获取DOM元素
            const audioElement = document.getElementById('output_audio');
            const customPlayer = document.getElementById('custom_audio_player');
            const playBtn = document.getElementById('custom_play_btn');
            const progressBar = document.getElementById('progress_bar');
            const timeDisplay = document.getElementById('time_display');
            const downloadBtn = document.getElementById('download_btn');
            const speedControl = document.getElementById('speed_control');
            const speedValue = document.getElementById('speed_value');

            // 重置音频元素
            audioElement.src = '';
            audioElement.load();
            audioElement.src = data.audio_path;
            customPlayer.classList.remove('hidden');
            
            // 播放按钮事件处理函数
            eventHandlers.playButton = () => {
                if (audioElement.paused) {
                    audioElement.play().catch(err => {
                        console.error('播放失败:', err);
                        showMessage('播放失败，请重试', 'error');
                    });
                    playBtn.innerHTML = '<i class="fa fa-pause"></i>';
                } else {
                    audioElement.pause();
                    playBtn.innerHTML = '<i class="fa fa-play"></i>';
                }
            };
            playBtn.addEventListener('click', eventHandlers.playButton);
            
            // 生成上下镜像波形（默认）
            generateRandomWaveform(audioElement, 'output_audio_waveform', 'mirrored');
            
            // 进度更新处理函数
            eventHandlers.timeUpdate = () => {
                if (isNaN(audioElement.duration)) return; // 避免NaN导致的问题
                
                const percent = (audioElement.currentTime / audioElement.duration) * 100;
                progressBar.style.width = `${percent}%`;
                
                // 更新时间显示
                const currentMinutes = Math.floor(audioElement.currentTime / 60);
                const currentSeconds = Math.floor(audioElement.currentTime % 60);
                const totalMinutes = Math.floor(audioElement.duration / 60);
                const totalSeconds = Math.floor(audioElement.duration % 60);
                
                timeDisplay.textContent = `${currentMinutes}:${currentSeconds.toString().padStart(2, '0')} / ${totalMinutes}:${totalSeconds.toString().padStart(2, '0')}`;
            };
            audioElement.addEventListener('timeupdate', eventHandlers.timeUpdate);

            // 点击进度条跳转处理函数
            eventHandlers.progressClick = (e) => {
                const rect = progressBar.parentElement.getBoundingClientRect();
                const pos = (e.clientX - rect.left) / rect.width;
                audioElement.currentTime = pos * audioElement.duration;
            };
            progressBar.parentElement.addEventListener('click', eventHandlers.progressClick);

            // 播放结束时重置处理函数
            eventHandlers.ended = () => {
                playBtn.innerHTML = '<i class="fa fa-play"></i>';
                progressBar.style.width = '0%';
            };
            audioElement.addEventListener('ended', eventHandlers.ended);

            // 显示输出容器
            document.getElementById('output_container').classList.remove('hidden');
            
            // 保存到历史记录
            const voiceName = document.getElementById('prompt_audio_name').textContent;
            saveToHistory(text, data.audio_path, voiceName);
            
            // 语速控制处理函数
            eventHandlers.speedControl = function() {
                const speed = parseFloat(this.value);
                audioElement.playbackRate = speed;
                speedValue.textContent = `${speed}x`;
            };
            speedControl.addEventListener('input', eventHandlers.speedControl);

            // 下载按钮处理函数
            eventHandlers.downloadBtn = function() {
                const speed = parseFloat(speedControl.value);
                const downloadUrl = `${audioElement.src}?speed=${speed}`;
                
                const a = document.createElement('a');
                a.href = downloadUrl;
                a.download = `generated_audio_${new Date().getTime()}_${speed}x.mp3`;
                document.body.appendChild(a);
                a.click();
                // 使用setTimeout确保元素被正确移除
                setTimeout(() => document.body.removeChild(a), 100);
            };
            downloadBtn.addEventListener('click', eventHandlers.downloadBtn);

            // 添加音频错误处理
            eventHandlers.audioError = (e) => {
                console.error('音频错误:', e);
                showMessage('音频加载失败，请重试', 'error');
            };
            audioElement.addEventListener('error', eventHandlers.audioError);

        } else {
            throw new Error(data.message || '生成音频失败');
        }
    })
    .catch(error => {
        console.error('生成音频错误:', error);
        document.getElementById('generation_status').classList.add('hidden');
        
        // 处理认证错误
        if (error.message === '请先登录') {
            showMessage('登录已过期，请重新登录', 'error');
            logoutUser();
            document.getElementById('auth-page').classList.remove('hidden');
            document.getElementById('current-page').classList.add('hidden');
            return;
        }
        
        document.getElementById('output_container').classList.remove('hidden');
        document.getElementById('output_container').innerHTML = `
            <p class="text-red-400 text-sm">生成失败: ${error.message}</p>
            <button id="retry_generation" class="mt-2 px-3 py-1 bg-gold/20 hover:bg-gold/30 text-gold rounded-lg text-xs transition-colors">
                <i class="fa fa-refresh mr-1"></i>重试
            </button>
        `;
        
        // 重试按钮事件
        const retryBtn = document.getElementById('retry_generation');
        eventHandlers.retryBtn = generateAudio;
        retryBtn.addEventListener('click', eventHandlers.retryBtn);
    });
}

// 清理所有事件监听器
function cleanupEventListeners() {
    const audioElement = document.getElementById('output_audio');
    const playBtn = document.getElementById('custom_play_btn');
    const progressBar = document.getElementById('progress_bar');
    const downloadBtn = document.getElementById('download_btn');
    const speedControl = document.getElementById('speed_control');
    const retryBtn = document.getElementById('retry_generation');
    const waveformButtons = {
        mirrored: document.getElementById('btn-mirrored'),
        natural: document.getElementById('btn-natural'),
        symmetric: document.getElementById('btn-symmetric')
    };
    
    // 移除波形相关事件监听器
    if (audioElement._waveformData) {
        audioElement.removeEventListener('play', audioElement._waveformData.handlePlay);
        audioElement.removeEventListener('pause', audioElement._waveformData.handlePause);
        audioElement.removeEventListener('ended', audioElement._waveformData.handlePause);
        if (audioElement._waveformData.animationId) {
            cancelAnimationFrame(audioElement._waveformData.animationId);
        }
        audioElement._waveformData = null;
    }
    
    // 移除其他事件监听器
    if (eventHandlers.playButton && playBtn) {
        playBtn.removeEventListener('click', eventHandlers.playButton);
    }
    if (eventHandlers.timeUpdate && audioElement) {
        audioElement.removeEventListener('timeupdate', eventHandlers.timeUpdate);
    }
    if (eventHandlers.progressClick && progressBar && progressBar.parentElement) {
        progressBar.parentElement.removeEventListener('click', eventHandlers.progressClick);
    }
    if (eventHandlers.ended && audioElement) {
        audioElement.removeEventListener('ended', eventHandlers.ended);
    }
    if (eventHandlers.speedControl && speedControl) {
        speedControl.removeEventListener('input', eventHandlers.speedControl);
    }
    if (eventHandlers.downloadBtn && downloadBtn) {
        downloadBtn.removeEventListener('click', eventHandlers.downloadBtn);
    }
    if (eventHandlers.retryBtn && retryBtn) {
        retryBtn.removeEventListener('click', eventHandlers.retryBtn);
    }
    if (eventHandlers.audioError && audioElement) {
        audioElement.removeEventListener('error', eventHandlers.audioError);
    }
    if (eventHandlers.waveformStyle) {
        Object.values(waveformButtons).forEach(btn => {
            if (btn) {
                btn.removeEventListener('click', eventHandlers.waveformStyle);
            }
        });
    }
    
    // 重置事件处理函数存储对象
    Object.keys(eventHandlers).forEach(key => {
        eventHandlers[key] = null;
    });
}

// 防抖函数
function debounce(func, wait) {
    let timeout;
    return function() {
        const context = this;
        const args = arguments;
        clearTimeout(timeout);
        timeout = setTimeout(() => func.apply(context, args), wait);
    };
}

// 随机动态波形生成函数（减少条数、放慢速度版本）
// 修改后的随机动态波形生成函数（按指定参数配置）
function generateRandomWaveform(audioElement, containerId, style = 'natural') {
    // 清理旧事件与动画
    if (audioElement._waveformData) {
        audioElement.removeEventListener('play', audioElement._waveformData.handlePlay);
        audioElement.removeEventListener('pause', audioElement._waveformData.handlePause);
        audioElement.removeEventListener('ended', audioElement._waveformData.handlePause);
        if (audioElement._waveformData.animationId) {
            cancelAnimationFrame(audioElement._waveformData.animationId);
        }
    }

    const container = typeof containerId === 'string' ? document.getElementById(containerId) : containerId;
    if (!container) {
        console.error('波形容器未找到:', containerId);
        return;
    }

    // 清空容器并设置样式
    container.innerHTML = '';
    
    // 应用指定的参数配置
    const barCount = 32; // 波形条数: 32 条
    const barWidth = 4; // 条宽度: 4px
    const barGap = 2.5; // 间距: 2.5px
    const updateSpeed = 120; // 更新速度: 120ms
    const transitionTime = 400; // 过渡时间: 400ms
    const energyDecay = 0.82; // 能量衰减: 0.89
    const centerWeight = 0.3; // 中心权重: 0.3
    const randomFactor = 0.7; // 随机波动: 0.7
    const maxHeight = 15; // 最大高度: 25px
    const minHeight = 2; // 最小高度
    
    // 设置容器样式
    container.className = 'audio-waveform flex justify-center w-full items-center';
    container.style.gap = `${barGap}px`;

    const bars = [];
    const waveformData = {
        isPlaying: audioElement.paused ? false : true,
        animationId: null,
        lastHeights: Array(barCount).fill(minHeight),
        energy: 0,
        energyDecay: energyDecay,
        updateInterval: updateSpeed
    };

    // 创建波形条
    for (let i = 0; i < barCount; i++) {
        const barGroup = document.createElement('div');
        barGroup.className = 'flex flex-col items-center';

        // 上半部分波形条
        const topBar = document.createElement('div');
        topBar.className = 'bg-gradient-to-t from-gold to-gold/70 rounded-t-full transition-all ease-out';
        topBar.style.width = `${barWidth}px`;
        topBar.style.height = `${minHeight}px`;
        topBar.style.minHeight = `${minHeight}px`;
        topBar.style.transitionDuration = `${transitionTime}ms`;

        // 下半部分波形条（镜像用）
        const bottomBar = document.createElement('div');
        bottomBar.className = 'bg-gradient-to-b from-gold to-gold/70 rounded-b-full transition-all ease-out';
        bottomBar.style.width = `${barWidth}px`;
        bottomBar.style.height = style === 'mirrored' ? `${minHeight}px` : '0px';
        bottomBar.style.minHeight = `${minHeight}px`;
        bottomBar.style.opacity = style === 'mirrored' ? '0.3' : '0';
        bottomBar.style.transitionDuration = `${transitionTime}ms`;

        barGroup.appendChild(topBar);
        barGroup.appendChild(bottomBar);
        container.appendChild(barGroup);
        bars.push({ top: topBar, bottom: bottomBar });
    }

    // 波形高度计算（应用指定参数）
    function getMirroredHeights() {
        waveformData.energy = Math.max(0.2, waveformData.energy * waveformData.energyDecay + (Math.random() * randomFactor));
        
        const centerIndex = barCount / 2;
        const heights = [];
        
        for (let i = 0; i < barCount; i++) {
            // 应用中心权重参数（0.3）
            const distanceFromCenter = Math.abs(i - centerIndex);
            const weight = 1 - (distanceFromCenter / centerIndex) * centerWeight;
            
            // 应用随机波动参数（0.7）
            const random = Math.random() * randomFactor + (1 - randomFactor);
            
            // 计算目标高度并应用平滑过渡
            const targetHeight = minHeight + (maxHeight * weight * random * waveformData.energy);
            const smoothHeight = waveformData.lastHeights[i] * 0.8 + targetHeight * 0.2;
            
            heights.push(Math.max(minHeight, smoothHeight));
        }
        
        waveformData.lastHeights = heights;
        return heights;
    }

    function getNaturalHeights() {
        waveformData.energy = Math.max(0.2, waveformData.energy * waveformData.energyDecay + (Math.random() * randomFactor));
        
        const centerIndex = barCount / 2;
        const heights = [];
        
        for (let i = 0; i < barCount; i++) {
            // 应用中心权重参数（0.3）使形状特征为"中间略高"
            const distanceFromCenter = Math.abs(i - centerIndex);
            const weight = 1 - (distanceFromCenter / centerIndex) * centerWeight;
            
            // 应用随机波动参数（0.7）
            const random = Math.random() * randomFactor + (1 - randomFactor);
            
            // 计算目标高度并应用平滑过渡
            const targetHeight = minHeight + (maxHeight * weight * random * waveformData.energy);
            const smoothHeight = waveformData.lastHeights[i] * 0.8 + targetHeight * 0.2;
            
            heights.push(Math.max(minHeight, smoothHeight));
        }
        
        waveformData.lastHeights = heights;
        return heights;
    }

    function getSymmetricHeights() {
        waveformData.energy = Math.max(0.2, waveformData.energy * waveformData.energyDecay + (Math.random() * randomFactor));
        
        const halfCount = Math.floor(barCount / 2);
        const leftHeights = [];
        
        for (let i = 0; i < halfCount; i++) {
            // 应用中心权重参数（0.3）
            const positionWeight = (i / halfCount) * (1 - centerWeight) + centerWeight;
            const random = Math.random() * randomFactor + (1 - randomFactor);
            
            const targetHeight = minHeight + (maxHeight * positionWeight * random * waveformData.energy);
            const smoothHeight = waveformData.lastHeights[i] * 0.8 + targetHeight * 0.2;
            
            leftHeights.push(Math.max(minHeight, smoothHeight));
        }
        
        const rightHeights = [...leftHeights].reverse();
        const heights = barCount % 2 !== 0 
            ? [...leftHeights, minHeight + (maxHeight * (Math.random() * 0.3 + 0.7) * waveformData.energy), ...rightHeights] 
            : [...leftHeights, ...rightHeights];
            
        waveformData.lastHeights = heights;
        return heights;
    }

    // 波形更新与动画
    function updateWaveform() {
        if (!waveformData.isPlaying) return;

        let heights;
        if (style === 'mirrored') heights = getMirroredHeights();
        else if (style === 'symmetric') heights = getSymmetricHeights();
        else heights = getNaturalHeights(); // 默认使用自然起伏

        bars.forEach((barPair, i) => {
            const height = heights[i];
            if (style === 'mirrored') {
                // 上下镜像
                barPair.top.style.height = `${height}px`;
                barPair.bottom.style.height = `${height}px`;
                const opacity = 0.4 + (height / maxHeight) * 0.6;
                barPair.top.style.opacity = opacity;
                barPair.bottom.style.opacity = opacity;
            } else {
                // 自然起伏或左右对称
                barPair.top.style.height = `${height}px`;
                barPair.top.style.opacity = 0.4 + (height / maxHeight) * 0.6;
                barPair.bottom.style.height = '0px';
                barPair.bottom.style.opacity = 0;
            }
        });

        // 使用setTimeout控制更新速度（120ms）
        waveformData.animationId = setTimeout(updateWaveform, waveformData.updateInterval);
    }

    // 播放状态同步
    waveformData.handlePlay = () => {
        waveformData.isPlaying = true;
        updateWaveform();
    };

    waveformData.handlePause = () => {
        waveformData.isPlaying = false;
        if (waveformData.animationId) {
            clearTimeout(waveformData.animationId);
            waveformData.animationId = null;
        }
        // 重置波形
        bars.forEach(barPair => {
            barPair.top.style.height = `${minHeight}px`;
            barPair.top.style.opacity = 0.3;
            if (style === 'mirrored') {
                barPair.bottom.style.height = `${minHeight}px`;
                barPair.bottom.style.opacity = 0.3;
            } else {
                barPair.bottom.style.height = '0px';
                barPair.bottom.style.opacity = 0;
            }
        });
        waveformData.lastHeights = Array(barCount).fill(minHeight);
        waveformData.energy = 0;
    };

    // 绑定音频事件
    audioElement.addEventListener('play', waveformData.handlePlay);
    audioElement.addEventListener('pause', waveformData.handlePause);
    audioElement.addEventListener('ended', waveformData.handlePause);
    audioElement._waveformData = waveformData;

    // 初始渲染
    updateWaveform();
}

