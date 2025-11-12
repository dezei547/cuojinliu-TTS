
// 存储所有示例数据
let allExamples = [];
// 存储所有预设音色（按分类组织）
let voicesByCategory = {
    'all': [] // 全部音色
};
// 当前选中的分类
let currentCategory = 'all';
// 存储收藏的音色
let favoriteVoices = JSON.parse(localStorage.getItem('favoriteVoices')) || [];

// DOM 元素加载完成后执行
document.addEventListener('DOMContentLoaded', function() {
    // 初始化页面导航
    initPageNavigation();
    
    // 初始化音频上传功能
    initAudioUpload('prompt');
    
    
    // 初始化音色库
    initVoiceLibrary();
    // 初始化收藏功能
    favoriteVoices = JSON.parse(localStorage.getItem('favoriteVoices')) || [];
    setupFavoriteButtonEvents();
    initModalVoiceLibrary();
    initHistory();
    // 功能设置折叠/展开
    const settingsToggle = document.getElementById('settings_toggle');
    const settingsContent = document.getElementById('settings_content');
    const settingsChevron = document.getElementById('settings_chevron');
    
    settingsToggle.addEventListener('click', function() {
        settingsContent.classList.toggle('hidden');
        settingsChevron.classList.toggle('rotate-180');
    });
    
    // 高级设置折叠/展开
    const advancedToggle = document.getElementById('advanced_settings_toggle');
    const advancedContent = document.getElementById('advanced_settings_content');
    const advancedChevron = document.getElementById('advanced_settings_chevron');
    
    
    advancedToggle.addEventListener('click', function() {
        advancedContent.classList.toggle('hidden');
        advancedChevron.classList.toggle('rotate-180');
    });
    
    // 分句结果折叠/展开
    const segmentsToggle = document.getElementById('segments_toggle');
    const segmentsContent = document.getElementById('segments_content');
    const segmentsChevron = document.getElementById('segments_chevron');
    
    segmentsToggle.addEventListener('click', function() {
        segmentsContent.classList.toggle('hidden');
        segmentsChevron.classList.toggle('rotate-180');
    });
    
    // 采样参数显示
    const temperature = document.getElementById('temperature');
    const temperatureValue = document.getElementById('temperature_value');
    temperature.addEventListener('input', function() {
        temperatureValue.textContent = this.value;
    });
    
    const topP = document.getElementById('top_p');
    const topPValue = document.getElementById('top_p_value');
    topP.addEventListener('input', function() {
        topPValue.textContent = this.value;
    });
    
    const topK = document.getElementById('top_k');
    const topKValue = document.getElementById('top_k_value');
    topK.addEventListener('input', function() {
        topKValue.textContent = this.value;
    });
    
    const numBeams = document.getElementById('num_beams');
    const numBeamsValue = document.getElementById('num_beams_value');
    numBeams.addEventListener('input', function() {
        numBeamsValue.textContent = this.value;
    });
    
    const maxMelTokens = document.getElementById('max_mel_tokens');
    const maxMelTokensValue = document.getElementById('max_mel_tokens_value');
    maxMelTokens.addEventListener('input', function() {
        maxMelTokensValue.textContent = this.value;
    });
    
    const maxTextTokens = document.getElementById('max_text_tokens_per_segment');
    const maxTextTokensValue = document.getElementById('max_text_tokens_value');
    maxTextTokens.addEventListener('input', function() {
        maxTextTokensValue.textContent = this.value;
        updateSegments(); // 更新分句
    });
    
    // 初始化情绪控制开关
    const emoToggle = document.getElementById('emo_control_toggle');
    const emoSwitch = document.getElementById('emo_control_switch');
    const emotionVectorGroup = document.getElementById('emotion_vector_group');
    const switchDot = emoToggle.parentElement.querySelector('.dot');
    const switchBg = emoToggle.parentElement.querySelector('div[class*="bg-ink"]');

    // 开关默认状态：未选中（银色），面板隐藏
    emoToggle.value = 0; // 0=默认（与音色一致），1=调整情绪
    emotionVectorGroup.classList.add('hidden');

    // 开关点击事件
    emoSwitch.addEventListener('click', function(e) {
        // 仅点击开关区域时触发（避免点击文字误触发）
        if (e.target.closest('.relative') || e.target === emoToggle) {
            emoToggle.checked = !emoToggle.checked;
            const isChecked = emoToggle.checked;

            // 更新开关样式
            if (isChecked) {
                // 选中：背景边框变金色，圆点变金色并右移
                switchBg.classList.remove('border-silver/30');
                switchBg.classList.add('border-gold/60');
                switchDot.classList.remove('bg-silver/60');
                switchDot.classList.add('bg-gold');
                switchDot.style.transform = 'translateX(30px)';
                emoToggle.value = 1; // 标记为“调整情绪”
            } else {
                // 未选中：恢复银色，圆点复位
                switchBg.classList.remove('border-gold/60');
                switchBg.classList.add('border-silver/30');
                switchDot.classList.remove('bg-gold');
                switchDot.classList.add('bg-silver/60');
                switchDot.style.transform = 'translateX(0)';
                emoToggle.value = 0; // 标记为“默认”
            }

            // 显示/隐藏情绪向量面板
            emotionVectorGroup.classList.toggle('hidden', !isChecked);
        }
    });
    
    // 文本输入变化时更新分句
    const inputText = document.getElementById('input_text');
    inputText.addEventListener('input', debounce(updateSegments, 500));
    
    // 生成按钮点击事件
    const genButton = document.getElementById('gen_button');
    genButton.addEventListener('click', generateAudio);
    


    
    // 音色库搜索功能
    const libraryVoiceSearch = document.getElementById('library_voice_search');
    libraryVoiceSearch.addEventListener('input', function() {
        filterLibraryVoices(this.value.toLowerCase());
    });
    // 在DOMContentLoaded事件中添加
    document.getElementById('open_voice_library').addEventListener('click', function() {

    });

    document.getElementById('close_voice_library').addEventListener('click', function() {
        document.getElementById('voice_library_modal').classList.add('hidden');
    });

    // 点击弹窗外部关闭
    document.getElementById('voice_library_modal').addEventListener('click', function(e) {
        if (e.target === this) {
            this.classList.add('hidden');
        }
    });


});

// 初始化页面导航
function initPageNavigation() {
    const sidebarItems = document.querySelectorAll('.sidebar-item');
    
    sidebarItems.forEach(item => {
        item.addEventListener('click', function(e) {
            e.preventDefault();
            
            // 更新导航选中状态
            sidebarItems.forEach(navItem => {
                navItem.classList.remove('active');
            });
            this.classList.add('active');
            
            // 显示对应的页面
            const pageId = this.getAttribute('data-page');
            document.querySelectorAll('.page-content').forEach(page => {
                page.classList.add('hidden');
            });
            document.getElementById(`${pageId}-page`).classList.remove('hidden');
            
            // 如果切换到音色库页面，刷新收藏列表
            if (pageId === 'voice-library') {
                renderFavoriteVoices();
            }
        });
    });
    
    // 初始化音色库标签页切换
    const libraryTabs = document.querySelectorAll('.voice-library-tab');
    
    libraryTabs.forEach(tab => {
        tab.addEventListener('click', function() {
            // 更新标签选中状态
            libraryTabs.forEach(t => {
                t.classList.remove('active');
            });
            this.classList.add('active');
            
            // 显示对应的内容
            const tabId = this.getAttribute('data-tab');
            document.querySelectorAll('#voice-library-page > div[id$="-content"]').forEach(content => {
                content.classList.add('hidden');
            });
            document.getElementById(`${tabId}-content`).classList.remove('hidden');
        });
    });
}

