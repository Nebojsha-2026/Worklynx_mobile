# WorkLynx Mobile — Build Guide

## Overview

WorkLynx Mobile is a professional React Native + Expo application for iOS and Android.
It connects to the same Supabase backend as the web platform at **worklynx.com.au**.

---

## Quick Start (Development)

```bash
# Install dependencies
npm install

# Start Expo dev server
npm start

# Run on Android emulator
npm run android

# Run on iOS simulator (macOS only)
npm run ios
```

---

## Building the APK (Android)

WorkLynx Mobile uses **Expo EAS Build** to generate production-ready APK files.

### 1. Install EAS CLI

```bash
npm install -g eas-cli
eas login
```

### 2. Set up environment variables

Create a `.env` file (already included with Supabase credentials):

```env
EXPO_PUBLIC_SUPABASE_URL=https://ljnpugeuyosecggnbapa.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=<your_anon_key>
```

### 3. Build APK (self-hosted, no Google Play needed)

```bash
# Preview APK (fastest, suitable for self-hosting on your website)
npm run build:android:preview

# Production APK
npm run build:android
```

EAS will output a download URL. Download the `.apk` file and host it on worklynx.com.au:

```
https://www.worklynx.com.au/downloads/worklynx.apk
```

### 4. Android install page

Add a download page to your site:

```html
<a href="/downloads/worklynx.apk" download>
  Download WorkLynx App (Android)
</a>
```

> **Note**: Android users will need to enable "Install from unknown sources" in their device settings to install a self-hosted APK.

---

## Building for iOS (future)

When you have an Apple Developer account ($99/year):

```bash
npm run build:ios
```

This generates an `.ipa` file that can be submitted to the App Store via App Store Connect.

---

## Environment Variables

| Variable | Description |
|---|---|
| `EXPO_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `EXPO_PUBLIC_SUPABASE_ANON_KEY` | Supabase anonymous key (safe to expose) |
| `EXPO_PUBLIC_GOOGLE_MAPS_API_KEY` | Google Maps key for location features |

---

## App Architecture

```
app/                    # Expo Router file-based screens
  (auth)/               # Login, Register, Forgot Password, MFA
  (tabs)/               # Main app screens (role-based tabs)
    dashboard.tsx       # Role-aware dashboard
    shifts.tsx          # Shifts (employee: my shifts, manager: all shifts)
    timesheets.tsx      # Employee timesheets
    approvals.tsx       # Manager/BM timesheet approvals
    team.tsx            # Team management + invite
    reports.tsx         # BM/BO reports
    billing.tsx         # BO billing & subscription
    notifications.tsx   # Push notifications inbox
    profile.tsx         # User profile + sign out

src/
  components/
    ui/                 # Button, Card, Input, Badge, Toast, Avatar, etc.
    dashboards/         # Role-specific dashboard components
  hooks/                # useAuth, etc.
  lib/                  # supabase.ts, theme.ts, format.ts
  store/                # Zustand auth store
  types/                # Supabase database types
```

## Role-Based Navigation

| Role | Tabs |
|---|---|
| Employee | Dashboard, My Shifts, Timesheets, Alerts, Profile |
| Manager | Dashboard, Shifts, Team, Approvals, Profile |
| Business Manager | Dashboard, Team, Approvals, Reports, Profile |
| Business Owner | Dashboard, Team, Reports, Billing, Profile |

---

## Key Features

- ✅ **Auth**: Email/password login, register, forgot password, MFA (TOTP)
- ✅ **Shifts**: View/manage shifts, clock in/out with timestamp
- ✅ **Timesheets**: Submit, view status, full details
- ✅ **Approvals**: Review, approve, or reject with reason
- ✅ **Team**: View members, roles, invite new staff
- ✅ **Reports**: Hours, wages, approval stats by period
- ✅ **Billing**: Plan details, upgrade links, trial status
- ✅ **Notifications**: In-app inbox, mark read
- ✅ **Profile**: Edit details, sign out
- ✅ **Dark theme**: Professional slate dark design system
- ✅ **Secure storage**: JWT tokens stored in device Keychain/Keystore
- ✅ **React Query**: Automatic caching, background refresh, pull-to-refresh

---

## Connecting to the Same Supabase DB

The app uses the exact same Supabase project as the web app:

- **URL**: `https://ljnpugeuyosecggnbapa.supabase.co`
- **Same RLS policies** apply — users only see their own org's data
- **Same auth** — users can log in with the same credentials

---

## Hosting the APK on worklynx.com.au

1. Build the APK using EAS: `npm run build:android:preview`
2. Download the `.apk` from the EAS dashboard
3. Upload to your Vercel-hosted site as a static asset:
   - Place in `public/downloads/worklynx.apk` (or equivalent)
4. Create a download page on your site
5. Share the link with your customers

Users scan a QR code or click a link to download directly from your website.
