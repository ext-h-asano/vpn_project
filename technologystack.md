## シーケンス図
sequenceDiagram
    participant App as Flutter App (Mobile)
    participant Cognito as AWS Cognito
    participant Lambda as Lambda Function & DynamoDB
    participant Signal as Signaling Server
    participant Ubuntu as Ubuntu Server with Waydroid
    
    %% 認証フェーズ
    App->>Cognito: 1. ユーザー認証要求
    Cognito-->>App: 2. 認証成功
    App->>Lambda: 3. デバイスID要求
    Lambda-->>App: 4. デバイスID返却
    
    %% 隠し機能起動フェーズ
    Note over App: 5. 計算機アプリとして動作
    Note over App: 6. 特定の操作シーケンス実行
    Note over App: 7. 隠し機能起動
    
    %% Ubuntu側の初期接続
    Ubuntu->>Signal: 8. WebSocket接続要求
    Ubuntu->>Signal: 9. デバイスID送信 {"open": {"local": local_id, "remote": remote_id}}
    
    %% Flutterアプリの接続
    App->>Signal: 10. WebSocket接続要求
    
    %% 初期化コマンド
    App->>Signal: 11. 初期化コマンド送信 {"init": true}
    Signal->>Ubuntu: 12. 初期化コマンド転送
    
    Note over Ubuntu: 13. v4l2loopback再設定
    Note over Ubuntu: 14. Waydroid session stop
    Note over Ubuntu: 15. Waydroid show-full-ui
    Note over Ubuntu: 16. ADB接続確立
    Note over Ubuntu: 17. scrcpy起動 (--v4l2-sink=/dev/video0)
    
    Ubuntu-->>Signal: 18. 初期化成功通知 {"status": "success"}
    Signal-->>App: 19. 初期化成功通知転送
    
    %% 画面サイズ設定
    App->>Signal: 20. 画面サイズ設定要求 {"screen_size": {"width": X, "height": Y}}
    Signal->>Ubuntu: 21. 画面サイズ設定要求転送
    
    Note over Ubuntu: 22. Waydroid session stop
    Note over Ubuntu: 23. Waydroid session start
    Note over Ubuntu: 24. ADB接続再確立
    Note over Ubuntu: 25. 画面サイズ設定 (adb shell wm size)
    
    Ubuntu-->>Signal: 26. サイズ変更成功通知 {"type": "resize_success"}
    Signal-->>App: 27. サイズ変更成功通知転送
    
    %% WebRTC接続確立
    App->>Signal: 28. WebRTC接続オファー {"sdp": {...}}
    Signal->>Ubuntu: 29. オファー転送
    
    Note over Ubuntu: 30. RTCPeerConnection作成
    Note over Ubuntu: 31. MediaPlayer設定 (/dev/video0)
    Note over Ubuntu: 32. ビデオトラック追加
    Note over Ubuntu: 33. データチャネルハンドラ設定
    
    Ubuntu-->>Signal: 34. WebRTC応答 {"sdp": {...}}
    Signal-->>App: 35. 応答転送
    
    App->>Signal: 36. ICE候補送信
    Signal->>Ubuntu: 37. ICE候補転送
    Ubuntu-->>Signal: 38. ICE候補送信
    Signal-->>App: 39. ICE候補転送
    
    %% P2P接続確立
    App->>Ubuntu: 40. WebRTC P2P接続確立
    
    %% リモート操作フェーズ
    Ubuntu-->>App: 41. ビデオストリーミング (WebRTC)
    
    %% タッチイベント処理
    App->>Ubuntu: 42. タッチイベント送信 (swipe_start) {"type": "swipe_start", "startX": X, "startY": Y}
    Note over Ubuntu: 43. ADB motionevent DOWN実行
    
    App->>Ubuntu: 44. 移動イベント送信 (move_to) {"type": "move_to", "endX": X, "endY": Y}
    Note over Ubuntu: 45. 座標蓄積と一定間隔でADB motionevent MOVE実行
    
    App->>Ubuntu: 46. タッチイベント終了 (swipe_end) {"type": "swipe_end", "endX": X, "endY": Y}
    Note over Ubuntu: 47. ADB motionevent UP実行
    
    App->>Ubuntu: 48. タップイベント (touch) {"type": "touch", "x": X, "y": Y}
    Note over Ubuntu: 49. ADB tap実行
    
    %% 終了フェーズ
    App->>Ubuntu: 50. 接続終了
    Note over Ubuntu: 51. scrcpy終了
    Note over Ubuntu: 52. Waydroidセッション終了
    Note over Ubuntu: 53. リソース解放