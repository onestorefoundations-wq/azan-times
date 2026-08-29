import 'dart:io';
import 'dart:convert';
import 'package:http/http.dart' as http;

Future<void> main() async {
  final uploadUrl = 'https://expertai.co.uk/softwares/general_upload/masjidazan/uploads.php';
  // Dev-only probe script. Read the key from the environment rather than
  // committing it: PHP_API_KEY=... dart run tool/<script>.dart
  final apiKey = Platform.environment['PHP_API_KEY'];
  if (apiKey == null || apiKey.isEmpty) {
    print('Set PHP_API_KEY in the environment first.');
    exit(1);
  }

  final file = File('test_image.jpg');
  await file.writeAsBytes([0xFF, 0xD8, 0xFF, 0xE0, 0x00, 0x10, 0x4A, 0x46, 0x49, 0x46, 0x00, 0x01, 0x01, 0x01, 0x00, 0x48, 0x00, 0x48, 0x00, 0x00, 0xFF, 0xDB, 0x00, 0x43, 0x00, 0xFF, 0xD9]);

  try {
    final request = http.MultipartRequest('POST', Uri.parse(uploadUrl));
    request.headers['Authorization'] = 'Bearer $apiKey';
    request.files.add(await http.MultipartFile.fromPath('file', file.path));

    final streamedResponse = await request.send();
    final response = await http.Response.fromStream(streamedResponse);

    print('Status: ${response.statusCode}');
    if (response.statusCode == 200) {
      final data = jsonDecode(response.body);
      print('Returned URL: ${data['url']}');
    } else {
      print('Body: ${response.body}');
    }
  } catch (e) {
    print('Exception: $e');
  }

  if (file.existsSync()) file.deleteSync();
}
