const WebSocket = require('ws');
const wrtc = require('@roamhq/wrtc')
const { RTCPeerConnection, RTCSessionDescription } = wrtc;
const { MediaDevices } = wrtc.nonstandard;
const {exec, spawn} = require('child_process');
const util = require('util');
const execPromise = util.promisify(exec);
const LAUNCH_SSL_PORT = 3001;
const LAUNCH_SERVER_ADDRESS = `wss://signaling.android-vpn.com:${LAUNCH_SSL_PORT}`;

const local_id = 'test_device_id';
const remote_id = 'f7a46a28-e091-7031-dcd8-f3a301923e0c';

let sc = null;
let peer_connection = null;

let moveCoordX = [];
let moveCoordY = [];


async function startServerConnection(){
    console.log("ソケット通信の処理を開始しました");
    //SSL検証を無効化するためのオプションを設定しておく
    const wsOptions = {
        rejectUnauthorized: false,
    }
    //WebSocketの接続を確立する
    sc = new WebSocket(LAUNCH_SERVER_ADDRESS, wsOptions);
    //接続が開いた時の処理
    sc.on('open', () => {
        console.log("WebSocket接続が確立されました");
        sc.send(JSON.stringify({
            "open": {"local":local_id, "remote":remote_id,}
        }));
        console.log("openのメッセージを送信しました。");
    });

    //メッセージを受け取った時の処理
    sc.on('message', (message) => {
        gotMessageFromServer(message);
    });

    sc.on('error', (error) => {
        console.error("WebSocketエラーが発生しました");
    });

    sc.on('close', (code, reason) => {
        console.log(`WebSocket接続が閉じられました: ${code} ${reason}`);
    });

    const pingInterval = setInterval(() => {
        if (sc.readyState == WebSocket.OPEN) {
            sc.send(JSON.stringify({"ping": 1}));
            console.log("Pingを送信しました");
        } else {
            clearInterval(pingInterval);
        }
    }, 30000); //30秒ごとにPingを送信
}

async function gotMessageFromServer(message){
    const signal = JSON.parse(message);
    console.log(`${JSON.stringify(signal)}: testetsttesttest`);

    if (signal.screen_size) {
        const screenSize = signal.screen_size;
        const width = parseInt(screenSize.width) * 2;
        const height = parseInt(screenSize.height) * 2;
        
        console.log("スクリーンサイズ変更");
        await execPromise('waydroid session stop');
        console.log("waydroid session stop");
        await execPromise('sudo killall -9 adb');
        console.log('adbのプロセスを全て終了')
        // spawn('waydroid', ['show-full-ui'], {
        //     detached: true,
        //     stdio: 'ignore'
        // });
        await startWaydroidAndWaitForEstablished();
        console.log("waydroid show-full-ui");
        await execPromise('adb kill-server');
        console.log("kill-server");
        await execPromise('adb start-server');
        console.log("start-server");
        await execPromise('adb connect 192.168.240.112:5555');
        console.log("connect");
        await execPromise('adb devices');
        console.log('devices');
        console.log(width);
        console.log(height);
        await execPromise(`adb shell wm size ${width}x${height}`);
        console.log('adb screen size');
        sc.send(JSON.stringify({"type": "resize_success", "remote": remote_id}));
    } else if (signal.init){
        // scrcpyが実行中かどうかを確認
        
        const scrcpyRunning = await isScrcpyRunning();
        
        if (scrcpyRunning) {
            console.log("scrcpyは既に実行中です。一度終了させます。");
            await execPromise('sudo killall -9 scrcpy');
            console.log("scrcpyを終了しました。");
        } else {
            console.log("scrcpyは実行されていません。");
        }

        await execPromise('sudo modprobe -r v4l2loopback');
        console.log("v4l2loopbackを削除しました。");
        // v4l2loopback モジュールを一度削除し、再設定
        await execPromise('sudo modprobe v4l2loopback exclusive_caps=1');
        console.log("v4l2loopbackを再設定しました。");
        
        
        // waydroidセッションを停止
        // await execPromise('waydroid session stop');
        // console.log("waydroid session stop");
        
        // adbサーバーを再起動
        // await execPromise('adb kill-server');
        // await execPromise('adb start-server');
        // await execPromise('adb connect 192.168.240.112:5555');
        
        // scrcpyを起動
        console.log("scrcpyを起動します");
        spawn('scrcpy', ['--v4l2-sink=/dev/video0'], {
            detached: true,
            stdio: 'ignore'
        }); 
        
        // 5秒待機
        await new Promise(resolve => setTimeout(resolve, 5000));
        sc.send(JSON.stringify({"status": "success", "remote": remote_id}));
    } else if (signal.sdp) {
        await receiveOfferAndSendAnswer(signal);
    } else if (signal.ice) {
        await receiveIceCandidate(signal.ice);
    } else {
        console.log("Key 'type' not found in signal");
    }
}

