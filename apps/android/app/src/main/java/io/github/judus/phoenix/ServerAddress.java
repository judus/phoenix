package io.github.judus.phoenix;

import java.net.URI;
import java.net.URISyntaxException;
import java.util.Locale;

/** One explicitly chosen HTTP origin; pairing codes are never persisted by the shell. */
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
            URI origin = new URI(scheme.toLowerCase(Locale.ROOT), null,
                    uri.getHost().toLowerCase(Locale.ROOT), uri.getPort(), "/", null, null);
            return new ServerAddress(origin, origin.toASCIIString()
                    + (uri.getRawFragment() == null ? "" : "#" + uri.getRawFragment()));
        } catch (URISyntaxException exception) {
            throw new IllegalArgumentException("Invalid server address", exception);
        }
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
