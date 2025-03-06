import 'package:flutter/material.dart';
import 'package:flutter_webrtc/flutter_webrtc.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:web_socket_channel/web_socket_channel.dart';
import 'dart:convert';
import 'dart:async';

class NextPage extends StatefulWidget {
  // final String localId;
  // final String remoteId;
  // final int screenWidth;
  // final int screenHeight;


  // NextPage({required this.localId, required this.remoteId, required this.screenWidth, required this.screenHeight});

  @override
  _NextPageState createState() => _NextPageState();
}

class _NextPageState extends State<NextPage> {
  String _deviceId = '';
  String _userId = '';
  bool _isConnected = false;
  bool _isConnecting = false;
  bool _connectionFailed = false;
  String _connectionStatus = '接続待機中...';
  RTCPeerConnection? _peerConnection;
  final _remoteRenderer = RTCVideoRenderer();
  MediaStream? _localAudioStream;
  WebSocketChannel? _channel;
  WebSocketChannel? _launchChannel;
  WebSocketChannel? _swipeChannel;
  List<RTCIceCandidate> _iceCandidates = [];
  final List<Map<String, dynamic>> queue = [];
  RTCDataChannel? _dataChannel;

  @override
  void initState() {
    super.initState();
    _initializeConnection();
  }

  @override
  void dispose() {
    _remoteRenderer.dispose();
    _channel?.sink.close();
    _peerConnection?.dispose();
    _localAudioStream?.dispose();
    super.dispose();
  }

  void _initializeConnection() async {
    // await _startUpWaydroid();
    await _initRenderers();
    await _connectWebSocket();
    await _createPeerConnection();
    await _createLocalAudioStream();
    // await _setupDataChannel();
  }

  Future<void> _startUpWaydroid() async {
    SharedPreferences prefs = await SharedPreferences.getInstance();
    // String deviceId = prefs.getString('deviceId') ?? 'defaultDeviceId';
    // String userId = prefs.getString('userId') ?? 'defaultUserId';
    _deviceId = prefs.getString('deviceId') ?? 'defaultDeviceId';
    _userId = prefs.getString('userId') ?? 'defaultUserId';

    _launchChannel = WebSocketChannel.connect(
      Uri.parse('wss://signaling.android-vpn.com:3001/')
    );

    // Completerを作成して、successメッセージの受信を待機する
    final Completer<void> completer = Completer<void>();

    // WebSocketのストリームをlistenして、受信メッセージをチェックする
    final subscription = _launchChannel!.stream.listen((message) {
      print("受信メッセージ: $message");

      final Map<String, dynamic> data = jsonDecode(message);
      if (data['status'] == 'success') {
        // successメッセージを受信したらCompleterを完了する
        completer.complete();
      }
    });

    _launchChannel!.sink.add(jsonEncode({
      'open': {'local': _userId, 'remote': _deviceId}
    }));
    _launchChannel!.sink.add(jsonEncode({'init': 'init', 'remote': _deviceId}));
    print("initした");

    // successメッセージが来るまで非同期的に待機する
    await completer.future;
    await subscription.cancel();

    print("successメッセージを受信しました。処理を続行します。");
  }

