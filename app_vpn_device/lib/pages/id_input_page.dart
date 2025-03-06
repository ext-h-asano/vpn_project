import 'package:flutter/material.dart';
import 'next_page.dart';

class IdInputPage extends StatefulWidget {
  @override
  _IdInputPageState createState() => _IdInputPageState();
}

class _IdInputPageState extends State<IdInputPage> {
  final TextEditingController _localIdController = TextEditingController();
  final TextEditingController _remoteIdController = TextEditingController();
  @override
  void dispose() {
    _localIdController.dispose();
    _remoteIdController.dispose();
    super.dispose();
  }

  void _saveIds() {
    final localId = _localIdController.text;
    final remoteId = _remoteIdController.text;

    //画面サイズもここで取得しておく
    // final Size screenSize = MediaQuery.of(context).size;
    // final int screenWidth = screenSize.width.ceil();
    // final int screenHeight = screenSize.height.ceil();

    // ここでlocalIdとremoteIdを保存する処理を追加
    print('Local ID: $localId');
    print('Remote ID: $remoteId');

    Navigator.pushReplacement(
      context,
      MaterialPageRoute(builder: (context) => NextPage()),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: Text('ID入力ページ'),
      ),
      body: Padding(
        padding: const EdgeInsets.all(16.0),
        child: Column(
          children: [
            TextField(
              controller: _localIdController,
              decoration: InputDecoration(labelText: 'Local ID'),
            ),
            TextField(
              controller: _remoteIdController,
              decoration: InputDecoration(labelText: 'Remote ID'),
            ),
            SizedBox(height: 20),
            ElevatedButton(
              onPressed: _saveIds,
              child: Text('接続ページに移動する'),
            ),
          ],
        ),
      ),
    );
  }
}