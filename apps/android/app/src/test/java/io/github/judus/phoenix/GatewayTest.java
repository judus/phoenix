package io.github.judus.phoenix;

import java.io.IOException;
import java.net.URI;
import java.net.Socket;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicReference;
import okhttp3.OkHttpClient;
import okhttp3.Request;
import okhttp3.RequestBody;
import okhttp3.mockwebserver.MockResponse;
import okhttp3.mockwebserver.MockWebServer;
import okhttp3.mockwebserver.RecordedRequest;
import okhttp3.mockwebserver.SocketPolicy;
import okhttp3.tls.HandshakeCertificates;
import okhttp3.tls.HeldCertificate;
import org.junit.After;
import org.junit.Before;
import org.junit.Test;
import static org.junit.Assert.*;

/** Real local HTTP and TLS sockets: transport, identities, bodies, session isolation and cancellation. */
public class GatewayTest {
    private MockWebServer remote;
    private HeldCertificate certificate;
    private GatewayIdentity identity;
    private GatewayTls tls;
    private LoopbackGateway gateway;
    private final OkHttpClient browser = new OkHttpClient.Builder().readTimeout(3, TimeUnit.SECONDS).build();
    private final AtomicReference<String> saved = new AtomicReference<>();

    @Before public void start() throws Exception {
        certificate = new HeldCertificate.Builder().commonName("PHOENIX test").addSubjectAlternativeName("localhost").build();
        remote = new MockWebServer();
        // PHOENIX's Node TLS listener speaks HTTP/1.1. MockWebServer's chunked-body
        // helper stores literal HTTP/1 chunks, which are not an HTTP/2 fixture.
        remote.setProtocols(java.util.List.of(okhttp3.Protocol.HTTP_1_1));
        remote.useHttps(new HandshakeCertificates.Builder().heldCertificate(certificate).build().sslSocketFactory(), false);
        remote.start();
        identity = new GatewayIdentity(remote.url("/").toString(), fingerprint(certificate), "TEST-CODE");
        tls = new GatewayTls(identity.pin);
        gateway = new LoopbackGateway(identity, tls, "phoenix_session=remote-test", saved::set);
        gateway.start(10000, true);
    }

    @After public void stop() throws Exception {
        gateway.close(); remote.shutdown();
        browser.connectionPool().evictAll(); browser.dispatcher().executorService().shutdownNow();
    }

    private Request.Builder local(String path) {
        return new Request.Builder().url(gateway.origin().replaceFirst("/$", "") + path)
                .header("Cookie", gateway.capabilityCookie().split(";", 2)[0]);
    }

    @Test public void qrIdentityIsStrictAndNeverAcceptsCleartextOrUnknownFields() {
        String link = "phoenix-gateway://connect?origin=" + java.net.URLEncoder.encode(identity.server.origin(), StandardCharsets.UTF_8)
                + "&pin=" + identity.pin + "&code=TEST-CODE";
        assertEquals(identity.key(), GatewayIdentity.parse(link).key());
        assertThrows(IllegalArgumentException.class, () -> GatewayIdentity.parse(link + "&extra=yes"));
        assertThrows(IllegalArgumentException.class, () -> GatewayIdentity.parse(link + "&pin=" + identity.pin));
        assertThrows(IllegalArgumentException.class, () -> new GatewayIdentity("http://127.0.0.1:1234", identity.pin, ""));
        assertThrows(IllegalArgumentException.class, () -> new GatewayIdentity(identity.server.origin(), "bad", ""));
    }

    @Test public void forwardsFullUnicodeBodyAndRawQueryWithoutLeakingLocalCookie() throws Exception {
        String body = "{\"text\":\"Tea squirrel ☕ 日本語\"}";
        remote.enqueue(new MockResponse().setResponseCode(201).setHeader("Content-Type", "application/json")
                .setHeader("Set-Cookie", "phoenix_session=new-test; HttpOnly; Secure; Path=/").setBody(body));
        try (var response = browser.newCall(local("/api/test%2Fpath?name=tea%20squirrel&x=%2B")
                .header("Origin", gateway.origin().replaceFirst("/$", ""))
                .header("X-Forwarded-For", "127.0.0.1")
                .post(RequestBody.create(body.getBytes(StandardCharsets.UTF_8), okhttp3.MediaType.get("application/json"))).build()).execute()) {
            assertEquals(201, response.code()); assertEquals(body, response.body().string());
            assertNull(response.header("Set-Cookie"));
        }
        RecordedRequest request = remote.takeRequest(1, TimeUnit.SECONDS);
        assertNotNull(request);
        assertEquals("/api/test%2Fpath?name=tea%20squirrel&x=%2B", request.getPath());
        assertEquals(body, request.getBody().readUtf8());
        assertEquals("phoenix_session=remote-test", request.getHeader("Cookie"));
        assertNull(request.getHeader("X-Forwarded-For"));
        assertEquals(identity.server.origin().replaceFirst("/$", ""), request.getHeader("Origin"));
        assertEquals("phoenix_session=new-test", saved.get());
    }