// waydroidを起動し、Establishedログが出るまで待機する関数
async function startWaydroidAndWaitForEstablished() {
    return new Promise((resolve, reject) => {
        // waydroidプロセスを起動し、標準出力と標準エラー出力を取得できるようにする
        // stdio: 'ignore'を指定せず、出力をキャプチャできるようにする
        const waydroidProcess = spawn('waydroid', ['show-full-ui'], {
            detached: true
        });
        
        // タイムアウト設定（60秒）
        const timeout = setTimeout(() => {
            waydroidProcess.removeAllListeners();
            waydroidProcess.stdout.removeAllListeners();
            waydroidProcess.stderr.removeAllListeners();
            console.log('waydroid起動タイムアウト');
            resolve(); // タイムアウトしても次に進む
        }, 60000);
        
        // 標準出力を監視
        waydroidProcess.stdout.on('data', (data) => {
            const output = data.toString();
            console.log(`waydroid stdout: ${output}`);
            
            if (output.includes('Established ADB connection to Waydroid device at 192.168.240.112.')) {
                clearTimeout(timeout);
                console.log('waydroid起動完了を検出');
                resolve();
            }
        });
        
        // 標準エラー出力を監視
        waydroidProcess.stderr.on('data', (data) => {
            const output = data.toString();
            console.log(`waydroid stderr: ${output}`);
            
            if (output.includes('Established')) {
                clearTimeout(timeout);
                console.log('waydroid起動完了を検出');
                resolve();
            }
        });
        
        // エラー処理
        waydroidProcess.on('error', (err) => {
            clearTimeout(timeout);
            console.error('waydroid起動エラー:', err);
            reject(err);
        });
    });
}

// scrcpyが実行中かどうかを確認する関数
async function isScrcpyRunning() {
    try {
        const { stdout } = await execPromise('pgrep -x scrcpy');
        return stdout.trim() !== '';
    } catch (error) {
        // pgrep コマンドが失敗した場合（プロセスが見つからない場合など）
        return false;
    }
}

