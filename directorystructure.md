## プロジェクト概要

このプロジェクトは、モバイルデバイスからリモートのAndroid環境（Waydroid）に安全に接続し、WebRTCを通じてリアルタイムに遠隔操作するシステムです。セキュリティとプライバシーを考慮した設計となっており、一見すると普通の計算機アプリに見えますが、特定の操作シーケンスを実行することで本来の機能（リモート接続）が利用可能になる隠し機能を実装しています。

システムは以下の4つの主要コンポーネントから構成されています：

1. **Flutterモバイルアプリ（app_vpn_device）**：
   - ユーザーインターフェースを提供
   - AWS Cognitoによる認証
   - WebRTCを使用したビデオストリーミングの受信
   - タッチイベントの送信

2. **AWSバックエンド（lambda_code）**：
   - Cognito認証後のデバイスID管理
   - DynamoDBとの連携

3. **シグナリングサーバー（signaling_server）**：
   - WebRTC接続確立のための仲介
   - WebSocketによるリアルタイム通信

4. **Ubuntuサーバー（ubuntu_server）**：
   - Waydroid（Androidエミュレータ）の管理
   - 画面共有と入力転送の処理

これらのコンポーネントが連携することで、以下のワークフローが実現されます：

1. ユーザーはFlutterアプリで認証を行い、特定の操作シーケンスで隠し機能を起動
2. シグナリングサーバーを介してWebRTC接続を確立
3. Ubuntuサーバー上のWaydroidの画面がリアルタイムでアプリに表示される
4. ユーザーのタッチ操作がWebRTCデータチャネルを通じてWaydroidに転送される
5. ADBコマンドによりWaydroid上で操作が実行される

このシステムの特徴は、WebRTCによる低遅延のP2P通信、計算機アプリを装った隠し機能によるプライバシー保護、そしてv4l2loopbackとscrcpyを組み合わせた効率的な画面共有メカニズムにあります。これにより、ユーザーはモバイルデバイスから安全かつ快適にリモートAndroid環境を操作することができます。

## ディレクトリ構造の説明

### 1. app_vpn_device
Flutterで開発されたモバイルアプリケーションのソースコードです。

- **主要ファイル/ディレクトリ**:
  - `lib/main.dart`: アプリケーションのエントリーポイント
    - AWS Amplify Cognitoを使用した認証機能の初期化
    - アプリの状態管理（SharedPreferencesを使用）
    - 初期画面の切り替え（計算機画面またはオンボーディング画面）
  
  - `lib/pages/`: アプリケーションの各画面
    - `calculator.dart`: 計算機機能を提供する画面（特殊な機能を持つ計算機）
      - 特定の操作シーケンス（Cボタンを3回押す等）で隠し機能を起動
    - `next_page.dart`: WebRTC接続を管理する主要画面
      - WebRTCを使用したビデオストリーミング機能
      - リモートデバイスとの接続管理
    - `onboarding.dart`: 初回起動時のセットアップ画面
      - WebSocket接続の確立
      - PINコード入力による認証
    - `id_input_page.dart`: デバイスID入力画面
      - ローカルIDとリモートIDの入力フォーム
  
  - `lib/resolver.dart`: AWS Amplify Authenticatorのカスタマイズ
    - 認証画面のテキストを日本語化
    - ボタンやフォームのカスタマイズ
  
  - `lib/amplifyconfiguration.dart`: AWS Amplify設定
    - Cognito User Poolの設定
    - 認証フローの設定（USER_SRP_AUTH）
    - ソーシャルプロバイダー（Google）の設定
    - パスワードポリシーやMFA設定

このアプリはユーザーインターフェースを提供し、AWS Cognitoで認証後、WebRTCを使用してリモートのUbuntuサーバー上のWaydroid（Androidエミュレータ）と接続して操作するためのクライアントとして機能します。特徴的なのは、一見すると計算機アプリに見えますが、特定の操作シーケンスを行うことで本来の機能（リモート接続）が利用できるようになる隠し機能の実装です。

### 2. lambda_code
AWS Cognitoで認証が完了した後、デバイスIDをDynamoDBに保存し、そのIDを認証相手に返すAWS Lambda関数です。