// 初始化音频上传功能
function initAudioUpload(prefix) {
    const container = document.getElementById(`${prefix}_audio_container`);
    const fileInput = document.getElementById(`${prefix}_audio`);
    const uploadState = document.getElementById(`${prefix}_audio_upload_state`);
    const previewState = document.getElementById(`${prefix}_audio_preview_state`);
    const audioPlayer = document.getElementById(`${prefix}_audio_player`);
    const audioName = document.getElementById(`${prefix}_audio_name`);
    const audioDuration = document.getElementById(`${prefix}_audio_duration`);
    const audioSize = document.getElementById(`${prefix}_audio_size`);
    const audioWave = document.getElementById(`${prefix}_audio_wave`);
    const removeButton = document.getElementById(`${prefix}_audio_remove`);
    const playButton = document.getElementById(`${prefix}_audio_play_btn`);
    const waveContainer = document.getElementById('audio_wave_container');
    
    // 创建波形可视化
    function createWaveform() {
        if (!audioWave) return;
        
        audioWave.innerHTML = '';
        // 创建30个波形条
        for (let i = 0; i < 30; i++) {
            const bar = document.createElement('div');
            bar.className = 'audio-wave-bar';
            // 随机高度创造波形效果
            bar.style.height = `${Math.random() * 30 + 5}px`;
            // 错开动画时间
            bar.style.animationDelay = `${i * 0.05}s`;
            audioWave.appendChild(bar);
        }
    }
    
    // 处理文件上传
    function handleFileUpload(file) {
        if (!file) return;
        
        // 清除所有音色卡片的选中状态
        document.querySelectorAll('.voice-card').forEach(card => {
            card.classList.remove('active');
        });
        
        // 显示文件名
        audioName.textContent = file.name;
        
        // 显示文件大小
        const sizeKB = (file.size / 1024).toFixed(1);
        audioSize.textContent = `${sizeKB} KB`;
        
        // 创建音频URL
        const audioURL = URL.createObjectURL(file);
        audioPlayer.src = audioURL;
        
        // 加载音频以获取时长
        audioPlayer.onloadedmetadata = function() {
            const minutes = Math.floor(audioPlayer.duration / 60);
            const seconds = Math.floor(audioPlayer.duration % 60);
            audioDuration.textContent = `${minutes}:${seconds.toString().padStart(2, '0')}`;
        };
        
        // 创建波形
        createWaveform();
        
        // 切换显示状态
        uploadState.classList.add('hidden');
        previewState.classList.remove('hidden');
    }
    
    // 播放/暂停控制
    playButton.addEventListener('click', function() {
        if (audioPlayer.paused) {
            audioPlayer.play()
                .then(() => {
                    // 切换按钮状态
                    playButton.innerHTML = '<i class="fa fa-pause text-xl"></i>';
                    playButton.classList.add('playing');
                    // 激活波纹动画
                    waveContainer.classList.add('playing');
                })
                .catch(error => {
                    console.error('播放音频失败:', error);
                });
        } else {
            audioPlayer.pause();
            // 恢复按钮状态
            playButton.innerHTML = '<i class="fa fa-play text-xl"></i>';
            playButton.classList.remove('playing');
            // 停止波纹动画
            waveContainer.classList.remove('playing');
        }
    });    
    
    // 音频结束时恢复状态
    audioPlayer.addEventListener('ended', function() {
        playButton.innerHTML = '<i class="fa fa-play text-xl"></i>';
        playButton.classList.remove('playing');
        waveContainer.classList.remove('playing');
    });        
    
    // 点击上传区域触发文件选择
    uploadState.addEventListener('click', function(e) {
        if (!e.target.closest('label')) {
            fileInput.click();
        }
    });
    
    // 文件选择变化
    fileInput.addEventListener('change', function() {
        if (this.files && this.files[0]) {
            handleFileUpload(this.files[0]);
        }
    });
    
    // 拖放功能
    container.addEventListener('dragover', function(e) {
        e.preventDefault();
        container.classList.add('drag-over');
    });
    
    container.addEventListener('dragleave', function() {
        container.classList.remove('drag-over');
    });
    
    container.addEventListener('drop', function(e) {
        e.preventDefault();
        container.classList.remove('drag-over');
        
        if (e.dataTransfer.files && e.dataTransfer.files[0]) {
            // 检查是否为音频文件
            if (e.dataTransfer.files[0].type.startsWith('audio/')) {
                handleFileUpload(e.dataTransfer.files[0]);
                // 更新隐藏的input值
                fileInput.files = e.dataTransfer.files;
            }
        }
    });
    
    // 移除音频
    removeButton.addEventListener('click', function() {
        // 重置文件输入
        fileInput.value = '';
        // 清除预设选择
        document.querySelectorAll('.voice-card').forEach(card => {
            card.classList.remove('active');
        });
        document.getElementById('prompt_audio_example').value = '';
        
        // 释放音频URL
        if (audioPlayer.src) {
            URL.revokeObjectURL(audioPlayer.src);
            audioPlayer.src = '';
        }
        
        // 切换显示状态
        previewState.classList.add('hidden');
        uploadState.classList.remove('hidden');
        playButton.innerHTML = '<i class="fa fa-play text-xl"></i>';
        playButton.classList.remove('playing');
        waveContainer.classList.remove('playing');
    });
    
    // 播放时波形动画
    audioPlayer.addEventListener('play', function() {
        const bars = audioWave.querySelectorAll('.audio-wave-bar');
        bars.forEach(bar => {
            bar.style.animationPlayState = 'running';
        });
    });
    
    // 暂停时波形动画
    audioPlayer.addEventListener('pause', function() {
        const bars = audioWave.querySelectorAll('.audio-wave-bar');
        bars.forEach(bar => {
            bar.style.animationPlayState = 'paused';
        });
    });
}

// 选择预设音色 - 核心功能实现
function selectPresetVoice(voicePath, voiceName) {
    // 获取DOM元素
    const uploadState = document.getElementById('prompt_audio_upload_state');
    const previewState = document.getElementById('prompt_audio_preview_state');
    const audioName = document.getElementById('prompt_audio_name');
    const audioPlayer = document.getElementById('prompt_audio_player');
    const audioDuration = document.getElementById('prompt_audio_duration');
    const audioSize = document.getElementById('prompt_audio_size');
    const audioWave = document.getElementById('prompt_audio_wave');
    const promptAudioExample = document.getElementById('prompt_audio_example');
    const fileInput = document.getElementById('prompt_audio');
    
    // 重置文件输入
    fileInput.value = '';
    
    // 设置示例音频路径
    promptAudioExample.value = voicePath;
    
    // 更新显示的文件名（使用音色名称而非文件名）
    audioName.textContent = voiceName;
    
    // 设置音频源
    audioPlayer.src = voicePath;
    
    // 创建波形（核心显示）
    createWaveform('prompt');
    
    // 切换显示状态（在prompt_audio_container中显示）
    uploadState.classList.add('hidden');
    previewState.classList.remove('hidden');
    
    // 加载音频以获取时长和大小
    audioPlayer.onloadedmetadata = function() {
        // 计算并显示时长
        const minutes = Math.floor(audioPlayer.duration / 60);
        const seconds = Math.floor(audioPlayer.duration % 60);
        audioDuration.textContent = `${minutes}:${seconds.toString().padStart(2, '0')}`;
        
        // 获取并显示文件大小
        fetch(voicePath, { method: 'HEAD' })
            .then(response => {
                const fileSize = response.headers.get('Content-Length');
                if (fileSize) {
                    const sizeKB = (parseInt(fileSize) / 1024).toFixed(1);
                    audioSize.textContent = `${sizeKB} KB`;
                }
            })
            .catch(error => {
                console.error('获取文件大小失败:', error);
                audioSize.textContent = '未知大小';
            });
    };
    
    // 处理音频加载错误
    audioPlayer.onerror = function() {
        console.error('音频加载失败');
        audioDuration.textContent = '加载失败';
        audioSize.textContent = '加载失败';
        // 显示错误提示
        alert('所选音色无法加载，请尝试其他选项');
    };
}

