/// slideshow_panel_widget.dart
/// Auto-advancing image slideshow from local file paths.
/// Uses PageView with crossfade transitions.

import 'dart:async';
import 'dart:convert';
import 'dart:io';
import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import '../core/app_config.dart';

class SlideshowPanelWidget extends StatefulWidget {
  final List<SlideAsset> assets;
  final int durationSeconds;

  const SlideshowPanelWidget({
    super.key,
    required this.assets,
    this.durationSeconds = 5,
  });

  @override
  State<SlideshowPanelWidget> createState() => _SlideshowPanelWidgetState();
}

class _SlideshowPanelWidgetState extends State<SlideshowPanelWidget> {
  final PageController _controller = PageController();
  int _currentIndex = 0;
  Timer? _timer;

  @override
  void initState() {
    super.initState();
    _startTimer();
  }

  @override
  void didUpdateWidget(SlideshowPanelWidget oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.durationSeconds != widget.durationSeconds ||
        oldWidget.assets.length != widget.assets.length) {
      _restartTimer();
    }
  }

  void _startTimer() {
    _timer?.cancel();
    if (widget.assets.length <= 1) return;
    _timer = Timer.periodic(
      Duration(seconds: widget.durationSeconds.clamp(1, 999)),
      (_) {
        if (!mounted) return;
        final nextIndex = (_currentIndex + 1) % widget.assets.length;
        setState(() => _currentIndex = nextIndex);
        if (_controller.hasClients) {
          _controller.animateToPage(
            nextIndex,
            duration: const Duration(milliseconds: 800),
            curve: Curves.easeInOut,
          );
        }
      },
    );
  }

  void _restartTimer() {
    _timer?.cancel();
    _startTimer();
  }

  @override
  void dispose() {
    _timer?.cancel();
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    if (widget.assets.isEmpty) {
      return const SizedBox.shrink();
    }

    return Stack(
      children: [
        PageView.builder(
          controller: _controller,
          physics: const NeverScrollableScrollPhysics(),
          itemCount: widget.assets.length,
          onPageChanged: (i) => setState(() => _currentIndex = i),
          itemBuilder: (_, index) {
            final asset = widget.assets[index];
            return _buildSlide(asset);
          },
        ),

        // Dot indicators
        if (widget.assets.length > 1)
          Positioned(
            bottom: 12,
            left: 0,
            right: 0,
            child: Row(
              mainAxisAlignment: MainAxisAlignment.center,
              children: List.generate(widget.assets.length, (i) {
                return AnimatedContainer(
                  duration: const Duration(milliseconds: 300),
                  margin: const EdgeInsets.symmetric(horizontal: 3),
                  width: _currentIndex == i ? 20 : 6,
                  height: 6,
                  decoration: BoxDecoration(
                    color: _currentIndex == i
                        ? const Color(0xFF14B8A6)
                        : Colors.white.withOpacity(0.3),
                    borderRadius: BorderRadius.circular(3),
                  ),
                );
              }),
            ),
          ),
      ],
    );
  }

  Widget _buildSlide(SlideAsset asset) {
    Widget image;
    if (asset.localPath.startsWith('http')) {
      image = Image.network(
        asset.localPath,
        key: ValueKey(asset.localPath),
        fit: BoxFit.cover,
        width: double.infinity,
        height: double.infinity,
        errorBuilder: (_, __, ___) => _placeholder(asset.filename),
      );
    } else if (asset.localPath.startsWith('data:')) {
      if (kIsWeb) {
        // Browsers handle data: URLs natively via Image.network
        image = Image.network(
          asset.localPath,
          key: ValueKey(asset.localPath),
          fit: BoxFit.cover,
          width: double.infinity,
          height: double.infinity,
          errorBuilder: (_, __, ___) => _placeholder(asset.filename),
        );
      } else {
        // Android/iOS: decode base64 and use Image.memory
        try {
          final commaIdx = asset.localPath.indexOf(',');
          final bytes = base64Decode(asset.localPath.substring(commaIdx + 1));
          image = Image.memory(
            bytes,
            key: ValueKey(asset.localPath.hashCode),
            fit: BoxFit.cover,
            width: double.infinity,
            height: double.infinity,
            errorBuilder: (_, __, ___) => _placeholder(asset.filename),
          );
        } catch (_) {
          image = _placeholder(asset.filename);
        }
      }
    } else if (!kIsWeb) {
      final file = File(asset.localPath);
      image = file.existsSync()
          ? Image.file(
              file,
              key: ValueKey(asset.localPath),
              fit: BoxFit.cover,
              width: double.infinity,
              height: double.infinity,
              errorBuilder: (_, __, ___) => _placeholder(asset.filename),
            )
          : _placeholder(asset.filename);
    } else {
      // kIsWeb and path is not http/data: — a device-local path synced from native app
      image = _placeholder(asset.filename, isLocalPath: true);
    }
    return AnimatedSwitcher(
      duration: const Duration(milliseconds: 600),
      child: image,
    );
  }

  Widget _placeholder(String filename, {bool isLocalPath = false}) {
    return Container(
      color: const Color(0xFF1E293B),
      child: Center(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Icon(Icons.image_not_supported_outlined,
                color: Color(0xFF475569), size: 48),
            const SizedBox(height: 8),
            Text(
              filename,
              style: const TextStyle(color: Color(0xFF64748B), fontSize: 14),
            ),
            if (isLocalPath) ...[
              const SizedBox(height: 6),
              const Text(
                'Stored on device — please re-upload from the app',
                textAlign: TextAlign.center,
                style: TextStyle(color: Color(0xFF475569), fontSize: 11),
              ),
            ],
          ],
        ),
      ),
    );
  }
}
