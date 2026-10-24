package io.github.judus.phoenix;

import java.io.IOException;
import java.io.InterruptedIOException;
import java.lang.reflect.Proxy;
import java.net.ProtocolException;
import java.net.SocketTimeoutException;
import java.security.cert.CertificateException;
import java.util.concurrent.atomic.AtomicInteger;
import javax.net.ssl.SSLHandshakeException;
import javax.net.ssl.SSLPeerUnverifiedException;
import okhttp3.Call;
import okhttp3.Interceptor;
import okhttp3.OkHttpClient;
import okhttp3.Request;
import okhttp3.RequestBody;
import okhttp3.Response;
import org.junit.Test;
import static org.junit.Assert.*;

public class GatewayRecoveryTest {
    @Test public void trustProtocolAndThreadCancellationFailuresNeverRetry() {
        for (IOException failure : new IOException[] {
                new SSLHandshakeException("certificate rejected"), new SSLPeerUnverifiedException("wrong host"),
                new IOException(new CertificateException("expired")), new ProtocolException("bad framing"),
                new InterruptedIOException("interrupted") }) {
            AtomicInteger attempts = new AtomicInteger();
            Interceptor.Chain chain = chain("GET", attempts, failure, false);
            assertSame(failure, assertThrows(IOException.class, () -> new GatewayRecovery().intercept(chain)));
            assertEquals(1, attempts.get());
        }
    }

    @Test public void retriesAtMostOnceForReadsAndNeverForActions() {
        for (String method : new String[] { "GET", "HEAD", "POST", "PUT", "DELETE", "PATCH" }) {
            AtomicInteger attempts = new AtomicInteger();
            IOException failure = new SocketTimeoutException("connect timeout");
            Interceptor.Chain chain = chain(method, attempts, failure, false);
            assertSame(failure, assertThrows(IOException.class, () -> new GatewayRecovery().intercept(chain)));
            assertEquals(method.equals("GET") || method.equals("HEAD") ? 2 : 1, attempts.get());
        }
    }

    @Test public void cancellationAfterFailedAttemptPreventsTheSecond() {
        AtomicInteger attempts = new AtomicInteger();
        Interceptor.Chain chain = chain("GET", attempts, new IOException("closed"), true);
        assertThrows(IOException.class, () -> new GatewayRecovery().intercept(chain));
        assertEquals(1, attempts.get());
    }

    private Interceptor.Chain chain(String method, AtomicInteger attempts, IOException failure, boolean cancel) {
        Request request = new Request.Builder().url("https://localhost/fixture")
                .method(method, method.equals("GET") || method.equals("HEAD") ? null : RequestBody.create(new byte[0], null)).build();
        Call call = new OkHttpClient().newCall(request);
        return (Interceptor.Chain) Proxy.newProxyInstance(Interceptor.Chain.class.getClassLoader(),
                new Class<?>[] { Interceptor.Chain.class }, (proxy, operation, arguments) -> {
                    switch (operation.getName()) {
                        case "request": return request;
                        case "call": return call;
                        case "proceed":
                            attempts.incrementAndGet();
                            if (cancel) call.cancel();
                            throw failure;
                        default: throw new AssertionError("Unexpected chain operation: " + operation.getName());
                    }
                });
    }
}