// 创建波形图的独立函数
function createWaveform(prefix) {
    const audioWave = document.getElementById(`${prefix}_audio_wave`);
    if (!audioWave) return;
    
    audioWave.innerHTML = '';
    // 创建30个波形条
    for (let i = 0; i < 30; i++) {
        const bar = document.createElement('div');
        bar.className = 'audio-wave-bar';
        // 随机高度创造波形效果
        bar.style.height = `${Math.random() * 30 + 5}px`;
        // 错开动画时间
        bar.style.animationDelay = `${i * 0.05}s`;
        audioWave.appendChild(bar);
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
function generateAudioWaveform(audioElement, containerId) {
    // 通过 ID 获取 DOM 元素
    const container = typeof containerId === 'string' ? document.getElementById(containerId) : containerId;
    
    if (!container) {
        console.error('波形容器未找到:', containerId);
        return;
    }
    
    // 清空容器
    container.innerHTML = '';
    container.className = 'audio-waveform flex items-end justify-center gap-0.5 h-20 w-full';
    
    // 检查是否已经为此音频元素创建过分析器
    if (audioElement._audioContext) {
        // 如果已经存在，重用现有的音频上下文
        const { audioContext, analyser, source } = audioElement._audioContext;
        
        // 确保音频上下文处于运行状态
        if (audioContext.state === 'suspended') {
            audioContext.resume();
        }
        
        // 直接使用现有的分析器创建波形
        createBarsAndAnimate(container, analyser, audioElement);
        return;
    }
    
    // 创建新的音频上下文和分析器
    const audioContext = new (window.AudioContext || window.webkitAudioContext)();
    const analyser = audioContext.createAnalyser();
    
    // 配置分析器
    analyser.fftSize = 64;
    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);
    
    try {
        // 创建媒体元素源
        const source = audioContext.createMediaElementSource(audioElement);
        
        // 连接音频节点
        source.connect(analyser);
        analyser.connect(audioContext.destination);
        
        // 保存引用以便重用
        audioElement._audioContext = {
            audioContext,
            analyser,
            source,
            dataArray,
            bufferLength
        };
        
        // 创建波形条并开始动画
        createBarsAndAnimate(container, analyser, audioElement, dataArray, bufferLength);
        
    } catch (error) {
        console.error('创建音频分析器失败:', error);
        // 如果连接失败，创建静态波形作为降级方案
        createFallbackWaveform(container);
    }
}
// 生成音频
function generateAudio() {
    const text = document.getElementById('input_text').value;
    if (!text.trim()) {
        alert('请铸刻目标铭文');
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
        body: formData
    })
    .then(response => {
        if (!response.ok) {
            throw new Error('生成音频失败');
        }
        return response.json();
    })
    .then(data => {
        // 隐藏生成状态
        document.getElementById('generation_status').classList.add('hidden');
        
        if (data.status === 'success' && data.audio_path) {
                // 保存到历史记录

            // 显示生成结果
            const audioElement = document.getElementById('output_audio');
            const customPlayer = document.getElementById('custom_audio_player');
            const playBtn = document.getElementById('custom_play_btn');
            const progressBar = document.getElementById('progress_bar');
            const timeDisplay = document.getElementById('time_display');
            const volumeBtn = document.getElementById('volume_btn');
            const downloadBtn = document.getElementById('download_btn');
            const speedBtn = document.getElementById('speed_btn');

            audioElement.src = data.audio_path;
            customPlayer.classList.remove('hidden');
            playBtn.addEventListener('click', () => {
            if (audioElement.paused) {
                audioElement.play();
                playBtn.innerHTML = '<i class="fa fa-pause"></i>';
            } else {
                audioElement.pause();
                playBtn.innerHTML = '<i class="fa fa-play"></i>';
            }
            });
            generateAudioWaveform(audioElement, 'output_audio_waveform');
            // 进度更新
            audioElement.addEventListener('timeupdate', () => {
                const percent = (audioElement.currentTime / audioElement.duration) * 100;
                progressBar.style.width = `${percent}%`;
                
                // 更新时间显示
                const currentMinutes = Math.floor(audioElement.currentTime / 60);
                const currentSeconds = Math.floor(audioElement.currentTime % 60);
                const totalMinutes = Math.floor(audioElement.duration / 60);
                const totalSeconds = Math.floor(audioElement.duration % 60);
                
                timeDisplay.textContent = `${currentMinutes}:${currentSeconds.toString().padStart(2, '0')} / ${totalMinutes}:${totalSeconds.toString().padStart(2, '0')}`;
            });

            // 点击进度条跳转
            progressBar.parentElement.addEventListener('click', (e) => {
                const rect = progressBar.parentElement.getBoundingClientRect();
                const pos = (e.clientX - rect.left) / rect.width;
                audioElement.currentTime = pos * audioElement.duration;
            });


            // 播放结束时重置
            audioElement.addEventListener('ended', () => {
                playBtn.innerHTML = '<i class="fa fa-play"></i>';
                progressBar.style.width = '0%';
            });

            document.getElementById('output_container').classList.remove('hidden');
            const text = document.getElementById('input_text').value;
            const voiceName = document.getElementById('prompt_audio_name').textContent;
            saveToHistory(text, data.audio_path, voiceName);
        } else {
            throw new Error(data.message || '生成音频失败');
        }
        // 在生成音频成功后添加波形生成
        


        // 添加语速控制逻辑
        document.getElementById('speed_control').addEventListener('input', function() {
            const speed = parseFloat(this.value);
            const audioElement = document.getElementById('output_audio');
            audioElement.playbackRate = speed;
            document.getElementById('speed_value').textContent = `${speed}x`;
        });

        // 修改下载按钮逻辑，考虑语速
        document.getElementById('download_btn').addEventListener('click', function() {
            const audioElement = document.getElementById('output_audio');
            const speed = parseFloat(document.getElementById('speed_control').value);
            
            // 这里需要后端支持按语速下载，前端只能传递参数
            const downloadUrl = `${audioElement.src}?speed=${speed}`;
            
            const a = document.createElement('a');
            a.href = downloadUrl;
            a.download = `generated_audio_${new Date().getTime()}_${speed}x.mp3`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
        });
        
    })
    .catch(error => {
        console.error('生成音频错误:', error);
        document.getElementById('generation_status').classList.add('hidden');
        document.getElementById('output_container').classList.remove('hidden');
        document.getElementById('output_container').innerHTML = `
            <p class="text-red-400 text-sm">生成失败: ${error.message}</p>
            <button id="retry_generation" class="mt-2 px-3 py-1 bg-gold/20 hover:bg-gold/30 text-gold rounded-lg text-xs transition-colors">
                <i class="fa fa-refresh mr-1"></i>重试
            </button>
        `;
        // 添加重试按钮事件
        document.getElementById('retry_generation').addEventListener('click', generateAudio);
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

// 加载预设音色（从后端API获取）

// 初始化音色库
function initVoiceLibrary() {
    // 加载所有音色
    loadLibraryVoices();
    
    // 初始化收藏功能
    setupFavoriteButtonEvents();
    
    // 初始化音色库标签页切换
    const libraryTabs = document.querySelectorAll('.voice-library-tab');
    libraryTabs.forEach(tab => {
        tab.addEventListener('click', function() {
            const tabId = this.getAttribute('data-tab');
            if (tabId === 'favorite-voices') {
                renderFavoriteVoices();
            }
        });
    });
    
    // 收藏音色搜索功能
    const favoriteVoiceSearch = document.getElementById('favorite_voice_search');
    favoriteVoiceSearch.addEventListener('input', function() {
        filterFavoriteVoices(this.value.toLowerCase());
    });
}

// 从API加载音色库
function loadLibraryVoices() {
    // 显示加载状态
    const loading = document.getElementById('library_voices_loading');
    const container = document.getElementById('library_voices_container');
    const error = document.getElementById('library_voices_error');
    const retryBtn = document.getElementById('library_retry_voices');
    
    loading.classList.remove('hidden');
    container.classList.add('hidden');
    error.classList.add('hidden');
    retryBtn.classList.add('hidden');
    
    // 加载所有分类用于筛选
    fetch('/api/categories')
        .then(response => {
            if (!response.ok) throw new Error('获取分类失败');
            return response.json();
        })
        .then(categories => {
            // 渲染分类筛选器
            renderDynamicFilters(categories);
            
            // 加载所有音色
            return fetch('/api/voices?category=all');
        })
        .then(response => {
            if (!response.ok) throw new Error('获取音色失败');
            return response.json();
        })
        .then(voices => {
            // 隐藏加载状态，显示音色列表
            loading.classList.add('hidden');
            container.classList.remove('hidden');
            
            // 存储所有音色
            voicesByCategory['all'] = voices;
            
            // 按分类组织音色
            voices.forEach(voice => {
                if (!voicesByCategory[voice.category_id]) {
                    voicesByCategory[voice.category_id] = [];
                }
                voicesByCategory[voice.category_id].push(voice);
            });
            
            // 渲染音色列表
            renderLibraryVoices(voices);
            
            // 初始化收藏状态
            updateFavoriteStatuses();
        })
        .catch(error => {
            console.error('加载音色库失败:', error);
            loading.classList.add('hidden');
            error.classList.remove('hidden');
            retryBtn.classList.remove('hidden');
        });
}

// 渲染动态分类筛选器
function renderDynamicFilters(categories) {
    const container = document.getElementById('dynamic-filters-container');
    container.innerHTML = ''; // 清空加载状态
    
    // 创建分类筛选下拉框
    const filterSelect = document.createElement('select');
    filterSelect.id = 'category_filter';
    filterSelect.className = 'bg-ink border border-gold/30 rounded-lg px-3 py-2 text-silver focus:border-gold focus:outline-none';
    
    // 添加默认选项
    const defaultOption = document.createElement('option');
    defaultOption.value = 'all';
    defaultOption.textContent = '所有分类';
    filterSelect.appendChild(defaultOption);
    
    // 添加各分类选项
    categories.forEach(category => {
        const option = document.createElement('option');
        option.value = category.id;
        option.textContent = category.name;
        filterSelect.appendChild(option);
    });
    
    // 添加筛选事件
    filterSelect.addEventListener('change', function() {
        const categoryId = this.value;
        const searchTerm = document.getElementById('library_voice_search').value.toLowerCase();
        
        let filteredVoices = [];
        if (categoryId === 'all') {
            filteredVoices = voicesByCategory['all'] || [];
        } else {
            filteredVoices = voicesByCategory[categoryId] || [];
        }
        
        // 应用搜索过滤
        if (searchTerm) {
            filteredVoices = filteredVoices.filter(voice => 
                voice.name.toLowerCase().includes(searchTerm) || 
                voice.description.toLowerCase().includes(searchTerm) ||
                voice.category_name.toLowerCase().includes(searchTerm)
            );
        }
        
        renderLibraryVoices(filteredVoices);
    });
    
    container.appendChild(filterSelect);
}

// 渲染音色库列表
function renderLibraryVoices(voices) {
    const container = document.getElementById('library_voices_container');
    container.innerHTML = '';
    
    if (voices.length === 0) {
        container.innerHTML = `
            <div class="text-center py-8 bg-ink rounded-lg border border-gold/10">
                <p class="text-silver/60">未找到匹配的音色</p>
            </div>
        `;
        return;
    }
    
    // 创建音色列表
    voices.forEach(voice => {
        const isFavorite = favoriteVoices.some(v => v.id === voice.id);
        
        const voiceCard = document.createElement('div');
        voiceCard.className = 'voice-card bg-ink rounded-lg border border-gold/10 p-4 flex items-center justify-between';
        voiceCard.setAttribute('data-voice-id', voice.id);
        
        // 格式化文件大小
        const fileSizeKB = (voice.file_size / 1024).toFixed(1);
        const fileSize = fileSizeKB > 1024 
            ? `${(fileSizeKB / 1024).toFixed(1)} MB` 
            : `${fileSizeKB} KB`;
        
        // 格式化时长
        const minutes = Math.floor(voice.duration / 60);
        const seconds = Math.floor(voice.duration % 60);
        const duration = `${minutes}:${seconds.toString().padStart(2, '0')}`;
        
        voiceCard.innerHTML = `
            <div class="flex items-center space-x-4 flex-1">
                <div class="relative w-12 h-12">
                    <button class="play-btn absolute inset-0 rounded-full bg-ink-light flex items-center justify-center"
                            data-voice-id="${voice.id}">
                        <i class="fa fa-play text-gold"></i>
                        <!-- 波动动效元素 -->
                        <span class="play-animation absolute inset-0 rounded-full bg-gold/30"></span>
                    </button>
                </div>
                <div>
                    <h4 class="font-medium text-gold-light">${voice.name}</h4>
                    <div class="flex items-center text-xs text-silver/60 mt-1">
                        <span class="mr-3">${voice.category_name}</span>

                    </div>
                    ${voice.description ? `<p class="text-sm text-silver/70 mt-2">${voice.description}</p>` : ''}
                </div>
            </div>
            <div class="flex items-center space-x-3">
                <button class="select-voice-btn metal-btn px-3 py-1 bg-gold/20 hover:bg-gold/30 text-gold rounded-lg text-sm transition-colors" 
                        data-voice-id="${voice.id}" 
                        data-voice-name="${voice.name}" 
                        data-voice-path="${voice.audio_path}">
                    <i class="fa fa-check mr-1"></i>选择
                </button>
                <button class="favorite-btn ${isFavorite ? 'favorited' : ''} text-silver hover:text-gold" 
                        data-voice-id="${voice.id}">
                    <i class="fa ${isFavorite ? 'fa-heart' : 'fa-heart-o'}"></i>
                </button>
            </div>
        `;
        
        container.appendChild(voiceCard);
    });
    
    // 为新添加的元素绑定事件
    setupVoiceCardEvents();
    setupPlayButtons();
}

// 渲染收藏的音色
function renderFavoriteVoices() {
    const container = document.getElementById('favorite_voices_container');
    const noFavoritesMsg = document.getElementById('no_favorites_message');
    
    if (favoriteVoices.length === 0) {
        container.classList.add('hidden');
        noFavoritesMsg.classList.remove('hidden');
        return;
    }
    
    container.classList.remove('hidden');
    noFavoritesMsg.classList.add('hidden');
    container.innerHTML = '';
    
    favoriteVoices.forEach(voice => {
        const voiceCard = document.createElement('div');
        voiceCard.className = 'voice-card bg-ink rounded-lg border border-gold/10 p-4 flex items-center justify-between';
        voiceCard.setAttribute('data-voice-id', voice.id);
        
        // 格式化文件大小
        const fileSizeKB = (voice.file_size / 1024).toFixed(1);
        const fileSize = fileSizeKB > 1024 
            ? `${(fileSizeKB / 1024).toFixed(1)} MB` 
            : `${fileSizeKB} KB`;
        
        // 格式化时长
        const minutes = Math.floor(voice.duration / 60);
        const seconds = Math.floor(voice.duration % 60);
        const duration = `${minutes}:${seconds.toString().padStart(2, '0')}`;
        
        voiceCard.innerHTML = `
            <div class="flex items-center space-x-4 flex-1">
                <div class="relative w-12 h-12">
                    <button class="play-btn absolute inset-0 rounded-full bg-ink-light flex items-center justify-center"
                            data-voice-id="${voice.id}">
                        <i class="fa fa-play text-gold"></i>
                        <!-- 波动动效元素 -->
                        <span class="play-animation absolute inset-0 rounded-full bg-gold/30"></span>
                    </button>
                </div>
                <div>
                    <h4 class="font-medium text-gold-light">${voice.name}</h4>
                    <div class="flex items-center text-xs text-silver/60 mt-1">
                        <span class="mr-3">${voice.category_name}</span>

                    </div>
                    ${voice.description ? `<p class="text-sm text-silver/70 mt-2">${voice.description}</p>` : ''}
                </div>
            </div>
            <div class="flex items-center space-x-3">
                <button class="select-voice-btn metal-btn px-3 py-1 bg-gold/20 hover:bg-gold/30 text-gold rounded-lg text-sm transition-colors" 
                        data-voice-id="${voice.id}" 
                        data-voice-name="${voice.name}" 
                        data-voice-path="${voice.audio_path}">
                    <i class="fa fa-check mr-1"></i>选择
                </button>
                <button class="favorite-btn favorited text-gold" 
                        data-voice-id="${voice.id}">
                    <i class="fa fa-heart"></i>
                </button>
            </div>
        `;
        
        container.appendChild(voiceCard);
    });
    
    // 为新添加的元素绑定事件
    setupVoiceCardEvents();
    setupPlayButtons();
}

// 设置音色卡片事件
function setupVoiceCardEvents() {
    // 选择音色按钮事件
    document.querySelectorAll('.select-voice-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            const voiceId = this.getAttribute('data-voice-id');
            const voiceName = this.getAttribute('data-voice-name');
            const voicePath = this.getAttribute('data-voice-path');
            
            // 选择该音色
            selectPresetVoice(voicePath, voiceName);
            
            // 切换到首页
            document.querySelector('.sidebar-item[data-page="home"]').click();
        });
    });
    
    // 收藏按钮事件（动态绑定，避免重复绑定）
    document.querySelectorAll('.favorite-btn:not([data-event-bound])').forEach(btn => {
        btn.setAttribute('data-event-bound', 'true');
        btn.addEventListener('click', function() {
            const voiceId = this.getAttribute('data-voice-id');
            toggleFavorite(voiceId);
        });
    });
}

