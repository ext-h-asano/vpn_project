import socket
import struct
import time

# 設定
LOCAL_PORT = 27183  # 確認したポート番号
X_COORD = 500       # タッチするX座標
Y_COORD = 500       # タッチするY座標
SCREEN_WIDTH = 1080  # デバイスの画面幅（必要に応じて調整）
SCREEN_HEIGHT = 1920 # デバイスの画面高さ（必要に応じて調整）

# メッセージタイプとアクション定数
TYPE_INJECT_TOUCH_EVENT = 2
ACTION_DOWN = 0
ACTION_UP = 1
ACTION_MOVE = 2

# ポインターID
POINTER_ID_GENERIC_FINGER = -2  # 64ビット符号付き整数として扱う

def send_touch_event(sock, action, x, y):
    # タッチイベントメッセージを作成
    msg = bytearray(32)
    
    # メッセージタイプ
    msg[0] = TYPE_INJECT_TOUCH_EVENT
    
    # アクション (DOWN/UP/MOVE)
    msg[1] = action
    
    # ポインターID (GENERIC_FINGER = -2)
    pointer_id_bytes = struct.pack('>q', POINTER_ID_GENERIC_FINGER)
    msg[2:10] = pointer_id_bytes
    
    # X座標 (32ビット整数)
    x_bytes = struct.pack('>i', x)
    msg[10:14] = x_bytes
    
    # Y座標 (32ビット整数)
    y_bytes = struct.pack('>i', y)
    msg[14:18] = y_bytes
    
    # 画面幅 (16ビット整数)
    width_bytes = struct.pack('>H', SCREEN_WIDTH)
    msg[18:20] = width_bytes
    
    # 画面高さ (16ビット整数)
    height_bytes = struct.pack('>H', SCREEN_HEIGHT)
    msg[20:22] = height_bytes
    
    # 圧力 (1.0 = 0xFFFF)
    pressure_bytes = struct.pack('>H', 0xFFFF)
    msg[22:24] = pressure_bytes
    
    # アクションボタン (0)
    action_button_bytes = struct.pack('>I', 0)
    msg[24:28] = action_button_bytes
    
    # ボタン状態 (0)
    buttons_bytes = struct.pack('>I', 0)
    msg[28:32] = buttons_bytes
    
    # メッセージを送信
    sock.sendall(msg)

def swipe(sock, start_x, start_y, end_x, end_y, duration=0.5, steps=10):
    """
    スワイプ操作を実行する
    
    :param sock: ソケット
    :param start_x: 開始X座標
    :param start_y: 開始Y座標
    :param end_x: 終了X座標
    :param end_y: 終了Y座標
    :param duration: スワイプの所要時間（秒）
    :param steps: スワイプの分割ステップ数
    """
    # タッチダウン
    send_touch_event(sock, ACTION_DOWN, start_x, start_y)
    time.sleep(0.05)
    
    # 移動
    for i in range(1, steps + 1):
        progress = i / steps
        x = int(start_x + (end_x - start_x) * progress)
        y = int(start_y + (end_y - start_y) * progress)
        
        send_touch_event(sock, ACTION_MOVE, x, y)
        time.sleep(duration / steps)
    
    # タッチアップ
    send_touch_event(sock, ACTION_UP, end_x, end_y)

def main():
    try:
        # ソケット接続
        sock = socket.socket(socket.AF_INET, SOCK_STREAM)
        sock.connect(('127.0.0.1', LOCAL_PORT))
        
        print(f"接続成功: 127.0.0.1:{LOCAL_PORT}")
        
        # タップ操作を実行
        print(f"タップ実行: ({X_COORD}, {Y_COORD})")
        
        # タッチダウン
        send_touch_event(sock, ACTION_DOWN, X_COORD, Y_COORD)
        
        # 少し待機
        time.sleep(0.1)
        
        # タッチアップ
        send_touch_event(sock, ACTION_UP, X_COORD, Y_COORD)
        
        print("タップ完了")
        
        # スワイプ操作の例（コメントアウトされています）
        # print("スワイプ実行: 下から上へ")
        # swipe(sock, 500, 1000, 500, 200, duration=0.3)
        # print("スワイプ完了")
        
    except Exception as e:
        print(f"エラー: {e}")
    finally:
        sock.close()
        print("接続終了")

if __name__ == "__main__":
    main()