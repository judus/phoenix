package io.github.judus.phoenix;

import java.io.IOException;
import java.net.InetAddress;
import java.util.concurrent.TimeUnit;
import okhttp3.mockwebserver.MockResponse;
import okhttp3.mockwebserver.MockWebServer;
import okhttp3.mockwebserver.RecordedRequest;
import org.json.JSONObject;
import org.junit.After;
import org.junit.Before;
import org.junit.Test;
import static org.junit.Assert.*;

/** Real HTTP boundary: no mocked URLConnection, CookieManager or production schema relaxation. */
public class PairingClientTest {
    private MockWebServer server;
    private ServerAddress address;
    private final PairingClient client = new PairingClient();

    @Before public void start() throws IOException {
        server = new MockWebServer();
        server.start(InetAddress.getByName("127.0.0.1"), 0);
        address = ServerAddress.parse("http://127.0.0.1:" + server.getPort());
    }
    @After public void stop() throws IOException { server.shutdown(); }

    @Test public void reusesAnAuthorizedSessionWithoutClaimingAgain() throws Exception {
        reply(200, "{\"authenticated\":true}");
        assertNull(client.authorize(address, "", "phoenix_session=existing"));
        RecordedRequest status = request();
        assertEquals("GET", status.getMethod());
        assertEquals("/api/pairing/status", status.getPath());
        assertEquals("phoenix_session=existing", status.getHeader("Cookie"));
        assertEquals(1, server.getRequestCount());
    }

    @Test public void claimsWithJsonCodeAndReturnsOriginalHttpOnlyCookie() throws Exception {
        unauthenticated();
        String cookie = "phoenix_session=test-token; HttpOnly; SameSite=Strict; Path=/; Max-Age=31536000";
        server.enqueue(new MockResponse().setBody("{\"authenticated\":true}").addHeader("Set-Cookie", cookie));
        assertEquals(cookie, client.authorize(address, "ABCDE-12345", null));
        request();
        RecordedRequest claim = request();
        assertEquals("/api/pairing/claim", claim.getPath());
        assertEquals("POST", claim.getMethod());
        assertTrue(claim.getHeader("Content-Type").startsWith("application/json"));
        assertEquals("ABCDE-12345", new JSONObject(claim.getBody().readUtf8()).getString("code"));
    }

    @Test public void missingCodeDoesNotSendAClaim() {
        unauthenticated();
        PairingClient.Rejected failure = assertThrows(PairingClient.Rejected.class, () -> client.authorize(address, "", null));
        assertTrue(failure.getMessage().contains("Enter the pairing code"));
        assertEquals(1, server.getRequestCount());
    }

    @Test public void invalidCodeAndRateLimitHaveActionableMessages() {
        unauthenticated();
        reply(401, "{}");
        assertTrue(assertThrows(PairingClient.Rejected.class, () -> client.authorize(address, "wrong", null)).getMessage().contains("invalid"));
        unauthenticated();
        reply(429, "{}");
        assertTrue(assertThrows(PairingClient.Rejected.class, () -> client.authorize(address, "wrong", null)).getMessage().contains("Wait"));
    }

    @Test public void refusesRedirectsWithoutSendingCodesToRedirectTarget() throws IOException {
        unauthenticated();
        server.enqueue(new MockResponse().setResponseCode(307).addHeader("Location", server.url("/other")));
        reply(200, "{\"authenticated\":true}");
        assertThrows(PairingClient.Rejected.class, () -> client.authorize(address, "code", null));
        assertEquals(2, server.getRequestCount());
    }

    @Test public void rejectsMissingCookieAndFalseAuthorizationOnClaim() {
        unauthenticated();
        reply(200, "{\"authenticated\":true}");
        assertThrows(PairingClient.Rejected.class, () -> client.authorize(address, "code", null));
        unauthenticated();
        server.enqueue(new MockResponse().setBody("{\"authenticated\":false}").addHeader("Set-Cookie", "phoenix_session=unused"));
        assertThrows(PairingClient.Rejected.class, () -> client.authorize(address, "code", null));
    }

    @Test public void rejectsNonPhoenixAndOversizedResponses() {
        String[] responses = {"<html>Not PHOENIX</html>", "{}", "{\"authenticated\":\"true\"}", "x".repeat(8193)};
        for (String body : responses) {
            reply(200, body);
            assertThrows(PairingClient.Rejected.class, () -> client.authorize(address, "code", null));
        }
    }

    private void unauthenticated() { reply(200, "{\"authenticated\":false}"); }
    private void reply(int status, String body) { server.enqueue(new MockResponse().setResponseCode(status).setBody(body)); }
    private RecordedRequest request() throws InterruptedException {
        RecordedRequest request = server.takeRequest(1, TimeUnit.SECONDS);
        assertNotNull("Expected a pairing request", request);
        return request;
    }
}
