# 🕌 Masjid App — Connection & Sync Test Results

**Test Date:** 2026-06-21 14:02 IST  
**Test Script:** `tool/test_sync_simulation.dart`  
**Supabase Project:** `veyrcvvvsomyrahjfvhh.supabase.co`  
**Tenant Tested:** `cc51470a-edc0-4533-9a7e-e934ca21cd3f` (Oravampuram Salafi Masjid)

---

## 📋 Test Results Summary

| # | Test | Result | Time |
|---|------|--------|------|
| 1 | Database Connectivity (REST API) | ✅ PASS | — |
| 2 | Read Full Config from Cloud | ✅ PASS | 527ms |
| 3 | Full Account Creation (tenant + user + config) | ✅ PASS | 1,488ms |
| 4 | Config Push ↑ (Admin Save / Upload) | ✅ PASS | 559ms |
| 5 | Config Pull ↓ (Device B Polling / Download) | ✅ PASS | 348ms |
| 6 | Realtime WebSocket Delivery | ❌ FAIL | Timeout 8s |
| 7 | Stale Version Guard (Logic) | ✅ PASS | — |
| 8 | Config Restore (Cleanup) | ✅ PASS | 538ms |
| 9 | Test Account Cleanup | ✅ PASS | — |

**Overall: 8/9 PASSED**

---

## ⏱️ Detailed Timing Report

```
╔══════════════════════════════════════════════════════╗
║  📋 SYNC TIMING REPORT                               ║
╠══════════════════════════════════════════════════════╣
║  ⏱  Operation Timings:                               ║
║    Tenants table read                      1830ms  ║
║    mosque_configs table read                505ms  ║
║    device_registry table read               494ms  ║
║    Config pull latency (↓)                  348ms  ║
║    Tenant creation                          583ms  ║
║    Admin user creation                      427ms  ║
║    Initial config push                      478ms  ║
║    Config push latency (↑)                  559ms  ║
║    Config restore push                      538ms  ║
╠══════════════════════════════════════════════════════╣
║  Tests: 8 passed, 1 failed of 9 total               ║
║  Total run time: 16796ms                            ║
╚══════════════════════════════════════════════════════╝
```

---

## 📊 Database State at Time of Test

| Table | Rows |
|-------|------|
| `tenants` | 4 |
| `mosque_configs` | 3 |
| `device_registry` | **11 active devices** |

**Active Devices Registered:**
| Device ID | Last Seen (UTC) |
|-----------|-----------------|
| `web_d9b057ed` | 2026-06-18 17:40 |
| `flutter_1ed5740b` | 2026-06-21 01:50 |
| `flutter_acd0171f` | 2026-06-21 03:01 |
| `flutter_0d8ec348` | 2026-06-21 03:26 |
| `flutter_3106ac5f` | 2026-06-21 12:39 |
| `flutter_c19a20b2` | 2026-06-21 13:01 |
| `flutter_b9894e60` | 2026-06-21 04:01 |
| `flutter_dcafb725` | 2026-06-21 04:04 |
| `flutter_d2cb4cdc` | 2026-06-21 04:15 |
| `flutter_e0cd3604` | 2026-06-21 04:19 |
| `flutter_6575a907` | 2026-06-21 04:42 |

**Mosque Config (at test time):**
- Version: `17`
- Size: `1,653 bytes (1.6 KB)`
- Slideshow images: `2`
- Ticker messages: `0`
- Prayer times: `configured ✅`

---

## 🔴 Known Failure — Realtime WebSocket

### What happened
The WebSocket connection to Supabase was established successfully (`join: ok`), but **no change events were received** within the 8-second timeout window.

### Root Cause
The `mosque_configs` table has **not been added to the Supabase Realtime publication**. Without this, Supabase does not broadcast row-change events to subscribers.

### Fix Required (one-time SQL)
Run the following in **Supabase Dashboard → SQL Editor → New Query → Run**:

```sql
-- Step 1: Enable full row data in change events
ALTER TABLE mosque_configs REPLICA IDENTITY FULL;

-- Step 2: Add table to the realtime broadcast publication
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
    AND tablename = 'mosque_configs'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE mosque_configs;
  END IF;
END$$;

-- Step 3 (optional but recommended): Atomic version increment to prevent race condition
CREATE OR REPLACE FUNCTION increment_and_push_config(
  p_tenant_id UUID,
  p_config_json JSONB,
  p_device_id TEXT
)
RETURNS INT AS $$
DECLARE
  new_version INT;
BEGIN
  UPDATE mosque_configs
  SET 
    config_json = p_config_json,
    config_version = config_version + 1,
    updated_at = NOW(),
    updated_by = p_device_id
  WHERE tenant_id = p_tenant_id
  RETURNING config_version INTO new_version;
  
  IF NOT FOUND THEN
    INSERT INTO mosque_configs (tenant_id, config_json, config_version, updated_by)
    VALUES (p_tenant_id, p_config_json, 1, p_device_id)
    RETURNING config_version INTO new_version;
  END IF;
  
  RETURN new_version;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

### Expected result after fix
Realtime delivery should complete in **< 300ms**.

---

## 🔁 How to Run the Test Again

### Prerequisites
- Flutter SDK installed (for the project)
- Dart available on PATH
- Internet connection

### Steps

1. **Open terminal in the project directory:**
   ```
   cd c:\DATA_02\masjid-azan-times\flutter_app
   ```

2. **Run the test script directly with Dart:**
   ```
   dart tool/test_sync_simulation.dart
   ```

3. **The script will automatically:**
   - Connect to Supabase REST API
   - Read all table row counts and device registry
   - Create a temporary test account (auto-deleted at end)
   - Push and pull a config change with timing
   - Subscribe to WebSocket and measure realtime delivery
   - Restore the original config
   - Print a full timing report

4. **Check the output for:**
   - ✅ Lines = tests passed
   - ❌ Lines = tests failed with reason
   - ⏱ Lines = individual operation timing in ms

### Expected Results (after SQL fix)

| Operation | Expected Time |
|-----------|--------------|
| Config pull ↓ | 300–600ms |
| Config push ↑ | 400–700ms |
| Account creation | 1,200–2,000ms |
| **Realtime delivery** | **< 300ms** |

---

## 📁 Related Files

| File | Purpose |
|------|---------|
| `tool/test_sync_simulation.dart` | The test script |
| `lib/core/supabase_sync_service.dart` | Core sync service |
| `lib/providers/app_provider.dart` | App state + lifecycle observer |
| `supabase_setup.sql` *(in artifacts)* | SQL to enable Realtime |

---

*Last updated: 2026-06-21*
