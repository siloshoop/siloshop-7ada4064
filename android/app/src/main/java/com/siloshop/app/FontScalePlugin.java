package com.siloshop.app;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/**
 * Reports the phone's system text size (Settings → Display → Font size) to the web pages,
 * which scale the whole layout with it so text, fields and pictures grow together.
 */
@CapacitorPlugin(name = "SiloShopFontScale")
public class FontScalePlugin extends Plugin {
    @PluginMethod
    public void get(PluginCall call) {
        JSObject result = new JSObject();
        result.put("scale", getContext().getResources().getConfiguration().fontScale);
        call.resolve(result);
    }
}
