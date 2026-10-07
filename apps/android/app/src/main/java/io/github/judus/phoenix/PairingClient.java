package io.github.judus.phoenix;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URI;
import java.nio.charset.StandardCharsets;
import org.json.JSONException;
import org.json.JSONObject;

/** Existing pairing HTTP contract; WebView remains the only session store. */
final class PairingClient {
    static final class Rejected extends IOException {
        Rejected(String message) { super(message); }
    }

    /** Newly issued Set-Cookie header, or null when the existing session is authorized. */
    String authorize(ServerAddress server, String code, String existingCookies) throws IOException {
        JSONObject status = request(server, "status", null, existingCookies).body;
        if (Boolean.TRUE.equals(status.opt("authenticated"))) return null;
        if (code.isBlank()) throw new Rejected("Enter the pairing code shown on your computer, or scan its QR code.");
        try {
            Reply reply = request(server, "claim", new JSONObject().put("code", code).toString(), existingCookies);
            if (!Boolean.TRUE.equals(reply.body.opt("authenticated")) || reply.cookie == null) {
                throw new Rejected("PHOENIX did not authorize this device. Check the pairing code and try again.");
            }
            return reply.cookie;
        } catch (JSONException invalid) {
            throw new Rejected("Cannot prepare the pairing request.");
        }
    }

    private Reply request(ServerAddress server, String path, String body, String cookies) throws IOException {
        HttpURLConnection connection = (HttpURLConnection) URI.create(server.origin() + "api/pairing/" + path).toURL().openConnection();
        connection.setConnectTimeout(10000);
        connection.setReadTimeout(10000);
        connection.setInstanceFollowRedirects(false); // Never forward pairing codes to another origin.
        connection.setRequestProperty("Accept", "application/json");
        connection.setRequestProperty("User-Agent", "PHOENIX Android");
        if (cookies != null) connection.setRequestProperty("Cookie", cookies);
        try {
            if (body != null) {
                connection.setRequestMethod("POST");
                connection.setDoOutput(true);
                connection.setRequestProperty("Content-Type", "application/json; charset=utf-8");
                byte[] bytes = body.getBytes(StandardCharsets.UTF_8);
                connection.setFixedLengthStreamingMode(bytes.length);
                try (var output = connection.getOutputStream()) { output.write(bytes); }
            }
            int status = connection.getResponseCode();
            if (status == 401) throw new Rejected("The pairing code is invalid. Check the current code on your computer.");
            if (status == 429) throw new Rejected("Too many pairing attempts. Wait a moment, then try again.");
            if (status != 200) throw new Rejected("The server could not complete pairing (HTTP " + status + "). Check the PHOENIX address.");
            try (InputStream input = connection.getInputStream(); ByteArrayOutputStream output = new ByteArrayOutputStream()) {
                byte[] buffer = new byte[1024];
                int size;
                while ((size = input.read(buffer)) != -1) {
                    if (output.size() + size > 8192) throw new Rejected("This address did not return a PHOENIX pairing response.");
                    output.write(buffer, 0, size);
                }
                JSONObject json = new JSONObject(output.toString(StandardCharsets.UTF_8.name()));
                if (!(json.opt("authenticated") instanceof Boolean)) {
                    throw new Rejected("This address did not return a PHOENIX pairing response.");
                }
                return new Reply(json, connection.getHeaderField("Set-Cookie"));
            } catch (JSONException invalid) {
                throw new Rejected("This address did not return a PHOENIX pairing response.");
            }
        } finally { connection.disconnect(); }
    }

    private static final class Reply {
        final JSONObject body;
        final String cookie;
        Reply(JSONObject body, String cookie) { this.body = body; this.cookie = cookie; }
    }
}
