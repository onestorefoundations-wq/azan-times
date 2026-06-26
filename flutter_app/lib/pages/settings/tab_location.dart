/// tab_location.dart
/// Location & Calculation settings tab.
/// GPS location, OpenStreetMap map picker, timezone, calc method, Asr method.

import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:http/http.dart' as http;
import 'package:geolocator/geolocator.dart';
import 'package:flutter_map/flutter_map.dart';
import 'package:latlong2/latlong.dart';
import '../../core/app_config.dart';
import 'settings_helpers.dart';

class _PlaceResult {
  final String displayName;
  final double lat;
  final double lon;
  _PlaceResult({required this.displayName, required this.lat, required this.lon});

  factory _PlaceResult.fromJson(Map<String, dynamic> json) {
    return _PlaceResult(
      displayName: json['display_name'] ?? '',
      lat: double.tryParse(json['lat'].toString()) ?? 0,
      lon: double.tryParse(json['lon'].toString()) ?? 0,
    );
  }
}

class TabLocation extends StatefulWidget {
  final MasjidProfile profile;
  final ValueChanged<MasjidProfile> onChanged;

  const TabLocation({super.key, required this.profile, required this.onChanged});

  @override
  State<TabLocation> createState() => _TabLocationState();
}

class _TabLocationState extends State<TabLocation> {
  late TextEditingController _latCtrl;
  late TextEditingController _lngCtrl;
  late TextEditingController _tzCtrl;
  bool _showMap = false;
  bool _gettingLocation = false;
  String? _locationError;

  final MapController _mapController = MapController();

  @override
  void initState() {
    super.initState();
    _latCtrl = TextEditingController(text: widget.profile.latitude.toString());
    _lngCtrl = TextEditingController(text: widget.profile.longitude.toString());
    _tzCtrl = TextEditingController(text: widget.profile.timezoneId);
  }

  @override
  void dispose() {
    _latCtrl.dispose();
    _lngCtrl.dispose();
    _tzCtrl.dispose();
    super.dispose();
  }

  void _notify({double? lat, double? lng, String? tz, String? method, String? asr}) {
    widget.onChanged(widget.profile.copyWith(
      latitude: lat ?? double.tryParse(_latCtrl.text) ?? widget.profile.latitude,
      longitude: lng ?? double.tryParse(_lngCtrl.text) ?? widget.profile.longitude,
      timezoneId: tz ?? _tzCtrl.text.trim(),
      calculationMethod: method ?? widget.profile.calculationMethod,
      asrJuristicMethod: asr ?? widget.profile.asrJuristicMethod,
    ));
  }

  Future<void> _getLocation() async {
    setState(() { _gettingLocation = true; _locationError = null; });
    try {
      // Check if location services exist on this device (TV devices often have no GPS)
      final serviceEnabled = await Geolocator.isLocationServiceEnabled();
      if (!serviceEnabled) {
        setState(() => _locationError = 'GPS/Location not available on this device. Please enter coordinates manually.');
        return;
      }

      LocationPermission permission = await Geolocator.checkPermission();
      if (permission == LocationPermission.denied) {
        permission = await Geolocator.requestPermission();
      }
      if (permission == LocationPermission.deniedForever) {
        setState(() => _locationError = 'Location permission denied permanently. Enable in device settings.');
        return;
      }

      final pos = await Geolocator.getCurrentPosition(
        locationSettings: const LocationSettings(
          accuracy: LocationAccuracy.high,
          timeLimit: Duration(seconds: 15),
        ),
      );
      final lat = double.parse(pos.latitude.toStringAsFixed(6));
      final lng = double.parse(pos.longitude.toStringAsFixed(6));
      _latCtrl.text = lat.toString();
      _lngCtrl.text = lng.toString();

      if (_showMap) {
        _mapController.move(LatLng(lat, lng), 13);
      }
      _notify(lat: lat, lng: lng);
    } catch (e) {
      setState(() => _locationError = 'Could not get location: $e');
    } finally {
      setState(() => _gettingLocation = false);
    }
  }

  Future<Iterable<_PlaceResult>> _searchPlaces(String query) async {
    if (query.isEmpty) return const [];
    try {
      final uri = Uri.parse(
          'https://nominatim.openstreetmap.org/search?q=${Uri.encodeComponent(query)}&format=json&limit=5');
      final response = await http.get(uri, headers: {'User-Agent': 'com.masjid.flutter_app'});
      if (response.statusCode == 200) {
        final List data = jsonDecode(response.body);
        return data.map((e) => _PlaceResult.fromJson(e as Map<String, dynamic>));
      }
    } catch (_) {}
    return const [];
  }