  // Future<void> _startUpWaydroid() async {
  //   SharedPreferences prefs = await SharedPreferences.getInstance();
  //   String deviceId = prefs.getString('deviceId') ?? 'defaultDeviceId';
  //   String userId = prefs.getString('userId') ?? 'defaultUserId';
  //   _launchChannel = WebSocketChannel.connect(
  //     Uri.parse('wss://signaling.android-vpn.com:3001/')
  //   );
  //   _launchChannel!.sink.add(jsonEncode({
  //     'open': {'local': userId, 'remote': deviceId}
  //   }));
  //   _launchChannel!.sink.add(jsonEncode({'init': 'init', 'remote': deviceId}));
  //   print("initした");
  //   // await Future.delayed(const Duration(seconds: 10));
  //   // _handlingChannel!.sink.add(jsonEncode(
  //   //     {'type': 'screen_size', 'width': widget.screenWidth, 'height': widget.screenHeight, 'remote': widget.remoteId}));
  //   // print("adbした");
  //   // await Future.delayed(const Duration(seconds: 10));
  //   // _handlingChannel!.sink.add(jsonEncode({'type': 'restart', 'remote': widget.remoteId}));
  //   // print("restartした");
  //   // await Future.delayed(const Duration(seconds: 10));
  //   // _handlingChannel!.sink.add(jsonEncode({
  //   //   'type': 'start_browser',
  //   //   'width': widget.screenWidth,
  //   //   'height': widget.screenHeight,
  //   //   'remote': widget.remoteId
  //   // }));
  //   // await Future.delayed(const Duration(seconds: 20));
  // }

  Future<void> _initRenderers() async {
    await _remoteRenderer.initialize();
  }

  Future<void> _connectWebSocket() async {
    // SharedPreferences を使ってデバイス情報を取得
    SharedPreferences prefs = await SharedPreferences.getInstance();
    _deviceId = prefs.getString('deviceId') ?? 'defaultDeviceId';
    _userId = prefs.getString('userId') ?? 'defaultUserId';

    _channel = WebSocketChannel.connect(
        Uri.parse('wss://signaling.android-vpn.com:3001/'));
    print("signalingサーバーに接続ができた");
    print(_deviceId);
    print(_userId);
    _channel!.sink.add(jsonEncode({
      'open': {'local': _userId, 'remote': _deviceId}
    }));
    //ここで、waydroidを起動させておく
    _channel!.sink.add(jsonEncode({'init': 'init', 'remote': _deviceId}));
    // _handlingChannel = WebSocketChannel.connect(Uri.parse('wss://handling.android-vpn.com:3001/'));
    // _handlingChannel!.sink.add(jsonEncode({'open': {'local': 'bbbpython', 'remote': 'aaapython'}}));
    // _handlingChannel!.sink.add(jsonEncode({'type': 'screen_size', 'width': screenWidth, 'height': screenHeight}));
    await Future.delayed(const Duration(seconds: 1));
    _channel!.stream.listen((message) {
      print('メッセージ受け取ってんで: $message');
      _handleSignalingMessage(jsonDecode(message));
    });
  }

  Future<void> _createLocalAudioStream() async {
    try {
      //一旦音声の部分はコメントアウトしておく
      // _localAudioStream = await navigator.mediaDevices
      //     .getUserMedia({'audio': {
      //       // 'echoCancellation': false,
      //       // 'noiseSuppression': false,
      //       // 'autoGainControl': false, 
      //       // 'sampleRate': 48000,
      //       // 'channelCount': 1,
      //       // 'sampleSize': 16
      //     }, 'video': false});
      // _localAudioStream?.getTracks().forEach((track) {
      //   _peerConnection?.addTrack(track, _localAudioStream!);
      // });
      // print("ローカルオーディオストリームを作成し、ピア接続に追加しました");
      print("一旦ローカルにマイク音声の入力は中止");
    } catch (e) {
      print("ローカルオーディオストリームの作成中にエラーが発生しました: $e");
    }
  }

