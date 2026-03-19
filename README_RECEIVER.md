# 📡 语音转文字 - 接收端

用于接收手机上语音转文字应用发送的文本数据。

## 🚀 快速开始

### 1. 安装依赖

```bash
pip install -r requirements.txt
```

### 2. 运行接收端

```bash
python receiver.py
```

服务器会同时启动：
- **WebSocket**: `ws://0.0.0.0:8765`
- **HTTP**: `http://0.0.0.0:8080`

### 3. 配置手机应用

1. 打开手机上的语音转文字应用
2. 在"发送到服务器"区域：
   - **协议选择**: WebSocket 或 HTTP
   - **IP地址**: 输入电脑的内网 IP（如 `192.168.1.100`）
   - **端口**: WebSocket 默认 `8765`，HTTP 默认 `8080`
3. 点击"连接"
4. 录音后点击"发送文本到服务器"

## 📱 获取电脑 IP

### Windows
```cmd
ipconfig
```
找 IPv4 地址，如 `192.168.1.100`

### Mac/Linux
```bash
ifconfig
# 或
ip addr
```

## 🔧 高级配置

### 自定义端口

```bash
python receiver.py --ws-port 9000 --http-port 9001
```

### 只监听本地

```bash
python receiver.py --host 127.0.0.1
```

### 查看帮助

```bash
python receiver.py --help
```

## 📊 接收到的数据

接收到的文本会：
1. **显示在控制台** - 实时看到转写内容
2. **保存到文件** - 自动保存到 `received_texts.txt`

### 文件格式示例

```
[2026-03-19T22:35:10.123456]
类型: websocket
语言: zh-CN
内容: 这是语音转写的文本内容
--------------------------------------------------
```

## 🌐 防火墙设置

如果手机无法连接，请检查防火墙：

### Windows
```powershell
# 添加防火墙规则
New-NetFirewallRule -DisplayName "VoiceReceiver" -Direction Inbound -LocalPort 8765,8080 -Protocol TCP -Action Allow
```

### Mac
在"系统设置 → 网络 → 防火墙"中允许 Python 应用

### Linux
```bash
sudo ufw allow 8765/tcp
sudo ufw allow 8080/tcp
```

## 🔌 API 接口

### WebSocket

连接: `ws://<ip>:8765`

发送消息格式:
```json
{
  "type": "speech",
  "text": "语音转写的文本",
  "timestamp": "2026-03-19T22:35:10.123Z",
  "language": "zh-CN"
}
```

### HTTP

**健康检查:**
```bash
GET http://<ip>:8080/health
```

**发送文本:**
```bash
POST http://<ip>:8080/api/text
Content-Type: application/json

{
  "text": "语音转写的文本",
  "timestamp": "2026-03-19T22:35:10.123Z",
  "language": "zh-CN"
}
```

## 📝 日志

运行日志保存在 `receiver.log` 文件中。

## 🐛 故障排除

### 手机无法连接
1. 确保手机和电脑在同一 WiFi 网络
2. 检查电脑 IP 是否正确
3. 关闭防火墙或添加例外规则
4. 尝试用浏览器访问 `http://<电脑IP>:8080/health`

### 端口被占用
```bash
# 查找占用端口的进程
lsof -i :8765
# 或 Windows
netstat -ano | findstr :8765
```

### Python 版本
需要 Python 3.7+
```bash
python --version
```

## 📄 许可证

MIT License
