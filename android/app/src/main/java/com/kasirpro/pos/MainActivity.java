package com.kasirpro.pos;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(BluetoothEscposPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
