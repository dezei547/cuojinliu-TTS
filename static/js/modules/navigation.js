// 页面导航模块
export function initPageNavigation() {
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

// 渲染收藏的音色（需要从其他模块导入）
function renderFavoriteVoices() {
    // 这个函数将在voiceLibrary模块中实现
    if (window.renderFavoriteVoices) {
        window.renderFavoriteVoices();
    }
}