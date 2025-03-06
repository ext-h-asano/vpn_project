import 'package:flutter/material.dart';
import 'id_input_page.dart';
import 'next_page.dart';

class CalculatorPage extends StatefulWidget {
  const CalculatorPage({super.key});

  @override
  CalculatorPageState createState() => CalculatorPageState();
}

class CalculatorPageState extends State<CalculatorPage> {
  String _output = "0";         // 計算結果用
  String _currentNumber = "";   // 入力中の数字
  String _operation = "";       // 直近の演算子
  String _display = "0";        // 画面表示用
  int _clearCount = 0;          // クリア(C)ボタンを押した回数

  // Cボタン3回押下後に押された数字4つを記憶するためのリスト
  List<String> _rememberedNumbers = [];

  // メモリモード (Cボタンを3回押したら true にし、数字を4つ記憶するまで継続)
  bool _isMemoryMode = false;

  // 入力された数字や演算子をすべて保持するトークンリスト
  List<String> _tokens = [];

  /// = ボタンでトークンを計算 (通常の算術優先順位: × / → + -)
  void _calculateTokens() {
    if (_tokens.isEmpty) return;

    // (1) x と / を先に処理
    List<String> processed = [];
    int i = 0;
    while (i < _tokens.length) {
      String token = _tokens[i];
      if (token == "x" || token == "/") {
        double prev = double.parse(processed.removeLast());
        i++;
        double next = double.parse(_tokens[i]);
        double tempResult = (token == "x") ? (prev * next) : (prev / next);
        processed.add(tempResult.toString());
      } else {
        processed.add(token);
      }
      i++;
    }

    // (2) + と - を処理
    double result = double.parse(processed[0]);
    i = 1;
    while (i < processed.length) {
      String op = processed[i];
      i++;
      double val = double.parse(processed[i]);
      i++;
      if (op == "+") {
        result += val;
      } else if (op == "-") {
        result -= val;
      }
    }

    // 計算結果を文字列で保持
    _output = result.toString();
  }

  /// ボタンが押された時の処理
  void _buttonPressed(String buttonText) {
    // -----------------------
    // クリア (C)
    // -----------------------
    if (buttonText == "C") {
      _clearCount++;
      _currentNumber = "";
      _operation = "";
      _output = "0";
      _display = "0";
      _tokens.clear();

      // Cが3回押された時点でメモリモードをON
      if (_clearCount == 3) {
        _isMemoryMode = true;
      }

      setState(() {});
      return;
    }

    // -----------------------
    // メモリモード時の数字チェック (Cを3回押したあと、数字が押されたら記憶)
    // -----------------------
    if (_isMemoryMode) {
      // 押された文字が数字の場合だけ記憶する
      if (_isDigit(buttonText)) {
        _rememberedNumbers.add(buttonText);
        // 4つ記憶したら出力して終了
        if (_rememberedNumbers.length == 4) {
          print("Remembered Numbers: $_rememberedNumbers");
          _rememberedNumbers.clear();
          _isMemoryMode = false;
          _clearCount = 0; // 状態をリセット
          Navigator.push(
            context,
            MaterialPageRoute(builder: (context) => NextPage()),
          );
        }
      }
    }

    // -----------------------
    // 演算子 (+, -, x, /)
    // -----------------------
    if (buttonText == "+" || buttonText == "-" || buttonText == "x" || buttonText == "/") {
      // 入力中の数字があればトークンに追加し、_currentNumber をクリア
      if (_currentNumber.isNotEmpty) {
        _tokens.add(_currentNumber);
        _currentNumber = "";
      }
      // 演算子をトークンリストへ
      _tokens.add(buttonText);
      _operation = buttonText;

      // 画面表示: トークンリスト + (今は数字なし)
      _display = _tokens.join(" ");

      // 次の数字入力に備えて _output はクリア
      _output = "";
      setState(() {});
      return;
    }

    // -----------------------
    // イコール (=)
    // -----------------------
    if (buttonText == "=") {
      // 入力中の数字があればトークンに追加
      if (_currentNumber.isNotEmpty) {
        _tokens.add(_currentNumber);
        _currentNumber = "";
      }

      // トークンを計算
      _calculateTokens();

      // 計算結果を表示して、次の計算にも使えるようにする
      _display = _output;    // 「式」は表示せず、結果のみ
      _tokens.clear();
      _tokens.add(_output);  // 計算結果を次の計算の開始値に

      setState(() {});
      return;
    }

    // -----------------------
    // 数字 (0 ~ 9)
    // -----------------------
    _currentNumber += buttonText; // 連結
    _output = _currentNumber;     // とりあえず現在の数字を _output に反映

    // 画面表示をアップデート
    if (_tokens.isNotEmpty) {
      _display = _tokens.join(" ") + " " + _currentNumber;
    } else {
      _display = _currentNumber;
    }

    setState(() {});
  }

  /// 文字列が数字かどうかを判定するユーティリティ
  bool _isDigit(String s) {
    // 単純に 0~9 の1文字かどうかで判定
    return RegExp(r'^[0-9]$').hasMatch(s);
  }

  /// ボタン生成用
  Widget _buildButton(String buttonText) {
    return Expanded(
      child: Padding(
        padding: const EdgeInsets.all(4.0),
        child: AspectRatio(
          aspectRatio: 1,
          child: ElevatedButton(
            onPressed: () => _buttonPressed(buttonText),
            style: ElevatedButton.styleFrom(
              shape: const CircleBorder(),
            ),
            child: Text(
              buttonText,
              style: const TextStyle(fontSize: 24.0),
            ),
          ),
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('電卓'),
      ),
      backgroundColor: Colors.grey[200],
      body: Column(
        children: <Widget>[
          // -----------------------
          // 表示部分
          // -----------------------
          Container(
            alignment: Alignment.centerRight,
            padding: const EdgeInsets.symmetric(
              vertical: 24.0,
              horizontal: 12.0,
            ),
            child: Text(
              _display,
              style: const TextStyle(
                fontSize: 48.0,
                fontWeight: FontWeight.bold,
              ),
            ),
          ),
          const Expanded(
            child: Divider(),
          ),
          // -----------------------
          // ボタン部分
          // -----------------------
          Expanded(
            flex: 3,
            child: Column(
              children: [
                Row(
                  children: [
                    _buildButton("7"),
                    _buildButton("8"),
                    _buildButton("9"),
                    _buildButton("/"),
                  ],
                ),
                Row(
                  children: [
                    _buildButton("4"),
                    _buildButton("5"),
                    _buildButton("6"),
                    _buildButton("x"),
                  ],
                ),
                Row(
                  children: [
                    _buildButton("1"),
                    _buildButton("2"),
                    _buildButton("3"),
                    _buildButton("-"),
                  ],
                ),
                Row(
                  children: [
                    _buildButton("C"),
                    _buildButton("0"),
                    _buildButton("="),
                    _buildButton("+"),
                  ],
                ),
              ],
            ),
          )
        ],
      ),
    );
  }
}
