package io.github.judus.phoenix;

import java.io.IOException;

/** Activity-owned bind/publication/destruction; authorization runs outside this lock. */
final class GatewayLifecycle implements AutoCloseable {
    private boolean destroyed;
    private LoopbackGateway current;

    synchronized boolean start(LoopbackGateway prepared) throws IOException {
        if (destroyed) { prepared.close(); return false; }
        if (current != null) throw new IllegalStateException("Gateway already started.");
        prepared.start(10000, true);
        current = prepared;
        return true;
    }

    synchronized boolean owns(LoopbackGateway gateway) { return !destroyed && current == gateway; }

    synchronized void disconnect() {
        if (current != null) { current.close(); current = null; }
    }

    @Override public synchronized void close() {
        destroyed = true;
        disconnect();
    }
}
