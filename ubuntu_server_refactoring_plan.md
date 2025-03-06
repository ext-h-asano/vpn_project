ステータス: [Active]
確信度: [95%]
最終更新日: 2024-06-13

タスク:
[ID-001] ubuntu_serverコードのリファクタリング計画
ステータス: [X] 優先度: [High]
依存関係: なし
進捗ノート:
- 2024-06-13 初期分析開始
- 2024-06-13 主要機能と責務の特定完了
- 2024-06-13 詳細設計の作成
- 2024-06-13 リファクタリング計画完成

[ID-002] モジュール構造の再設計
ステータス: [X] 優先度: [High]
依存関係: [ID-001]
進捗ノート:
- 2024-06-13 新しいディレクトリ構造の作成
- 2024-06-13 基本的なファイル構造の作成
- 2024-06-13 設定管理、ロギング、例外処理の実装
- 2024-06-13 ユーティリティ関数の実装
- 2024-06-13 アプリケーションの基本構造の実装
- 2024-06-13 READMEと依存パッケージリストの作成

## 現状分析

`ubuntu_server/change_size_waydroid.py`の初期分析結果：

### 問題点
1. コード構造が単一ファイルに集中しており、責務の分離ができていない
2. エラーハンドリングが不十分
3. グローバル変数の使用（local_id, remote_id, sc, peer_connection, move_coords_x, move_coords_y）
4. コメントアウトされたコードが残っている
5. ハードコードされた値（IPアドレス、ポート番号など）
6. 非同期処理の管理が複雑
7. ログ出力が不統一（print文とloggingの混在）
8. サブプロセス実行の管理が雑
9. 関数の命名が不明確
10. テストコードの欠如

### 主要な機能と責務
1. **WebSocketによるシグナリングサーバーとの通信**
   - シグナリングサーバーへの接続
   - メッセージの送受信
   - 接続状態の管理

2. **WebRTC接続の管理**
   - PeerConnectionの作成と管理
   - SDPオファー/アンサーの処理
   - メディアトラックの追加

3. **Waydroidの管理**
   - Waydroidセッションの起動/停止
   - 画面サイズの変更
   - ADB接続の確立

4. **入力イベント処理**
   - タッチイベントの受信
   - ADBコマンドによる入力の転送
   - スワイプ動作の処理

5. **メディア処理**
   - 仮想カメラの設定（v4l2loopback）
   - scrcpyによる画面キャプチャ
   - ビデオトラックの作成

### 改善すべき点
1. モジュール分割
2. 設定の外部化
3. エラーハンドリングの強化
4. ログ機構の統一
5. クラス設計の導入
6. テストの追加
7. ドキュメントの充実

## リファクタリング計画

### [ID-002] モジュール構造の再設計
ステータス: [X] 優先度: [High]
依存関係: [ID-001]
- 単一ファイルを複数のモジュールに分割
- 各モジュールは単一責任の原則に従う
- パッケージ構造の導入

### [ID-003] 設定管理の改善
ステータス: [-] 優先度: [Medium]
依存関係: [ID-002]
- 設定ファイル（YAML/JSON）の導入
- 環境変数のサポート
- シークレット情報の適切な管理

### [ID-004] クラス設計の導入
ステータス: [ ] 優先度: [High]
依存関係: [ID-002]
- 各責務に対応するクラスの設計
- 依存性注入パターンの適用
- インターフェースの定義

### [ID-005] エラーハンドリングの強化
ステータス: [ ] 優先度: [Medium]
依存関係: [ID-004]
- 例外処理の統一
- リトライメカニズムの導入
- エラーログの充実

### [ID-006] ログ機構の改善
ステータス: [-] 優先度: [Low]
依存関係: [ID-004]
- loggingモジュールの一貫した使用
- ログレベルの適切な設定
- ログフォーマットの標準化

### [ID-007] テスト導入
ステータス: [ ] 優先度: [Medium]
依存関係: [ID-004]
- ユニットテストの作成
- モックを使用した依存関係のテスト
- CI/CD統合の準備

### [ID-008] ドキュメント整備
ステータス: [-] 優先度: [Low]
依存関係: [ID-002, ID-004]
- コードコメントの充実
- README.mdの作成
- API仕様書の作成

## 詳細設計

### 新しいディレクトリ構造

