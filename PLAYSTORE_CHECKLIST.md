# 📱 Google Play Store Publication Checklist & Implementation Guide
**App Name**: Baghchal - Tigers & Goats  
**Application ID**: `np.com.grisma.baghchal`  
**Current Version**: `1.1.4` (versionCode: `2`)  
**Target API**: Android 15 (API 35) | Min API: Android 6.0 (API 23)

---

## 🎯 Status Summary (What has been implemented in code)

| Requirement | Criteria / Policy | Implementation Status |
|---|---|---|
| **Target SDK** | Google requires API 34+ (Android 14+) | ✅ **Target API 35** (`compileSdkVersion 35`, `targetSdkVersion 35`) |
| **Publishing Format** | Google requires `.aab` (Android App Bundle) | ✅ **AAB Build Enabled** (`bundleRelease` in Gradle & CI) |
| **Native App Icons** | Adaptive Icon + 512x512 icon | ✅ **Custom Royal Tiger Icons** in all mipmap densities (`mdpi` to `xxxhdpi`) |
| **Store Graphic Assets** | 512x512 Icon & 1024x500 Feature Graphic | ✅ **Generated** in `store-assets/` directory |
| **Android Permissions** | No sensitive/unjustified permissions | ✅ Only `INTERNET`, `ACCESS_NETWORK_STATE`, and `VIBRATE` |
| **Hardware Back Button** | Standard Android navigation & modal dismissal | ✅ Handled via `@capacitor/app` in `useMobileLifecycle` |
| **Privacy Policy** | Public URL covering COPPA, Data Safety, P2P WebRTC | ✅ **`public/privacy.html`** created + linked in app UI |
| **Data Safety Compliance** | Zero personal data collection | ✅ Form answers prepared below |

---

## 📋 1. Google Play Console Setup & Policy Questionnaire (Exact Answers)

When you submit the app on **Google Play Console** (`play.google.com/console`), fill in these sections under **"Policy and programs" -> "App content"**:

### A. Privacy Policy
- **Privacy Policy URL**:
  ```text
  https://baghchal.pages.dev/privacy.html
  ```
  *(Alternative if using GitHub Pages: `https://iamgrisma.github.io/Baghchal/privacy.html`)*

### B. App Access
- **Question**: Is any part of your app restricted (requires login / credentials)?
- **Answer**: Select **"All functionality is available without special access"**.

### C. Ads Declaration
- **Question**: Does your app contain advertising?
- **Answer**: Select **"No, my app does not contain ads"**.

### D. Content Rating (IARC Questionnaire)
- **Category**: Select **"Game"** -> **"Puzzle / Strategy / Board"**.
- **Violence**: None (no realistic violence, animated board game only).
- **Fear / Horror**: None.
- **Sexuality / Nudity**: None.
- **Language**: None.
- **Controlled Substances**: None.
- **User Interactions**: 
  - Allows users to interact or exchange content with other users? -> **Yes** (P2P multiplayer).
  - Shares physical location? -> **No**.
  - Digital purchases / In-app purchases? -> **No**.
- **Resulting Rating**: **PEGI 3 / Everyone (ESRB E)**.

### E. Target Audience & Content
- **Target Age Groups**: Select **"13 and older"** (or all ages if desired).
- **Appeal to Children**: Does the store listing unintentionally appeal to children under 13? Select **"No"**.

### F. Data Safety Declaration (Crucial Section)
- **Does your app collect or share any user data?**
  👉 Select **"No"**.
- *(Our app stores game settings & stats exclusively on the local device, and multiplayer runs over direct peer-to-peer WebRTC without user accounts or tracking servers.)*
- **Is all user data collected by your app encrypted in transit?**
  👉 Select **"Yes"** (WebRTC DTLS/SRTP and HTTPS).
- **Do you provide a way for users to request data deletion?**
  👉 Select **"Not applicable"** (No server account exists; uninstalling or clearing app storage deletes everything).

### G. Government Apps & Financial Features
- **Government app?** 👉 **No**.
- **Financial / Loan / Cryptocurrency trading?** 👉 **No** *(The cryptographic ledger in Baghchal is an offline SHA-256 fair-play state validator, not a cryptocurrency).*

---

## 🎨 2. Store Listing Metadata (Ready to Copy & Paste)

### App Details
- **App Name** (max 30 characters):
  ```text
  Baghchal - Tigers & Goats
  ```
