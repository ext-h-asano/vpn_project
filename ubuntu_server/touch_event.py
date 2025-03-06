import socket
import struct
import time

# 設定
LOCAL_PORT = 27183  # 確認したポート番号
X_COORD = 500       # タッチするX座標
Y_COORD = 500       # タッチするY座標
SCREEN_WIDTH = 1080  # デバイスの画面幅
SCREEN_HEIGHT = 1920 # デバイスの画面高さ

# メッセージタイプとアクション定数
TYPE_INJECT_TOUCH_EVENT = 2
ACTION_DOWN = 0
ACTION_UP = 1

# ポインターID
POINTER_ID_GENERIC_FINGER = -2

def create_touch_event(action, x, y):
    # タッチイベントメッセージを作成
    msg = bytearray(32)
    
    # メッセージタイプ
    msg[0] = TYPE_INJECT_TOUCH_EVENT
    
    # アクション (DOWN/UP)
    msg[1] = action
    
    # ポインターID (GENERIC_FINGER = -2)
    struct.pack_into('>q', msg, 2, POINTER_ID_GENERIC_FINGER)
    
    # X座標
    struct.pack_into('>i', msg, 10, x)
    
    # Y座標
    struct.pack_into('>i', msg, 14, y)
    
    # 画面幅
    struct.pack_into('>H', msg, 18, SCREEN_WIDTH)
    
    # 画面高さ
    struct.pack_into('>H', msg, 20, SCREEN_HEIGHT)
    
    # 圧力 (1.0 = 0xFFFF)
    struct.pack_into('>H', msg, 22, 0xFFFF)
    
    # アクションボタン (0)
    struct.pack_into('>I', msg, 24, 0)
    
    # ボタン状態 (0)
    struct.pack_into('>I', msg, 28, 0)
    
    return msg

# メイン処理
try:
    print("scrcpyサーバーに接続を試みます...")
    
    # ソケット作成
    sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    sock.connect(('127.0.0.1', LOCAL_PORT))
    
    print(f"接続成功: 127.0.0.1:{LOCAL_PORT}")
    print(f"タップ実行: ({X_COORD}, {Y_COORD})")
    
    # タッチダウンイベント送信
    down_event = create_touch_event(ACTION_DOWN, X_COORD, Y_COORD)
    sock.sendall(down_event)
    
    # 少し待機
    time.sleep(0.1)
    
    # タッチアップイベント送信
    up_event = create_touch_event(ACTION_UP, X_COORD, Y_COORD)
    sock.sendall(up_event)
    
    print("タップ完了")
    
except Exception as e:
    print(f"エラー発生: {e}")

finally:
    try:
        sock.close()
    except:
        pass
    print("接続終了")