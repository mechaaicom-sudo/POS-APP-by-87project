package com.kasirpro.pos;

import android.Manifest;
import android.bluetooth.BluetoothAdapter;
import android.bluetooth.BluetoothDevice;
import android.bluetooth.BluetoothSocket;
import android.content.pm.PackageManager;
import android.os.Build;
import android.util.Log;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;
import org.json.JSONObject;

import java.io.IOException;
import java.io.OutputStream;
import java.nio.charset.StandardCharsets;
import java.util.Set;
import java.util.UUID;

@CapacitorPlugin(name = "BluetoothEscpos", permissions = {
    @Permission(alias = "bluetooth", strings = {Manifest.permission.BLUETOOTH_CONNECT})
})
public class BluetoothEscposPlugin extends Plugin {

    private static final String TAG = "BluetoothEscpos";
    private static final UUID SPP_UUID = UUID.fromString("00001101-0000-1000-8000-00805F9B34FB");

    private boolean ensurePermission(PluginCall call) {
        if (Build.VERSION.SDK_INT >= 31) {
            if (getContext().checkSelfPermission(Manifest.permission.BLUETOOTH_CONNECT)
                    != PackageManager.PERMISSION_GRANTED) {
                requestPermissionForAlias("bluetooth", call, "permissionCallback");
                call.setKeepAlive(true);
                return false;
            }
        }
        return true;
    }

    @PluginMethod
    public void listDevices(PluginCall call) {
        call.setKeepAlive(true);
        if (!ensurePermission(call)) return;
        try {
            BluetoothAdapter adapter = BluetoothAdapter.getDefaultAdapter();
            JSArray devices = new JSArray();
            if (adapter != null) {
                Set<BluetoothDevice> bonded = adapter.getBondedDevices();
                for (BluetoothDevice d : bonded) {
                    if (d.getType() != BluetoothDevice.DEVICE_TYPE_LE) {
                        JSObject o = new JSObject();
                        o.put("name", d.getName() != null ? d.getName() : "?");
                        o.put("address", d.getAddress());
                        devices.put(o);
                    }
                }
            }
            JSObject ret = new JSObject();
            ret.put("devices", devices);
            call.resolve(ret);
        } catch (Exception e) {
            call.reject(e.getMessage());
        }
    }

    @PluginMethod
    public void print(PluginCall call) {
        call.setKeepAlive(true);
        if (!ensurePermission(call)) return;
        new Thread(() -> {
            try {
                String address = call.getString("address");
                JSArray lines = call.getArray("lines");
                BluetoothAdapter adapter = BluetoothAdapter.getDefaultAdapter();
                if (adapter == null) { call.reject("Bluetooth tidak tersedia"); return; }
                BluetoothDevice device = adapter.getRemoteDevice(address);
                BluetoothSocket socket = device.createRfcommSocketToServiceRecord(SPP_UUID);
                socket.connect();
                OutputStream os = socket.getOutputStream();
                os.write(new byte[]{0x1B, 0x40}); // ESC @ init
                if (lines != null && lines.length() > 0) {
                    for (int i = 0; i < lines.length(); i++) {
                        JSONObject l = lines.getJSONObject(i);
                        String s = escText(l.has("s") ? l.getString("s") : "");
                        String a = l.has("a") ? l.getString("a") : "left";
                        boolean bold = l.has("b") && l.getBoolean("b");
                        if (bold) os.write(new byte[]{0x1B, 0x45, 0x01});
                        if ("center".equals(a)) os.write(new byte[]{0x1B, 0x61, 0x01});
                        else if ("right".equals(a)) os.write(new byte[]{0x1B, 0x61, 0x02});
                        else os.write(new byte[]{0x1B, 0x61, 0x00});
                        os.write(s.getBytes(StandardCharsets.ISO_8859_1));
                        os.write('\n');
                        if (bold) os.write(new byte[]{0x1B, 0x45, 0x00});
                        os.flush();
                    }
                }
                os.write(new byte[]{0x1B, 0x64, 0x04}); // ESC d feed
                os.write(new byte[]{0x1D, 0x56, 0x42, 0x00}); // GS V B cut
                os.flush();
                os.close();
                socket.close();
                call.resolve();
            } catch (Exception e) {
                Log.e(TAG, "print error", e);
                call.reject(e.getMessage() != null ? e.getMessage() : "Gagal mencetak");
            }
        }).start();
    }

    private String escText(String s) {
        StringBuilder sb = new StringBuilder();
        for (char c : s.toCharArray()) {
            if (c == '\n' || c == '\r') continue;
            sb.append(c <= 0xFF ? c : '?');
        }
        return sb.toString();
    }

    @PermissionCallback
    private void permissionCallback(PluginCall call) {
        if (getContext().checkSelfPermission(Manifest.permission.BLUETOOTH_CONNECT)
                == PackageManager.PERMISSION_GRANTED) {
            if ("print".equals(call.getMethodName())) print(call);
            else listDevices(call);
        } else {
            call.reject("Izin Bluetooth ditolak");
        }
    }
}