```
ubuntu_server/
├── config/
│   ├── __init__.py
│   ├── settings.py        # 設定管理
│   └── config.yaml        # 設定ファイル
├── core/
│   ├── __init__.py
│   ├── app.py             # アプリケーションのエントリーポイント
│   ├── exceptions.py      # カスタム例外クラス
│   └── logger.py          # ログ設定
├── services/
│   ├── __init__.py
│   ├── signaling.py       # シグナリングサーバー通信
│   ├── webrtc.py          # WebRTC接続管理
│   ├── waydroid.py        # Waydroid管理
│   ├── input_handler.py   # 入力イベント処理
│   └── media.py           # メディア処理
├── utils/
│   ├── __init__.py
│   ├── subprocess_utils.py # サブプロセス実行ユーティリティ
│   └── async_utils.py     # 非同期処理ユーティリティ
├── tests/
│   ├── __init__.py
│   ├── test_signaling.py
│   ├── test_webrtc.py
│   ├── test_waydroid.py
│   └── ...
├── main.py                # エントリーポイント
├── requirements.txt       # 依存パッケージ
└── README.md              # ドキュメント
```

### クラス設計

#### 1. シグナリングサービス

```python
# services/signaling.py
import asyncio
import json
import logging
import websockets
from config.settings import Settings

class SignalingService:
    def __init__(self, settings: Settings, message_handler):
        self.settings = settings
        self.message_handler = message_handler
        self.connection = None
        self.logger = logging.getLogger(__name__)
        
    async def connect(self):
        """シグナリングサーバーに接続"""
        try:
            self.connection = await websockets.connect(
                self.settings.signaling_server_url,
                ssl=self.settings.ssl_context
            )
            self.logger.info("Connected to signaling server")
            return True
        except Exception as e:
            self.logger.error(f"Failed to connect to signaling server: {e}")
            return False
            
    async def send_message(self, message):
        """メッセージを送信"""
        if not self.connection:
            self.logger.error("Not connected to signaling server")
            return False
            
        try:
            await self.connection.send(json.dumps(message))
            self.logger.debug(f"Sent message: {message}")
            return True
        except Exception as e:
            self.logger.error(f"Failed to send message: {e}")
            return False
            
    async def listen(self):
        """メッセージの受信を待機"""
        if not self.connection:
            self.logger.error("Not connected to signaling server")
            return
            
        try:
            while True:
                message = await self.connection.recv()
                self.logger.debug(f"Received message: {message}")
                await self.message_handler(message)
        except websockets.exceptions.ConnectionClosed:
            self.logger.warning("Connection to signaling server closed")
        except Exception as e:
            self.logger.error(f"Error in message listener: {e}")
```

#### 2. WebRTCサービス

```python
# services/webrtc.py
import json
import logging
from aiortc import RTCPeerConnection, RTCSessionDescription
from services.media import MediaService

class WebRTCService:
    def __init__(self, signaling_service, media_service: MediaService):
        self.signaling_service = signaling_service
        self.media_service = media_service
        self.peer_connection = None
        self.data_channel = None
        self.logger = logging.getLogger(__name__)
        
    async def create_peer_connection(self):
        """PeerConnectionを作成"""
        self.peer_connection = RTCPeerConnection()
        
        # ビデオトラックを追加
        video_track = self.media_service.create_video_track()
        self.peer_connection.addTrack(video_track)
        
        # データチャネルのイベントハンドラを設定
        @self.peer_connection.on("datachannel")
        def on_datachannel(channel):
            self.data_channel = channel
            self.logger.info("Data channel opened")
            
            @channel.on("message")
            async def on_message(message):
                await self.handle_data_channel_message(message)
                
        return self.peer_connection
        
    async def handle_offer(self, offer_data):
        """オファーを処理してアンサーを生成"""
        try:
            # オファーSDPを設定
            offer_sdp = RTCSessionDescription(
                sdp=offer_data["sdp"]["sdp"], 
                type="offer"
            )
            
            # PeerConnectionがなければ作成
            if not self.peer_connection:
                await self.create_peer_connection()
                
            # リモートディスクリプションを設定
            await self.peer_connection.setRemoteDescription(offer_sdp)
            
            # アンサーを作成
            answer = await self.peer_connection.createAnswer()
            await self.peer_connection.setLocalDescription(answer)
            
            # アンサーを送信
            await self.signaling_service.send_message({
                "sdp": {
                    "sdp": self.peer_connection.localDescription.sdp,
                    "type": self.peer_connection.localDescription.type
                },
                "remote": offer_data.get("remote")
            })
            
            self.logger.info("Sent answer to offer")
            return True
        except Exception as e:
            self.logger.error(f"Error handling offer: {e}")
            return False
            
    async def handle_data_channel_message(self, message):
        """データチャネルからのメッセージを処理"""
        # 実装は入力ハンドラに委譲
        from services.input_handler import InputHandler
        input_handler = InputHandler()
        await input_handler.process_input(message)
```

