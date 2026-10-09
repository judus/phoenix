package io.github.judus.phoenix;

import java.net.URI;
import java.net.URISyntaxException;
import java.net.InetAddress;
import java.net.UnknownHostException;
import java.util.Locale;

/** One explicit origin: cleartext is local-IP-only; HTTPS uses normal platform trust. */
final class ServerAddress {
    private final URI origin;
    private final String launchUrl;

    private ServerAddress(URI origin, String launchUrl) {
        this.origin = origin;
        this.launchUrl = launchUrl;
    }

    static ServerAddress parse(String input) {
        try {
            URI uri = new URI(input.trim());
            String scheme = uri.getScheme();
            if (scheme == null || (!scheme.equalsIgnoreCase("http") && !scheme.equalsIgnoreCase("https"))
                    || uri.getHost() == null || uri.getUserInfo() != null
                    || uri.getPort() == 0 || uri.getPort() > 65535 || uri.getPort() < -1
                    || uri.getRawQuery() != null
                    || (!uri.getRawPath().isEmpty() && !uri.getRawPath().equals("/"))
                    || (uri.getRawFragment() != null && !uri.getRawFragment().matches("pair=[A-Za-z0-9%_-]+"))) {
                throw new IllegalArgumentException("Expected a PHOENIX HTTP(S) server origin or pairing link");
            }
            if (scheme.equalsIgnoreCase("http") && !isLocalIp(uri.getHost())) {
                throw new IllegalArgumentException("HTTP requires a local IP address. Use the tablet access address shown by PHOENIX, or HTTPS.");
            }
            URI origin = new URI(scheme.toLowerCase(Locale.ROOT), null,
                    uri.getHost().toLowerCase(Locale.ROOT), uri.getPort(), "/", null, null);
            return new ServerAddress(origin, origin.toASCIIString()
                    + (uri.getRawFragment() == null ? "" : "#" + uri.getRawFragment()));
        } catch (URISyntaxException exception) {
            throw new IllegalArgumentException("Invalid server address", exception);
        }
    }

    private static boolean isLocalIp(String host) {
        // Never resolve names here: WebView resolves independently, so a DNS check would not
        // constrain its eventual peer (including .local names and DNS rebinding).
        if (host.startsWith("[") && host.endsWith("]") && host.indexOf('%') == -1) {
            try {
                InetAddress address = InetAddress.getByName(host);
                byte[] bytes = address.getAddress();
                if (bytes.length == 4) return isLocalIpv4(bytes); // IPv4-mapped IPv6 literal.
                return address.isLoopbackAddress() || address.isLinkLocalAddress()
                        || (bytes[0] & 0xfe) == 0xfc; // Unique-local fc00::/7, not obsolete fec0::/10.
            } catch (UnknownHostException invalid) { return false; }
        }
        String[] parts = host.split("\\.", -1);
        if (parts.length != 4) return false;
        byte[] bytes = new byte[4];
        for (int i = 0; i < parts.length; i++) {
            // Reject alternate numeric spellings that HTTP stacks might interpret differently.
            if (!parts[i].matches("0|[1-9][0-9]{0,2}")) return false;
            int value = Integer.parseInt(parts[i]);
            if (value > 255) return false;
            bytes[i] = (byte) value;
        }
        return isLocalIpv4(bytes);
    }

    private static boolean isLocalIpv4(byte[] bytes) {
        int first = bytes[0] & 0xff;
        int second = bytes[1] & 0xff;
        return first == 10 || first == 127 || (first == 172 && second >= 16 && second <= 31)
                || (first == 192 && second == 168) || (first == 169 && second == 254);
    }

    String origin() {
        return origin.toASCIIString();
    }

    String launchUrl() {
        return launchUrl;
    }

    String pairingCode() {
        String fragment = URI.create(launchUrl).getFragment();
        return fragment == null ? "" : fragment.substring("pair=".length());
    }

    boolean contains(String url) {
        try {
            URI uri = new URI(url);
            return uri.getUserInfo() == null && origin.getScheme().equalsIgnoreCase(uri.getScheme())
                    && origin.getHost().equalsIgnoreCase(uri.getHost())
                    && effectivePort(origin) == effectivePort(uri);
        } catch (URISyntaxException exception) {
            return false;
        }
    }

    private static int effectivePort(URI uri) {
        return uri.getPort() == -1 ? ("https".equalsIgnoreCase(uri.getScheme()) ? 443 : 80) : uri.getPort();
    }
}
