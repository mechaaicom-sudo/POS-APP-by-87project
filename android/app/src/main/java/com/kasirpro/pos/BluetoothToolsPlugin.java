package com.kasirpro.pos;

import android.content.Intent;
import android.os.Build;
import android.provider.Settings;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/**
 * BluetoothTools — helper tambahan utk printer Bluetooth ESC/POS.
 *  - checkPermission(): laporan status izin runtime BLUETOOTH_CONNECT (Android 12+)
 *  - openSettings(): buka Settings Bluetooth Android utk pairing printer dulu
 */
@CapacitorPlugin(name = "BluetoothTools")
public class BluetoothToolsPlugin extends Plugin {

    @PluginMethod
    public void checkPermission(PluginCall call) {
        JSObject ret = new JSObject();
        ret.put("granted", hasRequiredPermissions());
        ret.put("api", Build.VERSION.SDK_INT);
        call.resolve(ret);
    }

    @PluginMethod
    public void openSettings(PluginCall call) {
        try {
            Intent intent = new Intent(Settings.ACTION_BLUETOOTH_SETTINGS);
            getActivity().startActivity(intent);
            call.resolve();
        } catch (Exception e) {
            call.reject(e.getMessage(), e);
        }
    }
}