#### 3. Waydroid管理サービス

```python
# services/waydroid.py
import asyncio
import logging
import subprocess
from utils.subprocess_utils import run_command, run_command_with_output

class WaydroidService:
    def __init__(self):
        self.logger = logging.getLogger(__name__)
        
    async def start_session(self):
        """Waydroidセッションを開始"""
        try:
            self.logger.info("Starting Waydroid session")
            await run_command("waydroid session stop")
            await self.wait_for_waydroid_start()
            self.logger.info("Waydroid session started")
            return True
        except Exception as e:
            self.logger.error(f"Failed to start Waydroid session: {e}")
            return False
            
    async def show_full_ui(self):
        """Waydroidの完全UIを表示"""
        try:
            self.logger.info("Showing Waydroid full UI")
            await self.wait_show_full_ui_waydroid()
            self.logger.info("Waydroid full UI shown")
            return True
        except Exception as e:
            self.logger.error(f"Failed to show Waydroid full UI: {e}")
            return False
            
    async def set_screen_size(self, width, height):
        """画面サイズを設定"""
        try:
            self.logger.info(f"Setting screen size to {width}x{height}")
            await run_command("waydroid session stop")
            await self.wait_for_waydroid_start()
            await run_command("adb kill-server")
            await run_command("adb start-server")
            await run_command("adb connect 192.168.240.112:5555")
            await run_command(f"adb shell wm size {width}x{height}")
            self.logger.info(f"Screen size set to {width}x{height}")
            return True
        except Exception as e:
            self.logger.error(f"Failed to set screen size: {e}")
            return False
            
    async def wait_for_waydroid_start(self):
        """Waydroidの起動を待機"""
        target_log = "Established ADB connection to Waydroid device at 192.168.240.112."
        await run_command("sudo killall -9 adb")
        
        process = await run_command_with_output(
            ["waydroid", "session", "start"],
            target_log=target_log
        )
        return process
        
    async def wait_show_full_ui_waydroid(self):
        """Waydroidの完全UI表示を待機"""
        target_log = "Established ADB connection to Waydroid device at 192.168.240.112."
        await run_command("sudo killall -9 adb")
        
        process = await run_command_with_output(
            ["waydroid", "show-full-ui"],
            target_log=target_log
        )
        return process
        
    async def setup_virtual_camera(self):
        """仮想カメラをセットアップ"""
        try:
            self.logger.info("Setting up virtual camera")
            await run_command("sudo killall -9 scrcpy")
            await run_command("sudo modprobe -r v4l2loopback")
            await run_command("sudo modprobe v4l2loopback exclusive_caps=1")
            await run_command("waydroid session stop")
            await self.wait_show_full_ui_waydroid()
            await run_command("adb kill-server")
            await run_command("adb start-server")
            await run_command("adb connect 192.168.240.112:5555")
            
            # scrcpyをバックグラウンドで実行
            subprocess.Popen(["scrcpy", "--v4l2-sink=/dev/video0"])
            await asyncio.sleep(5)  # 起動を待機
            
            self.logger.info("Virtual camera setup completed")
            return True
        except Exception as e:
            self.logger.error(f"Failed to setup virtual camera: {e}")
            return False
```

#### 4. 入力ハンドラ