  Future<void> _createPeerConnection() async {
    Map<String, dynamic> configuration = {
      "iceServers": [
        {"url": "stun:stun.l.google.com:19302"},
      ]
    };

    final Map<String, dynamic> offerSdpConstraints = {
      "mandatory": {
        "OfferToReceiveAudio": true,
        "OfferToReceiveVideo": true,
      },
      "optional": [],
    };

    _peerConnection =
        await createPeerConnection(configuration, offerSdpConstraints);

    //データチャンネルをここで作成する
    final dataChannelConfig = RTCDataChannelInit();
    _dataChannel = await _peerConnection?.createDataChannel('signalig_data_channel', dataChannelConfig);


    _peerConnection?.onIceGatheringState = (RTCIceGatheringState state) async {

      //ICEの収集が終わるまで、早期returnをする
      if (state != RTCIceGatheringState.RTCIceGatheringStateComplete) {
        return;
      }
      
      //収集が終わったら、Offerを送信する。
      var localDescription = await _peerConnection?.getLocalDescription();
      print("Local SDP: ${localDescription?.sdp}");
      
      _sendSignalingMessage({
        "sdp": {"type": "offer", "sdp": localDescription!.sdp},
        "remote": _deviceId
      });
      print("ICEを収集して、それを、送信した。");
    };


//Iceの交換も一旦offerに含めるからコメントアウト
    // _peerConnection?.onIceCandidate = (RTCIceCandidate candidate) {
    //   if (candidate != null) {
    //     print('ICE候補を作成しました');
    //     _iceCandidates.add(candidate);
    //     print('あいしーいー: ${candidate.candidate}');
    //     _sendSignalingMessage({
    //       'ice': {
    //         'candidate': candidate.candidate,
    //         'sdpMid': candidate.sdpMid,
    //         'sdpMLineIndex': candidate.sdpMLineIndex
    //       },
    //       'remote': widget.remoteId
    //     });
    //   }
    // };

    // _peerConnection?.onConnectionState = (RTCPeerConnectionState state) {
    //   print('Connection state change: $state');
    //   setState(() {
    //     _isConnected =
    //         state == RTCPeerConnectionState.RTCPeerConnectionStateConnected;
    //     _isConnecting =
    //         state == RTCPeerConnectionState.RTCPeerConnectionStateConnecting;
    //   });
    // };

    _peerConnection?.onConnectionState = (RTCPeerConnectionState state) {
      print('Connection state change: $state');
      setState(() {
        switch (state) {
          case RTCPeerConnectionState.RTCPeerConnectionStateConnected:
            _isConnected = true;
            _isConnecting = false;
            _connectionFailed = false;
            _connectionStatus = '接続完了';
            break;
          case RTCPeerConnectionState.RTCPeerConnectionStateConnecting:
            _isConnecting = true;
            _connectionFailed = false;
            _connectionStatus = '接続中...';
            break;
          case RTCPeerConnectionState.RTCPeerConnectionStateFailed:
            _isConnected = false;
            _isConnecting = false;
            _connectionFailed = true;
            _connectionStatus = '接続に失敗しました';
            break;
          case RTCPeerConnectionState.RTCPeerConnectionStateDisconnected:
            _isConnected = false;
            _isConnecting = false;
            _connectionFailed = true;
            _connectionStatus = '接続が切断されました';
            break;
          default:
            _isConnected = false;
            _isConnecting = false;
            _connectionStatus = '接続待機中...';
        }
      });
    };

    _peerConnection?.onTrack = (RTCTrackEvent event) {
      print("Received track: ${event.track.kind}");
      if (event.track.kind == 'video') {
        print("めっちゃビデオやで！！！！！！");
        setState(() {
          _remoteRenderer.srcObject = event.streams[0];
        });
      } else if (event.track.kind == 'audio') {
        print('オーディオやから！！！！！！！！！！！！！！！！！！');
        event.streams[0].getAudioTracks().forEach((track){
          // track.enabled = false;
          track.enableSpeakerphone(false);
        });
        print('スピーカーに設定しました。');
      }
    };
  }

