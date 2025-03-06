import 'package:flutter/material.dart';
import 'package:web_socket_channel/web_socket_channel.dart';
import 'dart:convert';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:amplify_flutter/amplify_flutter.dart';
import 'package:http/http.dart' as http;
import 'calculator.dart';

class OnboardingPage extends StatefulWidget {
  const OnboardingPage({super.key});

  @override
  State<OnboardingPage> createState() => _OnboardingPageState();
}

class _OnboardingPageState extends State<OnboardingPage> {
  late WebSocketChannel channel;

  //４けたの数字入力用のTextEditingContorollerを用意
  final TextEditingController _pinController = TextEditingController();

  @override
  void initState() {
    super.initState();
    _connectWebSocket();
  }

  Future<void> checkAndNavigate() async {
    SharedPreferences prefs = await SharedPreferences.getInstance();
    bool? useCalculatorPage = prefs.getBool('useCalculatorPage');
    String? pin = prefs.getString('usePin');
    // 両方が保存されている場合に遷移する
    if (useCalculatorPage == true && pin != null && pin.isNotEmpty) {
      if (!mounted) return;
      // ここではCalculatorPageへ遷移しています（CalculatorPageをインポートする必要があります）
      Navigator.pushReplacement(
        context,
        MaterialPageRoute(builder: (context) => CalculatorPage()),
      );
    }
  }

  //cognitoから、登録メールアドレスを取得する
  Future<void> saveUserEmail() async {
    List<AuthUserAttribute> attributes = await Amplify.Auth.fetchUserAttributes();
    for (var attribute in attributes){
      if (attribute.userAttributeKey.toString() == 'email'){
        final email = attribute.value;
        await getDeivceIdFromDB(email);
      }
    }
  }

  //メールアドレスで、デバイスIDとユーザーIDを取得する。
  Future<void> getDeivceIdFromDB(String email) async {
    final url = 'https://ayo3ucimnkbexrwxiersew7ena0mmygk.lambda-url.ap-northeast-1.on.aws/';
    final headers = {'Content-Type': 'application/json'};
    final body = jsonEncode({'email': email});

    try {
      final response = await http.post(
        Uri.parse(url),
        headers: headers,
        body: body
      );

      if (response.statusCode == 200) {
        print('レスポンス: ${response.body}');
        final jsonResponse = jsonDecode(response.body);
        final deviceId = jsonResponse['deviceId'];
        final userId = jsonResponse['userId'];

        SharedPreferences prefs = await SharedPreferences.getInstance();
        await prefs.setString('deviceId', deviceId.toString());
        await prefs.setString('userId', userId.toString());
        print('ID保存しました');
        print(userId);
        print(deviceId);
      } else {
        print('サーバーエラー:${response.body}');
        showMaintenanceDialog();
        throw Exception('DBからのデバイスID取得に失敗しました');
      }
    } catch (e){
      print(e);
      showMaintenanceDialog();
      throw Exception('DBからのデバイスID取得に失敗しました。');
    }
  }

  //デバイスIDが準備されてない時、メンテログを表示
  void showMaintenanceDialog(){
    showDialog(
      context: context, 
      builder: (BuildContext context) {
        return AlertDialog(
          title: const Text("大変申し訳ございません"),
          content: const Text('現在、運営が準備中です。運営から連絡があるまで、少々お待ちください。連絡がありましたら、再度このアプリを起動してください。'),
          actions: [
            TextButton(onPressed: (){
              Navigator.of(context).pop();
            }, child: const Text('OK'))
          ],
        );
      }
    );
  }
  
  //waydroidの画面サイズをデバイスサイズに合わせる
  Future<void> _connectWebSocket() async {
    try {
      await saveUserEmail();
      // WebSocketサーバーに接続
      channel = WebSocketChannel.connect(
        Uri.parse('wss://signaling.android-vpn.com:3001/'),
      );
      print('接続しました');

      //SharedPreferencesからuserIdとdeviceIdを取得する
      SharedPreferences prefs = await SharedPreferences.getInstance();
      String? userId = prefs.getString('userId');
      String? deviceId = prefs.getString('deviceId');
      
      channel.stream.listen(
        (message) async {
          print('サーバーからのメッセージ$message');
          final data = jsonDecode(message);
          if (data['type'] == 'resize_success'){
            //サイズが変更できたら、フラグを保存して、次回以降、電卓に遷移させる。
            SharedPreferences prefs = await SharedPreferences.getInstance();
            await prefs.setBool('useCalculatorPage', true);
            await channel.sink.close();
            print("kokomadekita");
            await checkAndNavigate(); // PIN保存後に条件を満たしていれば画面遷移
          }
        }
      );
      // スクリーンサイズを取得して送信
      WidgetsBinding.instance.addPostFrameCallback((_) {
        final size = MediaQuery.of(context).size;
        final screenData = {
          'width': size.width,
          'height': size.height,
        };
        print(screenData);
        //　最初に送信先のIDを渡す。
        channel.sink.add(jsonEncode({'open': {'local': userId, 'remote': deviceId}}));
        // JSONとしてデータを送信
        channel.sink.add(jsonEncode({'screen_size': screenData, 'remote': deviceId}));
      });
    } catch (e) {
      print('WebSocket接続エラー: $e');
    }
  }

  //入力されたPINをShared Preferencesに保存する
  Future<void> _savePin() async {
    if (_pinController.text.length != 4){
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('4桁の数字を入力してください')),
      );
      return;
    }
    SharedPreferences prefs = await SharedPreferences.getInstance();
    await prefs.setString('usePin', _pinController.text);
    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(content: Text('PINが保存されました。'))
    );
    await checkAndNavigate(); // PIN保存後に条件を満たしていれば画面遷移
  }

  @override
  void dispose() {
    _pinController.dispose();
    channel.sink.close();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('オンボーディング'),
      ),
      body: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          // ユーザーに4桁の数字を入力してもらうTextField
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 16.0),
            child: TextField(
              controller: _pinController,
              keyboardType: TextInputType.number,
              maxLength: 4,
              decoration: const InputDecoration(
                border: OutlineInputBorder(),
                labelText: '4桁の数字',
              ),
            ),
          ),
          const SizedBox(height: 16),
          // 入力値を保存するボタン
          ElevatedButton(
            onPressed: _savePin,
            child: const Text('保存'),
          ),
          const SizedBox(height: 32),
        ],
      ),
    );
  }
}