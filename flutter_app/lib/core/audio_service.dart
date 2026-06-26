/// audio_service.dart
/// Wraps audioplayers for Adhan/Iqamah alert sounds.

import 'package:audioplayers/audioplayers.dart';
import 'dart:developer' as dev;

class AudioService {
  static AudioPlayer? _player;
  static bool _enabled = true;

  static void setEnabled(bool enabled) {
    _enabled = enabled;
    if (!enabled) stopAlert();
  }

  /// Play an alert audio file from assets/audio/.
  /// Recreates the player each call to avoid stale state between alerts.
  static Future<void> playAlert(String filename) async {
    if (!_enabled) return;
    try {
      // Stop and dispose old player cleanly
      await _player?.stop();
      await _player?.dispose();
      _player = null;

      final player = AudioPlayer();
      await player.setReleaseMode(ReleaseMode.stop);
      await player.play(AssetSource('audio/$filename'));
      _player = player;
      dev.log('[Audio] Playing $filename');
    } catch (e) {
      dev.log('[Audio] Failed to play $filename: $e');
      // Try once more with a fresh player in case of init race
      try {
        _player = AudioPlayer();
        await _player!.play(AssetSource('audio/$filename'));
      } catch (e2) {
        dev.log('[Audio] Retry also failed: $e2');
      }
    }
  }

  static Future<void> stopAlert() async {
    try {
      await _player?.stop();
    } catch (_) {}
  }

  static void dispose() {
    _player?.dispose();
    _player = null;
  }
}
