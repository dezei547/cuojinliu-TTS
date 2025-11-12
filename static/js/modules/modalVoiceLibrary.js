// 弹窗音色库模块
import { appState } from '../app.js';
import { selectPresetVoice } from './audioUpload.js';

export function initModalVoiceLibrary() {
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
    if (appState.voicesByCategory['all'] && appState.voicesByCategory['all'].length > 0) {
        // 已经有数据，直接渲染
        loading.classList.add('hidden');
        container.classList.remove('hidden');
        renderModalLibraryVoices(appState.voicesByCategory['all']);
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
            console.log('获取到的分类数据:', categories);
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
            appState.voicesByCategory['all'] = voices;
            
            // 按分类组织音色
            voices.forEach(voice => {
                if (!appState.voicesByCategory[voice.category_id]) {
                    appState.voicesByCategory[voice.category_id] = [];
                }
                appState.voicesByCategory[voice.category_id].push(voice);
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
    console.log('开始渲染分类筛选器，分类数量:', categories.length);
    const container = document.getElementById('modal_dynamic-filters-container');
    console.log('筛选容器:', container);
    container.innerHTML = '';
    const buttonsContainer = document.getElementById('modal_category-buttons-container');
    console.log('按钮容器:', buttonsContainer);
    buttonsContainer.innerHTML = '';
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
    // 添加"全部"按钮
    const allButton = document.createElement('button');
    allButton.className = 'modal-category-btn active px-3 py-2 bg-gold/20 text-gold rounded-lg text-sm transition-colors border border-gold/30';
    allButton.setAttribute('data-category', 'all');
    allButton.textContent = '全部';
    allButton.addEventListener('click', handleCategoryButtonClick);
    buttonsContainer.appendChild(allButton);

    // 添加筛选事件
    filterSelect.addEventListener('change', function() {
        const categoryId = this.value;
        const searchTerm = document.getElementById('modal_voice_search').value.toLowerCase();
        
        let filteredVoices = [];
        if (categoryId === 'all') {
            filteredVoices = appState.voicesByCategory['all'] || [];
        } else {
            filteredVoices = appState.voicesByCategory[categoryId] || [];
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
    
    // 为动态生成的分类按钮添加事件
    categories.forEach(category => {
        console.log('创建分类按钮:', category);
        const categoryButton = document.createElement('button');
        categoryButton.className = 'modal-category-btn px-3 py-2 bg-ink text-silver rounded-lg text-sm transition-colors border border-gold/30';
        categoryButton.setAttribute('data-category', category.id);
        categoryButton.textContent = category.name;
        categoryButton.addEventListener('click', handleCategoryButtonClick);
        buttonsContainer.appendChild(categoryButton);
    });
    
    console.log('分类筛选器渲染完成，下拉框已创建:', filterSelect);
    console.log('分类按钮数量:', buttonsContainer.children.length);
    // 类别按钮点击事件处理
    function handleCategoryButtonClick() {
        const categoryId = this.getAttribute('data-category');
        
        // 更新按钮状态
        updateCategoryButtonsState(categoryId);
        
        // 同步更新下拉框
        const dropdown = document.getElementById('modal_category_filter');
        if (dropdown) {
            dropdown.value = categoryId;
        }
        
        // 执行筛选
        filterModalLibraryVoices(document.getElementById('modal_voice_search').value.toLowerCase());
    }

    // 更新按钮选中状态
    function updateCategoryButtonsState(activeCategoryId) {
        const buttons = document.querySelectorAll('#voice_library_modal .modal-category-btn');
        buttons.forEach(btn => {
            const categoryId = btn.getAttribute('data-category');
            if (categoryId === activeCategoryId) {
                btn.classList.add('active');
                btn.classList.remove('bg-ink');
                btn.classList.add('bg-gold/20', 'text-gold');
            } else {
                btn.classList.remove('active');
                btn.classList.add('bg-ink', 'text-silver');
                btn.classList.remove('bg-gold/20', 'text-gold');
            }
        });
    }
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
    const gridContainer = document.createElement('div');
    gridContainer.className = 'grid grid-cols-1 md:grid-cols-2 gap-4';    
    // 创建音色列表
    voices.forEach(voice => {
        const isFavorite = appState.favoriteVoices.some(v => v.id === voice.id);
        
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
        
        gridContainer.appendChild(voiceCard);
    });
    container.appendChild(gridContainer);
    // 为新添加的元素绑定事件
    setupModalVoiceCardEvents();
    setupModalPlayButtons();
}

// 渲染弹窗中收藏的音色
function renderModalFavoriteVoices() {
    const container = document.getElementById('modal_favorite_voices_container');
    const noFavoritesMsg = document.getElementById('modal_no_favorites_message');
    // 检查收藏的音色是否仍然存在
    const validFavoriteVoices = appState.favoriteVoices.filter(voice => {
        const allVoices = appState.voicesByCategory['all'] || [];
        return allVoices.some(v => v.id === voice.id);
    });
    
    // 如果发现无效的收藏，更新本地存储
    if (validFavoriteVoices.length !== appState.favoriteVoices.length) {
        appState.favoriteVoices = validFavoriteVoices;
        localStorage.setItem('favoriteVoices', JSON.stringify(appState.favoriteVoices));
    }    
    if (appState.favoriteVoices.length === 0) {
        container.classList.add('hidden');
        noFavoritesMsg.classList.remove('hidden');
        return;
    }
    
    container.classList.remove('hidden');
    noFavoritesMsg.classList.add('hidden');
    container.innerHTML = '';
    const gridContainer = document.createElement('div');
    gridContainer.className = 'grid grid-cols-1 md:grid-cols-2 gap-4';
    appState.favoriteVoices.forEach(voice => {
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
        
        gridContainer.appendChild(voiceCard);
    });
    container.appendChild(gridContainer);
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
        const isFavorite = appState.favoriteVoices.some(v => v.id == voiceId);
        
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
    const categoryFilter = document.getElementById('modal_category_filter');
    const categoryId = categoryFilter ? categoryFilter.value : 'all';
    
    let filteredVoices = [];
    if (categoryId === 'all') {
        filteredVoices = appState.voicesByCategory['all'] || [];
    } else {
        filteredVoices = appState.voicesByCategory[categoryId] || [];
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
    const validFavoriteVoices = appState.favoriteVoices.filter(voice => {
        const allVoices = appState.voicesByCategory['all'] || [];
        return allVoices.some(v => v.id === voice.id);
    });
    
    // 更新本地存储（如果发现无效音色）
    if (validFavoriteVoices.length !== appState.favoriteVoices.length) {
        appState.favoriteVoices = validFavoriteVoices;
        localStorage.setItem('favoriteVoices', JSON.stringify(appState.favoriteVoices));
    }
    if (!searchTerm) {
        renderModalFavoriteVoices();
        return;
    }
    
    const filtered = appState.favoriteVoices.filter(voice => 
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

// 切换音色收藏状态（从voiceLibrary模块导入）
function toggleFavorite(voiceId) {
    // 查找该音色
    const allVoices = appState.voicesByCategory['all'] || [];
    const voice = allVoices.find(v => v.id == voiceId);
    
    if (!voice) return;
    
    // 检查是否已收藏
    const index = appState.favoriteVoices.findIndex(v => v.id == voiceId);
    
    if (index > -1) {
        // 取消收藏
        appState.favoriteVoices.splice(index, 1);
    } else {
        // 添加收藏
        appState.favoriteVoices.push(voice);
    }
    
    // 保存到本地存储
    localStorage.setItem('favoriteVoices', JSON.stringify(appState.favoriteVoices));
    
    // 更新UI
    updateModalFavoriteStatuses();
}