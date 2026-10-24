package io.github.judus.phoenix;

import java.net.ServerSocket;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;
import org.junit.Test;
import static org.junit.Assert.*;

public class GatewayLifecycleTest {
    private LoopbackGateway prepared() throws Exception {
        String pin = "0".repeat(64);
        return new LoopbackGateway(new GatewayIdentity("https://localhost:8443", pin, ""),
                new GatewayTls(pin), "", ignored -> {});
    }

    @Test public void destroyedOwnerNeverBindsAfterDelayedAuthorizationReturns() throws Exception {
        GatewayLifecycle lifecycle = new GatewayLifecycle();
        CountDownLatch authorizing = new CountDownLatch(1);
        CountDownLatch authorized = new CountDownLatch(1);
        var worker = java.util.concurrent.Executors.newSingleThreadExecutor();
        try {
            var result = worker.submit(() -> {
                authorizing.countDown();
                assertTrue(authorized.await(2, TimeUnit.SECONDS));
                LoopbackGateway gateway = prepared();
                assertFalse(lifecycle.start(gateway));
                assertFalse(lifecycle.owns(gateway));
                return null;
            });
            assertTrue(authorizing.await(2, TimeUnit.SECONDS));
            lifecycle.close();
            // A late start would fail on this occupied port, even if immediately closed.
            try (ServerSocket occupied = new ServerSocket(LoopbackGateway.PORT, 1, java.net.InetAddress.getByName("127.0.0.1"))) {
                authorized.countDown();
                result.get(3, TimeUnit.SECONDS);
                assertTrue(occupied.isBound());
            }
        } finally { authorized.countDown(); lifecycle.close(); worker.shutdownNow(); }
    }

    @Test public void destructionClosesPublishedListenerAndDisallowsRestart() throws Exception {
        GatewayLifecycle lifecycle = new GatewayLifecycle();
        LoopbackGateway gateway = prepared();
        try {
            assertTrue(lifecycle.start(gateway));
            assertTrue(lifecycle.owns(gateway));
            lifecycle.close();
            assertFalse(lifecycle.owns(gateway));
            assertFalse(lifecycle.start(prepared()));
            try (ServerSocket released = new ServerSocket(LoopbackGateway.PORT, 1, java.net.InetAddress.getByName("127.0.0.1"))) {
                assertTrue(released.isBound());
            }
        } finally { lifecycle.close(); }
    }
}
