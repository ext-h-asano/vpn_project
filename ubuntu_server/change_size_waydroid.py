import asyncio
import websockets
import ssl
import json
import subprocess
import time
import logging
# import sounddevice as sd
# import numpy as np
# from collections import deque



from aiortc import RTCPeerConnection, RTCSessionDescription
from aiortc.contrib.media import MediaPlayer


LAUNCH_SSL_PORT = 3001
LAUNCG_SERVER_ADDRESS = 'wss://signaling.android-vpn.com:' + str(LAUNCH_SSL_PORT)

#SSL検証を無効にする
ssl_context = ssl.create_default_context()
ssl_context.check_hostname = False
ssl_context.verify_mode = ssl.CERT_NONE


local_id = 'test_device_id'
remote_id = 'f7a46a28-e091-7031-dcd8-f3a301923e0c'
sc = None
peer_connection = None

move_coords_x= []
move_coords_y= []

async def receive_offer_and_send_answer(data):

    # シグナリングサーバーからOfferを受けて、SDPの形式に直す
    offer_sdp = RTCSessionDescription(sdp=data["sdp"]["sdp"], type="offer")

    # PeerConnectionを作成する
    peer_connection = RTCPeerConnection()

    # Videoトラックを作成して、PeerConnectionに追加する
    video_track = create_local_video_track()
    peer_connection.addTrack(video_track)

    # Audioトラックを作成して、PeerConnectionに追加する
    # audio_track = create_local_audio_track()
    # peer_connection.addTrack(audio_track)


    # データチャンネルの開設を確認する。
    @peer_connection.on("datachannel")
    def on_datachannel(channel):
        print("Data channel was opened.") # データチャンネルが開設されたことをログ出力
        @channel.on("message")
        async def on_message(message):
            global move_coords_x, move_coords_y # グローバル変数を参照するように修正
            coords = json.loads(message)

            if coords['type'] == "swipe_start":
                process_down = await asyncio.create_subprocess_exec(
                    'adb', 'shell', 'input', 'motionevent', 'DOWN', str(coords["startX"]), str(coords["startY"])
                )
                print("swipe_start")
            elif coords['type'] == "move_to":
                print("move")
                move_coords_x.append(coords["endX"])
                move_coords_y.append(coords["endY"])
                if len(move_coords_x) == 4:
                    last_x = move_coords_x[-1]
                    last_y = move_coords_y[-1]
                    process_move = await asyncio.create_subprocess_exec(
                        'adb', 'shell', 'input', 'motionevent', 'MOVE', str(last_x), str(last_y)
                    )
                    move_coords_x= []
                    move_coords_y= []
            elif coords['type'] == "swipe_end":
                process_end = await asyncio.create_subprocess_exec(
                    'adb', 'shell', 'input', 'motionevent', 'UP', str(coords["endX"]), str(coords["endY"])
                )
            elif coords['type'] == "touch":
                process_end = await asyncio.create_subprocess_exec(
                    'adb', 'shell', 'input', 'tap', str(coords["x"]), str(coords["y"])
                )
    # 受け取ったOfferをリモートSDPとしてRTCPeerConnectionに追加
    await peer_connection.setRemoteDescription(offer_sdp)

    # Answerを作成してローカルSDPとしてRTCPeerConnectionに追加
    answer_sdp = await peer_connection.createAnswer()
    await peer_connection.setLocalDescription(answer_sdp)

    # 作成したAnswerをアプリに返す
    await sc.send(json.dumps({"sdp": {"sdp":peer_connection.localDescription.sdp,"type":peer_connection.localDescription.type}, "remote": remote_id}))


# 仮想カメラでの/dev/video0から映像を取得する関数
def create_local_video_track():
    screen_video = MediaPlayer('/dev/video0', format='v4l2')
    return screen_video.video

async def start_server_connection():
    print('開始')
    #websocketにIDを送信して、接続を試みる
    global sc
    sc = await websockets.connect(LAUNCG_SERVER_ADDRESS, ssl=ssl_context)
    await sc.send(json.dumps({"open": {"local": local_id, "remote": remote_id}}))
    print('終了')
    while True:
        launch_message = await sc.recv()
        await got_message_from_server(launch_message)

# waydroidが起動するまで、待機する関数
def wait_for_waydroid_start():
    target_log = "Established ADB connection to Waydroid device at 192.168.240.112."
    subprocess.run(['sudo', 'killall', '-9', 'adb'])
    process = subprocess.Popen(
        ["waydroid", "session", "start"],
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        text=True,
        bufsize=1
    )
    while True:
        line = process.stdout.readline()
        if not line:
            break
        print(line, end="")
        if target_log in line:
            break

# waydroidが起動するまで、待機する関数
def wait_show_full_ui_waydroid():
    target_log = "Established ADB connection to Waydroid device at 192.168.240.112."
    subprocess.run(['sudo', 'killall', '-9', 'adb'])
    process = subprocess.Popen(
        ["waydroid", "show-full-ui"],
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        text=True,
        bufsize=1
    )
    while True:
        line = process.stdout.readline()
        if not line:
            break
        print(line, end="")
        if target_log in line:
            break



async def got_message_from_server(message):
    signal = json.loads(message)
    print(f'{signal} : testetetertertrtert')

    if 'screen_size' in signal:
        screen_size = signal['screen_size']
        width = int(screen_size.get('width')) * 2
        height = int(screen_size.get('height')) * 2
        print("スクリーンサイズ")
        subprocess.run(['waydroid', 'session', 'stop'])
        print("waydroid session stop")
        wait_for_waydroid_start()
        print("waydroid show-full-ui")
        subprocess.run(['adb', 'kill-server'])
        subprocess.run(['adb', 'start-server'])
        subprocess.run(['adb', 'connect', '192.168.240.112:5555'])
        subprocess.run(['adb', 'devices'])
        print('connect')
        print(width)
        print(height)
        subprocess.run(['adb','shell', 'wm', 'size', f'{width}x{height}'])
        print('adb screen size')
        await sc.send(json.dumps({"type": "resize_success", "remote": remote_id}))
    elif 'init' in signal:
        # subprocess.run(['pkill', 'scrcpy'])
        subprocess.run(['sudo', 'killall', '-9', 'scrcpy'])
        # v4l2loopback モジュールを一度削除し、再設定後scrcpyを起動する
        subprocess.run(['sudo', 'modprobe', '-r', 'v4l2loopback'])
        subprocess.run(['sudo', 'modprobe', 'v4l2loopback', 'exclusive_caps=1'])
        subprocess.run(['waydroid', 'session', 'stop'])
        print("waydroid session stop")
        wait_show_full_ui_waydroid()
        subprocess.run(['adb', 'kill-server'])
        subprocess.run(['adb', 'start-server'])
        subprocess.run(['adb', 'connect', '192.168.240.112:5555'])
        subprocess.Popen(['scrcpy', '--v4l2-sink=/dev/video0'])
        time.sleep(5)
        await sc.send(json.dumps({"status": "success", "remote": remote_id}))
    elif 'sdp' in signal:
        await receive_offer_and_send_answer(signal)
    else:
        print("Key 'type' not found in signal")



async def main():
    logging.basicConfig(level=logging.INFO)
    await start_server_connection()

asyncio.run(main())
