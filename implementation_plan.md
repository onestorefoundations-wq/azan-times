# Islamic Digital Signage System

This document outlines the implementation plan for the multi-tenant Islamic Digital Signage System for mosques, as detailed in the provided prompt. The core is an Android TV Flutter application that runs 100% offline, with an embedded local admin panel, optional Supabase cloud sync, a React super admin dashboard, and a PHP asset server.

## Overview of Components

1.  **Flutter TV App**: Android TV display (portrait/landscape), strictly offline prayer time calculation using `adhan` and `hijri` packages, complex prayer state machine, Iqamah countdown, and slideshow engine.
2.  **SQLite Database**: Local database for the TV app storing masjid profiles, time adjustments, feature formats, slideshow settings, announcements, slide assets, Jumuah settings, and sync metadata.
3.  **Embedded Local Admin Panel**: HTTP server (`shelf`) running inside the Flutter app on port 8080 for same-network configuration, secured by a 4-digit PIN.
4.  **Supabase Cloud Database**: Multi-tenant PostgreSQL for remote management, with sync logic via a background worker in Flutter.
5.  **React Super Admin Dashboard**: Vite + React app for managing multiple mosques and pushing config updates.
6.  **PHP Asset Server**: Lightweight image upload endpoint (`uploads.php`).

## User Review Required

> [!IMPORTANT]
> The prompt requests a step-by-step delivery, starting with item 1 and pausing after each deliverable. 
> 
> Here are the deliverables in order:
> 1. SQLite initialization code (`database_helper.dart`)
> 2. `PrayerStateManager` service
> 3. Main TV display widget
> 4. `shelf` HTTP server setup
> 5. Supabase sync service
> 6. Supabase SQL migrations
> 7. React Dashboard scaffold
> 8. `uploads.php`

## Open Questions

> [!WARNING]
> Before I begin generating the code for Deliverable 1, please confirm if you want me to:
> 
> 1.  Create a brand new Flutter project directory in `c:\DATA_02\masjid-azan-times\` for the TV app, and start writing the actual files to the disk?
> 2.  Or simply output the code snippets here in the chat for you to copy/paste?
>
> If you want me to create the project, please provide a preferred name for the Flutter project (e.g., `tv_app`).

## Proposed Changes

### Deliverable 1: SQLite Initialization Code

I will implement `database_helper.dart` using `sqflite`. It will include all the tables defined in the schema (masjid_profile, time_adjustments, features_format, slideshow_settings, announcements, slide_assets, jumuah_settings, sync_meta) with migration support (`onUpgrade`) and default seed data.

#### [NEW] `lib/database_helper.dart` (Assuming a standard Flutter project structure)

## Verification Plan

We will verify each deliverable step-by-step as requested. For the first step, verification will involve ensuring the Dart code is syntactically correct and properly implements the requested SQLite schema.