    @Test public void rejectsMissingCapabilityForeignHostAndForeignOrigin() throws Exception {
        try (var response = browser.newCall(local("/").removeHeader("Cookie").build()).execute()) { assertEquals(401, response.code()); }
        try (var response = browser.newCall(local("/").header("Host", "evil.example").build()).execute()) { assertEquals(403, response.code()); }
        try (var response = browser.newCall(local("/").header("Origin", "https://evil.example").build()).execute()) { assertEquals(403, response.code()); }
        assertEquals(0, remote.getRequestCount());
    }

    @Test public void rejectsOversizedBodiesAndPortCollision() throws Exception {
        try (var response = browser.newCall(local("/api/test").post(RequestBody.create(new byte[65537], null)).build()).execute()) {
            assertEquals(413, response.code());
        }
        LoopbackGateway collision = new LoopbackGateway(identity, tls, "", ignored -> {});
        try { assertThrows(IOException.class, () -> collision.start()); } finally { collision.close(); }
        assertEquals(0, remote.getRequestCount());
    }

    @Test public void keepsHttpErrorsAndRewritesOnlySameOriginRedirects() throws Exception {
        remote.enqueue(new MockResponse().setResponseCode(403).setBody("not allowed"));
        try (var response = browser.newCall(local("/api/test").build()).execute()) {
            assertEquals(403, response.code()); assertEquals("not allowed", response.body().string());
        }
        remote.enqueue(new MockResponse().setResponseCode(307).setHeader("Location", remote.url("/next?q=1")));
        OkHttpClient noRedirect = browser.newBuilder().followRedirects(false).build();
        try (var response = noRedirect.newCall(local("/redirect").build()).execute()) {
            assertEquals(307, response.code()); assertEquals(gateway.origin() + "next?q=1", response.header("Location"));
        }
    }

    @Test public void recoversOneReadFailureBeforeHeadersButDoesNotReplayAnEffect() throws Exception {
        remote.enqueue(new MockResponse().setSocketPolicy(SocketPolicy.DISCONNECT_AFTER_REQUEST));
        remote.enqueue(new MockResponse().setBody("recovered asset"));
        try (var response = browser.newCall(local("/assets/fixture.js").build()).execute()) {
            assertEquals(200, response.code());
            assertEquals("recovered asset", response.body().string());
        }
        assertEquals(2, remote.getRequestCount());
        remote.enqueue(new MockResponse().setSocketPolicy(SocketPolicy.DISCONNECT_AFTER_REQUEST));
        remote.enqueue(new MockResponse().setBody("must not replay"));
        try (var response = browser.newCall(local("/api/effect").post(RequestBody.create("{}", null)).build()).execute()) {
            assertEquals(502, response.code());
        }
        assertEquals(3, remote.getRequestCount());
    }

    @Test public void neverRestartsAnInterruptedBodyAfterHeaders() throws Exception {
        remote.enqueue(new MockResponse().setBody("x".repeat(32768))
                .setSocketPolicy(SocketPolicy.DISCONNECT_DURING_RESPONSE_BODY));
        remote.enqueue(new MockResponse().setBody("must not restart"));
        try (var response = browser.newCall(local("/api/stream").build()).execute()) {
            assertEquals(200, response.code());
            assertThrows(IOException.class, () -> response.body().string());
        }
        assertEquals(1, remote.getRequestCount());
    }