// 设置收藏按钮事件委托
function setupFavoriteButtonEvents() {
    // 音色库重试按钮
    document.getElementById('library_retry_voices').addEventListener('click', loadLibraryVoices);
}

// 切换音色收藏状态
function toggleFavorite(voiceId) {
    // 查找该音色
    const allVoices = voicesByCategory['all'] || [];
    const voice = allVoices.find(v => v.id == voiceId);
    
    if (!voice) return;
    
    // 检查是否已收藏
    const index = favoriteVoices.findIndex(v => v.id == voiceId);
    
    if (index > -1) {
        // 取消收藏
        favoriteVoices.splice(index, 1);
    } else {
        // 添加收藏
        favoriteVoices.push(voice);
    }
    
    // 保存到本地存储
    localStorage.setItem('favoriteVoices', JSON.stringify(favoriteVoices));
    
    // 更新UI
    updateFavoriteStatuses();
    
    // 如果当前在收藏标签页，重新渲染
    const activeTab = document.querySelector('.voice-library-tab.active');
    if (activeTab && activeTab.getAttribute('data-tab') === 'favorite-voices') {
        renderFavoriteVoices();
    }
}

// 更新所有收藏状态UI
function updateFavoriteStatuses() {
    document.querySelectorAll('.favorite-btn').forEach(btn => {
        const voiceId = btn.getAttribute('data-voice-id');
        const isFavorite = favoriteVoices.some(v => v.id == voiceId);
        
        if (isFavorite) {
            btn.classList.add('favorited');
            btn.innerHTML = '<i class="fa fa-heart"></i>';
        } else {
            btn.classList.remove('favorited');
            btn.innerHTML = '<i class="fa fa-heart-o"></i>';
        }
    });
}

