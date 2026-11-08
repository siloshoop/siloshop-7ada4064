package com.siloshop.app;

import android.os.Bundle;
import android.webkit.WebSettings;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    /**
     * Android WebView would otherwise enlarge only the words by the phone's system text size
     * while fields, icons and images keep their size, which made them overlap. The WebView
     * text zoom stays at 100% and FontScalePlugin passes the system size to the pages instead,
     * which enlarge text together with the boxes around it.
     */
    private static final int WEBVIEW_TEXT_ZOOM = 100;

    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(FontScalePlugin.class);
        super.onCreate(savedInstanceState);
        keepWebViewTextZoom();
    }

    @Override
    public void onResume() {
        super.onResume();
        keepWebViewTextZoom();
    }

    private void keepWebViewTextZoom() {
        if (bridge == null || bridge.getWebView() == null) return;
        WebSettings settings = bridge.getWebView().getSettings();
        if (settings.getTextZoom() != WEBVIEW_TEXT_ZOOM) settings.setTextZoom(WEBVIEW_TEXT_ZOOM);
    }
}
