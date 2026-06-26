# Mosque TV Display - Flutter App

A standalone, offline-first, and Supabase-synced Flutter application designed to display mosque prayer times on TVs and mobile devices.

## Features
- **Standalone/Local Mode:** Works without internet. Local settings and prayer calculations.
- **Synced Mode:** Links to a Supabase tenant to fetch configuration from a central dashboard.
- **Responsive Layout:** Automatically adapts between landscape and portrait orientations depending on device constraints. Perfect for both TV mounting and tablet/phone usage.

## Display Orientation Management
The app includes a local hardware setting for **Display Orientation**. This setting overrides the standard auto-rotation behavior on your device to force either Landscape or Portrait mode. 

**Note:** This setting is *device-specific* and is never synced to the cloud. It ensures that wall-mounted TVs or dedicated display tablets remain locked in the correct orientation regardless of the OS orientation state or accidental rotation.
