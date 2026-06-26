import 'dart:io';
import 'dart:convert';
import 'package:http/http.dart' as http;

Future<void> main() async {
  final urlsToTest = [
    'https://expertai.co.uk/softwares/general_upload/uploads.php',
    'https://www.expertai.co.uk/softwares/general_upload/uploads.php',
    'https://expertai.co.uk/softwares/general_upload/masjidazan/uploads.php',
    'http://www.expertai.co.uk/softwares/general_upload/uploads.php',
  ];
  final apiKey = r'EverY0NeKnoW$1T';

  final file = File('test_image.jpg');
  await file.writeAsBytes([0xFF, 0xD8, 0xFF, 0xE0, 0x00, 0x10, 0x4A, 0x46, 0x49, 0x46, 0x00, 0x01, 0x01, 0x01, 0x00, 0x48, 0x00, 0x48, 0x00, 0x00, 0xFF, 0xDB, 0x00, 0x43, 0x00, 0xFF, 0xD9]);

  for (final uploadUrl in urlsToTest) {
    try {
      print('\n--- Testing $uploadUrl ---');
      final request = http.MultipartRequest('POST', Uri.parse(uploadUrl));
      request.headers['Authorization'] = 'Bearer $apiKey';
      request.files.add(await http.MultipartFile.fromPath('file', file.path));

      final streamedResponse = await request.send();
      final response = await http.Response.fromStream(streamedResponse);

      print('Status: ${response.statusCode}');
      print('Body: ${response.body.length > 100 ? response.body.substring(0, 100) + '...' : response.body}');
    } catch (e) {
      print('Exception: $e');
    }
  }

  if (file.existsSync()) file.deleteSync();
}