- **Short Description** (max 80 characters):
  ```text
  Ancient Nepali strategy board game (4 Tigers vs 20 Goats) with AI & multiplayer.
  ```

### Full Description (max 4000 characters):
```text
Experience Baghchal (बाघचाल), the revered ancient strategic board game of Nepal, beautifully reimagined with handcrafted cultural aesthetics, offline intelligent AI, and secure peer-to-peer online multiplayer!

🐅 THE TIMELESS STRATEGY OF BAGHCHAL
Baghchal is a two-player asymmetric strategy board game played on a 5x5 grid:
• 4 Tigers (बाघ): Hunt down the herd by leaping over goats to capture them.
• 20 Goats (बाख्रा): Work together as a united defense to outmaneuver and trap all 4 tigers until they have zero legal moves!

✨ KEY FEATURES

🧠 ADAPTIVE AI & OFFLINE PLAY
• Play anytime, anywhere without an internet connection.
• Multiple difficulty tiers: Novice, Strategic, and Master.
• Smart heuristics simulate authentic human tactical play.

🌐 REAL-TIME PEER-TO-PEER MULTIPLAYER
• Play with friends or challenge players worldwide via low-latency WebRTC.
• Quick Match matchmaking & Private Room codes.
• Heartbeat reconnection recovery & 30-second forfeit countdown.

🔒 FAIR-PLAY CRYPTOGRAPHIC LEDGER
• Every move is validated sequentially through a tamper-proof SHA-256 block ledger.
• Transparent game audit log prevents cheating and state tampering.

🎨 AUTHENTIC NEPALI AESTHETICS
• Visual themes: Classic Royal Ebony, Brass Gold, Himalayan Slate, and Terracotta.
• Tactile haptic feedback on piece placement and captures.
• Traditional ambient folk sound design with mute controls.

📊 STATISTICS & PLAYER PROGRESSION
• Track your win/loss records, capture ratios, and win streaks.
• Local profile management without mandatory registration or accounts.

📜 ACCESSIBLE & FAMILY-FRIENDLY
• Interactive in-game rulebook explaining Placement & Movement phases.
• 100% Free, zero advertisements, and zero personal data tracking.

Rediscover the rich heritage of Nepal's favorite board game. Download Baghchal and test your strategic intellect today!
```

---

## 🖼️ 3. Store Listing Graphic Assets

The required graphical assets have been prepared in the `store-assets/` directory:

1. **App Icon**:
   - File: `store-assets/icon-512.png`
   - Specifications: 512 x 512 px, 32-bit PNG, transparent background / rounded square.
2. **Feature Graphic**:
   - File: `store-assets/feature-graphic-1024x500.png`
   - Specifications: 1024 x 500 px, high-resolution cultural banner.
3. **Phone Screenshots**:
   - Take 3 to 6 screenshots while running the app on Android:
     1. Home Setup Screen (Select AI / Online / Themes)
     2. In-Game Placement Phase (Board with glowing tiger & goats)
     3. Movement Phase / Tiger Trapped scenario
     4. Cryptographic Ledger verification modal
     5. Win / GameOver Celebration screen

---

## 📦 4. Building the Play Store Release Bundle (`.aab`)

### Via GitHub Actions (Automated & Recommended)
Whenever you push to `main` or trigger the workflow manually:
1. Go to **GitHub Actions** -> **Build Android APK & Play Store Bundle**.
2. Download the artifact: **`Baghchal-Android-Builds`**.
3. It contains:
   - `Baghchal-v1.1.4.apk` (for direct testing on mobile devices)
   - `Baghchal-v1.1.4.aab` (for direct upload to Google Play Console!)

### Via Local Command Line
If you have Android SDK / Java installed:
```bash
npm run build
npx cap sync android
cd android
./gradlew bundleRelease
```
The output file is located at:
`android/app/build/outputs/bundle/release/app-release.aab`

---

## ⚠️ 5. Play Console 2024–2026 Testing Requirement Note
*(Important for Personal Developer Accounts created after November 13, 2023)*:
- Google requires **Closed Testing** with at least **12 testers opted in for 14 continuous days** before production release access is unlocked.
- **Workflow to fulfill this**:
  1. Upload `Baghchal-v1.1.4.aab` to **Testing -> Closed testing**.
  2. Create an email list of 12 friends / family / testers.
  3. Share the Google Play Closed Test opt-in link with them.
  4. Keep the test running for 14 days, then click **"Apply for production"**.
