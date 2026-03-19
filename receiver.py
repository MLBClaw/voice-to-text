#!/usr/bin/env python3
"""
语音转文字 - 接收端服务器
支持 WebSocket 和 HTTP 接收
"""

import asyncio
import json
import logging
import os
import sys
import websockets
from datetime import datetime
from http.server import HTTPServer, BaseHTTPRequestHandler
import threading
import argparse

# 配置日志
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.StreamHandler(sys.stdout),
        logging.FileHandler('receiver.log', encoding='utf-8')
    ]
)
logger = logging.getLogger(__name__)

# 全局变量
received_messages = []
SAVE_FILE = 'received_texts.txt'

# ==================== WebSocket 服务器 ====================

class WebSocketServer:
    def __init__(self, host='0.0.0.0', port=8765):
        self.host = host
        self.port = port
        self.clients = set()
    
    async def register(self, websocket):
        """注册新客户端"""
        self.clients.add(websocket)
        logger.info(f"WebSocket 客户端连接，当前连接数: {len(self.clients)}")
    
    async def unregister(self, websocket):
        """注销客户端"""
        self.clients.discard(websocket)
        logger.info(f"WebSocket 客户端断开，当前连接数: {len(self.clients)}")
    
    async def handle_client(self, websocket, path):
        """处理客户端连接"""
        await self.register(websocket)
        try:
            async for message in websocket:
                try:
                    data = json.loads(message)
                    await self.process_message(data, websocket)
                except json.JSONDecodeError:
                    logger.warning(f"收到无效的 JSON: {message}")
                    await websocket.send(json.dumps({
                        "status": "error",
                        "message": "Invalid JSON format"
                    }))
        except websockets.exceptions.ConnectionClosed:
            logger.info("WebSocket 连接正常关闭")
        except Exception as e:
            logger.error(f"WebSocket 处理错误: {e}")
        finally:
            await self.unregister(websocket)
    
    async def process_message(self, data, websocket):
        """处理接收到的消息"""
        text = data.get('text', '')
        timestamp = data.get('timestamp', datetime.now().isoformat())
        language = data.get('language', 'unknown')
        source = data.get('source', 'unknown')
        
        # 保存消息
        message_record = {
            'type': 'websocket',
            'text': text,
            'timestamp': timestamp,
            'language': language,
            'source': source,
            'received_at': datetime.now().isoformat()
        }
        received_messages.append(message_record)
        save_to_file(message_record)
        
        # 打印到控制台
        print("\n" + "="*50)
        print("🎙️ 收到语音转写文本 (WebSocket)")
        print("="*50)
        print(f"📝 内容: {text}")
        print(f"🌐 语言: {language}")
        print(f"📱 来源: {source}")
        print(f"⏰ 时间: {timestamp}")
        print("="*50 + "\n")
        
        # 发送确认
        response = {
            "status": "success",
            "message": "Text received",
            "received_at": datetime.now().isoformat()
        }
        await websocket.send(json.dumps(response))
    
    async def start(self):
        """启动 WebSocket 服务器"""
        logger.info(f"WebSocket 服务器启动在 ws://{self.host}:{self.port}")
        async with websockets.serve(self.handle_client, self.host, self.port):
            await asyncio.Future()  # 永久运行


# ==================== HTTP 服务器 ====================