// WebRTC関連の処理
async function receiveOfferAndSendAnswer(data) {
    try {
        // シグナリングサーバーからOfferを受けて、SDPの形式に直す
        const offerSdp = new RTCSessionDescription({
            sdp: data.sdp.sdp,
            type: "offer"
        });

        // PeerConnectionを作成する
        peer_connection = new RTCPeerConnection();
        console.log("PeerConnectionを作成した。");

        // Videoトラックを作成して、PeerConnectionに追加する
        // const videoTrack = await createLocalVideoTrack();
        // if (videoTrack) {
        //     peer_connection.addTrack(videoTrack);
        // }

        // データチャンネルの開設を確認する
        peer_connection.ondatachannel = (event) => {
            const channel = event.channel;
            console.log("データチャンネルを開設した。");
            
            channel.onmessage = async (event) => {
                try {
                    const coords = JSON.parse(event.data);
                    
                    if (coords.type === "swipe_start") {
                        await execPromise(`adb shell input motionevent DOWN ${coords.startX} ${coords.startY}`);
                        console.log("swipe_start");
                    } else if (coords.type === "move_to") {
                        console.log("move");
                        moveCoordX.push(coords.endX);
                        moveCoordY.push(coords.endY);
                        if (moveCoordX.length === 4) {
                            const lastX = moveCoordX[moveCoordX.length - 1];
                            const lastY = moveCoordY[moveCoordY.length - 1];
                            await execPromise(`adb shell input motionevent MOVE ${lastX} ${lastY}`);
                            moveCoordX = [];
                            moveCoordY = [];
                        }
                    } else if (coords.type === "swipe_end") {
                        await execPromise(`adb shell input motionevent UP ${coords.endX} ${coords.endY}`);
                    } else if (coords.type === "touch") {
                        await execPromise(`adb shell input tap ${coords.x} ${coords.y}`);
                    }
                } catch (error) {
                    console.error("データチャネルメッセージ処理エラー:", error);
                }
            };
            
            channel.onclose = () => {
                console.log("Data channel closed");
            };
            
            channel.onerror = (error) => {
                console.error("Data channel error:", error);
            };
        };

        // 受け取ったOfferをリモートSDPとしてRTCPeerConnectionに追加
        await peer_connection.setRemoteDescription(offerSdp);
        console.log("リモートSDPを設定した。");

        // Answerを作成してローカルSDPとしてRTCPeerConnectionに追加
        const answerSdp = await peer_connection.createAnswer();
        console.log("Answerを作成した。");
        await peer_connection.setLocalDescription(answerSdp);
        console.log("Answerを設定した。");

        // 作成したAnswerをアプリに返す
        sc.send(JSON.stringify({
            "sdp": {
                "sdp": peer_connection.localDescription.sdp,
                "type": peer_connection.localDescription.type
            },
            "remote": remote_id
        }));
        console.log("作成したAnswerを送り返した。");

        peer_connection.onicecandidate = (event) => {
            if (event.candidate) {
                sc.send(JSON.stringify({
                    "ice": {
                        "candidate": event.candidate.candidate,
                        "sdpMid": event.candidate.sdpMid,
                        "sdpMLineIndex": event.candidate.sdpMLineIndex
                    },
                    "remote": remote_id
                }));
                console.log("ICE候補を送る。");
            }
        }


    } catch (error) {
        console.error("WebRTC処理エラー:", error);
    }
}

//ICE候補を受け取った時の処理
async function receiveIceCandidate(iceData) {
    try {
        if (peer_connection) {
            const iceCandidate = new RTCIceCandidate({
                candidate: iceData.candidate,
                sdpMid: iceData.sdpMid,
                sdpMLineIndex: iceData.sdpMLineIndex
            });
            await peer_connection.addIceCandidate(iceCandidate);
            console.log("ICE候補を追加した。");
        } else {
            console.log("PeerConnectionが存在しません。");
        }
    } catch (error) {
        console.error("ICE候補追加エラー:", error);
    }
}

async function createLocalVideoTrack() {
    try {
        // v4l2デバイスからメディアストリームを取得
        const mediaDevices = new MediaDevices();
        const stream = await mediaDevices.getUserMedia({
            video: {
                deviceId: '/dev/video0',
                width: { ideal: 1280 },
                height: { ideal: 720 }
            }
        });
        
        const videoTracks = stream.getVideoTracks();
        if (videoTracks.length > 0) {
            console.log("ビデオトラックを取得しました");
            return videoTracks[0];
        } else {
            console.error("ビデオトラックが見つかりませんでした");
            return null;
        }
    } catch (error) {
        console.error("ビデオトラック作成エラー:", error);
        return null;
    }
}


async function main() {
    console.log('Node.jsアプリケーションの開始');
    await startServerConnection();
}

main().catch(err => {
    console.error('エラーが発生しました;', err);
});
