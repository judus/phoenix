package io.github.judus.phoenix;

import java.io.IOException;
import java.io.InterruptedIOException;
import java.net.ProtocolException;
import java.net.SocketTimeoutException;
import java.security.cert.CertificateException;
import javax.net.ssl.SSLException;
import okhttp3.Interceptor;
import okhttp3.Response;

/** At most one new attempt for a read that failed before any response headers. */
final class GatewayRecovery implements Interceptor {
    @Override public Response intercept(Chain chain) throws IOException {
        try {
            return chain.proceed(chain.request());
        } catch (IOException failure) {
            String method = chain.request().method();
            if (!(method.equals("GET") || method.equals("HEAD"))
                    || chain.call().isCanceled() || Thread.currentThread().isInterrupted()
                    || !recoverable(failure)) throw failure;
            // The same Call owns both attempts: local EOF/Activity shutdown cancels
            // either one. Body/SSE reads happen after this method returns and are
            // never replayed, nor are HTTP error responses.
            return chain.proceed(chain.request());
        }
    }

    private static boolean recoverable(IOException failure) {
        for (Throwable cause = failure; cause != null; cause = cause.getCause()) {
            if (cause instanceof SSLException || cause instanceof CertificateException
                    || cause instanceof ProtocolException
                    || (cause instanceof InterruptedIOException && !(cause instanceof SocketTimeoutException))) {
                return false;
            }
        }
        return true;
    }
}
