const path = require('path');
const fs = require('fs');
const http = require('http');
const WebSocket = require('ws');

const sslPort = 3001;

// 接続リスト
let connections = [];

// WebSocket処理
const socketProc = function(ws, req) {
        ws._pingTimer = setInterval(function() {
                if (ws.readyState === WebSocket.OPEN) {
                        // 接続確認
                        ws.send(JSON.stringify({ping: 1}));
                }
        }, 180000);

        ws.on('message', function(message) {
                const json = JSON.parse(message);
                console.log(json)
                if (json.open) {
                        console.log('open: ' + ws._socket.remoteAddress + ': local=' + json.open.local + ', remote=' + json.open.remote);
                        // 同一IDが存在するときは古い方を削除
                        connections = connections.filter(data => !(data.local === json.open.local && data.remote === json.open.remote));
                        // 接続情報を保存
                        connections.push({local: json.open.local, remote: json.open.remote, ws: ws});
                        connections.some(data => {
                                if (data.local === json.open.remote && data.ws.readyState === WebSocket.OPEN) {
                                        // 両方が接続済の場合にstartを通知
                                        data.ws.send(JSON.stringify({start: 'answer'}));
                                        ws.send(JSON.stringify({start: 'offer'}));
                                        return true;
                                }
                        });
                        return;
                }
                if (json.pong) {
                        return;
                }
                if (json.ping) {
                        if (ws.readyState === WebSocket.OPEN) {
                                ws.send(JSON.stringify({pong: 1}));
                        }
                        return;
                }
                // 対向の接続を検索
                connections.some(data => {
                        if (data.local === json.remote && data.ws.readyState === WebSocket.OPEN) {
                                // シグナリングメッセージの転送
                                data.ws.send(JSON.stringify(json));
                                return true;
                        }
                });
        });

        ws.on('close', function () {
                closeConnection(ws);
                console.log('close: ' + ws._socket.remoteAddress);
        });

        ws.on('error', function(error) {
                closeConnection(ws);
                console.error('error: ' + ws._socket.remoteAddress + ': ' + error);
        });

        function closeConnection(conn) {
                connections = connections.filter(data => {
                        if (data.ws !== conn) {
                                return true;
                        }
                        connections.some(remoteData => {
                                if (remoteData.local === data.remote && remoteData.ws.readyState === WebSocket.OPEN) {
                                        // 対向に切断を通知
                                        remoteData.ws.send(JSON.stringify({close: 1}));
                                        return true;
                                }
                        });
                        data.ws = null;
                        return false;
                });
                if (conn._pingTimer) {
                        clearInterval(conn._pingTimer);
                        conn._pingTimer = null;
                }
        }
};

// 静的ファイル処理
const service = function(req, res) {
    const url = req.url.replace(/\?.+$/, '');  // クエリパラメータを取り除いたURLパス
    //helth checkようにパスを追加しておく
    // ヘルスチェック用パス
    if (url === '/health') {
        res.writeHead(200, {'Content-Type': 'text/plain'});
        res.end('OK');
        return; // ここで終了
    }

    // URLに応じて表示するファイルを切り替える
    let file;
    if (url === '/answer') {
        file = path.join(process.cwd(), 'index_answer.html');  // /answer の場合
    } else if (url === '/offer') {
        file = path.join(process.cwd(), 'index_offer.html');   // /offer の場合
    } else {
        file = path.join(process.cwd(), url);  // それ以外のURLの場合
    }

    fs.stat(file, (err, stat) => {
        if (err) {
            res.writeHead(404);
            res.end();
            return;
        }
        if (stat.isDirectory()) {
            service({url: url.replace(/\/$/, '') + '/index.html'}, res);  // ディレクトリの場合
        } else if (stat.isFile()) {
            const stream = fs.createReadStream(file);
            stream.pipe(res);  // ファイルの場合はそれをストリームとして返す
        } else {
            res.writeHead(404);
            res.end();
        }
    });
};

// HTTPSサーバの開始
const httpsServer = http.createServer(service);
httpsServer.listen(sslPort, '0.0.0.0');

// WebSocketの開始
const wss = new WebSocket.Server({server: httpsServer});
wss.on('connection', socketProc);
console.log('Server running.');