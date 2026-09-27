# SiloShop — Android signing (copy/paste reference)

Everything here runs on **your** computer. Keystores and passwords must never be committed.

## 1. The upload keystore (already created in Android Studio — do not recreate)

Your existing keystore is used as-is. Only its *location* matters (see step 2).
If you ever need a new one:

```bash
keytool -genkey -v -keystore siloshop-upload.keystore \
  -alias siloshop -keyalg RSA -keysize 2048 -validity 10000
```

Back it up somewhere safe. If you lose it you cannot update the app on Google Play
(unless you use Play App Signing key reset).

## 2. Store the credentials outside git

Put **both files** in the `android/` folder (next to `gradlew`):

- `android/keystore.properties`
- your keystore file, e.g. `android/siloshop-upload.keystore`

Create `android/keystore.properties`:

```properties
storeFile=siloshop-upload.keystore
storePassword=YOUR_STORE_PASSWORD
keyAlias=siloshop
keyPassword=YOUR_KEY_PASSWORD
```

- `storeFile` may be a bare filename (resolved against the `android/` folder) or an absolute path like `C:\keys\siloshop-upload.keystore`.
- `.gitignore` already excludes `keystore.properties`, `*.keystore` and `*.jks`, so these are never committed.

## 3. Signing config (already wired in this project)

`android/app/build.gradle` already loads `android/keystore.properties` and signs
the release build with it — no edit needed. It matches this structure:

```gradle
def keystorePropsFile = rootProject.file("keystore.properties")
def keystoreProps = new Properties()
if (keystorePropsFile.exists()) {
    keystoreProps.load(new FileInputStream(keystorePropsFile))
}

android {
    signingConfigs {
        release {
            if (keystorePropsFile.exists()) {
                // relative storeFile paths resolve against the android/ folder
                storeFile ...
                storePassword keystoreProps['storePassword']
                keyAlias keystoreProps['keyAlias']
                keyPassword keystoreProps['keyPassword']
            }
        }
    }

    namespace = "com.siloshop.app"
    defaultConfig {
        applicationId "com.siloshop.app"
        // current values — bump versionCode for every Play upload
        versionCode 10
        versionName "1.0.1"
    }

    buildTypes {
        release {
            signingConfig keystorePropsFile.exists() ? signingConfigs.release : null
        }
    }
}
```

If `android/keystore.properties` is missing, the build fails with a clear message
instead of producing an unsigned bundle (Play rejects unsigned bundles).

## 4. Build the signed bundle

```bash
bash scripts/android-release.sh
```

Output: `android/app/build/outputs/bundle/release/app-release.aab`

## 5. Verify the signature (optional)

```bash
# needs Android build-tools on PATH
bundletool validate --bundle android/app/build/outputs/bundle/release/app-release.aab
jarsigner -verify -verbose -certs android/app/build/outputs/bundle/release/app-release.aab | head
```

## 6. Upload

Google Play Console → your app → Production → Create new release → upload the `.aab`.
Keep **Play App Signing** enabled (default) so Google manages the final app signing key.
