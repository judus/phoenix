package io.github.judus.phoenix;

import java.io.IOException;
import java.net.ServerSocket;
import java.util.concurrent.TimeUnit;
import okhttp3.OkHttpClient;
import okhttp3.Request;
import okhttp3.mockwebserver.MockResponse;
import okhttp3.mockwebserver.MockWebServer;
import okhttp3.tls.HandshakeCertificates;
import okhttp3.tls.HeldCertificate;
import org.junit.Test;
import static org.junit.Assert.*;

public class GatewayDeadlineTest {
    private static void close(OkHttpClient client) {
        client.connectionPool().evictAll();
        client.dispatcher().executorService().shutdownNow();
    }

    @Test public void connectedSilentTlsPeerIsCanceledWithinHeaderBudget() throws Exception {
        try (ServerSocket silent = new ServerSocket(0)) {
            OkHttpClient client = new GatewayTls("0".repeat(64)).client(300);
            var worker = java.util.concurrent.Executors.newSingleThreadExecutor();
            try {
                var result = worker.submit(() -> assertThrows(IOException.class, () -> client.newCall(new Request.Builder()
                        .url("https://localhost:" + silent.getLocalPort()).build()).execute()));
                silent.setSoTimeout(2000);
                try (var connected = silent.accept()) {
                    assertTrue(connected.isConnected());
                    assertNotNull(result.get(2, TimeUnit.SECONDS));
                }
            } finally { close(client); worker.shutdownNow(); }
        }
    }

    @Test public void defaultBudgetAllowsSlowActionToWaitBeyondTenSeconds() throws Exception {
        HeldCertificate cert = new HeldCertificate.Builder().addSubjectAlternativeName("localhost").build();
        StringBuilder pin = new StringBuilder();
        for (byte value : java.security.MessageDigest.getInstance("SHA-256").digest(cert.certificate().getEncoded())) pin.append(String.format("%02x", value & 255));
        try (MockWebServer remote = new MockWebServer()) {
            remote.useHttps(new HandshakeCertificates.Builder().heldCertificate(cert).build().sslSocketFactory(), false);
            remote.start();
            remote.enqueue(new MockResponse().setHeadersDelay(11, TimeUnit.SECONDS).setBody("valid action result"));
            OkHttpClient client = new GatewayTls(pin.toString()).client();
            var worker = java.util.concurrent.Executors.newSingleThreadExecutor();
            try {
                var result = worker.submit(() -> {
                    try (var response = client.newCall(new Request.Builder().url(remote.url("/api/navigation/destination")).post(okhttp3.RequestBody.create("{}", null)).build()).execute()) {
                        assertEquals(200, response.code());
                        return response.body().string();
                    }
                });
                assertEquals("valid action result", result.get(15, TimeUnit.SECONDS));
                assertEquals(1, remote.getRequestCount());
                assertEquals("POST", remote.takeRequest(1, TimeUnit.SECONDS).getMethod());
            } finally { close(client); worker.shutdownNow(); }
        }
    }

    @Test public void stalledHeadersExpireButEstablishedIdleBodySurvivesTheSameBudget() throws Exception {
        HeldCertificate cert = new HeldCertificate.Builder().addSubjectAlternativeName("localhost").build();
        StringBuilder pin = new StringBuilder();
        for (byte value : java.security.MessageDigest.getInstance("SHA-256").digest(cert.certificate().getEncoded())) pin.append(String.format("%02x", value & 255));
        try (MockWebServer remote = new MockWebServer()) {
            remote.useHttps(new HandshakeCertificates.Builder().heldCertificate(cert).build().sslSocketFactory(), false);
            remote.start();
            OkHttpClient client = new GatewayTls(pin.toString()).client(500);
            try {
                remote.enqueue(new MockResponse().setHeadersDelay(1500, TimeUnit.MILLISECONDS).setBody("late"));
                var worker = java.util.concurrent.Executors.newSingleThreadExecutor();
                try {
                    var result = worker.submit(() -> assertThrows(IOException.class, () -> client.newCall(new Request.Builder().url(remote.url("/stalled")).build()).execute()));
                    assertNotNull(remote.takeRequest(2, TimeUnit.SECONDS));
                    assertNotNull(result.get(2, TimeUnit.SECONDS));
                    assertEquals(1, remote.getRequestCount());
                } finally { worker.shutdownNow(); }
                remote.enqueue(new MockResponse().setHeader("Content-Type", "text/event-stream")
                        .setBody("data: survived\n\n").setBodyDelay(1200, TimeUnit.MILLISECONDS));
                try (var response = client.newCall(new Request.Builder().url(remote.url("/idle")).build()).execute()) {
                    assertEquals(200, response.code());
                    assertEquals("data: survived\n\n", response.body().string());
                }
                assertEquals(2, remote.getRequestCount());
            } finally { close(client); }
        }
    }
}
