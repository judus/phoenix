package io.github.judus.phoenix;

import org.junit.Test;

import static org.junit.Assert.*;

public class ServerAddressTest {
    @Test
    public void normalizesOriginAndKeepsPairingCodeOnlyInLaunchUrl() {
        ServerAddress address = ServerAddress.parse(" HTTP://192.168.1.10:3400/#pair=123456 ");
        assertEquals("http://192.168.1.10:3400/", address.origin());
        assertEquals("http://192.168.1.10:3400/#pair=123456", address.launchUrl());
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
        ServerAddress address = ServerAddress.parse("http://192.168.1.10:3400");
        for (String url : new String[] {"http://192.168.1.10.attacker:3400/", "http://192.168.1.10:3401/",
                "https://192.168.1.10:3400/", "http://user@192.168.1.10:3400/", "javascript:alert(1)",
                "file:///etc/passwd", "not a URL"}) {
            assertFalse(url, address.contains(url));
        }
    }

    @Test
    public void comparesDefaultPortsByScheme() {
        assertTrue(ServerAddress.parse("http://192.168.1.10:80").contains("http://192.168.1.10/"));
        assertFalse(ServerAddress.parse("https://phoenix.local").contains("https://phoenix.local:80/"));
    }

    @Test
    public void allowsOnlyExplicitLocalIpRangesForHttp() {
        for (String host : new String[] {"10.0.0.1", "10.255.255.254", "172.16.0.1", "172.31.255.254",
                "192.168.0.1", "192.168.255.254", "169.254.1.1", "127.0.0.1",
                "[fc00::1]", "[fdff::1]", "[fe80::1]", "[febf::1]", "[::1]",
                "[::ffff:192.168.1.10]"}) {
            assertEquals("http://" + host + ":3400/", ServerAddress.parse("http://" + host + ":3400").origin());
        }
    }

    @Test
    public void rejectsPublicAndAmbiguousHttpHostsIncludingPairingLinks() {
        for (String host : new String[] {"8.8.8.8", "172.15.255.255", "172.32.0.1", "192.169.0.1",
                "100.64.0.1", "0.0.0.0", "255.255.255.255", "224.0.0.1", "192.168.1.256",
                "192.168.001.10", "2130706433", "127.1", "0x7f000001", "localhost", "phoenix.local",
                "example.com", "192.168.1.10.example.com", "[2001:4860:4860::8888]", "[::]",
                "[ff02::1]", "[fec0::1]", "[::ffff:8.8.8.8]", "[fe80::1%25wlan0]"}) {
            for (String suffix : new String[] {"", "/#pair=ABCDE-12345"}) {
                String url = "http://" + host + ":3400" + suffix;
                assertThrows(url, IllegalArgumentException.class, () -> ServerAddress.parse(url));
            }
        }
    }

    @Test
    public void keepsHttpsPublicAndHostnameOrigins() {
        assertEquals("https://example.com/", ServerAddress.parse("https://example.com").origin());
        assertEquals("https://8.8.8.8/", ServerAddress.parse("https://8.8.8.8").origin());
        assertEquals("https://phoenix.local/", ServerAddress.parse("https://phoenix.local").origin());
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
