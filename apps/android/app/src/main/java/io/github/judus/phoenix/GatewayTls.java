package io.github.judus.phoenix;

import java.io.IOException;
import java.net.URI;
import java.security.GeneralSecurityException;
import java.security.MessageDigest;
import java.security.cert.CertificateException;
import java.security.cert.X509Certificate;
import javax.net.ssl.HttpsURLConnection;
import javax.net.ssl.SSLContext;
import javax.net.ssl.X509TrustManager;
import okhttp3.OkHttpClient;

/** Private per-connection trust: exact QR certificate pin AND normal hostname verification. */
final class GatewayTls {
    private final SSLContext context;
    private final X509TrustManager trust;

    GatewayTls(String pin) throws IOException {
        byte[] expected = new byte[32];
        if (!pin.matches("[a-fA-F0-9]{64}")) throw new IllegalArgumentException("Invalid certificate fingerprint.");
        for (int i = 0; i < expected.length; i++) expected[i] = (byte) Integer.parseInt(pin.substring(i * 2, i * 2 + 2), 16);
        trust = new X509TrustManager() {
            @Override public X509Certificate[] getAcceptedIssuers() { return new X509Certificate[0]; }
            @Override public void checkClientTrusted(X509Certificate[] chain, String type) throws CertificateException {
                throw new CertificateException("Client certificates are not supported.");
            }
            @Override public void checkServerTrusted(X509Certificate[] chain, String type) throws CertificateException {
                if (chain == null || chain.length == 0) throw new CertificateException("Missing server certificate.");
                chain[0].checkValidity();
                try {
                    byte[] actual = MessageDigest.getInstance("SHA-256").digest(chain[0].getEncoded());
                    if (!MessageDigest.isEqual(expected, actual)) throw new CertificateException("PHOENIX certificate changed. Rescan the computer's QR.");
                } catch (java.security.NoSuchAlgorithmException impossible) { throw new CertificateException(impossible); }
            }
        };
        try {
            context = SSLContext.getInstance("TLS");
            context.init(null, new X509TrustManager[] { trust }, null);
        } catch (GeneralSecurityException failure) { throw new IOException("Cannot initialize native TLS.", failure); }
    }

    HttpsURLConnection open(URI uri) throws IOException {
        if (!"https".equals(uri.getScheme())) throw new IOException("Gateway requires HTTPS.");
        HttpsURLConnection connection = (HttpsURLConnection) uri.toURL().openConnection();
        connection.setSSLSocketFactory(context.getSocketFactory());
        // Do not replace the platform's hostname verifier, or any global trust settings.
        return connection;
    }

    // Non-streaming handlers include Spansh (30s), macros/tools (60s) and provider
    // work (90s). Leave network/serialization headroom without an unbounded wait.
    OkHttpClient client() { return client(120000); }

    OkHttpClient client(long headerDeadlineMilliseconds) {
        return new OkHttpClient.Builder().sslSocketFactory(context.getSocketFactory(), trust)
                .followRedirects(false).followSslRedirects(false).retryOnConnectionFailure(false)
                .addInterceptor(new GatewayHeaderDeadline(headerDeadlineMilliseconds))
                .addInterceptor(new GatewayResponsePolicy())
                .addInterceptor(new GatewayRecovery())
                .addNetworkInterceptor(GatewayResponsePolicy.NETWORK)
                .connectTimeout(5, java.util.concurrent.TimeUnit.SECONDS)
                .readTimeout(0, java.util.concurrent.TimeUnit.SECONDS).build();
    }
}