```python
# services/input_handler.py
import json
import logging
import asyncio
from utils.subprocess_utils import run_command

class InputHandler:
    def __init__(self):
        self.logger = logging.getLogger(__name__)
        self.move_coords_x = []
        self.move_coords_y = []
        
    async def process_input(self, message):
        """入力イベントを処理"""
        try:
            coords = json.loads(message)
            event_type = coords.get('type')
            
            if not event_type:
                self.logger.warning(f"Received message without type: {message}")
                return
                
            self.logger.debug(f"Processing input event: {event_type}")
            
            if event_type == "swipe_start":
                await self.handle_swipe_start(coords)
            elif event_type == "move_to":
                await self.handle_move_to(coords)
            elif event_type == "swipe_end":
                await self.handle_swipe_end(coords)
            elif event_type == "touch":
                await self.handle_touch(coords)
            else:
                self.logger.warning(f"Unknown event type: {event_type}")
                
        except json.JSONDecodeError:
            self.logger.error(f"Invalid JSON in input message: {message}")
        except Exception as e:
            self.logger.error(f"Error processing input: {e}")
            
    async def handle_swipe_start(self, coords):
        """スワイプ開始イベントを処理"""
        try:
            x = coords.get("startX")
            y = coords.get("startY")
            
            if x is None or y is None:
                self.logger.warning("Missing coordinates in swipe_start event")
                return
                
            self.logger.debug(f"Handling swipe start at ({x}, {y})")
            await run_command(f"adb shell input motionevent DOWN {x} {y}")
            
        except Exception as e:
            self.logger.error(f"Error handling swipe start: {e}")
            
    async def handle_move_to(self, coords):
        """移動イベントを処理"""
        try:
            x = coords.get("endX")
            y = coords.get("endY")
            
            if x is None or y is None:
                self.logger.warning("Missing coordinates in move_to event")
                return
                
            self.logger.debug(f"Handling move to ({x}, {y})")
            
            # 座標をバッファに追加
            self.move_coords_x.append(x)
            self.move_coords_y.append(y)
            
            # 4つの座標が溜まったら処理
            if len(self.move_coords_x) == 4:
                last_x = self.move_coords_x[-1]
                last_y = self.move_coords_y[-1]
                
                await run_command(f"adb shell input motionevent MOVE {last_x} {last_y}")
                
                # バッファをクリア
                self.move_coords_x = []
                self.move_coords_y = []
                
        except Exception as e:
            self.logger.error(f"Error handling move to: {e}")
            
    async def handle_swipe_end(self, coords):
        """スワイプ終了イベントを処理"""
        try:
            x = coords.get("endX")
            y = coords.get("endY")
            
            if x is None or y is None:
                self.logger.warning("Missing coordinates in swipe_end event")
                return
                
            self.logger.debug(f"Handling swipe end at ({x}, {y})")
            await run_command(f"adb shell input motionevent UP {x} {y}")
            
        except Exception as e:
            self.logger.error(f"Error handling swipe end: {e}")
            
    async def handle_touch(self, coords):
        """タッチイベントを処理"""
        try:
            x = coords.get("x")
            y = coords.get("y")
            
            if x is None or y is None:
                self.logger.warning("Missing coordinates in touch event")
                return
                
            self.logger.debug(f"Handling touch at ({x}, {y})")
            await run_command(f"adb shell input tap {x} {y}")
            
        except Exception as e:
            self.logger.error(f"Error handling touch: {e}")
```

#### 5. メディアサービス

```python
# services/media.py
import logging
from aiortc.contrib.media import MediaPlayer

class MediaService:
    def __init__(self):
        self.logger = logging.getLogger(__name__)
        
    def create_video_track(self):
        """仮想カメラからビデオトラックを作成"""
        try:
            self.logger.info("Creating video track from virtual camera")
            screen_video = MediaPlayer('/dev/video0', format='v4l2')
            return screen_video.video
        except Exception as e:
            self.logger.error(f"Failed to create video track: {e}")
            raise
```

### サブプロセスユーティリティ

```python
# utils/subprocess_utils.py
import asyncio
import logging
import subprocess
from typing import List, Optional

logger = logging.getLogger(__name__)

async def run_command(command: str) -> bool:
    """コマンドを実行し、成功したかどうかを返す"""
    try:
        if isinstance(command, str):
            command_list = command.split()
        else:
            command_list = command
            
        logger.debug(f"Running command: {command}")
        process = await asyncio.create_subprocess_exec(
            *command_list,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE
        )
        
        stdout, stderr = await process.communicate()
        
        if process.returncode != 0:
            logger.error(f"Command failed with return code {process.returncode}")
            logger.error(f"stderr: {stderr.decode()}")
            return False
            
        logger.debug(f"Command completed successfully")
        return True
        
    except Exception as e:
        logger.error(f"Error running command: {e}")
        return False

async def run_command_with_output(command: List[str], target_log: Optional[str] = None) -> subprocess.Popen:
    """
    コマンドを実行し、特定のログが出力されるまで待機する
    target_logが指定されていない場合は、プロセスを返す
    """
    try:
        logger.debug(f"Running command with output: {command}")
        process = subprocess.Popen(
            command,
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            text=True,
            bufsize=1
        )
        
        if target_log:
            while True:
                line = process.stdout.readline()
                if not line:
                    break
                    
                logger.debug(line.strip())
                
                if target_log in line:
                    logger.info(f"Found target log: {target_log}")
                    break
                    
        return process
        
    except Exception as e:
        logger.error(f"Error running command with output: {e}")
        raise
```

