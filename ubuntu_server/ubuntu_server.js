const WebSocket = require('ws');
const wrtc = require('@roamhq/wrtc')
const { RTCPeerConnection, RTCSessionDescription, RTCIceCandidate } = wrtc;
const { RTCVideoSource} = wrtc.nonstandard;
const v4l2camera = require("@dwe.ai/v4l2camera");
const {exec, spawn} = require('child_process');
const util = require('util');
const execPromise = util.promisify(exec);
const LAUNCH_SSL_PORT = 3001;
const LAUNCH_SERVER_ADDRESS = `wss://signaling.android-vpn.com:${LAUNCH_SSL_PORT}`;

// フレーム送信停止フラグをグローバル変数として初期化
global.shouldStopFrameSending = false;

const local_id = 'test_device_id';
const remote_id = 'f7a46a28-e091-7031-dcd8-f3a301923e0c';

let sc = null;
let peer_connection = null;
let admin_peer_connection = null;
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

        sc.send(JSON.stringify({
            "open": {"local":"admin_server" + remote_id, "remote":"admin_web" + remote_id,}
        }));

        console.log("adminのopenのメッセージを送信しました。");
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
        const width = parseInt(screenSize.width);
        const height = parseInt(screenSize.height);
        
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
        // 送信元を確認して適切なピアコネクションに割り当てる
        if (signal.action == "admin_sdp") {
            console.log("管理者からのSDPを受信しました");
            await receiveAdminOfferAndSendAnswer(signal);
        } else {
            console.log("通常ユーザーからのSDPを受信しました");
            await receiveOfferAndSendAnswer(signal);
        }
    } else if (signal.ice) {
        // ICEも送信元に基づいて適切なピアコネクションに割り当てる
        if (isAdmin) {
            console.log("管理者からのICE候補を受信しました");
            await receiveAdminIceCandidate(signal.ice);
        } else {
            console.log("通常ユーザーからのICE候補を受信しました");
            await receiveIceCandidate(signal.ice);
        }
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
        // 新しい接続を開始するので、フレーム送信停止フラグをリセット
        global.shouldStopFrameSending = false;
        
        // シグナリングサーバーからOfferを受けて、SDPの形式に直す
        const offerSdp = new RTCSessionDescription({
            sdp: data.sdp.sdp,
            type: "offer"
        });

        // PeerConnectionを作成する
        peer_connection = new RTCPeerConnection();
        console.log("PeerConnectionを作成した。");

        // RTCVideoSourceを使用して映像トラックを作成
        try {
            // 動画のソースを作成する
            const videoSource = new RTCVideoSource();
            console.log("動画のソースを作成した。");
            
            const cam = new v4l2camera.Camera("/dev/video0");

            const config = cam.configGet();

            cam.start();
            // createTrack()でトラックを作成
            const videoTrack = videoSource.createTrack();
            console.log("動画のトラックを作成した。");
            
            // トラックをPeerConnectionに追加
            const stream = new wrtc.MediaStream();
            stream.addTrack(videoTrack);
            peer_connection.addTrack(videoTrack, stream);
            console.log("動画のトラックをPeerConnectionに追加した。");
            
            // v4l2loopbackデバイスからフレームを取得して送信する処理
            // ダミーフレームを送信（テスト用）
            const sendDummyFrame = () => {
                // 接続が失敗または終了している場合は処理を中止
                if (global.shouldStopFrameSending) {
                    console.log("接続状態により、フレーム送信を中止します。");
                    return;
                }
                
                cam.capture((success) => {
                    if (success) {
                        try {
                            const rawFrame = cam.frameRaw();

                            videoSource.onFrame({
                                width: config.width,
                                height: config.height,
                                data: rawFrame,
                            });

                            console.log("フレームを送信しました。");
                            // 接続状態を再確認してから次のフレーム送信をスケジュール
                            if (!global.shouldStopFrameSending) {
                                setTimeout(sendDummyFrame, 33); // 約30fps
                            }
                        } catch (err) {
                            console.error("フレーム処理エラー:", err);
                            if (!global.shouldStopFrameSending) {
                                setTimeout(sendDummyFrame, 100);
                            }
                        }
                    } else {
                        console.error("フレームキャプチャに失敗しました。");
                        if (!global.shouldStopFrameSending) {
                            setTimeout(sendDummyFrame, 100);
                        }
                    }
                });
            };
            
            // フレーム送信開始
            sendDummyFrame();
            
        } catch (mediaError) {
            console.error("映像トラック作成に失敗しました:", mediaError);
        }

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

        // ピア接続の状態変化を監視するイベントリスナーを追加
        peer_connection.onconnectionstatechange = (event) => {
            console.log(`接続状態が変化しました: ${peer_connection.connectionState}`);
            // 接続が失敗または切断された場合、フレーム送信を停止するフラグを設定
            if (peer_connection.connectionState === 'failed' || 
                peer_connection.connectionState === 'disconnected' || 
                peer_connection.connectionState === 'closed') {
                global.shouldStopFrameSending = true;
                console.log("接続が失敗または終了したため、フレーム送信を停止します。");
            }
        };
        
        peer_connection.oniceconnectionstatechange = (event) => {
            console.log(`ICE接続状態が変化しました: ${peer_connection.iceConnectionState}`);
            // ICE接続が失敗または切断された場合、フレーム送信を停止
            if (peer_connection.iceConnectionState === 'failed' || 
                peer_connection.iceConnectionState === 'disconnected' || 
                peer_connection.iceConnectionState === 'closed') {
                global.shouldStopFrameSending = true;
                console.log("ICE接続が失敗または終了したため、フレーム送信を停止します。");
            }
        };
        
        peer_connection.onsignalingstatechange = (event) => {
            console.log(`シグナリング状態が変化しました: ${peer_connection.signalingState}`);
        };
        
        peer_connection.onicegatheringstatechange = (event) => {
            console.log(`ICE収集状態が変化しました: ${peer_connection.iceGatheringState}`);
        };

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
                console.log(`ICE候補の詳細: ${JSON.stringify({
                    candidate: event.candidate.candidate,
                    sdpMid: event.candidate.sdpMid,
                    sdpMLineIndex: event.candidate.sdpMLineIndex
                })}`);
            } else {
                console.log("ICE候補の収集が完了しました。");
            }

        }


    } catch (error) {
        console.error("WebRTC処理エラー:", error);
    }
}

