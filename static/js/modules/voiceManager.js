// voiceManager.js - 共享的音色管理逻辑
import { appState } from '../app.js';

export class VoiceManager {
    constructor(context) {
        this.context = context; // 'main' 或 'modal'
        this.currentAudio = null;
        this.currentPlayButton = null;
    }

    // 共享的收藏功能
    toggleFavorite(voiceId) {
        const allVoices = appState.voicesByCategory['all'] || [];
        const voice = allVoices.find(v => v.id == voiceId);
        
        if (!voice) return;
        
        const index = appState.favoriteVoices.findIndex(v => v.id == voiceId);
        
        if (index > -1) {
            appState.favoriteVoices.splice(index, 1);
        } else {
            appState.favoriteVoices.push(voice);
        }
        
        localStorage.setItem('favoriteVoices', JSON.stringify(appState.favoriteVoices));
        return appState.favoriteVoices;
    }

    // 共享的播放功能
    async handlePlayButton(button, audioPath) {
        // 如果点击的是新的播放按钮，先停止当前播放的音频
        if (this.currentPlayButton && this.currentPlayButton !== button) {
            this.currentAudio.pause();
            this.currentAudio.currentTime = 0;
            this.currentPlayButton.classList.remove('playing');
            this.currentPlayButton.querySelector('i').className = 'fa fa-play text-gold';
            
            this.currentAudio = null;
            this.currentPlayButton = null;
        }

        // 检查是否是当前正在播放的按钮
        if (this.currentPlayButton === button) {
            // 暂停播放
            this.currentAudio.pause();
            this.currentAudio.currentTime = 0;
            button.classList.remove('playing');
            button.querySelector('i').className = 'fa fa-play text-gold';
            this.currentAudio = null;
            this.currentPlayButton = null;
        } else {
            // 开始播放新的音频
            try {
                if (this.currentAudio) {
                    this.currentAudio.pause();
                    this.currentAudio = null;
                }
                
                this.currentAudio = new Audio(audioPath);
                this.currentPlayButton = button;
                
                await this.currentAudio.play();
                
                button.classList.add('playing');
                button.querySelector('i').className = 'fa fa-pause text-gold';
                
                this.currentAudio.onended = () => {
                    button.classList.remove('playing');
                    button.querySelector('i').className = 'fa fa-play text-gold';
                    this.currentAudio.currentTime = 0;
                    this.currentAudio = null;
                    this.currentPlayButton = null;
                };
            } catch (error) {
                console.error('播放音频失败:', error);
                alert('无法播放音频，请稍后再试');
                this.currentAudio = null;
                this.currentPlayButton = null;
                button.classList.remove('playing');
                button.querySelector('i').className = 'fa fa-play text-gold';
            }
        }
    }

    // 格式化文件大小
    formatFileSize(bytes) {
        const fileSizeKB = (bytes / 1024).toFixed(1);
        return fileSizeKB > 1024 
            ? `${(fileSizeKB / 1024).toFixed(1)} MB` 
            : `${fileSizeKB} KB`;
    }

    // 格式化时长
    formatDuration(seconds) {
        const minutes = Math.floor(seconds / 60);
        const remainingSeconds = Math.floor(seconds % 60);
        return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
    }

    // 过滤音色
    filterVoices(voices, searchTerm, categoryId = 'all') {
        let filteredVoices = categoryId === 'all' 
            ? voices 
            : (appState.voicesByCategory[categoryId] || []);
        
        if (searchTerm) {
            filteredVoices = filteredVoices.filter(voice => 
                voice.name.toLowerCase().includes(searchTerm) || 
                voice.description.toLowerCase().includes(searchTerm) ||
                voice.category_name.toLowerCase().includes(searchTerm)
            );
        }
        
        return filteredVoices;
    }
}