  @override
  Widget build(BuildContext context) {
    final lat = double.tryParse(_latCtrl.text) ?? widget.profile.latitude;
    final lng = double.tryParse(_lngCtrl.text) ?? widget.profile.longitude;

    return SettingsTabScaffold(
      title: 'Location & Calculation',
      children: [
        // GPS + Map buttons
        Wrap(
          spacing: 12,
          runSpacing: 8,
          children: [
            ElevatedButton.icon(
              onPressed: _gettingLocation ? null : _getLocation,
              icon: _gettingLocation
                  ? const SizedBox(width: 14, height: 14, child: CircularProgressIndicator(strokeWidth: 2))
                  : const Icon(Icons.my_location, size: 16),
              label: Text(_gettingLocation ? 'Getting location...' : '📍 Get My Location'),
              style: ElevatedButton.styleFrom(
                backgroundColor: const Color(0xFF1E293B),
                foregroundColor: SettingsTheme.accentTeal,
                side: const BorderSide(color: SettingsTheme.accentTeal),
              ),
            ),
            ElevatedButton.icon(
              onPressed: () => setState(() => _showMap = !_showMap),
              icon: Icon(_showMap ? Icons.map_outlined : Icons.map, size: 16),
              label: Text(_showMap ? '🗺️ Hide Map' : '🗺️ Select from Map'),
              style: ElevatedButton.styleFrom(
                backgroundColor: const Color(0xFF1E293B),
                foregroundColor: SettingsTheme.textSecondary,
                side: BorderSide(color: SettingsTheme.borderSubtle),
              ),
            ),
          ],
        ),

        if (_locationError != null) ...[
          const SizedBox(height: 8),
          Text(_locationError!, style: const TextStyle(color: SettingsTheme.accentRed, fontSize: 12)),
        ],

        const SizedBox(height: 16),

        if (_showMap) ...[
          // Search place
          Padding(
            padding: const EdgeInsets.only(bottom: 12),
            child: Autocomplete<_PlaceResult>(
              displayStringForOption: (option) => option.displayName,
              optionsBuilder: (textEditingValue) async {
                if (textEditingValue.text.length < 3) return const Iterable.empty();
                return await _searchPlaces(textEditingValue.text);
              },
              onSelected: (selection) {
                _latCtrl.text = selection.lat.toStringAsFixed(6);
                _lngCtrl.text = selection.lon.toStringAsFixed(6);
                _mapController.move(LatLng(selection.lat, selection.lon), 13);
                _notify(lat: selection.lat, lng: selection.lon);
                setState(() {});
              },
              fieldViewBuilder: (context, controller, focusNode, onEditingComplete) {
                return TextField(
                  controller: controller,
                  focusNode: focusNode,
                  onEditingComplete: onEditingComplete,
                  style: SettingsTheme.inputTextStyle,
                  decoration: SettingsTheme.inputDecoration('🔍 Search for a city or mosque...'),
                );
              },
            ),
          ),

          // Map picker
          SizedBox(
            height: 240,
            child: ClipRRect(
              borderRadius: BorderRadius.circular(10),
              child: FlutterMap(
                mapController: _mapController,
                options: MapOptions(
                  initialCenter: LatLng(lat, lng),
                  initialZoom: 13,
                  onTap: (_, point) {
                    _latCtrl.text = point.latitude.toStringAsFixed(6);
                    _lngCtrl.text = point.longitude.toStringAsFixed(6);
                    _notify(lat: point.latitude, lng: point.longitude);
                    setState(() {});
                  },
                ),
                children: [
                  TileLayer(
                    urlTemplate: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
                    userAgentPackageName: 'com.masjid.flutter_app',
                  ),
                  MarkerLayer(
                    markers: [
                      Marker(
                        point: LatLng(lat, lng),
                        width: 40,
                        height: 40,
                        child: const Icon(Icons.location_pin,
                            color: SettingsTheme.accentTeal, size: 40),
                      ),
                    ],
                  ),
                ],
              ),
            ),
          ),
        ],

        const SizedBox(height: 16),

        // Lat/Long
        SettingsFormRow(
          left: SettingsFormField(
            label: 'Latitude',
            child: TextField(
              controller: _latCtrl,
              keyboardType: const TextInputType.numberWithOptions(
                  decimal: true, signed: true),
              style: SettingsTheme.inputTextStyle,
              decoration: SettingsTheme.inputDecoration('e.g. 51.5074'),
              onChanged: (_) => _notify(),
            ),
          ),
          right: SettingsFormField(
            label: 'Longitude',
            child: TextField(
              controller: _lngCtrl,
              keyboardType: const TextInputType.numberWithOptions(
                  decimal: true, signed: true),
              style: SettingsTheme.inputTextStyle,
              decoration: SettingsTheme.inputDecoration('e.g. -0.1278'),
              onChanged: (_) => _notify(),
            ),
          ),
        ),

        // Timezone
        SettingsFormField(
          label: 'Timezone ID',
          helpText: 'IANA timezone identifier, e.g. Europe/London, Asia/Riyadh, America/New_York',
          child: TextField(
            controller: _tzCtrl,
            style: SettingsTheme.inputTextStyle,
            decoration: SettingsTheme.inputDecoration('e.g. Asia/Riyadh'),
            onChanged: (_) => _notify(),
          ),
        ),

        // Calculation method
        SettingsDropdown<String>(
          label: 'Calculation Method',
          value: widget.profile.calculationMethod,
          onChanged: (v) => _notify(method: v),
          items: const [
            DropdownMenuItem(value: 'UmmAlQura', child: Text('Umm Al-Qura (Saudi Arabia)')),
            DropdownMenuItem(value: 'MoonsightingCommittee', child: Text('Moonsighting Committee')),
            DropdownMenuItem(value: 'NorthAmerica', child: Text('ISNA (North America)')),
            DropdownMenuItem(value: 'Muslim_World_League', child: Text('Muslim World League (MWL)')),
            DropdownMenuItem(value: 'Egyptian', child: Text('Egyptian General Authority')),
            DropdownMenuItem(value: 'Karachi', child: Text('University of Islamic Sciences, Karachi')),
          ],
        ),

        // Asr method
        SettingsDropdown<String>(
          label: 'Asr Juristic Method',
          value: widget.profile.asrJuristicMethod,
          onChanged: (v) => _notify(asr: v),
          items: const [
            DropdownMenuItem(value: 'Standard', child: Text("Standard (Shafi'i, Maliki, Hanbali)")),
            DropdownMenuItem(value: 'Hanafi', child: Text('Hanafi (Later Asr time)')),
          ],
        ),
      ],
    );
  }
}
