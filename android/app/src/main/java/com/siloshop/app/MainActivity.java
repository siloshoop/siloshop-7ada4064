package com.siloshop.app;

import android.os.Bundle;
import android.webkit.WebSettings;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    /**
     * Android WebView scales every font by the phone's system text size while fixed-size
     * fields, icons and images stay the same, so large system text made words, fields and
     * pictures overlap. Cap the scale at the size the pages are designed and tested for.
     */
    private static final int MAX_TEXT_ZOOM = 100;

    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        capTextZoom();
    }

    @Override
    public void onResume() {
        super.onResume();
        capTextZoom();
    }

    private void capTextZoom() {
        if (bridge == null || bridge.getWebView() == null) return;
        WebSettings settings = bridge.getWebView().getSettings();
        if (settings.getTextZoom() > MAX_TEXT_ZOOM) settings.setTextZoom(MAX_TEXT_ZOOM);
    }
}