// 过滤音色库
function filterLibraryVoices(searchTerm) {
    const categoryId = document.getElementById('category_filter').value;
    
    let filteredVoices = [];
    if (categoryId === 'all') {
        filteredVoices = voicesByCategory['all'] || [];
    } else {
        filteredVoices = voicesByCategory[categoryId] || [];
    }
    
    if (searchTerm) {
        filteredVoices = filteredVoices.filter(voice => 
            voice.name.toLowerCase().includes(searchTerm) || 
            voice.description.toLowerCase().includes(searchTerm) ||
            voice.category_name.toLowerCase().includes(searchTerm)
        );
    }
    
    renderLibraryVoices(filteredVoices);
}

// 过滤收藏的音色
function filterFavoriteVoices(searchTerm) {
    if (!searchTerm) {
        renderFavoriteVoices();
        return;
    }
    
    const filtered = favoriteVoices.filter(voice => 
        voice.name.toLowerCase().includes(searchTerm) || 
        voice.description.toLowerCase().includes(searchTerm) ||
        voice.category_name.toLowerCase().includes(searchTerm)
    );
    
    const container = document.getElementById('favorite_voices_container');
    container.innerHTML = '';
    
    if (filtered.length === 0) {
        container.innerHTML = `
            <div class="text-center py-8 bg-ink rounded-lg border border-gold/10">
                <p class="text-silver/60">未找到匹配的收藏音色</p>
            </div>
        `;
        return;
    }
    
    filtered.forEach(voice => {
        const voiceCard = document.createElement('div');
        voiceCard.className = 'voice-card bg-ink rounded-lg border border-gold/10 p-4 flex items-center justify-between';
        voiceCard.setAttribute('data-voice-id', voice.id);
        
        // 格式化文件大小
        const fileSizeKB = (voice.file_size / 1024).toFixed(1);
        const fileSize = fileSizeKB > 1024 
            ? `${(fileSizeKB / 1024).toFixed(1)} MB` 
            : `${fileSizeKB} KB`;
        
        // 格式化时长
        const minutes = Math.floor(voice.duration / 60);
        const seconds = Math.floor(voice.duration % 60);
        const duration = `${minutes}:${seconds.toString().padStart(2, '0')}`;
        
        voiceCard.innerHTML = `
            <div class="flex items-center space-x-4 flex-1">
                <div class="w-12 h-12 rounded-full bg-ink-light flex items-center justify-center">
                    <i class="fa fa-volume-up text-gold"></i>
                </div>
                <div>
                    <h4 class="font-medium text-gold-light">${voice.name}</h4>
                    <div class="flex items-center text-xs text-silver/60 mt-1">
                        <span class="mr-3">${voice.category_name}</span>
                        <span class="mr-3">${duration}</span>
                        <span>${fileSize}</span>
                    </div>
                    ${voice.description ? `<p class="text-sm text-silver/70 mt-2">${voice.description}</p>` : ''}
                </div>
            </div>
            <div class="flex items-center space-x-3">
                <button class="select-voice-btn metal-btn px-3 py-1 bg-gold/20 hover:bg-gold/30 text-gold rounded-lg text-sm transition-colors" 
                        data-voice-id="${voice.id}" 
                        data-voice-name="${voice.name}" 
                        data-voice-path="${voice.audio_path}">
                    <i class="fa fa-check mr-1"></i>选择
                </button>
                <button class="favorite-btn favorited text-gold" 
                        data-voice-id="${voice.id}">
                    <i class="fa fa-heart"></i>
                </button>
            </div>
        `;
        
        container.appendChild(voiceCard);
    });
    
    setupVoiceCardEvents();
}

// 在音色卡生成后添加播放按钮事件监听
function setupPlayButtons() {
    // 存储当前正在播放的音频实例
    let currentAudio = null;
    let currentPlayButton = null;

    // 为所有播放按钮添加点击事件
    document.querySelectorAll('.play-btn').forEach(button => {
        button.addEventListener('click', async function() {
            const voiceCard = this.closest('.voice-card');
            const audioPath = voiceCard.querySelector('.select-voice-btn').getAttribute('data-voice-path');

            // 如果点击的是新的播放按钮，先停止当前播放的音频
            if (currentPlayButton && currentPlayButton !== this) {
                currentAudio.pause();
                currentAudio.currentTime = 0;
                currentPlayButton.classList.remove('playing');
                currentPlayButton.querySelector('i').className = 'fa fa-play text-gold';
                
                // 清除当前播放实例
                currentAudio = null;
                currentPlayButton = null;
            }

            // 检查是否是当前正在播放的按钮
            if (currentPlayButton === this) {
                // 暂停播放
                currentAudio.pause();
                currentAudio.currentTime = 0;
                this.classList.remove('playing');
                this.querySelector('i').className = 'fa fa-play text-gold';
                currentAudio = null;
                currentPlayButton = null;
            } else {
                // 开始播放新的音频
                try {
                    // 确保先清除可能存在的音频实例
                    if (currentAudio) {
                        currentAudio.pause();
                        currentAudio = null;
                    }
                    
                    // 创建新的音频实例
                    currentAudio = new Audio(audioPath);
                    currentPlayButton = this;
                    
                    // 播放音频
                    await currentAudio.play();
                    
                    // 更新按钮状态和图标
                    this.classList.add('playing');
                    this.querySelector('i').className = 'fa fa-pause text-gold';
                    
                    // 音频播放结束时重置状态
                    currentAudio.onended = () => {
                        this.classList.remove('playing');
                        this.querySelector('i').className = 'fa fa-play text-gold';
                        currentAudio.currentTime = 0;
                        currentAudio = null;
                        currentPlayButton = null;
                    };
                } catch (error) {
                    console.error('播放音频失败:', error);
                    alert('无法播放音频，请稍后再试');
                    // 出错时重置状态
                    currentAudio = null;
                    currentPlayButton = null;
                    this.classList.remove('playing');
                    this.querySelector('i').className = 'fa fa-play text-gold';
                }
            }
        });
    });
}
      
