// @vitest-environment node
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

const PLAY_SIGNING_SHA256 =
  "68:1B:B2:A5:77:31:5B:C7:DE:3B:25:B0:C0:B3:3E:44:56:00:F5:DB:86:1E:7E:B4:34:96:80:00:38:0C:39:A3";

describe("Android App Links", () => {
  it("assetlinks.json links com.siloshop.app with the Play app signing key", () => {
    const links = JSON.parse(readFileSync("public/.well-known/assetlinks.json", "utf8"));
    expect(links).toHaveLength(1);
    expect(links[0].relation).toEqual(["delegate_permission/common.handle_all_urls"]);
    expect(links[0].target.namespace).toBe("android_app");
    expect(links[0].target.package_name).toBe("com.siloshop.app");
    expect(links[0].target.sha256_cert_fingerprints).toEqual([PLAY_SIGNING_SHA256]);
  });

  it("the app auto-verifies product links on both www.siloshop.net and siloshop.net", () => {
    const manifest = readFileSync("android/app/src/main/AndroidManifest.xml", "utf8");
    const filter = manifest.match(/<intent-filter android:autoVerify="true">([\s\S]*?)<\/intent-filter>/)?.[1] ?? "";
    expect(filter).toContain('android:scheme="https"');
    expect(filter).toContain('android:host="www.siloshop.net"');
    expect(filter).toContain('android:host="siloshop.net"');
    expect(filter).toContain('android:pathPrefix="/product/"');
  });

  it("every link the site shares (product, store, category, comparison, shared favorites) opens in the app", () => {
    const manifest = readFileSync("android/app/src/main/AndroidManifest.xml", "utf8");
    const filter = manifest.match(/<intent-filter android:autoVerify="true">([\s\S]*?)<\/intent-filter>/)?.[1] ?? "";
    for (const prefix of ["/product/", "/store/", "/category/"]) expect(filter).toContain(`android:pathPrefix="${prefix}"`);
    for (const path of ["/compare", "/shared-favorites"]) expect(filter).toContain(`android:path="${path}"`);
  });

  it("the app passes the phone's system text size to the pages instead of blocking it", () => {
    const activity = readFileSync("android/app/src/main/java/com/siloshop/app/MainActivity.java", "utf8");
    const plugin = readFileSync("android/app/src/main/java/com/siloshop/app/FontScalePlugin.java", "utf8");
    // WebView keeps its own words-only zoom at 100% so the pages can scale text and boxes together.
    expect(activity).toContain("WEBVIEW_TEXT_ZOOM = 100");
    expect(activity).toContain("registerPlugin(FontScalePlugin.class)");
    expect(activity.indexOf("registerPlugin(FontScalePlugin.class)")).toBeLessThan(activity.indexOf("super.onCreate"));
    expect(plugin).toContain('@CapacitorPlugin(name = "SiloShopFontScale")');
    expect(plugin).toContain("getConfiguration().fontScale");
  });

  it("the package id is unchanged", () => {
    expect(readFileSync("android/app/build.gradle", "utf8")).toContain('applicationId "com.siloshop.app"');
  });
});