    @Test public void correctPinDoesNotBypassHostnameAndWrongPinIsRejected() throws Exception {
        remote.enqueue(new MockResponse().setBody("ok"));
        var connection = tls.open(URI.create(identity.server.origin()));
        try { assertEquals(200, connection.getResponseCode()); } finally { connection.disconnect(); }
        GatewayTls wrong = new GatewayTls("0".repeat(64));
        assertThrows(IOException.class, () -> {
            var c = wrong.open(URI.create(identity.server.origin()));
            try { c.getResponseCode(); } finally { c.disconnect(); }
        });
        assertThrows(IOException.class, () -> {
            var c = tls.open(URI.create(identity.server.origin().replace("localhost", "127.0.0.1")));
            try { c.getResponseCode(); } finally { c.disconnect(); }
        });
    }

    @Test public void cancellationBeforeHeadersReleasesTheUpstreamImmediately() throws Exception {
        remote.enqueue(new MockResponse().setHeadersDelay(4, TimeUnit.SECONDS).setBody("late"));
        try (Socket socket = new Socket("127.0.0.1", LoopbackGateway.PORT)) {
            socket.getOutputStream().write(("GET /slow HTTP/1.1\r\nHost: 127.0.0.1:" + LoopbackGateway.PORT
                    + "\r\nCookie: " + gateway.capabilityCookie().split(";", 2)[0] + "\r\n\r\n").getBytes(StandardCharsets.US_ASCII));
            assertNotNull(remote.takeRequest(2, TimeUnit.SECONDS));
        }
        waitForIdle();
    }

    @Test public void reconnectsAfterDesktopTransportRestartsWithTheSameIdentity() throws Exception {
        remote.enqueue(new MockResponse().setBody("before"));
        try (var response = browser.newCall(local("/api/test").build()).execute()) { assertEquals("before", response.body().string()); }
        int port = remote.getPort();
        remote.shutdown();
        try (var response = browser.newCall(local("/api/test").build()).execute()) { assertEquals(502, response.code()); }
        remote = new MockWebServer();
        remote.setProtocols(java.util.List.of(okhttp3.Protocol.HTTP_1_1));
        remote.useHttps(new HandshakeCertificates.Builder().heldCertificate(certificate).build().sslSocketFactory(), false);
        remote.start(port);
        remote.enqueue(new MockResponse().setBody("after"));
        try (var response = browser.newCall(local("/api/test").build()).execute()) { assertEquals("after", response.body().string()); }
    }

    @Test public void evenTheCorrectPinRejectsExpiredCertificates() throws Exception {
        long now = System.currentTimeMillis();
        HeldCertificate expired = new HeldCertificate.Builder().commonName("Expired PHOENIX test")
                .addSubjectAlternativeName("localhost").validityInterval(now - 172800000, now - 86400000).build();
        try (MockWebServer other = new MockWebServer()) {
            other.useHttps(new HandshakeCertificates.Builder().heldCertificate(expired).build().sslSocketFactory(), false);
            other.start();
            GatewayTls expiredTls = new GatewayTls(fingerprint(expired));
            assertThrows(IOException.class, () -> {
                var connection = expiredTls.open(URI.create(other.url("/").toString()));
                try { connection.getResponseCode(); } finally { connection.disconnect(); }
            });
        }
    }

    @Test public void streamsFirstBytesAndCancelsIdleSse() throws Exception {
        // MockWebServer buffers small throttled writes. Fill its 8 KiB output
        // buffer so the first event actually reaches the socket before the idle gap.
        remote.enqueue(new MockResponse().setHeader("Content-Type", "text/event-stream")
                .setBody("data: first\n\n" + " ".repeat(8192) + "data: later\n\n").throttleBody(8192, 4, TimeUnit.SECONDS));
        long start = System.nanoTime();
        var call = browser.newCall(local("/events").build());
        try (var response = call.execute()) {
            assertEquals("data: first\n\n", new String(response.body().byteStream().readNBytes(13), StandardCharsets.UTF_8));
            assertTrue(TimeUnit.NANOSECONDS.toMillis(System.nanoTime() - start) < 2000);
            call.cancel();
        }
        waitForIdle();
    }

    private void waitForIdle() throws Exception {
        long deadline = System.nanoTime() + TimeUnit.SECONDS.toNanos(2);
        while (gateway.activeRequestCount() != 0 && System.nanoTime() < deadline) Thread.sleep(10);
        assertEquals(0, gateway.activeRequestCount());
    }

    private static String fingerprint(HeldCertificate certificate) throws Exception {
        StringBuilder result = new StringBuilder();
        for (byte value : MessageDigest.getInstance("SHA-256").digest(certificate.certificate().getEncoded())) result.append(String.format("%02x", value & 255));
        return result.toString();
    }
}