### ロギング設定

```python
# core/logger.py
import logging
import sys
from logging.handlers import RotatingFileHandler

def setup_logging(log_file='ubuntu_server.log', log_level=logging.INFO):
    """ロギングの設定"""
    # ルートロガーの設定
    root_logger = logging.getLogger()
    root_logger.setLevel(log_level)
    
    # フォーマッタの作成
    formatter = logging.Formatter(
        '%(asctime)s - %(name)s - %(levelname)s - %(message)s'
    )
    
    # コンソールハンドラの設定
    console_handler = logging.StreamHandler(sys.stdout)
    console_handler.setFormatter(formatter)
    root_logger.addHandler(console_handler)
    
    # ファイルハンドラの設定
    file_handler = RotatingFileHandler(
        log_file,
        maxBytes=10*1024*1024,  # 10MB
        backupCount=5
    )
    file_handler.setFormatter(formatter)
    root_logger.addHandler(file_handler)
    
    # サードパーティライブラリのログレベルを調整
    logging.getLogger('websockets').setLevel(logging.WARNING)
    logging.getLogger('asyncio').setLevel(logging.WARNING)
    
    return root_logger
```

### 設定ファイル例

```yaml
# config/config.yaml
# シグナリングサーバー設定
signaling_server_url: wss://signaling.android-vpn.com:3001

# デバイスID設定
local_id: test_device_id
remote_id: f7a46a28-e091-7031-dcd8-f3a301923e0c

# Waydroid設定
waydroid_ip: 192.168.240.112
waydroid_port: 5555

# ログ設定
log_level: INFO
log_file: ubuntu_server.log
```

### 依存パッケージ

```
# requirements.txt
aiortc==1.3.2
websockets==10.4
pyyaml==6.0
```

## 実装計画

1. **フェーズ1**: 基本構造の実装
   - ディレクトリ構造の作成
   - 設定管理の実装
   - ロギング機構の実装

2. **フェーズ2**: コアサービスの実装
   - シグナリングサービス
   - WebRTCサービス
   - Waydroidサービス

3. **フェーズ3**: 補助サービスの実装
   - 入力ハンドラ
   - メディアサービス
   - ユーティリティ関数

4. **フェーズ4**: テストとドキュメント
   - ユニットテストの作成
   - READMEの作成
   - コードコメントの追加

## リスク評価

1. **依存関係の複雑さ**:
   - リスク: WebRTC、Waydroid、ADBなど多くの外部依存関係がある
   - 対策: 各依存関係を適切に抽象化し、インターフェースを通じて操作する

2. **非同期処理の複雑さ**:
   - リスク: 非同期処理の管理が複雑になる可能性がある
   - 対策: asyncioの適切な使用と、非同期処理のパターンを統一する

3. **テスト難易度**:
   - リスク: 外部依存関係が多いため、テストが難しい
   - 対策: モックとスタブを使用して依存関係を分離し、ユニットテストを容易にする

## 結論

このリファクタリング計画は、現在の単一ファイルの実装を、責務ごとに分離された複数のモジュールに再構成します。これにより、コードの可読性、保守性、テスト容易性が向上し、将来の機能追加や変更が容易になります。

特に以下の点が改善されます：

1. **コード構造**: 単一責任の原則に従ったモジュール分割
2. **エラーハンドリング**: 統一された例外処理と適切なエラーログ
3. **設定管理**: 外部設定ファイルと環境変数のサポート
4. **ログ機構**: 一貫したロギングの使用
5. **テスト容易性**: 依存性注入によるテスト可能な設計

この計画に従って実装を進めることで、より堅牢で保守性の高いコードベースを実現できます。 