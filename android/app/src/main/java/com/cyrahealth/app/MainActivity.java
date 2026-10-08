package com.cyrahealth.app;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {

    @Override
    public void onCreate(Bundle savedInstanceState) {
        // App-local plugins are not listed in capacitor.plugins.json, so register them here,
        // before super.onCreate() creates the bridge (Capacitor docs: Android custom code).
        registerPlugin(CyraHealthPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
