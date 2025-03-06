const WebSocket = require('ws');
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
    // WebRTC関連のコードはここに実装
    // Node.jsでWebRTCを使用するには、wrtc、simple-peerなどのライブラリが必要です
    console.log("WebRTC offer received, implementation needed");
    
    // 以下はデータチャネルでのタッチイベント処理の例
    // 実際の実装ではWebRTCライブラリに応じて調整が必要です
    /*
    peerConnection.on('datachannel', channel => {
        console.log("Data channel was opened.");
        channel.on('message', async (message) => {
            const coords = JSON.parse(message);
            
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
        });
    });
    */
}

async function main() {
    console.log('Node.jsアプリケーションの開始');
    await startServerConnection();
}

main().catch(err => {
    console.error('エラーが発生しました;', err);
});
