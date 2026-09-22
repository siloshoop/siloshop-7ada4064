# قائمة تحقق إطلاق تطبيق SiloShop على Google Play

آخر تحديث: 2026-09-22

## 1. هوية التطبيق والحزمة

- [ ] اسم التطبيق المعروض: **SiloShop** (في `android/app/src/main/res/values/strings.xml` → `app_name`).
- [x] اسم الحزمة (Package / Application ID): `com.siloshop.app`
  - مضبوط في: `capacitor.config.ts` (`appId`)، `android/app/build.gradle` (`namespace` + `applicationId`)، `MainActivity.java`، `strings.xml` (`package_name`, `custom_url_scheme`).
  - ⚠️ لا يمكن تغيير اسم الحزمة بعد أول نشر على Google Play. أي تغيير = تطبيق جديد منفصل.
- [ ] تأكيد اسم الحزمة داخل Play Console يطابق `com.siloshop.app` قبل إنشاء التطبيق.

## 2. الإصدار الأول

| العنصر | القيمة الحالية | ملاحظات |
| --- | --- | --- |
| versionCode | `1` | يجب زيادته (+1) مع كل حزمة تُرفع، ولو كانت تجريبية |
| versionName | `1.0` | النص الظاهر للمستخدم |
| minSdk / targetSdk | من `android/variables.gradle` | targetSdk يجب أن يوافق الحد الأدنى الحالي لـ Google Play |

- [ ] التحقق من الإصدار في الحزمة الناتجة:
  ```bash
  aapt2 dump badging android/app/build/outputs/bundle/release/app-release.aab | head -1
  ```

## 3. التوقيع (Signing)

- [ ] إنشاء مفتاح الرفع (مرة واحدة، على جهازك فقط):
  ```bash
  keytool -genkey -v -keystore siloshop-upload.keystore \
    -alias siloshop -keyalg RSA -keysize 2048 -validity 10000
  ```
- [ ] تعبئة `android/keystore.properties` بمسار المفتاح وكلمات المرور.
- [ ] **حماية المفتاح**: نسخة احتياطية آمنة للملف + كلمة المرور. فقدان المفتاح = عدم القدرة على تحديث التطبيق.
- [ ] التأكد من أن `android/keystore.properties` و`*.keystore` غير مرفوعين إلى Git:
  ```bash
  git rm --cached android/keystore.properties   # إن كان متتبعًا سابقًا
  ```
  (`android/.gitignore` يمنعهما مستقبلاً.)
- [ ] تفعيل **Play App Signing** عند إنشاء أول إصدار في Play Console.
- [ ] التحقق من أن الحزمة موقّعة بمفتاح إصدار وليس Debug:
  ```bash
  jarsigner -verify -verbose -certs android/app/build/outputs/bundle/release/app-release.aab | head -20
  ```

## 4. بناء الحزمة النهائية (AAB)

```bash
bash scripts/android-release.sh
```
الناتج: `android/app/build/outputs/bundle/release/app-release.aab`

- [ ] البناء انتهى بـ `BUILD SUCCESSFUL` دون أخطاء.
- [ ] تجربة نسخة APK موقّعة على هاتف حقيقي قبل الرفع (`./gradlew assembleRelease`).
- [ ] فتح التطبيق والتأكد من: تسجيل الدخول يبقى محفوظًا بعد الإغلاق، التصفح والسلة والطلبات تعمل، لا قص في الواجهة، RTL سليم.

## 5. متطلبات Google Play Console

- [ ] وصف قصير ووصف كامل بالعربية.
- [ ] أيقونة التطبيق 512×512 PNG.
- [ ] صورة الغلاف (Feature graphic) 1024×500.
- [ ] 2–8 لقطات شاشة للهاتف (وللأجهزة اللوحية إن وُجد دعم).
- [ ] تصنيف المحتوى (Content rating questionnaire).
- [ ] بيان أمان البيانات (Data safety): الحساب، البريد، العنوان، الطلبات.
- [ ] سياسة الخصوصية: https://www.siloshop.net/privacy
- [ ] بريد الدعم وبيانات المطوّر.
- [ ] الدول المستهدفة وتصنيف التطبيق (تجارة إلكترونية / تسوّق).
- [ ] حساب تجريبي للمراجعين إن كان التسجيل مطلوبًا لاستخدام التطبيق.

## 6. مسار النشر المقترح

1. [ ] **Internal testing** — رفع أول AAB، تجربة مع 2–3 أجهزة.
2. [ ] **Closed / Open testing** (اختياري) لاختبار أوسع.
3. [ ] **Production** — بعد إصلاح ملاحظات الاختبار، مع زيادة `versionCode`.

## 7. بعد النشر

- [ ] متابعة الأعطال (Crashes & ANRs) في Play Console.
- [ ] مراقبة رسائل التحقق بالبريد (تُرسل من `notify@siloshop.net`).
- [ ] مع كل تحديث: زيادة `versionCode`، تحديث `versionName`، إعادة البناء بنفس المفتاح.