function initModalVoiceLibrary() {
    // 打开音色库弹窗
    document.getElementById('open_voice_library').addEventListener('click', function() {
        document.getElementById('voice_library_modal').classList.remove('hidden');
        loadModalLibraryVoices();
    });

    // 关闭音色库弹窗
    document.getElementById('close_voice_library').addEventListener('click', function() {
        document.getElementById('voice_library_modal').classList.add('hidden');
    });

    // 点击弹窗外部关闭
    document.getElementById('voice_library_modal').addEventListener('click', function(e) {
        if (e.target === this) {
            this.classList.add('hidden');
        }
    });

    // 初始化弹窗标签页切换
    const modalTabs = document.querySelectorAll('.modal-voice-tab');
    modalTabs.forEach(tab => {
        tab.addEventListener('click', function() {
            // 更新标签选中状态
            modalTabs.forEach(t => {
                t.classList.remove('active');
            });
            this.classList.add('active');
            
            // 显示对应的内容
            const tabId = this.getAttribute('data-tab');
            document.querySelectorAll('#voice_library_modal [id$="-content"]').forEach(content => {
                content.classList.add('hidden');
            });
            document.getElementById(`${tabId}-content`).classList.remove('hidden');
            
            // 如果切换到收藏标签页，刷新收藏列表
            if (tabId === 'modal-favorite-voices') {
                renderModalFavoriteVoices();
            }
        });
    });

    // 弹窗搜索功能
    const modalVoiceSearch = document.getElementById('modal_voice_search');
    modalVoiceSearch.addEventListener('input', function() {
        filterModalLibraryVoices(this.value.toLowerCase());
    });

    // 弹窗收藏搜索功能
    const modalFavoriteVoiceSearch = document.getElementById('modal_favorite_voice_search');
    modalFavoriteVoiceSearch.addEventListener('input', function() {
        filterModalFavoriteVoices(this.value.toLowerCase());
    });

    // 弹窗重试按钮
    document.getElementById('modal_retry_voices').addEventListener('click', loadModalLibraryVoices);
}

// 从API加载弹窗中的音色库
function loadModalLibraryVoices() {
    // 显示加载状态
    const loading = document.getElementById('modal_voices_loading');
    const container = document.getElementById('modal_voices_container');
    const error = document.getElementById('modal_voices_error');
    const retryBtn = document.getElementById('modal_retry_voices');
    
    loading.classList.remove('hidden');
    container.classList.add('hidden');
    error.classList.add('hidden');
    retryBtn.classList.add('hidden');
    
    // 先尝试使用已加载的数据
    if (voicesByCategory['all'] && voicesByCategory['all'].length > 0) {
        // 已经有数据，直接渲染
        loading.classList.add('hidden');
        container.classList.remove('hidden');
        renderModalLibraryVoices(voicesByCategory['all']);
        updateModalFavoriteStatuses();
        return;
    }
    
    // 加载所有分类用于筛选
    fetch('/api/categories')
        .then(response => {
            if (!response.ok) throw new Error('获取分类失败');
            return response.json();
        })
        .then(categories => {
            // 渲染弹窗分类筛选器
            renderModalDynamicFilters(categories);
            
            // 加载所有音色
            return fetch('/api/voices?category=all');
        })
        .then(response => {
            if (!response.ok) throw new Error('获取音色失败');
            return response.json();
        })
        .then(voices => {
            // 隐藏加载状态，显示音色列表
            loading.classList.add('hidden');
            container.classList.remove('hidden');
            
            // 存储所有音色
            voicesByCategory['all'] = voices;
            
            // 按分类组织音色
            voices.forEach(voice => {
                if (!voicesByCategory[voice.category_id]) {
                    voicesByCategory[voice.category_id] = [];
                }
                voicesByCategory[voice.category_id].push(voice);
            });
            
            // 渲染弹窗音色列表
            renderModalLibraryVoices(voices);
            
            // 初始化收藏状态
            updateModalFavoriteStatuses();
        })
        .catch(error => {
            console.error('加载弹窗音色库失败:', error);
            loading.classList.add('hidden');
            error.classList.remove('hidden');
            retryBtn.classList.remove('hidden');
        });
}

// 渲染弹窗动态分类筛选器
function renderModalDynamicFilters(categories) {
    const container = document.getElementById('modal_dynamic-filters-container');
    container.innerHTML = '';
    
    // 创建分类筛选下拉框
    const filterSelect = document.createElement('select');
    filterSelect.id = 'modal_category_filter';
    filterSelect.className = 'bg-ink border border-gold/30 rounded-lg px-3 py-2 text-silver focus:border-gold focus:outline-none';
    
    // 添加默认选项
    const defaultOption = document.createElement('option');
    defaultOption.value = 'all';
    defaultOption.textContent = '所有分类';
    filterSelect.appendChild(defaultOption);
    
    // 添加各分类选项
    categories.forEach(category => {
        const option = document.createElement('option');
        option.value = category.id;
        option.textContent = category.name;
        filterSelect.appendChild(option);
    });
    
    // 添加筛选事件
    filterSelect.addEventListener('change', function() {
        const categoryId = this.value;
        const searchTerm = document.getElementById('modal_voice_search').value.toLowerCase();
        
        let filteredVoices = [];
        if (categoryId === 'all') {
            filteredVoices = voicesByCategory['all'] || [];
        } else {
            filteredVoices = voicesByCategory[categoryId] || [];
        }
        
        // 应用搜索过滤
        if (searchTerm) {
            filteredVoices = filteredVoices.filter(voice => 
                voice.name.toLowerCase().includes(searchTerm) || 
                voice.description.toLowerCase().includes(searchTerm) ||
                voice.category_name.toLowerCase().includes(searchTerm)
            );
        }
        
        renderModalLibraryVoices(filteredVoices);
    });
    
    container.appendChild(filterSelect);
}

