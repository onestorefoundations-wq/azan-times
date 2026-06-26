/// analog_clock_widget.dart
/// Beautiful analog clock drawn with CustomPainter.
/// Uses primary and secondary colors from app config.

import 'dart:math' as math;
import 'package:flutter/material.dart';

class AnalogClockWidget extends StatelessWidget {
  final DateTime time;
  final Color primaryColor;
  final Color accentColor;
  final double size;

  const AnalogClockWidget({
    super.key,
    required this.time,
    required this.primaryColor,
    required this.accentColor,
    required this.size,
  });

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      width: size,
      height: size,
      child: CustomPaint(
        painter: _AnalogClockPainter(
          time: time,
          primaryColor: primaryColor,
          accentColor: accentColor,
        ),
      ),
    );
  }
}

class _AnalogClockPainter extends CustomPainter {
  final DateTime time;
  final Color primaryColor;
  final Color accentColor;

  _AnalogClockPainter({
    required this.time,
    required this.primaryColor,
    required this.accentColor,
  });

  @override
  void paint(Canvas canvas, Size size) {
    final cx = size.width / 2;
    final cy = size.height / 2;
    final r = math.min(cx, cy) * 0.95;
    final center = Offset(cx, cy);

    // ── Face ─────────────────────────────────────────────────────
    final facePaint = Paint()
      ..color = const Color(0xFF0F172A)
      ..style = PaintingStyle.fill;
    canvas.drawCircle(center, r, facePaint);

    // Outer ring
    final ringPaint = Paint()
      ..color = primaryColor.withOpacity(0.25)
      ..style = PaintingStyle.stroke
      ..strokeWidth = r * 0.025;
    canvas.drawCircle(center, r, ringPaint);

    // Inner subtle ring
    final innerRingPaint = Paint()
      ..color = primaryColor.withOpacity(0.08)
      ..style = PaintingStyle.stroke
      ..strokeWidth = 1;
    canvas.drawCircle(center, r * 0.88, innerRingPaint);

    // ── Hour markers ─────────────────────────────────────────────
    for (int i = 0; i < 12; i++) {
      final angle = (i * 30 - 90) * math.pi / 180;
      final isMain = i % 3 == 0; // 12, 3, 6, 9 are bolder
      final markerLen = isMain ? r * 0.14 : r * 0.08;
      final markerWidth = isMain ? r * 0.030 : r * 0.018;
      final outerR = r * 0.86;
      final innerR = outerR - markerLen;

      final p1 = Offset(cx + outerR * math.cos(angle), cy + outerR * math.sin(angle));
      final p2 = Offset(cx + innerR * math.cos(angle), cy + innerR * math.sin(angle));

      canvas.drawLine(
        p1, p2,
        Paint()
          ..color = isMain ? primaryColor.withOpacity(0.9) : primaryColor.withOpacity(0.45)
          ..strokeWidth = markerWidth
          ..strokeCap = StrokeCap.round,
      );
    }

    // ── Minute markers ───────────────────────────────────────────
    for (int i = 0; i < 60; i++) {
      if (i % 5 == 0) continue; // skip hour positions
      final angle = (i * 6 - 90) * math.pi / 180;
      final outerR = r * 0.86;
      final innerR = outerR - r * 0.04;
      final p1 = Offset(cx + outerR * math.cos(angle), cy + outerR * math.sin(angle));
      final p2 = Offset(cx + innerR * math.cos(angle), cy + innerR * math.sin(angle));
      canvas.drawLine(p1, p2,
          Paint()
            ..color = primaryColor.withOpacity(0.22)
            ..strokeWidth = r * 0.012
            ..strokeCap = StrokeCap.round);
    }

    // ── Hour numbers (12, 3, 6, 9) ──────────────────────────────
    final numPositions = {12: -90.0, 3: 0.0, 6: 90.0, 9: 180.0};
    numPositions.forEach((num, deg) {
      final angle = deg * math.pi / 180;
      final numR = r * 0.65;
      final pos = Offset(cx + numR * math.cos(angle), cy + numR * math.sin(angle));
      final tp = TextPainter(
        text: TextSpan(
          text: num.toString(),
          style: TextStyle(
            color: primaryColor.withOpacity(0.75),
            fontSize: r * 0.13,
            fontWeight: FontWeight.w700,
          ),
        ),
        textDirection: TextDirection.ltr,
      )..layout();
      tp.paint(canvas, pos - Offset(tp.width / 2, tp.height / 2));
    });

    // ── Clock hands ──────────────────────────────────────────────
    final seconds = time.second + time.millisecond / 1000.0;
    final minutes = time.minute + seconds / 60.0;
    final hours = (time.hour % 12) + minutes / 60.0;

    // Hour hand
    _drawHand(canvas, center, r,
      angle: (hours * 30 - 90) * math.pi / 180,
      length: r * 0.50,
      width: r * 0.040,
      color: primaryColor,
      withShadow: true,
    );

    // Minute hand
    _drawHand(canvas, center, r,
      angle: (minutes * 6 - 90) * math.pi / 180,
      length: r * 0.70,
      width: r * 0.028,
      color: primaryColor,
      withShadow: true,
    );

    // Second hand (accent color)
    _drawHand(canvas, center, r,
      angle: (seconds * 6 - 90) * math.pi / 180,
      length: r * 0.78,
      width: r * 0.016,
      color: accentColor,
      tailLength: r * 0.18,
    );

    // ── Center dot ───────────────────────────────────────────────
    canvas.drawCircle(center, r * 0.045, Paint()..color = accentColor);
    canvas.drawCircle(center, r * 0.022, Paint()..color = const Color(0xFF0F172A));
  }

  void _drawHand(
    Canvas canvas,
    Offset center,
    double r, {
    required double angle,
    required double length,
    required double width,
    required Color color,
    double tailLength = 0,
    bool withShadow = false,
  }) {
    final tip = Offset(
      center.dx + length * math.cos(angle),
      center.dy + length * math.sin(angle),
    );
    final tail = tailLength > 0
        ? Offset(
            center.dx - tailLength * math.cos(angle),
            center.dy - tailLength * math.sin(angle),
          )
        : center;

    if (withShadow) {
      canvas.drawLine(
        tail, tip,
        Paint()
          ..color = Colors.black.withOpacity(0.35)
          ..strokeWidth = width + 2
          ..strokeCap = StrokeCap.round
          ..maskFilter = const MaskFilter.blur(BlurStyle.normal, 3),
      );
    }

    canvas.drawLine(
      tail, tip,
      Paint()
        ..color = color
        ..strokeWidth = width
        ..strokeCap = StrokeCap.round,
    );
  }

  @override
  bool shouldRepaint(_AnalogClockPainter old) =>
      old.time.second != time.second ||
      old.time.minute != time.minute ||
      old.time.hour != time.hour ||
      old.primaryColor != primaryColor ||
      old.accentColor != accentColor;
}
