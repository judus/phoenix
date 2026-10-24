package io.github.judus.phoenix;

import java.io.IOException;
import java.util.concurrent.ScheduledThreadPoolExecutor;
import java.util.concurrent.TimeUnit;
import okhttp3.Interceptor;
import okhttp3.Response;

/** Total connect/TLS/request/header budget, removed before any response body/SSE read. */
final class GatewayHeaderDeadline implements Interceptor {
    private static final ScheduledThreadPoolExecutor TIMER = new ScheduledThreadPoolExecutor(1, task -> {
        Thread thread = new Thread(task, "PHOENIX header deadline");
        thread.setDaemon(true);
        return thread;
    });
    static { TIMER.setRemoveOnCancelPolicy(true); }
    private final long milliseconds;

    GatewayHeaderDeadline(long milliseconds) {
        if (milliseconds <= 0) throw new IllegalArgumentException("Header deadline must be positive.");
        this.milliseconds = milliseconds;
    }

    @Override public Response intercept(Chain chain) throws IOException {
        // Serialize expiration with header completion so an already dequeued timer
        // cannot cancel a healthy body after this interceptor has returned.
        Object lock = new Object();
        boolean[] waiting = { true };
        var deadline = TIMER.schedule(() -> {
            synchronized (lock) { if (waiting[0]) chain.call().cancel(); }
        }, milliseconds, TimeUnit.MILLISECONDS);
        try { return chain.proceed(chain.request()); }
        finally {
            synchronized (lock) { waiting[0] = false; deadline.cancel(false); }
        }
    }
}