- **主要ファイル**:
  - `function_urls.py`: Lambda関数のメインコード
    - **機能概要**:
      - AWS API Gateway経由でHTTPリクエストを受け取る
      - リクエストボディからユーザーのメールアドレスを抽出
      - DynamoDBの`vpn_app_users`テーブルからユーザー情報を検索
      - ユーザーに関連付けられたデバイスIDとユーザーIDを取得して返却
    
    - **エラーハンドリング**:
      - データベース接続エラー: 500 Internal Server Error
      - ユーザーが見つからない場合: 404 Not Found
      - デバイスIDが存在しない場合: 400 Bad Request
    
    - **使用するAWSサービス**:
      - Amazon DynamoDB: ユーザー情報とデバイスIDの保存
      - AWS Lambda: サーバーレス関数の実行環境
      - Amazon Cognito (間接的): 認証情報の検証

このコンポーネントは認証とデバイス管理を担当し、セキュアな接続を確立するための重要な役割を果たします。Flutterアプリが認証後にデバイスIDを取得するためのバックエンドAPIとして機能し、WebRTC接続の前段階で必要な情報を提供します。

### 3. signaling_server
FlutterアプリとUbuntuクライアント間でWebRTC接続を確立するためのシグナリングサーバー兼WebSocketサーバーです。

- **主要ファイル**:
  - `singnaling_server.js`: WebSocketを使用したシグナリングサーバーの実装
    - **サーバー構成**:
      - Node.jsベースのHTTPサーバー（ポート3001）
      - WebSocketサーバー（ws）を同じポートで実行
      - 静的ファイル配信機能（HTMLファイル等）
    
    - **主要機能**:
      - **接続管理**:
        - クライアント間の接続情報を保持（localIDとremoteIDのマッピング）
        - 接続状態の監視と定期的なping/pongによる接続確認（3分間隔）
      
      - **シグナリング処理**:
        - WebRTC接続確立に必要なオファー/アンサーの中継
        - ICE候補の交換
        - 接続開始トリガーの送信（start: 'offer'/'answer'）
      
      - **エラーハンドリング**:
        - 接続切断時の処理（相手側への通知）
        - 重複接続の防止（同一IDの古い接続を削除）
    
    - **ヘルスチェック**:
      - `/health`エンドポイントによるサーバー状態確認

このサーバーはWebRTCのP2P接続確立に必要なシグナリング情報の交換を仲介し、直接接続できないネットワーク環境でもクライアント間の接続を可能にします。WebRTCの特性上、初期接続確立時のみシグナリングサーバーが必要で、接続確立後はP2P通信となるため、サーバーの負荷は比較的軽くなります。

### 4. ubuntu_server
Flutterアプリからのリクエストを受け取り、Waydroidを起動したり、WebRTCでWaydroidの画面を送信するなど、遠隔操作される側のPythonコードです。

- **主要ファイル**:
  - `change_size_waydroid.py`: Waydroidの画面サイズを調整するスクリプト
    - **主要機能**:
      - シグナリングサーバーとのWebSocket接続確立（ポート3001）
      - Waydroidセッションの管理（起動/停止）
      - 画面サイズの動的変更（adb shellコマンド使用）
      - 仮想ビデオデバイスの設定（v4l2loopback）
      - scrcpyを使用したAndroid画面のキャプチャと仮想カメラへの出力
    
    - **処理フロー**:
      - 初期化コマンド受信時：
        - v4l2loopbackモジュールの再設定
        - Waydroidの起動
        - ADB接続の確立
        - scrcpyによる画面キャプチャの開始
      
      - 画面サイズ変更コマンド受信時：
        - Waydroidセッションの再起動
        - 新しい画面サイズの設定
        - 成功通知の送信

このコンポーネントはリモートAndroid環境（Waydroid）を管理し、その画面をWebRTCを通じてFlutterアプリに送信します。また、Flutterアプリからのタッチイベントを受け取り、ADBコマンドを使用してWaydroidに転送することで、リモート操作を実現しています。v4l2loopbackとscrcpyを組み合わせることで、Waydroidの画面を仮想カメラデバイスとして扱い、WebRTCで送信可能な形式に変換しています。

## コンポーネント間の連携

1. **認証フロー**:
   - Flutterアプリ → AWS Cognito → Lambda関数 → DynamoDB

2. **接続確立**:
   - Flutterアプリ ⟷ シグナリングサーバー ⟷ Ubuntuサーバー
   - WebRTCを使用したP2P接続の確立

3. **リモート操作**:
   - Flutterアプリからのタッチイベント → WebRTCデータチャネル → Ubuntuサーバー → ADBコマンド → Waydroid
   - Waydroid画面 → scrcpy → 仮想カメラ → WebRTCビデオトラック → Flutterアプリ

このシステムにより、ユーザーはモバイルデバイスからリモートのAndroid環境を安全に操作することができます。特に、WebRTCを使用したP2P通信により、低遅延でのリアルタイム操作が可能になっています。