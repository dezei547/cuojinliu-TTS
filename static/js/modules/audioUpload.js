// 音频上传模块
export function initAudioUpload(prefix) {
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
export function selectPresetVoice(voicePath, voiceName) {
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