class HTTPRequestHandler(BaseHTTPRequestHandler):
    def log_message(self, format, *args):
        """自定义日志"""
        logger.info(f"HTTP {args[0]}")
    
    def do_OPTIONS(self):
        """处理 CORS 预检请求"""
        self.send_response(200)
        self.send_cors_headers()
        self.end_headers()
    
    def send_cors_headers(self):
        """发送 CORS 响应头"""
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        self.send_header('Content-Type', 'application/json')
    
    def do_GET(self):
        """处理 GET 请求"""
        if self.path == '/health':
            self.send_response(200)
            self.send_cors_headers()
            self.end_headers()
            response = {
                "status": "ok",
                "service": "voice-to-text-receiver",
                "websocket_port": WS_PORT,
                "http_port": HTTP_PORT
            }
            self.wfile.write(json.dumps(response).encode('utf-8'))
        else:
            self.send_response(404)
            self.send_cors_headers()
            self.end_headers()
            self.wfile.write(json.dumps({"error": "Not found"}).encode('utf-8'))
    
    def do_POST(self):
        """处理 POST 请求"""
        if self.path == '/api/text':
            content_length = int(self.headers.get('Content-Length', 0))
            post_data = self.rfile.read(content_length)
            
            try:
                data = json.loads(post_data.decode('utf-8'))
                self.process_http_message(data)
                
                self.send_response(200)
                self.send_cors_headers()
                self.end_headers()
                response = {
                    "status": "success",
                    "message": "Text received",
                    "received_at": datetime.now().isoformat()
                }
                self.wfile.write(json.dumps(response).encode('utf-8'))
                
            except json.JSONDecodeError:
                self.send_response(400)
                self.send_cors_headers()
                self.end_headers()
                self.wfile.write(json.dumps({"error": "Invalid JSON"}).encode('utf-8'))
        else:
            self.send_response(404)
            self.send_cors_headers()
            self.end_headers()
            self.wfile.write(json.dumps({"error": "Not found"}).encode('utf-8'))
    
    def process_http_message(self, data):
        """处理 HTTP 消息"""
        text = data.get('text', '')
        timestamp = data.get('timestamp', datetime.now().isoformat())
        language = data.get('language', 'unknown')
        source = data.get('source', 'unknown')
        
        # 保存消息
        message_record = {
            'type': 'http',
            'text': text,
            'timestamp': timestamp,
            'language': language,
            'source': source,
            'received_at': datetime.now().isoformat()
        }
        received_messages.append(message_record)
        save_to_file(message_record)
        
        # 打印到控制台
        print("\n" + "="*50)
        print("🎙️ 收到语音转写文本 (HTTP)")
        print("="*50)
        print(f"📝 内容: {text}")
        print(f"🌐 语言: {language}")
        print(f"📱 来源: {source}")
        print(f"⏰ 时间: {timestamp}")
        print("="*50 + "\n")


class HTTPServerThread(threading.Thread):
    def __init__(self, host='0.0.0.0', port=8080):
        super().__init__()
        self.host = host
        self.port = port
        self.server = None
    
    def run(self):
        self.server = HTTPServer((self.host, self.port), HTTPRequestHandler)
        logger.info(f"HTTP 服务器启动在 http://{self.host}:{self.port}")
        self.server.serve_forever()
    
    def stop(self):
        if self.server:
            self.server.shutdown()


# ==================== 工具函数 ====================

def save_to_file(message):
    """保存消息到文件"""
    try:
        with open(SAVE_FILE, 'a', encoding='utf-8') as f:
            f.write(f"[{message['received_at']}]\n")
            f.write(f"类型: {message['type']}\n")
            f.write(f"语言: {message['language']}\n")
            f.write(f"内容: {message['text']}\n")
            f.write("-" * 50 + "\n\n")
    except Exception as e:
        logger.error(f"保存文件失败: {e}")


# ==================== 主程序 ====================

WS_PORT = 8765
HTTP_PORT = 8080

async def main():
    """主函数"""
    parser = argparse.ArgumentParser(description='语音转文字接收端')
    parser.add_argument('--ws-port', type=int, default=8765, help='WebSocket 端口 (默认: 8765)')
    parser.add_argument('--http-port', type=int, default=8080, help='HTTP 端口 (默认: 8080)')
    parser.add_argument('--host', type=str, default='0.0.0.0', help='监听地址 (默认: 0.0.0.0)')
    args = parser.parse_args()
    
    global WS_PORT, HTTP_PORT
    WS_PORT = args.ws_port
    HTTP_PORT = args.http_port
    
    print("\n" + "="*60)
    print("🎙️ 语音转文字 - 接收端服务器")
    print("="*60)
    print(f"📡 WebSocket: ws://{args.host}:{args.ws_port}")
    print(f"📤 HTTP:      http://{args.host}:{args.http_port}")
    print(f"💾 保存文件:  {os.path.abspath(SAVE_FILE)}")
    print("="*60)
    print("\n按 Ctrl+C 停止服务器\n")
    
    # 启动 HTTP 服务器（在单独的线程中）
    http_server = HTTPServerThread(args.host, args.http_port)
    http_server.daemon = True
    http_server.start()
    
    # 启动 WebSocket 服务器
    ws_server = WebSocketServer(args.host, args.ws_port)
    
    try:
        await ws_server.start()
    except KeyboardInterrupt:
        print("\n正在关闭服务器...")
        http_server.stop()
        print("服务器已停止")


if __name__ == '__main__':
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        print("\n程序已退出")
