/**
 * 语音转文字应用
 * 使用 Web Speech API
 */

// 全局变量
let recognition = null;
let isRecording = false;
let finalTranscript = '';
let interimTranscript = '';
let recordingStartTime = null;
let recordingTimer = null;
let audioContext = null;
let analyser = null;
let microphone = null;
let volumeDataArray = null;
let autoSaveTimer = null;

// 设置
let settings = {
    language: 'zh-CN',
    autoPunctuation: true,
    continuous: true
};

// 历史记录
let history = JSON.parse(localStorage.getItem('vtt_history') || '[]');

// 初始化
function init() {
    loadSettings();
    checkBrowserSupport();
    initSpeechRecognition();
    initVolumeIndicator();
    loadHistory();
    updateUI();
}

// 检查浏览器支持
function checkBrowserSupport() {
    const isSupported = 'webkitSpeechRecognition' in window || 'SpeechRecognition' in window;
    
    if (!isSupported) {
        document.getElementById('browserNotice').classList.add('show');
        document.getElementById('recordBtn').disabled = true;
        showToast('您的浏览器不支持语音识别');
    }
}

// 初始化语音识别
function initSpeechRecognition() {
    if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
        return;
    }

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    recognition = new SpeechRecognition();
    
    recognition.continuous = settings.continuous;
    recognition.interimResults = true;
    recognition.lang = settings.language;
    recognition.maxAlternatives = 1;

    recognition.onstart = () => {
        isRecording = true;
        recordingStartTime = Date.now();
        updateRecordingUI();
        startRecordingTimer();
        startVolumeMonitor();
        showToast('开始录音');
    };

    recognition.onresult = (event) => {
        interimTranscript = '';
        
        for (let i = event.resultIndex; i < event.results.length; i++) {
            const transcript = event.results[i][0].transcript;
            
            if (event.results[i].isFinal) {
                finalTranscript += transcript + ' ';
            } else {
                interimTranscript += transcript;
            }
        }
        
        updateTranscriptDisplay();
    };

    recognition.onerror = (event) => {
        console.error('语音识别错误:', event.error);
        
        let errorMsg = '识别出错';
        switch (event.error) {
            case 'no-speech':
                errorMsg = '未检测到语音';
                break;
            case 'audio-capture':
                errorMsg = '无法访问麦克风';
                break;
            case 'not-allowed':
                errorMsg = '请允许使用麦克风';
                break;
            case 'network':
                errorMsg = '网络错误';
                break;
            case 'aborted':
                errorMsg = '识别已取消';
                break;
        }
        
        showToast(errorMsg);
        
        // 自动重启（如果是连续模式且不是用户主动停止）
        if (settings.continuous && isRecording && event.error !== 'aborted') {
            setTimeout(() => {
                if (isRecording) {
                    try {
                        recognition.start();
                    } catch (e) {
                        console.log('重启失败');
                    }
                }
            }, 500);
        } else {
            stopRecording();
        }
    };

    recognition.onend = () => {
        if (settings.continuous && isRecording) {
            // 连续模式下自动重启
            try {
                recognition.start();
            } catch (e) {
                console.log('连续识别重启失败');
                stopRecording();
            }
        } else {
            stopRecording();
        }
    };
}

// 切换录音状态
function toggleRecording() {
    if (!recognition) {
        showToast('您的浏览器不支持语音识别');
        return;
    }

    if (isRecording) {
        stopRecording();
    } else {
        startRecording();
    }
}

// 开始录音
function startRecording() {
    finalTranscript = '';
    interimTranscript = '';
    
    // 更新设置
    recognition.lang = settings.language;
    recognition.continuous = settings.continuous;
    
    try {
        recognition.start();
    } catch (e) {
        showToast('启动失败，请重试');
        console.error(e);
    }
}

