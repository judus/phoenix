package io.github.judus.phoenix;

import java.net.URI;
import java.net.URLDecoder;
import java.nio.charset.StandardCharsets;
import java.util.HashMap;
import java.util.Map;

/** Installation identity supplied out of band by the computer's experimental QR. */
final class GatewayIdentity {
    final ServerAddress server;
    final String pin;
    final String code;

    GatewayIdentity(String origin, String pin, String code) {
        server = ServerAddress.parse(origin);
        if (!server.origin().startsWith("https://") || !server.pairingCode().isEmpty()
                || !pin.matches("[a-fA-F0-9]{64}") || !code.matches("[A-Za-z0-9_-]*")) {
            throw new IllegalArgumentException("Expected an HTTPS origin and SHA-256 certificate fingerprint.");
        }
        this.pin = pin.toLowerCase(java.util.Locale.ROOT);
        this.code = code;
    }

    static GatewayIdentity parse(String input) {
        try {
            URI uri = URI.create(input.trim());
            if (!"phoenix-gateway".equals(uri.getScheme()) || !"connect".equals(uri.getHost())
                    || uri.getUserInfo() != null || uri.getPort() != -1 || !uri.getRawPath().isEmpty()
                    || uri.getRawFragment() != null || uri.getRawQuery() == null) throw new IllegalArgumentException();
            Map<String, String> values = new HashMap<>();
            for (String item : uri.getRawQuery().split("&", -1)) {
                String[] pair = item.split("=", 2);
                if (pair.length != 2) throw new IllegalArgumentException();
                String name = URLDecoder.decode(pair[0], StandardCharsets.UTF_8.name());
                if (values.put(name, URLDecoder.decode(pair[1], StandardCharsets.UTF_8.name())) != null) throw new IllegalArgumentException();
            }
            if (values.size() != 3 || !values.keySet().containsAll(java.util.List.of("origin", "pin", "code"))) throw new IllegalArgumentException();
            return new GatewayIdentity(values.get("origin"), values.get("pin"), values.get("code"));
        } catch (IllegalArgumentException | java.io.UnsupportedEncodingException invalid) {
            throw new IllegalArgumentException("Scan the experimental gateway QR shown on the PHOENIX computer.", invalid);
        }
    }

    String key() { return server.origin() + "|" + pin; }
}