// 渲染弹窗音色库列表
function renderModalLibraryVoices(voices) {
    const container = document.getElementById('modal_voices_container');
    container.innerHTML = '';
    
    if (voices.length === 0) {
        container.innerHTML = `
            <div class="text-center py-8 bg-ink rounded-lg border border-gold/10">
                <p class="text-silver/60">未找到匹配的音色</p>
            </div>
        `;
        return;
    }
    
    // 创建音色列表
    voices.forEach(voice => {
        const isFavorite = favoriteVoices.some(v => v.id === voice.id);
        
        const voiceCard = document.createElement('div');
        voiceCard.className = 'voice-card bg-ink rounded-lg border border-gold/10 p-4 flex items-center justify-between';
        voiceCard.setAttribute('data-voice-id', voice.id);
        
        // 格式化文件大小
        const fileSizeKB = (voice.file_size / 1024).toFixed(1);
        const fileSize = fileSizeKB > 1024 
            ? `${(fileSizeKB / 1024).toFixed(1)} MB` 
            : `${fileSizeKB} KB`;
        
        // 格式化时长
        const minutes = Math.floor(voice.duration / 60);
        const seconds = Math.floor(voice.duration % 60);
        const duration = `${minutes}:${seconds.toString().padStart(2, '0')}`;
        
        voiceCard.innerHTML = `
            <div class="flex items-center space-x-4 flex-1">
                <div class="relative w-12 h-12">
                    <button class="play-btn absolute inset-0 rounded-full bg-ink-light flex items-center justify-center"
                            data-voice-id="${voice.id}">
                        <i class="fa fa-play text-gold"></i>
                        <!-- 波动动效元素 -->
                        <span class="play-animation absolute inset-0 rounded-full bg-gold/30"></span>
                    </button>
                </div>
                <div>
                    <h4 class="font-medium text-gold-light">${voice.name}</h4>
                    <div class="flex items-center text-xs text-silver/60 mt-1">
                        <span class="mr-3">${voice.category_name}</span>
                    </div>
                    ${voice.description ? `<p class="text-sm text-silver/70 mt-2">${voice.description}</p>` : ''}
                </div>
            </div>
            <div class="flex items-center space-x-3">
                <button class="select-voice-btn metal-btn px-3 py-1 bg-gold/20 hover:bg-gold/30 text-gold rounded-lg text-sm transition-colors" 
                        data-voice-id="${voice.id}" 
                        data-voice-name="${voice.name}" 
                        data-voice-path="${voice.audio_path}">
                    <i class="fa fa-check mr-1"></i>选择
                </button>
                <button class="favorite-btn ${isFavorite ? 'favorited' : ''} text-silver hover:text-gold" 
                        data-voice-id="${voice.id}">
                    <i class="fa ${isFavorite ? 'fa-heart' : 'fa-heart-o'}"></i>
                </button>
            </div>
        `;
        
        container.appendChild(voiceCard);
    });
    
    // 为新添加的元素绑定事件
    setupModalVoiceCardEvents();
    setupModalPlayButtons();
}

// 渲染弹窗中收藏的音色
function renderModalFavoriteVoices() {
    const container = document.getElementById('modal_favorite_voices_container');
    const noFavoritesMsg = document.getElementById('modal_no_favorites_message');
    
    if (favoriteVoices.length === 0) {
        container.classList.add('hidden');
        noFavoritesMsg.classList.remove('hidden');
        return;
    }
    
    container.classList.remove('hidden');
    noFavoritesMsg.classList.add('hidden');
    container.innerHTML = '';
    
    favoriteVoices.forEach(voice => {
        const voiceCard = document.createElement('div');
        voiceCard.className = 'voice-card bg-ink rounded-lg border border-gold/10 p-4 flex items-center justify-between';
        voiceCard.setAttribute('data-voice-id', voice.id);
        
        // 格式化文件大小
        const fileSizeKB = (voice.file_size / 1024).toFixed(1);
        const fileSize = fileSizeKB > 1024 
            ? `${(fileSizeKB / 1024).toFixed(1)} MB` 
            : `${fileSizeKB} KB`;
        
        // 格式化时长
        const minutes = Math.floor(voice.duration / 60);
        const seconds = Math.floor(voice.duration % 60);
        const duration = `${minutes}:${seconds.toString().padStart(2, '0')}`;
        
        voiceCard.innerHTML = `
            <div class="flex items-center space-x-4 flex-1">
                <div class="relative w-12 h-12">
                    <button class="play-btn absolute inset-0 rounded-full bg-ink-light flex items-center justify-center"
                            data-voice-id="${voice.id}">
                        <i class="fa fa-play text-gold"></i>
                        <!-- 波动动效元素 -->
                        <span class="play-animation absolute inset-0 rounded-full bg-gold/30"></span>
                    </button>
                </div>
                <div>
                    <h4 class="font-medium text-gold-light">${voice.name}</h4>
                    <div class="flex items-center text-xs text-silver/60 mt-1">
                        <span class="mr-3">${voice.category_name}</span>
                    </div>
                    ${voice.description ? `<p class="text-sm text-silver/70 mt-2">${voice.description}</p>` : ''}
                </div>
            </div>
            <div class="flex items-center space-x-3">
                <button class="select-voice-btn metal-btn px-3 py-1 bg-gold/20 hover:bg-gold/30 text-gold rounded-lg text-sm transition-colors" 
                        data-voice-id="${voice.id}" 
                        data-voice-name="${voice.name}" 
                        data-voice-path="${voice.audio_path}">
                    <i class="fa fa-check mr-1"></i>选择
                </button>
                <button class="favorite-btn favorited text-gold" 
                        data-voice-id="${voice.id}">
                    <i class="fa fa-heart"></i>
                </button>
            </div>
        `;
        
        container.appendChild(voiceCard);
    });
    
    // 为新添加的元素绑定事件
    setupModalVoiceCardEvents();
    setupModalPlayButtons();
}

// 设置弹窗音色卡片事件
function setupModalVoiceCardEvents() {
    // 选择音色按钮事件
    document.querySelectorAll('#voice_library_modal .select-voice-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            const voiceId = this.getAttribute('data-voice-id');
            const voiceName = this.getAttribute('data-voice-name');
            const voicePath = this.getAttribute('data-voice-path');
            
            // 选择该音色
            selectPresetVoice(voicePath, voiceName);
            
            // 关闭弹窗
            document.getElementById('voice_library_modal').classList.add('hidden');
        });
    });
    
    // 收藏按钮事件
    document.querySelectorAll('#voice_library_modal .favorite-btn:not([data-event-bound])').forEach(btn => {
        btn.setAttribute('data-event-bound', 'true');
        btn.addEventListener('click', function() {
            const voiceId = this.getAttribute('data-voice-id');
            toggleFavorite(voiceId);
        });
    });
}

// 更新弹窗中所有收藏状态UI
function updateModalFavoriteStatuses() {
    document.querySelectorAll('#voice_library_modal .favorite-btn').forEach(btn => {
        const voiceId = btn.getAttribute('data-voice-id');
        const isFavorite = favoriteVoices.some(v => v.id == voiceId);
        
        if (isFavorite) {
            btn.classList.add('favorited');
            btn.innerHTML = '<i class="fa fa-heart"></i>';
        } else {
            btn.classList.remove('favorited');
            btn.innerHTML = '<i class="fa fa-heart-o"></i>';
        }
    });
}

// 过滤弹窗音色库
function filterModalLibraryVoices(searchTerm) {
    const categoryId = document.getElementById('modal_category_filter').value;
    
    let filteredVoices = [];
    if (categoryId === 'all') {
        filteredVoices = voicesByCategory['all'] || [];
    } else {
        filteredVoices = voicesByCategory[categoryId] || [];
    }
    
    if (searchTerm) {
        filteredVoices = filteredVoices.filter(voice => 
            voice.name.toLowerCase().includes(searchTerm) || 
            voice.description.toLowerCase().includes(searchTerm) ||
            voice.category_name.toLowerCase().includes(searchTerm)
        );
    }
    
    renderModalLibraryVoices(filteredVoices);
}

