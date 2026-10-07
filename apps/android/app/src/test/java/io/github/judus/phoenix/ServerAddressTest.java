package io.github.judus.phoenix;

import org.junit.Test;

import static org.junit.Assert.*;

public class ServerAddressTest {
    @Test
    public void normalizesOriginAndKeepsPairingCodeOnlyInLaunchUrl() {
        ServerAddress address = ServerAddress.parse(" HTTP://Phoenix.local:3400/#pair=123456 ");
        assertEquals("http://phoenix.local:3400/", address.origin());
        assertEquals("http://phoenix.local:3400/#pair=123456", address.launchUrl());
        assertEquals("123456", address.pairingCode());
    }

    @Test
    public void acceptsIpv6AndEncodedPairingCodes() {
        assertEquals("http://[fd00::1]:3400/", ServerAddress.parse("http://[fd00::1]:3400").origin());
        assertEquals("https://phoenix.local/#pair=abc%2Ddef", ServerAddress.parse("https://phoenix.local/#pair=abc%2Ddef").launchUrl());
        assertEquals("abc-def", ServerAddress.parse("https://phoenix.local/#pair=abc%2Ddef").pairingCode());
        assertEquals("", ServerAddress.parse("https://phoenix.local").pairingCode());
    }

    @Test
    public void permitsSameOriginPathsAndRoutes() {
        ServerAddress address = ServerAddress.parse("https://phoenix.local");
        assertTrue(address.contains("https://PHOENIX.local:443/api/pairing"));
        assertTrue(address.contains("https://phoenix.local/#/galaxy/atlas"));
    }

    @Test
    public void rejectsOriginLookalikesDifferentPortsAndUnsafeSchemes() {
        ServerAddress address = ServerAddress.parse("http://phoenix.local:3400");
        for (String url : new String[] {"http://phoenix.local.attacker:3400/", "http://phoenix.local:3401/",
                "https://phoenix.local:3400/", "http://user@phoenix.local:3400/", "javascript:alert(1)",
                "file:///etc/passwd", "not a URL"}) {
            assertFalse(url, address.contains(url));
        }
    }

    @Test
    public void comparesDefaultPortsByScheme() {
        assertTrue(ServerAddress.parse("http://phoenix.local:80").contains("http://phoenix.local/"));
        assertFalse(ServerAddress.parse("https://phoenix.local").contains("https://phoenix.local:80/"));
    }

    @Test
    public void rejectsCredentialsSubpathsQueriesAndNonPairingFragments() {
        for (String input : new String[] {"", "phoenix.local:3400", "ftp://phoenix.local", "http://user:secret@host/",
                "http://host:0", "http://host:65536", "http://host/api", "http://host/?pair=123",
                "http://host/#not-pairing", "http://host/#pair=", "http://host/#pair=123&next=evil", "file:///tmp"}) {
            assertThrows(input, IllegalArgumentException.class, () -> ServerAddress.parse(input));
        }
    }
}
