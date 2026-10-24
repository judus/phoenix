package io.github.judus.phoenix;

import java.io.IOException;
import java.util.List;
import okhttp3.Interceptor;
import okhttp3.Response;

/** OkHttp 4.12 has no switch for 503 response follow-ups (even for POST). */
final class GatewayResponsePolicy implements Interceptor {
    private static final class OriginalHeaders { List<String> retryAfter; }

    @Override public Response intercept(Chain chain) throws IOException {
        OriginalHeaders original = new OriginalHeaders();
        Response response = chain.proceed(chain.request().newBuilder().tag(OriginalHeaders.class, original).build());
        if (original.retryAfter == null) return response;
        Response.Builder restored = response.newBuilder().removeHeader("Retry-After");
        for (String value : original.retryAfter) restored.addHeader("Retry-After", value);
        return restored.build();
    }

    static final Interceptor NETWORK = chain -> {
        Response response = chain.proceed(chain.request());
        if (response.code() != 503) return response;
        OriginalHeaders original = chain.request().tag(OriginalHeaders.class);
        if (original == null) throw new IllegalStateException("Missing gateway response policy.");
        original.retryAfter = response.headers("Retry-After");
        // Only the library's internal decision sees this value. The outer interceptor
        // restores the original Retry-After values before returning to the gateway/caller.
        return response.newBuilder().header("Retry-After", "1").build();
    };
}