// 停止录音
function stopRecording() {
    isRecording = false;
    
    try {
        recognition.stop();
    } catch (e) {
        console.log('停止识别');
    }
    
    clearInterval(recordingTimer);
    stopVolumeMonitor();
    
    // 保存最终结果
    if (finalTranscript.trim()) {
        saveToHistory(finalTranscript.trim());
    }
    
    updateRecordingUI();
    showToast('录音已停止');
}

// 更新录音 UI
function updateRecordingUI() {
    const btn = document.getElementById('recordBtn');
    const status = document.getElementById('recordStatus');
    const timeDisplay = document.getElementById('recordingTime');
    const volumeIndicator = document.getElementById('volumeIndicator');
    const visualizer = document.getElementById('visualizer');
    
    if (isRecording) {
        btn.classList.add('recording');
        btn.innerHTML = '⏹';
        status.textContent = '正在录音...';
        status.classList.add('recording');
        timeDisplay.style.display = 'block';
        volumeIndicator.style.display = 'flex';
        visualizer.style.display = 'flex';
    } else {
        btn.classList.remove('recording');
        btn.innerHTML = '🎤';
        status.textContent = '点击开始录音';
        status.classList.remove('recording');
        timeDisplay.style.display = 'none';
        timeDisplay.textContent = '00:00';
        volumeIndicator.style.display = 'none';
        visualizer.style.display = 'none';
    }
}

// 录音计时器
function startRecordingTimer() {
    recordingTimer = setInterval(() => {
        const elapsed = Math.floor((Date.now() - recordingStartTime) / 1000);
        const minutes = Math.floor(elapsed / 60).toString().padStart(2, '0');
        const seconds = (elapsed % 60).toString().padStart(2, '0');
        document.getElementById('recordingTime').textContent = `${minutes}:${seconds}`;
    }, 1000);
}

// 初始化音量指示器
function initVolumeIndicator() {
    const container = document.getElementById('volumeIndicator');
    for (let i = 0; i < 20; i++) {
        const bar = document.createElement('div');
        bar.className = 'volume-bar';
        bar.style.height = '4px';
        container.appendChild(bar);
    }

    // 初始化可视化器
    const visualizer = document.getElementById('visualizer');
    for (let i = 0; i < 30; i++) {
        const bar = document.createElement('div');
        bar.className = 'visualizer-bar';
        bar.style.height = '4px';
        visualizer.appendChild(bar);
    }
}

// 音量监控
async function startVolumeMonitor() {
    try {
        audioContext = new (window.AudioContext || window.webkitAudioContext)();
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        
        microphone = audioContext.createMediaStreamSource(stream);
        analyser = audioContext.createAnalyser();
        analyser.fftSize = 256;
        
        microphone.connect(analyser);
        
        volumeDataArray = new Uint8Array(analyser.frequencyBinCount);
        
        updateVolumeDisplay();
    } catch (e) {
        console.log('无法访问麦克风音量');
    }
}

// 更新音量显示
function updateVolumeDisplay() {
    if (!isRecording || !analyser) return;
    
    analyser.getByteFrequencyData(volumeDataArray);
    
    // 更新音量指示器
    const volumeBars = document.querySelectorAll('.volume-bar');
    const average = volumeDataArray.reduce((a, b) => a + b) / volumeDataArray.length;
    const volume = Math.min(100, average * 2);
    
    volumeBars.forEach((bar, index) => {
        const threshold = (index + 1) * 5;
        const height = volume > threshold ? 4 + Math.random() * 30 : 4;
        bar.style.height = height + 'px';
    });

    // 更新可视化器
    const visualizerBars = document.querySelectorAll('.visualizer-bar');
    const step = Math.floor(volumeDataArray.length / visualizerBars.length);
    
    visualizerBars.forEach((bar, index) => {
        const value = volumeDataArray[index * step] || 0;
        const height = Math.max(4, (value / 255) * 60);
        bar.style.height = height + 'px';
    });
    
    requestAnimationFrame(updateVolumeDisplay);
}