// 过滤弹窗中收藏的音色
function filterModalFavoriteVoices(searchTerm) {
    if (!searchTerm) {
        renderModalFavoriteVoices();
        return;
    }
    
    const filtered = favoriteVoices.filter(voice => 
        voice.name.toLowerCase().includes(searchTerm) || 
        voice.description.toLowerCase().includes(searchTerm) ||
        voice.category_name.toLowerCase().includes(searchTerm)
    );
    
    const container = document.getElementById('modal_favorite_voices_container');
    container.innerHTML = '';
    
    if (filtered.length === 0) {
        container.innerHTML = `
            <div class="text-center py-8 bg-ink rounded-lg border border-gold/10">
                <p class="text-silver/60">未找到匹配的收藏音色</p>
            </div>
        `;
        return;
    }
    
    filtered.forEach(voice => {
        const voiceCard = document.createElement('div');
        voiceCard.className = 'voice-card bg-ink rounded-lg border border-gold/10 p-4 flex items-center justify-between';
        voiceCard.setAttribute('data-voice-id', voice.id);
        
        // 格式化文件大小
        const fileSizeKB = (voice.file_size / 1024).toFixed(1);
        const fileSize = fileSizeKB > 1024 
            ? `${(fileSizeKB / 1024).toFixed(1)} MB` 
            : `${fileSizeKB} KB`;
        
        // 格式化时长
        const minutes = Math.floor(voice.duration / 60);
        const seconds = Math.floor(voice.duration % 60);
        const duration = `${minutes}:${seconds.toString().padStart(2, '0')}`;
        
        voiceCard.innerHTML = `
            <div class="flex items-center space-x-4 flex-1">
                <div class="w-12 h-12 rounded-full bg-ink-light flex items-center justify-center">
                    <i class="fa fa-volume-up text-gold"></i>
                </div>
                <div>
                    <h4 class="font-medium text-gold-light">${voice.name}</h4>
                    <div class="flex items-center text-xs text-silver/60 mt-1">
                        <span class="mr-3">${voice.category_name}</span>
                        <span class="mr-3">${duration}</span>
                        <span>${fileSize}</span>
                    </div>
                    ${voice.description ? `<p class="text-sm text-silver/70 mt-2">${voice.description}</p>` : ''}
                </div>
            </div>
            <div class="flex items-center space-x-3">
                <button class="select-voice-btn metal-btn px-3 py-1 bg-gold/20 hover:bg-gold/30 text-gold rounded-lg text-sm transition-colors" 
                        data-voice-id="${voice.id}" 
                        data-voice-name="${voice.name}" 
                        data-voice-path="${voice.audio_path}">
                    <i class="fa fa-check mr-1"></i>选择
                </button>
                <button class="favorite-btn favorited text-gold" 
                        data-voice-id="${voice.id}">
                    <i class="fa fa-heart"></i>
                </button>
            </div>
        `;
        
        container.appendChild(voiceCard);
    });
    
    setupModalVoiceCardEvents();
}

// 设置弹窗中播放按钮事件
function setupModalPlayButtons() {
    // 存储当前正在播放的音频实例
    let currentAudio = null;
    let currentPlayButton = null;

    // 为所有播放按钮添加点击事件
    document.querySelectorAll('#voice_library_modal .play-btn').forEach(button => {
        button.addEventListener('click', async function() {
            const voiceCard = this.closest('.voice-card');
            const audioPath = voiceCard.querySelector('.select-voice-btn').getAttribute('data-voice-path');

            // 如果点击的是新的播放按钮，先停止当前播放的音频
            if (currentPlayButton && currentPlayButton !== this) {
                currentAudio.pause();
                currentAudio.currentTime = 0;
                currentPlayButton.classList.remove('playing');
                currentPlayButton.querySelector('i').className = 'fa fa-play text-gold';
                
                // 清除当前播放实例
                currentAudio = null;
                currentPlayButton = null;
            }

            // 检查是否是当前正在播放的按钮
            if (currentPlayButton === this) {
                // 暂停播放
                currentAudio.pause();
                currentAudio.currentTime = 0;
                this.classList.remove('playing');
                this.querySelector('i').className = 'fa fa-play text-gold';
                currentAudio = null;
                currentPlayButton = null;
            } else {
                // 开始播放新的音频
                try {
                    // 确保先清除可能存在的音频实例
                    if (currentAudio) {
                        currentAudio.pause();
                        currentAudio = null;
                    }
                    
                    // 创建新的音频实例
                    currentAudio = new Audio(audioPath);
                    currentPlayButton = this;
                    
                    // 播放音频
                    await currentAudio.play();
                    
                    // 更新按钮状态和图标
                    this.classList.add('playing');
                    this.querySelector('i').className = 'fa fa-pause text-gold';
                    
                    // 音频播放结束时重置状态
                    currentAudio.onended = () => {
                        this.classList.remove('playing');
                        this.querySelector('i').className = 'fa fa-play text-gold';
                        currentAudio.currentTime = 0;
                        currentAudio = null;
                        currentPlayButton = null;
                    };
                } catch (error) {
                    console.error('播放音频失败:', error);
                    alert('无法播放音频，请稍后再试');
                    // 出错时重置状态
                    currentAudio = null;
                    currentPlayButton = null;
                    this.classList.remove('playing');
                    this.querySelector('i').className = 'fa fa-play text-gold';
                }
            }
        });
    });
}

// 在generateAudio函数的成功回调中添加
function saveToHistory(text, audioPath, voiceName) {
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

// 初始化历史记录
function initHistory() {
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
    
    // 语速控制
    document.querySelectorAll('.history-speed-control').forEach(control => {
        control.addEventListener('input', function() {
            const id = this.getAttribute('data-id');
            const speed = parseFloat(this.value);
            document.querySelector(`.history-speed-value[data-id="${id}"]`).textContent = `${speed}x`;
            
            // 更新音频元素的播放速度
            const audio = document.querySelector(`.history-audio-element[data-id="${id}"]`);
            if (audio) {
                audio.playbackRate = speed;
            }
            
            // 更新本地存储中的速度
            updateHistoryItemSpeed(id, speed);
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

// 更新历史记录项的语速
function updateHistoryItemSpeed(id, speed) {
    let history = JSON.parse(localStorage.getItem('audioHistory')) || [];
    const index = history.findIndex(item => item.id == id);
    
    if (index !== -1) {
        history[index].speed = speed;
        localStorage.setItem('audioHistory', JSON.stringify(history));
        
        // 更新下载按钮的data-speed属性
        document.querySelector(`.history-download-btn[data-id="${id}"]`).setAttribute('data-speed', speed);
    }
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
                // 初始化波形

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

// 格式化时间为 MM:SS 格式（复用现有函数或单独实现）
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


// 提取创建波形条和动画的逻辑到单独函数
function createBarsAndAnimate(container, analyser, audioElement, dataArray, bufferLength) {
    // 创建波形条
    const bars = [];
    const barCount = bufferLength || 32; // 如果没有bufferLength，使用默认值
    
    for (let i = 0; i < barCount; i++) {
        const bar = document.createElement('div');
        bar.className = 'bg-gradient-to-t from-gold to-gold/70 rounded-t-full transition-all duration-50 ease-out';
        bar.style.width = '3px';
        bar.style.height = '2px';
        bar.style.minHeight = '2px';
        container.appendChild(bar);
        bars.push(bar);
    }
    
    // 如果没有提供dataArray，创建新的
    if (!dataArray) {
        dataArray = new Uint8Array(barCount);
    }
    
    // 动画更新波形
    function updateWaveform() {
        if (!audioElement || audioElement.paused || !analyser) {
            requestAnimationFrame(updateWaveform);
            return;
        }
        
        try {
            // 获取频率数据
            analyser.getByteFrequencyData(dataArray);
            
            // 更新每个条形的高度
            bars.forEach((bar, i) => {
                const height = (dataArray[i] / 255) * 60 + 2; // 2-62px 高度范围
                bar.style.height = `${height}px`;
                bar.style.opacity = 0.5 + (dataArray[i] / 255) * 0.5;
            });
            
            requestAnimationFrame(updateWaveform);
        } catch (error) {
            console.error('更新波形失败:', error);
        }
    }
    
    // 音频播放时启动波形动画
    const playHandler = () => {
        if (audioElement._audioContext && audioElement._audioContext.audioContext.state === 'suspended') {
            audioElement._audioContext.audioContext.resume();
        }
        updateWaveform();
    };
    
    const pauseHandler = () => {
        bars.forEach(bar => {
            bar.style.height = '2px';
            bar.style.opacity = '0.3';
        });
    };
    
    // 移除旧的事件监听器（如果存在）
    audioElement.removeEventListener('play', playHandler);
    audioElement.removeEventListener('pause', pauseHandler);
    
    // 添加新的事件监听器
    audioElement.addEventListener('play', playHandler);
    audioElement.addEventListener('pause', pauseHandler);
    audioElement.addEventListener('ended', pauseHandler);
    
    // 初始状态
    pauseHandler();
}

// 降级方案：创建静态波形
function createFallbackWaveform(container) {
    container.innerHTML = '';
    for (let i = 0; i < 32; i++) {
        const bar = document.createElement('div');
        const randomHeight = Math.random() * 40 + 5;
        bar.className = 'bg-gradient-to-t from-gold/50 to-gold/30 rounded-t-full';
        bar.style.width = '3px';
        bar.style.height = `${randomHeight}px`;
        bar.style.opacity = '0.6';
        container.appendChild(bar);
    }
}