// 管理者用のWebRTC処理
async function receiveAdminOfferAndSendAnswer(data) {
    try {
        // シグナリングサーバーからOfferを受けて、SDPの形式に直す
        const offerSdp = new RTCSessionDescription({
            sdp: data.sdp.sdp,
            type: "offer"
        });

        // 管理者用PeerConnectionを作成する
        admin_peer_connection = new RTCPeerConnection();
        console.log("管理者用PeerConnectionを作成した。");

        // RTCVideoSourceを使用して映像トラックを作成
        try {
            // 通常のピアコネクションと同じビデオソースを共有する
            const videoSource = new RTCVideoSource();
            console.log("管理者用動画ソースを作成した。");
            
            const cam = new v4l2camera.Camera("/dev/video0");
            const config = cam.configGet();
            cam.start();
            
            const videoTrack = videoSource.createTrack();
            console.log("管理者用動画トラックを作成した。");
            
            // トラックをPeerConnectionに追加
            const stream = new wrtc.MediaStream();
            stream.addTrack(videoTrack);
            admin_peer_connection.addTrack(videoTrack, stream);
            console.log("管理者用動画トラックをPeerConnectionに追加した。");
            
            // フレーム送信処理（通常のピアコネクションと同様）
            const sendAdminDummyFrame = () => {
                // 管理者用の接続が終了している場合は処理を中止
                if (admin_peer_connection.connectionState === 'failed' || 
                    admin_peer_connection.connectionState === 'disconnected' || 
                    admin_peer_connection.connectionState === 'closed') {
                    console.log("管理者接続状態により、フレーム送信を中止します。");
                    return;
                }
                
                cam.capture((success) => {
                    if (success) {
                        try {
                            const rawFrame = cam.frameRaw();

                            videoSource.onFrame({
                                width: config.width,
                                height: config.height,
                                data: rawFrame,
                            });

                            console.log("管理者用フレームを送信しました。");
                            // 接続状態を再確認してから次のフレーム送信をスケジュール
                            if (!(admin_peer_connection.connectionState === 'failed' || 
                                admin_peer_connection.connectionState === 'disconnected' || 
                                admin_peer_connection.connectionState === 'closed')) {
                                setTimeout(sendAdminDummyFrame, 33); // 約30fps
                            }
                        } catch (err) {
                            console.error("管理者フレーム処理エラー:", err);
                            if (!(admin_peer_connection.connectionState === 'failed' || 
                                admin_peer_connection.connectionState === 'disconnected' || 
                                admin_peer_connection.connectionState === 'closed')) {
                                setTimeout(sendAdminDummyFrame, 100);
                            }
                        }
                    } else {
                        console.error("管理者フレームキャプチャに失敗しました。");
                        if (!(admin_peer_connection.connectionState === 'failed' || 
                            admin_peer_connection.connectionState === 'disconnected' || 
                            admin_peer_connection.connectionState === 'closed')) {
                            setTimeout(sendAdminDummyFrame, 100);
                        }
                    }
                });
            };
            
            // 管理者用フレーム送信開始
            sendAdminDummyFrame();
            
        } catch (mediaError) {
            console.error("管理者用映像トラック作成に失敗しました:", mediaError);
        }

        // 管理者用データチャンネルの開設
        admin_peer_connection.ondatachannel = (event) => {
            const channel = event.channel;
            console.log("管理者用データチャンネルを開設した。");
            
            channel.onmessage = async (event) => {
                try {
                    const data = JSON.parse(event.data);
                    console.log("管理者からのメッセージを受信:", data);
                    
                    // 管理者専用のコマンド処理を追加
                    if (data.type === "admin_command") {
                        console.log("管理者コマンドを実行:", data.command);
                        // 管理者専用コマンドの処理をここに追加
                        // 例: 設定変更、システム制御など
                    }
                    
                    // 必要に応じて他の管理者専用処理を追加
                    
                } catch (error) {
                    console.error("管理者データチャネルメッセージ処理エラー:", error);
                }
            };
            
            channel.onclose = () => {
                console.log("管理者データチャンネルが閉じられました");
            };
            
            channel.onerror = (error) => {
                console.error("管理者データチャンネルエラー:", error);
            };
        };

        // 受け取ったOfferをリモートSDPとしてRTCPeerConnectionに追加
        await admin_peer_connection.setRemoteDescription(offerSdp);
        console.log("管理者用リモートSDPを設定した。");

        // 接続状態監視
        admin_peer_connection.onconnectionstatechange = (event) => {
            console.log(`管理者接続状態が変化しました: ${admin_peer_connection.connectionState}`);
        };
        
        admin_peer_connection.oniceconnectionstatechange = (event) => {
            console.log(`管理者ICE接続状態が変化しました: ${admin_peer_connection.iceConnectionState}`);
        };
        
        admin_peer_connection.onsignalingstatechange = (event) => {
            console.log(`管理者シグナリング状態が変化しました: ${admin_peer_connection.signalingState}`);
        };
        
        admin_peer_connection.onicegatheringstatechange = (event) => {
            console.log(`管理者ICE収集状態が変化しました: ${admin_peer_connection.iceGatheringState}`);
        };

        // 管理者用Answerを作成してローカルSDPとして設定
        const answerSdp = await admin_peer_connection.createAnswer();
        console.log("管理者用Answerを作成した。");
        await admin_peer_connection.setLocalDescription(answerSdp);
        console.log("管理者用Answerを設定した。");

        // 管理者用Answerを送信
        sc.send(JSON.stringify({
            "sdp": {
                "sdp": admin_peer_connection.localDescription.sdp,
                "type": admin_peer_connection.localDescription.type
            },
            "remote": "admin_user_id",
            "sender": local_id
        }));
        console.log("管理者用Answerを送り返した。");

        // 管理者用ICE候補の処理
        admin_peer_connection.onicecandidate = (event) => {
            if (event.candidate) {
                sc.send(JSON.stringify({
                    "ice": {
                        "candidate": event.candidate.candidate,
                        "sdpMid": event.candidate.sdpMid,
                        "sdpMLineIndex": event.candidate.sdpMLineIndex
                    },
                    "remote": "admin_user_id",
                    "sender": local_id
                }));
                console.log("管理者用ICE候補を送る。");
            } else {
                console.log("管理者用ICE候補の収集が完了しました。");
            }
        }

    } catch (error) {
        console.error("管理者用WebRTC処理エラー:", error);
    }
}

// 管理者用ICE候補を受け取った時の処理
async function receiveAdminIceCandidate(iceData) {
    try {
        if (admin_peer_connection) {
            const iceCandidate = new RTCIceCandidate({
                candidate: iceData.candidate,
                sdpMid: iceData.sdpMid,
                sdpMLineIndex: iceData.sdpMLineIndex
            });
            await admin_peer_connection.addIceCandidate(iceCandidate);
            console.log("管理者用ICE候補を追加した。");
        } else {
            console.log("管理者用PeerConnectionが存在しません。");
        }
    } catch (error) {
        console.error("管理者用ICE候補追加エラー:", error);
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



async function main() {
    console.log('Node.jsアプリケーションの開始');
    await startServerConnection();
}

main().catch(err => {
    console.error('エラーが発生しました;', err);
});