// 停止音量监控
function stopVolumeMonitor() {
    if (microphone) {
        microphone.disconnect();
        microphone = null;
    }
    if (audioContext) {
        audioContext.close();
        audioContext = null;
    }
    analyser = null;
}

// 更新转写显示
function updateTranscriptDisplay() {
    const content = document.getElementById('transcriptContent');
    let text = finalTranscript;
    
    if (interimTranscript) {
        text += '<span class="interim">' + interimTranscript + '</span>';
    }
    
    content.innerHTML = text || '';
    content.scrollTop = content.scrollHeight;
}

// 保存到历史
function saveToHistory(text) {
    const record = {
        id: Date.now(),
        text: text,
        timestamp: new Date().toISOString(),
        language: settings.language,
        duration: recordingStartTime ? Math.floor((Date.now() - recordingStartTime) / 1000) : 0
    };
    
    history.unshift(record);
    
    // 限制历史数量
    if (history.length > 100) {
        history = history.slice(0, 100);
    }
    
    localStorage.setItem('vtt_history', JSON.stringify(history));
    loadHistory();
}

// 加载历史
function loadHistory() {
    const list = document.getElementById('historyList');
    
    if (history.length === 0) {
        list.innerHTML = `
            <div class="empty-state">
                <div class="empty-state-icon">📝</div>
                <p>暂无历史记录</p>
            </div>
        `;
        return;
    }
    
    list.innerHTML = history.map(item => {
        const date = new Date(item.timestamp);
        const timeStr = `${date.getMonth() + 1}/${date.getDate()} ${date.getHours()}:${date.getMinutes().toString().padStart(2, '0')}`;
        const duration = item.duration ? `${Math.floor(item.duration / 60)}:${(item.duration % 60).toString().padStart(2, '0')}` : '';
        
        return `
            <div class="history-item" onclick="showDetail(${item.id})">
                <div class="history-text">${escapeHtml(item.text)}</div>
                <div class="history-meta">
                    <span>${timeStr} ${duration ? '· ' + duration : ''}</span>
                    <div class="history-actions" onclick="event.stopPropagation()">
                        <button class="history-action-btn" onclick="copyHistoryItem(${item.id})">复制</button>
                        <button class="history-action-btn" onclick="deleteHistoryItem(${item.id})">删除</button>
                    </div>
                </div>
            </div>
        `;
    }).join('');
}

// 显示详情
function showDetail(id) {
    const item = history.find(h => h.id === id);
    if (!item) return;
    
    document.getElementById('detailText').textContent = item.text;
    document.getElementById('detailModal').dataset.currentId = id;
    document.getElementById('detailModal').classList.add('show');
}

// 复制详情
function copyDetailText() {
    const text = document.getElementById('detailText').textContent;
    copyToClipboard(text);
    closeModal();
}

// 关闭模态框
function closeModal() {
    document.getElementById('detailModal').classList.remove('show');
}

// 复制历史项
function copyHistoryItem(id) {
    const item = history.find(h => h.id === id);
    if (item) {
        copyToClipboard(item.text);
    }
}

// 删除历史项
function deleteHistoryItem(id) {
    if (!confirm('确定要删除这条记录吗？')) return;
    
    history = history.filter(h => h.id !== id);
    localStorage.setItem('vtt_history', JSON.stringify(history));
    loadHistory();
    showToast('已删除');
}

// 清空全部历史
function clearAllHistory() {
    if (!confirm('确定要清空所有历史记录吗？')) return;
    
    history = [];
    localStorage.setItem('vtt_history', JSON.stringify(history));
    loadHistory();
    showToast('历史记录已清空');
}

// 复制当前文本
function copyText() {
    const text = finalTranscript + interimTranscript;
    if (!text.trim()) {
        showToast('没有内容可复制');
        return;
    }
    copyToClipboard(text.trim());
}