  void _createAndSendOffer() async {
    final int maxRetries = 3;
    final int delaySeconds = 3;
    int attempts = 0;
    while (attempts < maxRetries) {
      try {
        RTCSessionDescription? offer = await _peerConnection?.createOffer();
        if (offer != null) {
          await _peerConnection?.setLocalDescription(offer);
          // var localDescription = await _peerConnection?.getLocalDescription();
          // print('このオファーが設定されています:');
          // print(localDescription?.toMap());

//まだここではOfferを送らない！
          // _sendSignalingMessage({
          //   'sdp': {"type": "offer", "sdp": offer.sdp},
          //   'remote': widget.remoteId
          // });

          setState(() {
            _isConnecting = true;
          });
          print("オファーを作成し、送信しました");
          return;
        } else {
          print("オファーの作成に失敗しました");
          attempts++;
          if (attempts < maxRetries) {
            await Future.delayed(Duration(seconds: delaySeconds));
          }
        }
      } catch (e) {
        print("オファーの作成と送信中にエラーが発生しました: $e");
        attempts++;
        if (attempts < maxRetries) {
          await Future.delayed(Duration(seconds: delaySeconds));
        }
      }
    }

    print("最大リトライ回数に達しました。オファーの作成を中止します。");
  }

  void _handleSignalingMessage(Map<String, dynamic> message) async {
    print('もとのメッセージ: $message');
    if (message.containsKey('status')) {
      print('オファーやでえ');
      _createAndSendOffer();
    }

    if (message.containsKey('sdp')) {
      RTCSessionDescription remoteDescription = RTCSessionDescription(
        message['sdp']['sdp'],
        message['sdp']['type'],
      );
      print("Remote SDP received: ${message['sdp']}");
      await _peerConnection?.setRemoteDescription(remoteDescription);
      print('リモートデスクリプションを設定しました');
    }

    if (message.containsKey('ice')) {
      print('ICE候補を追加します');
      if (_peerConnection?.getRemoteDescription() != null) {
        try {
          await _peerConnection?.addCandidate(RTCIceCandidate(
            message['ice']['candidate'],
            message['ice']['sdpMid'],
            message['ice']['sdpMLineIndex'],
          ));
        } catch (error) {
          print("ICE候補の追加中にエラーが発生しました: $error");
        }
      } else {
        queue.add(message);
        return;
      }
    }

    if (queue.isNotEmpty && _peerConnection?.getRemoteDescription() != null) {
      _handleSignalingMessage(queue.removeAt(0));
    }
    // switch (message['type']) {
    //   case 'answer':
    //     print('Received answer SDP: ${message['sdp']}');
    //     final RTCSessionDescription description =
    //         RTCSessionDescription(message['sdp'], 'answer');
    //     await _peerConnection?.setRemoteDescription(description);
    //     print('Remote description set');
    //     break;
    //   case 'ice_candidate':
    //     print('Received ICE candidate: ${message['candidate']}');
    //     final candidate = RTCIceCandidate(
    //       message['candidate']['candidate'],
    //       message['candidate']['sdpMid'],
    //       message['candidate']['sdpMLineIndex'],
    //     );
    //     await _peerConnection?.addCandidate(candidate);
    //     print('ICE candidate added');
    //     break;
    //   default:
    //     print('Unknown signaling message type: ${message['type']}');
    // }
  }

  void _sendSignalingMessage(Map<String, dynamic> message) {
    print('このメッセージを送るよ: $message');
    _channel?.sink.add(jsonEncode(message));
  }


  void _handleTap(TapDownDetails details) {
    final RenderBox box = context.findRenderObject() as RenderBox;
    final Offset localPosition = box.globalToLocal(details.globalPosition);

    final Map<String, dynamic> touchEvent = {
      'type': 'touch',
      'x': localPosition.dx,
      'y': localPosition.dy,
      'remote': _deviceId
    };

    print('タッチイベント: $touchEvent');

    _sendSwipeEvent(touchEvent);
  }


  //スワイプイベントをリアルタイムにしてみるバージョン
  Offset? _swipeStart;

  // updateで取得した座標を格納する配列を用意する
  // List<Offset> _swipePositions = [];

  void _handleSwipeStart(DragStartDetails details) {
    final RenderBox box = context.findRenderObject() as RenderBox;
    _swipeStart = box.globalToLocal(details.globalPosition);
    final Map<String, dynamic> swipeStart = {
      'type': 'swipe_start',
      'startX': _swipeStart!.dx,
      'startY': _swipeStart!.dy
    };
    _sendSwipeEvent(swipeStart);
    // _swipePositions.add(_swipeStart!);
  }

