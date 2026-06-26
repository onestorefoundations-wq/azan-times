/// tab_ticker.dart
/// Settings tab for the scrolling ticker messages.

import 'package:flutter/material.dart';
import '../../core/app_config.dart';
import '../settings/settings_helpers.dart';

class TabTicker extends StatefulWidget {
  final TickerSettings ticker;
  final ValueChanged<TickerSettings> onChanged;

  const TabTicker({
    super.key,
    required this.ticker,
    required this.onChanged,
  });

  @override
  State<TabTicker> createState() => _TabTickerState();
}

class _TabTickerState extends State<TabTicker> {
  late TextEditingController _addCtrl;

  @override
  void initState() {
    super.initState();
    _addCtrl = TextEditingController();
  }

  @override
  void dispose() {
    _addCtrl.dispose();
    super.dispose();
  }

  void _addMessage() {
    final msg = _addCtrl.text.trim();
    if (msg.isEmpty) return;
    
    final newMessages = List<String>.from(widget.ticker.messages)..add(msg);
    widget.onChanged(widget.ticker.copyWith(messages: newMessages));
    _addCtrl.clear();
  }

  void _removeMessage(int index) {
    final newMessages = List<String>.from(widget.ticker.messages)..removeAt(index);
    widget.onChanged(widget.ticker.copyWith(messages: newMessages));
  }

  @override
  Widget build(BuildContext context) {
    return SettingsTabScaffold(
      title: 'Scrolling Ticker',
      children: [
        SettingsToggleRow(
          label: 'Enable Scrolling Ticker',
          description: 'Display a marquee text banner at the bottom of the screen.',
          value: widget.ticker.enabled,
          onChanged: (v) => widget.onChanged(widget.ticker.copyWith(enabled: v)),
        ),
        const SizedBox(height: 16),
        SettingsDropdown<int>(
          label: 'Scroll Speed',
          value: widget.ticker.speed,
          onChanged: (v) {
            if (v != null) widget.onChanged(widget.ticker.copyWith(speed: v));
          },
          items: const [
            DropdownMenuItem(value: 20, child: Text('Slow (20)')),
            DropdownMenuItem(value: 50, child: Text('Normal (50)')),
            DropdownMenuItem(value: 80, child: Text('Fast (80)')),
            DropdownMenuItem(value: 120, child: Text('Very Fast (120)')),
          ],
        ),
        Divider(color: SettingsTheme.borderSubtle, height: 32),
        const SettingsSectionHeader(title: 'Ticker Messages'),
        Text(
          'Add text messages to scroll across the bottom of the screen.',
          style: TextStyle(fontSize: 12, color: SettingsTheme.textSecondary),
        ),
        const SizedBox(height: 16),
        
        Row(
          children: [
            Expanded(
              child: TextField(
                controller: _addCtrl,
                style: SettingsTheme.inputTextStyle,
                decoration: SettingsTheme.inputDecoration('Enter a new message...'),
                onSubmitted: (_) => _addMessage(),
              ),
            ),
            const SizedBox(width: 8),
            ElevatedButton(
              onPressed: _addMessage,
              style: SettingsTheme.primaryButtonStyle,
              child: const Text('Add'),
            ),
          ],
        ),
        const SizedBox(height: 16),
        
        if (widget.ticker.messages.isEmpty)
          Padding(
            padding: const EdgeInsets.all(16),
            child: Text('No messages added yet.', style: TextStyle(color: SettingsTheme.textSecondary)),
          )
        else
          Container(
            decoration: BoxDecoration(
              color: const Color(0xFF1E293B),
              borderRadius: BorderRadius.circular(8),
              border: Border.all(color: SettingsTheme.borderSubtle),
            ),
            child: ListView.separated(
              shrinkWrap: true,
              physics: const NeverScrollableScrollPhysics(),
              itemCount: widget.ticker.messages.length,
              separatorBuilder: (_, __) => Divider(color: SettingsTheme.borderSubtle, height: 1),
              itemBuilder: (context, index) {
                final msg = widget.ticker.messages[index];
                return Material(
                  color: Colors.transparent,
                  child: ListTile(
                    dense: true,
                    title: Text(msg, style: TextStyle(color: SettingsTheme.textPrimary, fontSize: 14)),
                    trailing: IconButton(
                      icon: const Icon(Icons.delete_outline, color: Color(0xFFEF4444), size: 20),
                      onPressed: () => _removeMessage(index),
                      tooltip: 'Remove',
                    ),
                  ),
                );
              },
            ),
          ),
      ],
    );
  }
}