// 分享文本
async function shareText() {
    const text = finalTranscript + interimTranscript;
    if (!text.trim()) {
        showToast('没有内容可分享');
        return;
    }
    
    if (navigator.share) {
        try {
            await navigator.share({
                title: '语音转文字',
                text: text.trim()
            });
        } catch (e) {
            copyToClipboard(text.trim());
        }
    } else {
        copyToClipboard(text.trim());
    }
}

// 保存转写
function saveTranscript() {
    const text = finalTranscript + interimTranscript;
    if (!text.trim()) {
        showToast('没有内容可保存');
        return;
    }
    
    const blob = new Blob([text.trim()], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `转写_${new Date().toLocaleDateString()}.txt`;
    a.click();
    URL.revokeObjectURL(url);
    
    showToast('已保存到下载文件夹');
}

// 清空转写
function clearTranscript() {
    if (!finalTranscript && !interimTranscript) {
        showToast('转写区已经是空的');
        return;
    }
    
    if (confirm('确定要清空当前转写内容吗？')) {
        finalTranscript = '';
        interimTranscript = '';
        updateTranscriptDisplay();
        showToast('已清空');
    }
}

// 复制到剪贴板
async function copyToClipboard(text) {
    try {
        await navigator.clipboard.writeText(text);
        showToast('已复制到剪贴板');
    } catch (e) {
        // 降级方案
        const textarea = document.createElement('textarea');
        textarea.value = text;
        textarea.style.position = 'fixed';
        textarea.style.opacity = '0';
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
        showToast('已复制到剪贴板');
    }
}

// 设置相关
function loadSettings() {
    const saved = localStorage.getItem('vtt_settings');
    if (saved) {
        settings = { ...settings, ...JSON.parse(saved) };
    }
    
    document.getElementById('languageSelect').value = settings.language;
    document.getElementById('autoPunctuationBtn').textContent = settings.autoPunctuation ? '开启' : '关闭';
    document.getElementById('autoPunctuationBtn').classList.toggle('off', !settings.autoPunctuation);
    document.getElementById('continuousBtn').textContent = settings.continuous ? '开启' : '关闭';
    document.getElementById('continuousBtn').classList.toggle('off', !settings.continuous);
}

function saveSettings() {
    localStorage.setItem('vtt_settings', JSON.stringify(settings));
}

// 语言切换
document.getElementById('languageSelect').addEventListener('change', (e) => {
    settings.language = e.target.value;
    saveSettings();
    
    // 重新初始化语音识别
    if (recognition) {
        recognition.lang = settings.language;
    }
    
    showToast(`已切换到 ${e.target.options[e.target.selectedIndex].text}`);
});

// 切换自动标点
function toggleAutoPunctuation() {
    settings.autoPunctuation = !settings.autoPunctuation;
    document.getElementById('autoPunctuationBtn').textContent = settings.autoPunctuation ? '开启' : '关闭';
    document.getElementById('autoPunctuationBtn').classList.toggle('off', !settings.autoPunctuation);
    saveSettings();
}

// 切换连续识别
function toggleContinuous() {
    settings.continuous = !settings.continuous;
    document.getElementById('continuousBtn').textContent = settings.continuous ? '开启' : '关闭';
    document.getElementById('continuousBtn').classList.toggle('off', !settings.continuous);
    saveSettings();
    
    if (recognition) {
        recognition.continuous = settings.continuous;
    }
}

// 页面切换
function showPage(page) {
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
    
    document.getElementById(`page-${page}`).classList.add('active');
    event.target.closest('.nav-item').classList.add('active');
}

// 显示提示
function showToast(message) {
    const toast = document.getElementById('toast');
    toast.textContent = message;
    toast.classList.add('show');
    
    setTimeout(() => {
        toast.classList.remove('show');
    }, 2000);
}

// 工具函数
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function updateUI() {
    updateTranscriptDisplay();
}

// 初始化
init();

// 页面可见性变化处理
document.addEventListener('visibilitychange', () => {
    if (document.hidden && isRecording) {
        // 页面隐藏时继续录音（后台运行）
        console.log('应用进入后台，继续录音');
    }
});

// 防止意外关闭时丢失数据
window.addEventListener('beforeunload', (e) => {
    if (isRecording) {
        e.preventDefault();
        e.returnValue = '正在录音中，确定要离开吗？';
    }
});

// ==================== TCP/WebSocket/HTTP 发送功能 ====================

// 连接相关变量
let wsConnection = null;
let currentProtocol = 'websocket';
let isConnected = false;

// 切换协议
function switchProtocol(protocol) {
    currentProtocol = protocol;
    
    // 更新标签样式
    document.querySelectorAll('.protocol-tab').forEach(tab => tab.classList.remove('active'));
    document.getElementById(`tab-${protocol}`).classList.add('active');
    
    // 断开现有连接
    if (wsConnection) {
        disconnectServer();
    }
    
    showToast(`已切换到 ${protocol.toUpperCase()} 模式`);
}

// 连接到服务器
async function connectServer() {
    const host = document.getElementById('serverHost').value.trim();
    const port = document.getElementById('serverPort').value.trim();
    
    if (!host) {
        showToast('请输入服务器地址');
        return;
    }
    
    if (currentProtocol === 'websocket') {
        connectWebSocket(host, port);
    } else {
        // HTTP 模式不需要持续连接
        testHttpConnection(host, port);
    }
}

// WebSocket 连接
function connectWebSocket(host, port) {
    const portStr = port ? `:${port}` : '';
    const wsUrl = `wss://${host}${portStr}`;
    
    showToast('正在连接...');
    
    try {
        wsConnection = new WebSocket(wsUrl);
        
        wsConnection.onopen = () => {
            isConnected = true;
            updateConnectionStatus(true);
            showToast('WebSocket 连接成功');
            document.getElementById('sendSection').style.display = 'block';
        };
        
        wsConnection.onclose = () => {
            isConnected = false;
            updateConnectionStatus(false);
            showToast('连接已断开');
            document.getElementById('sendSection').style.display = 'none';
        };
        
        wsConnection.onerror = (error) => {
            console.error('WebSocket 错误:', error);
            showToast('连接失败，请检查地址和端口');
            isConnected = false;
            updateConnectionStatus(false);
        };
        
        wsConnection.onmessage = (event) => {
            console.log('收到服务器消息:', event.data);
            showToast(`服务器回复: ${event.data}`);
        };
        
    } catch (e) {
        console.error('创建 WebSocket 失败:', e);
        showToast('连接失败: ' + e.message);
    }
}

// 测试 HTTP 连接
testHttpConnection = async (host, port) => {
    const portStr = port ? `:${port}` : '';
    const url = `https://${host}${portStr}/health`;
    
    showToast('测试连接...');
    
    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000);
        
        const response = await fetch(url, {
            method: 'GET',
            signal: controller.signal,
            mode: 'no-cors'
        });
        
        clearTimeout(timeoutId);
        
        // 由于 CORS 限制，这里只要没有抛出错误就算成功
        isConnected = true;
        updateConnectionStatus(true);
        showToast('HTTP 服务器可访问');
        document.getElementById('sendSection').style.display = 'block';
        
    } catch (e) {
        // 可能是 CORS 问题，但服务器仍可能存在
        isConnected = true;
        updateConnectionStatus(true);
        showToast('HTTP 模式已准备（可能受 CORS 限制）');
        document.getElementById('sendSection').style.display = 'block';
    }
};