  void _handleSwipeUpdate(DragUpdateDetails details) {
    print("キャッチ");
    final RenderBox box = context.findRenderObject() as RenderBox;
    final Offset currentPosition = box.globalToLocal(details.globalPosition);

    // updateで取得した座標を配列に代入
    // _swipePositions.add(currentPosition);

    // 配列に5つ代入する
    // if (_swipePositions.length >= 10){
    //   final Offset fifthPosition = _swipePositions[9];
    //   final Map<String, dynamic> moveTo = {
    //     'type': 'move_to',
    //     'startX': _swipeStart!.dx,
    //     'startY': _swipeStart!.dy,
    //     'endX': currentPosition.dx,
    //     'endY': currentPosition.dy,
    //     'remote': widget.remoteId
    //   };
    //   _sendSwipeEvent(moveTo);
    //   _swipeStart = fifthPosition;
    //   _swipePositions.clear();
    // }
    final Map<String, dynamic> moveTo = {
      'type': 'move_to',
      'endX': currentPosition.dx,
      'endY': currentPosition.dy,
    };
    _sendSwipeEvent(moveTo);
  }

  void _handleSwipeEnd(DragEndDetails details) {
      final RenderBox box = context.findRenderObject() as RenderBox;
      final Offset currentSwipeEnd = box.globalToLocal(details.globalPosition);
      // final Map<String, dynamic> swipeEnd = {
      //   'type': 'swipe_end',
      //   'startX': _swipePositions.last.dx,
      //   'startY': _swipePositions.last.dy,
      //   'endX': currentSwipeEnd.dx,
      //   'endY': currentSwipeEnd.dy,
      //   'remote': widget.remoteId
      // };

      final Map<String, dynamic> swipeEnd = {
        'type': 'swipe_end',
        'startX': _swipeStart!.dx,
        'startY': _swipeStart!.dy,
        'endX': currentSwipeEnd.dx,
        'endY': currentSwipeEnd.dy,
      };
      _sendSwipeEvent(swipeEnd);
      // _swipePositions.clear();
  }



  // void _sendTouchEvent(Map<String, dynamic> event) {
  //   _dataChannel?.send(RTCDataChannelMessage(jsonEncode(event)));
  //   if (_handlingChannel != null) {
  //     _handlingChannel?.sink.add(jsonEncode(event));
  //     print("送った");
  //     // _logTouchEvent(event);
  //   } else {
  //     print('Data channel is not open. Cannot send event.');
  //   }
  // }

  void _sendSwipeEvent(Map<String, dynamic> event) {
    _dataChannel?.send(RTCDataChannelMessage(jsonEncode(event)));
    print("送った");
  }


