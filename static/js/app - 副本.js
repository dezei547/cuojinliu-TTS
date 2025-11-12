import { initPageNavigation } from './modules/navigation.js';

import { initAudioUpload } from './modules/audioUpload.js';

import { initVoiceLibrary } from './modules/voiceLibrary.js';

import { initModalVoiceLibrary } from './modules/modalVoiceLibrary.js';

import { initHistory } from './modules/history.js';

import { initAudioGeneration } from './modules/audioGeneration.js';

import {initAuthSystem} from './modules/AuthSystem.js'; 

// 全局状态管理

export const appState = {

    allExamples: [],

    voicesByCategory: { 'all': [] },

    currentCategory: 'all',

    apiBaseUrl: 'http://39.101.72.163/api',

    favoriteVoices: JSON.parse(localStorage.getItem('favoriteVoices')) || [],

    user: JSON.parse(localStorage.getItem('user')) || null,

    token: localStorage.getItem('token') || null

};

// 主应用入口文件

try {





    console.log('所有模块导入成功');



    // DOM 元素加载完成后执行

    document.addEventListener('DOMContentLoaded', function() {

        console.log('DOM 加载完成，开始初始化应用...');

        // 功能设置折叠/展开

        const settingsToggle = document.getElementById('settings_toggle');

        const settingsContent = document.getElementById('settings_content');

        const settingsChevron = document.getElementById('settings_chevron');

        

        settingsToggle.addEventListener('click', function() {

            settingsContent.classList.toggle('hidden');

            settingsChevron.classList.toggle('rotate-180');

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

        try {

            // 初始化页面导航

            console.log('初始化页面导航...');

            initPageNavigation();

            console.log('初始化验证系统...');

            initAuthSystem();

            // 初始化音频上传功能

            console.log('初始化音频上传...');

            initAudioUpload('prompt');

            

            // 初始化音色库

            console.log('初始化音色库...');

            initVoiceLibrary();

            

            // 初始化弹窗音色库

            console.log('初始化弹窗音色库...');

            initModalVoiceLibrary();

            

            // 初始化历史记录

            console.log('初始化历史记录...');

            initHistory();

            

            // 初始化音频生成功能

            console.log('初始化音频生成...');

            initAudioGeneration();

            

            console.log('🎉 应用初始化完成！');

        } catch (initError) {

            console.error('❌ 应用初始化过程中出错:', initError);

        }

    });



} catch (importError) {

    console.error('❌ 模块导入失败:', importError);

    console.error('请检查以下文件是否存在:');

    console.error('- ./modules/navigation.js');

    console.error('- ./modules/audioUpload.js'); 

    console.error('- ./modules/voiceLibrary.js');

    console.error('- ./modules/modalVoiceLibrary.js');

    console.error('- ./modules/history.js');

    console.error('- ./modules/audioGeneration.js');

}