// 断开连接
function disconnectServer() {
    if (wsConnection) {
        wsConnection.close();
        wsConnection = null;
    }
    isConnected = false;
    updateConnectionStatus(false);
    document.getElementById('sendSection').style.display = 'none';
    showToast('已断开连接');
}

// 更新连接状态显示
function updateConnectionStatus(connected) {
    const statusEl = document.getElementById('connectionStatus');
    const dotEl = document.getElementById('statusDot');
    const textEl = document.getElementById('statusText');
    const connectBtn = document.getElementById('connectBtn');
    const disconnectBtn = document.getElementById('disconnectBtn');
    
    if (connected) {
        statusEl.classList.remove('disconnected');
        statusEl.classList.add('connected');
        dotEl.classList.remove('disconnected');
        dotEl.classList.add('connected');
        textEl.textContent = '已连接';
        connectBtn.style.display = 'none';
        disconnectBtn.style.display = 'inline-block';
    } else {
        statusEl.classList.remove('connected');
        statusEl.classList.add('disconnected');
        dotEl.classList.remove('connected');
        dotEl.classList.add('disconnected');
        textEl.textContent = '未连接';
        connectBtn.style.display = 'inline-block';
        disconnectBtn.style.display = 'none';
    }
}

// 发送文本
async function sendText() {
    const text = (finalTranscript + interimTranscript).trim();
    
    if (!text) {
        showToast('没有内容可发送');
        return;
    }
    
    const host = document.getElementById('serverHost').value.trim();
    const port = document.getElementById('serverPort').value.trim();
    
    if (!host) {
        showToast('请输入服务器地址');
        return;
    }
    
    if (currentProtocol === 'websocket') {
        sendViaWebSocket(text);
    } else {
        await sendViaHttp(text, host, port);
    }
}