  @override
  Widget build(BuildContext context) {
    // 接続状態を判断するための変数
    bool shouldShowLoading = !_isConnected || _isConnecting;
    
    return Scaffold(
      body: Stack(
        children: [
          GestureDetector(
            onTapDown: _handleTap,
            onPanStart: _handleSwipeStart,
            onPanUpdate: _handleSwipeUpdate,
            onPanEnd: _handleSwipeEnd,
            child: RTCVideoView(
              _remoteRenderer,
              objectFit: RTCVideoViewObjectFit.RTCVideoViewObjectFitCover,
            ),
          ),
          if (shouldShowLoading || _connectionFailed)
            Container(
              color: Colors.black.withOpacity(0.7),
              child: Center(
                child: Column(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    if (!_connectionFailed)
                      CircularProgressIndicator(
                        valueColor: AlwaysStoppedAnimation<Color>(Colors.white),
                      ),
                    if (_connectionFailed)
                      Icon(
                        Icons.error_outline,
                        color: Colors.red,
                        size: 50,
                      ),
                    SizedBox(height: 20),
                    Text(
                      _connectionStatus,
                      style: TextStyle(color: Colors.white, fontSize: 18),
                    ),
                    if (_connectionFailed)
                      Padding(
                        padding: const EdgeInsets.only(top: 20),
                        child: ElevatedButton(
                          onPressed: () {
                            setState(() {
                              _connectionFailed = false;
                              _connectionStatus = '再接続中...';
                            });
                            _initializeConnection();
                          },
                          child: Text('再接続する'),
                        ),
                      ),
                  ],
                ),
              ),
            ),
        ],
      ),
    );
  }

  // @override
  // Widget build(BuildContext context) {

  //   return Scaffold(
  //     body: GestureDetector(
  //       onTapDown: _handleTap,
  //       onPanStart: _handleSwipeStart,
  //       onPanUpdate: _handleSwipeUpdate,
  //       onPanEnd: _handleSwipeEnd,
  //       child: RTCVideoView(
  //         _remoteRenderer,
  //         objectFit: RTCVideoViewObjectFit.RTCVideoViewObjectFitCover,
  //       ),
  //     ),
  //   );
  // }
}


  // void _logTouchEvent(Map<String, dynamic> event) {
  //   String eventType = event['type'];
  //   double x = event['x'];
  //   double y = event['y'];
  //   double screenWidth = event['screenWidth'];
  //   double screenHeight = event['screenHeight'];

  //   String logMessage = 'Sent $eventType event:';
  //   logMessage +=
  //       '\n  Relative coordinates: (${x.toStringAsFixed(4)}, ${y.toStringAsFixed(4)})';
  //   logMessage +=
  //       '\n  Absolute coordinates: (${(x * screenWidth).toStringAsFixed(2)}, ${(y * screenHeight).toStringAsFixed(2)})';
  //   logMessage +=
  //       '\n  Screen size: ${screenWidth.toStringAsFixed(2)} x ${screenHeight.toStringAsFixed(2)}';

  //   if (eventType == 'swipe') {
  //     double deltaX = event['deltaX'];
  //     double deltaY = event['deltaY'];
  //     logMessage +=
  //         '\n  Delta (relative): (${deltaX.toStringAsFixed(4)}, ${deltaY.toStringAsFixed(4)})';
  //     logMessage +=
  //         '\n  Delta (absolute): (${(deltaX * screenWidth).toStringAsFixed(2)}, ${(deltaY * screenHeight).toStringAsFixed(2)})';
  //   }

  //   print(logMessage);
  // }


  // Offset? _swipeStart;
  // Offset? _swipeEnd;

  // void _handleSwipeStart(DragStartDetails details) {
  //   final RenderBox box = context.findRenderObject() as RenderBox;
  //   _swipeStart = box.globalToLocal(details.globalPosition);
  // }

  // void _handleSwipeUpdate(DragUpdateDetails details) {
  //   final RenderBox box = context.findRenderObject() as RenderBox;
  //   _swipeEnd = box.globalToLocal(details.globalPosition);
  // }

  // void _handleSwipeEnd(DragEndDetails details) {
  //   if (_swipeStart != null && _swipeEnd != null) {
  //     // final RenderBox box = context.findRenderObject() as RenderBox;
  //     final double startX = _swipeStart!.dx;
  //     final double startY = _swipeStart!.dy;
  //     final double endX = _swipeEnd!.dx;
  //     final double endY = _swipeEnd!.dy;

  //     final Map<String, dynamic> swipeEvent = {
  //       'type': 'swipe',
  //       'startX': startX,
  //       'startY': startY,
  //       'endX': endX,
  //       'endY': endY,
  //       'remote': widget.remoteId
  //     };

  //     _sendTouchEvent(swipeEvent);
  //   }
  // }


  // Future<void> _setupDataChannel() async {
  //   _dataChannel = await _peerConnection?.createDataChannel(
  //       'events', RTCDataChannelInit());
  //   _dataChannel?.onMessage = (RTCDataChannelMessage message) {
  //     print('Received message from data channel: ${message.text}');
  //   };
  // }