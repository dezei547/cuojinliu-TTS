import { appState } from '../app.js';
export function initAuthSystem() {
    updateUserInterface();
    setupAuthEvents();
    
    // 如果有token，验证token有效性
    if (appState.token) {
        validateToken();
    }
}


// 更新用户界面
function updateUserInterface() {
    const userInfo = document.getElementById('user-info');
    const guestInfo = document.getElementById('guest-info');
    const userName = document.getElementById('user-name');
    const userEmail = document.getElementById('user-email');
    
    if (appState.user) {
        userInfo.classList.remove('hidden');
        guestInfo.classList.add('hidden');
        userName.textContent = appState.user.username;
        userEmail.textContent = appState.user.email;
        
        // 更新导航中的用户信息
        document.querySelector('.sidebar-item[data-page="auth"]').classList.add('hidden');
    } else {
        userInfo.classList.add('hidden');
        guestInfo.classList.remove('hidden');
        document.querySelector('.sidebar-item[data-page="auth"]').classList.remove('hidden');
    }
}

// 设置认证事件
function setupAuthEvents() {
    // 登录/注册切换
    document.getElementById('show-register').addEventListener('click', function() {
        document.getElementById('login-form').classList.add('hidden');
        document.getElementById('register-form').classList.remove('hidden');
    });
    
    document.getElementById('show-login').addEventListener('click', function() {
        document.getElementById('register-form').classList.add('hidden');
        document.getElementById('login-form').classList.remove('hidden');
    });
    
    // 登录表单提交
    document.getElementById('loginForm').addEventListener('submit', function(e) {
        e.preventDefault();
        loginUser();
    });
    
    // 注册表单提交
    document.getElementById('registerForm').addEventListener('submit', function(e) {
        e.preventDefault();
        registerUser();
    });
    
    // 退出登录
    document.getElementById('logout-btn').addEventListener('click', logoutUser);
}

// 登录用户
async function loginUser() {
    const identifier = document.getElementById('login_identifier').value;
    const password = document.getElementById('login_password').value;
    
    try {
        const response = await fetch(`${appState.apiBaseUrl}/login`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                identifier: identifier,
                password: password
            })
        });
        
        const data = await response.json();
        
        if (data.status === 'success') {
            // 保存用户信息和token
            appState.user = data.user;
            appState.token = data.token;
            localStorage.setItem('user', JSON.stringify(data.user));
            localStorage.setItem('token', data.token);
            
            // 更新界面
            updateUserInterface();
            
            // 关闭认证页面，返回首页
            document.getElementById('auth-page').classList.add('hidden');
            document.getElementById('home-page').classList.remove('hidden');
            
            showMessage('登录成功！', 'success');
        } else {
            showMessage(data.message || '登录失败', 'error');
        }
    } catch (error) {
        console.error('登录错误:', error);
        showMessage('网络错误，请稍后重试', 'error');
    }
}

// 注册用户
async function registerUser() {
    const username = document.getElementById('register_username').value;
    const email = document.getElementById('register_email').value;
    const password = document.getElementById('register_password').value;
    const confirmPassword = document.getElementById('register_confirm_password').value;
    const inviteCode = document.getElementById('register_invite_code').value;
    
    // 前端验证
    if (password !== confirmPassword) {
        showMessage('两次输入的密码不一致', 'error');
        return;
    }
    
    if (password.length < 6) {
        showMessage('密码长度至少6位', 'error');
        return;
    }
    
    try {
        const response = await fetch(`${appState.apiBaseUrl}/register`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                username: username,
                email: email,
                password: password,
                invite_code: inviteCode
            })
        });
        
        const data = await response.json();
        
        if (data.status === 'success') {
            showMessage('注册成功！请登录', 'success');
            // 切换到登录表单
            document.getElementById('register-form').classList.add('hidden');
            document.getElementById('login-form').classList.remove('hidden');
            // 清空注册表单
            document.getElementById('registerForm').reset();
        } else {
            showMessage(data.message || '注册失败', 'error');
        }
    } catch (error) {
        console.error('注册错误:', error);
        showMessage('网络错误，请稍后重试', 'error');
    }
}

// 退出登录
export function logoutUser() {
    appState.user = null;
    appState.token = null;
    localStorage.removeItem('user');
    localStorage.removeItem('token');
    updateUserInterface();
    showMessage('已退出登录', 'info');
}

// 验证token有效性
async function validateToken() {
    try {
        const response = await fetch(`${appState.apiBaseUrl}/validate`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${appState.token}`
            }
        });
        
        if (!response.ok) {
            throw new Error('Token无效');
        }
        
        const data = await response.json();
        if (data.status === 'success') {
            appState.user = data.user;
            localStorage.setItem('user', JSON.stringify(data.user));
            updateUserInterface();
        }
    } catch (error) {
        console.error('Token验证失败:', error);
        // Token无效，清除本地存储
        localStorage.removeItem('user');
        localStorage.removeItem('token');
        appState.user = null;
        appState.token = null;
        updateUserInterface();
    }
}

// 显示消息提示
export function showMessage(message, type = 'info') {
    // 移除现有的消息
    const existingMessage = document.querySelector('.auth-message');
    if (existingMessage) {
        existingMessage.remove();
    }
    
    // 创建新消息
    const messageDiv = document.createElement('div');
    messageDiv.className = `auth-message fixed top-4 right-4 px-4 py-3 rounded-lg border z-50 transition-all duration-300 ${
        type === 'success' ? 'bg-green-500/10 border-green-500/30 text-green-400' :
        type === 'error' ? 'bg-red-500/10 border-red-500/30 text-red-400' :
        'bg-blue-500/10 border-blue-500/30 text-blue-400'
    }`;
    messageDiv.textContent = message;
    
    document.body.appendChild(messageDiv);
    
    // 3秒后自动消失
    setTimeout(() => {
        messageDiv.remove();
    }, 3000);
}

