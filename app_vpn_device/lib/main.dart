// import 'package:flutter/material.dart';
// import 'pages/id_input_page.dart';
// import 'pages/calculator.dart';

// void main() {
//   runApp(MaterialApp(
//     // home: IdInputPage(),
//     home: CalculatorPage(),
//   ));
// }


import 'package:amplify_auth_cognito/amplify_auth_cognito.dart';
import 'package:amplify_authenticator/amplify_authenticator.dart';
import 'package:amplify_flutter/amplify_flutter.dart';
import 'package:flutter/material.dart';

import 'amplifyconfiguration.dart';
import 'resolver.dart';
import 'pages/calculator.dart';
import 'pages/onboarding.dart';
import 'package:shared_preferences/shared_preferences.dart';

void main() {
  runApp(const MyApp());
}

class MyApp extends StatefulWidget {
  const MyApp({Key? key}) : super(key: key);

  @override
  State<MyApp> createState() => _MyAppState();
}

class _MyAppState extends State<MyApp> {
  // フラグ：trueならCalculatorPageを起動時の画面にする
  bool _useCalculatorPage = false;
  // 読み込み中の状態を管理（非同期処理対策）
  bool _isLoading = true;
  @override
  void initState() {
    super.initState();
    _configureAmplify();
    _loadInitialPage();
  }

  void _configureAmplify() async {
    try {
      await Amplify.addPlugin(AmplifyAuthCognito());
      await Amplify.configure(amplifyconfig);
      print('Successfully configured');
    } on Exception catch (e) {
      print('Error configuring Amplify: $e');
    }
  }

  // SharedPreferences からフラグを読み込む関数
  void _loadInitialPage() async {
    SharedPreferences prefs = await SharedPreferences.getInstance();
    bool flag = prefs.getBool('useCalculatorPage') ?? false;
    setState(() {
      _useCalculatorPage = flag;
      _isLoading = false;
    });
    print('フラグが${_useCalculatorPage}');
  }


  @override
  Widget build(BuildContext context) {
    // 読み込み中は空のコンテナやスプラッシュ画面を返す
    if (_isLoading) {
      return const MaterialApp(
        home: Scaffold(body: Center(child: CircularProgressIndicator())),
      );
    }
    return Authenticator(
      stringResolver: stringResolver,
      child: MaterialApp(
        builder: Authenticator.builder(),
        // フラグに応じて初期画面を切り替える
        home: _useCalculatorPage ? CalculatorPage() : const OnboardingPage(),
      ),
    );
  }
}