// 通过 WebSocket 发送
function sendViaWebSocket(text) {
    if (!wsConnection || wsConnection.readyState !== WebSocket.OPEN) {
        showToast('WebSocket 未连接');
        return;
    }
    
    const data = {
        type: 'speech',
        text: text,
        timestamp: new Date().toISOString(),
        language: settings.language
    };
    
    try {
        wsConnection.send(JSON.stringify(data));
        showToast('✓ 已发送到服务器');
    } catch (e) {
        showToast('发送失败: ' + e.message);
    }
}

// 通过 HTTP 发送
async function sendViaHttp(text, host, port) {
    const portStr = port ? `:${port}` : '';
    const url = `https://${host}${portStr}/api/text`;
    
    const data = {
        text: text,
        timestamp: new Date().toISOString(),
        language: settings.language,
        source: 'voice-to-text-app'
    };
    
    try {
        showToast('正在发送...');
        
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(data)
        });
        
        if (response.ok) {
            showToast('✓ 已发送到服务器');
        } else {
            throw new Error(`HTTP ${response.status}`);
        }
        
    } catch (e) {
        console.error('发送失败:', e);
        
        // 尝试 HTTP (非 HTTPS)
        try {
            const httpUrl = `http://${host}${portStr}/api/text`;
            const response = await fetch(httpUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(data)
            });
            
            if (response.ok) {
                showToast('✓ 已发送到服务器 (HTTP)');
            } else {
                throw new Error(`HTTP ${response.status}`);
            }
        } catch (e2) {
            showToast('发送失败，请检查服务器和 CORS 设置');
            console.error('HTTP 发送失败:', e2);
        }
    }
}

// 加载保存的服务器设置
function loadServerSettings() {
    const saved = localStorage.getItem('vtt_server');
    if (saved) {
        const server = JSON.parse(saved);
        document.getElementById('serverHost').value = server.host || '';
        document.getElementById('serverPort').value = server.port || '';
    }
}

// 保存服务器设置
function saveServerSettings() {
    const server = {
        host: document.getElementById('serverHost').value,
        port: document.getElementById('serverPort').value,
        protocol: currentProtocol
    };
    localStorage.setItem('vtt_server', JSON.stringify(server));
}

// 监听输入变化，自动保存
setInterval(() => {
    if (document.getElementById('serverHost')) {
        saveServerSettings();
    }
}, 5000);

// 页面加载时恢复设置
loadServerSettings();
