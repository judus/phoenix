package io.github.judus.phoenix;

import fi.iki.elonen.NanoHTTPD;
import java.io.ByteArrayOutputStream;
import java.io.FilterInputStream;
import java.io.IOException;
import java.io.InputStream;
import java.net.Socket;
import java.net.URI;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.SecureRandom;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.SynchronousQueue;
import java.util.concurrent.ThreadPoolExecutor;
import java.util.concurrent.TimeUnit;
import java.util.function.Consumer;
import okhttp3.Call;
import okhttp3.OkHttpClient;
import okhttp3.Request;
import okhttp3.RequestBody;

/** Experimental HTTP loopback -> pinned TLS bridge. No JavaScript/native bridge or TLS bypass. */
final class LoopbackGateway extends NanoHTTPD implements AutoCloseable {
    static final int PORT = 43184;
    private static final Set<String> HOP_HEADERS = Set.of("host", "connection", "keep-alive", "transfer-encoding",
            "te", "trailer", "upgrade", "proxy-authorization", "proxy-authenticate", "content-length",
            "cookie", "set-cookie", "origin", "referer", "remote-addr", "http-client-ip", "x-forwarded-for");
    private final GatewayIdentity identity;
    private final OkHttpClient upstream;
    private final Consumer<String> saveSession;
    private volatile String sessionCookie;
    private volatile boolean closed;
    private final String capability;
    private final Set<Call> calls = ConcurrentHashMap.newKeySet();
    private final Set<ClientHandler> clients = ConcurrentHashMap.newKeySet();
    private final ExecutorService workers = pool("PHOENIX gateway");
    private final ExecutorService watchers = pool("PHOENIX cancel");
    private final ThreadLocal<Client> current = new ThreadLocal<>();

    LoopbackGateway(GatewayIdentity identity, GatewayTls tls, String sessionCookie, Consumer<String> saveSession) {
        super("127.0.0.1", PORT);
        this.identity = identity;
        this.upstream = tls.client();
        this.sessionCookie = sessionCookie;
        this.saveSession = saveSession;
        byte[] random = new byte[32];
        new SecureRandom().nextBytes(random);
        capability = java.util.Base64.getUrlEncoder().withoutPadding().encodeToString(random);
        setAsyncRunner(new AsyncRunner() {
            @Override public void closeAll() { for (ClientHandler client : clients) client.close(); }
            @Override public void closed(ClientHandler client) { clients.remove(client); }
            @Override public void exec(ClientHandler client) {
                clients.add(client);
                try { workers.execute(client); }
                catch (java.util.concurrent.RejectedExecutionException overloaded) { client.close(); clients.remove(client); }
            }
        });
    }

    String origin() { return "http://127.0.0.1:" + PORT + "/"; }
    String capabilityCookie() { return "phoenix_gateway=" + capability + "; Path=/; HttpOnly; SameSite=Strict"; }
    int activeRequestCount() { return calls.size(); }

    private static ExecutorService pool(String name) {
        return new ThreadPoolExecutor(0, 24, 30, TimeUnit.SECONDS, new SynchronousQueue<>(), runnable -> {
            Thread thread = new Thread(runnable, name);
            thread.setDaemon(true);
            return thread;
        });
    }

    @Override protected ClientHandler createClientHandler(Socket socket, InputStream input) {
        Client client = new Client(socket, input);
        return new ClientHandler(client.input, socket) {
            @Override public void run() {
                current.set(client);
                try { super.run(); } finally { current.remove(); }
            }
        };
    }

    @Override public Response serve(IHTTPSession local) {
        Call call = null;
        try {
            var headers = local.getHeaders();
            if (!("127.0.0.1:" + PORT).equals(headers.get("host"))) return reject(Response.Status.FORBIDDEN);
            String origin = headers.get("origin");
            if (origin != null && !origin.equals(origin().substring(0, origin().length() - 1))) return reject(Response.Status.FORBIDDEN);
            String cookie = headers.getOrDefault("cookie", "");
            boolean authorized = false;
            for (String part : cookie.split(";")) {
                authorized |= MessageDigest.isEqual(part.trim().getBytes(StandardCharsets.UTF_8),
                        ("phoenix_gateway=" + capability).getBytes(StandardCharsets.UTF_8));
            }
            if (!authorized) return reject(Response.Status.UNAUTHORIZED);
            if (headers.containsKey("transfer-encoding")) return reject(Response.Status.BAD_REQUEST);
            int length = Integer.parseInt(headers.getOrDefault("content-length", "0"));
            if (length < 0 || length > 65536) return reject(Response.Status.PAYLOAD_TOO_LARGE);
            byte[] body = new byte[length];
            int offset = 0;
            while (offset < length) {
                int count = local.getInputStream().read(body, offset, length - offset);
                if (count < 0) return reject(Response.Status.BAD_REQUEST);
                offset += count;
            }
            Client client = current.get();
            String[] line = client.line.toString(StandardCharsets.US_ASCII.name()).trim().split(" ");
            if (line.length != 3 || !line[1].startsWith("/") || line[1].startsWith("//")) return reject(Response.Status.BAD_REQUEST);
            URI target = URI.create(line[1]);
            if (target.isAbsolute() || target.getRawAuthority() != null || target.getRawFragment() != null) return reject(Response.Status.BAD_REQUEST);
            Request.Builder request = new Request.Builder().url(identity.server.origin().replaceFirst("/$", "") + line[1]);
            for (var entry : headers.entrySet()) {
                String name = entry.getKey();
                if (!HOP_HEADERS.contains(name) && !name.startsWith("sec-")) request.header(name, entry.getValue());
            }
            // Never forward the local capability cookie, nor client-supplied forwarding identity.
            if (sessionCookie != null && !sessionCookie.isEmpty()) request.header("Cookie", sessionCookie);
            if (origin != null) request.header("Origin", identity.server.origin().replaceFirst("/$", ""));
            String method = local.getMethod().name();
            request.method(method, method.equals("GET") || method.equals("HEAD") ? null : RequestBody.create(body, null));
            call = upstream.newCall(request.build());
            calls.add(call);
            Call active = call;
            // One request per socket. EOF (even before upstream headers) must cancel idle SSE/fetch.
            client.socket.setSoTimeout(0);
            watchers.execute(() -> {
                try { client.socket.getInputStream().read(); } catch (IOException disconnected) { /* closed */ }
                finally { active.cancel(); }
            });
            okhttp3.Response remote = call.execute();
            for (String value : remote.headers("Set-Cookie")) acceptSessionCookie(value);
            InputStream stream = new FilterInputStream(remote.body().byteStream()) {
                @Override public void close() throws IOException {
                    try { super.close(); } finally {
                        remote.close(); active.cancel(); calls.remove(active);
                    }
                }
            };
            int status = remote.code();
            Response.IStatus responseStatus = new Response.IStatus() {
                @Override public int getRequestStatus() { return status; }
                @Override public String getDescription() { return status + " " + remote.message(); }
            };
            Response response = remote.body().contentLength() < 0
                    ? newChunkedResponse(responseStatus, remote.header("Content-Type"), stream)
                    : newFixedLengthResponse(responseStatus, remote.header("Content-Type"), stream, remote.body().contentLength());
            for (String name : remote.headers().names()) {
                String lower = name.toLowerCase(java.util.Locale.ROOT);
                if (HOP_HEADERS.contains(lower) || lower.equals("content-type")) continue;
                String value = remote.header(name);
                if (lower.equals("location") && identity.server.contains(value)) {
                    URI location = URI.create(value);
                    value = origin().replaceFirst("/$", "") + location.getRawPath()
                            + (location.getRawQuery() == null ? "" : "?" + location.getRawQuery())
                            + (location.getRawFragment() == null ? "" : "#" + location.getRawFragment());
                }
                response.addHeader(name, value);
            }
            response.closeConnection(true);
            return response;
        } catch (IOException | IllegalArgumentException | java.util.concurrent.RejectedExecutionException failure) {
            if (call != null) { call.cancel(); calls.remove(call); }
            Response.IStatus badGateway = new Response.IStatus() {
                @Override public int getRequestStatus() { return 502; }
                @Override public String getDescription() { return "502 Bad Gateway"; }
            };
            String diagnostic = BuildConfig.DEBUG ? " (" + failure.getClass().getSimpleName() + ")" : "";
            Response response = newFixedLengthResponse(badGateway, "text/plain", "PHOENIX encrypted connection unavailable. Check the computer or reconnect." + diagnostic);
            response.closeConnection(true);
            return response;
        }
    }

    private synchronized void acceptSessionCookie(String value) {
        if (closed) return;
        String pair = value.split(";", 2)[0];
        if (!pair.startsWith("phoenix_session=")) return;
        sessionCookie = pair.equals("phoenix_session=") ? "" : pair;
        saveSession.accept(sessionCookie);
    }

    @Override protected boolean useGzipWhenAccepted(Response response) { return false; }

    private Response reject(Response.Status status) {
        Response response = newFixedLengthResponse(status, "text/plain", "Gateway request rejected.");
        response.closeConnection(true);
        return response;
    }

    @Override public synchronized void close() {
        if (closed) return;
        closed = true;
        // Release the local port before another Activity can reconnect. Local
        // socket closure also wakes cancellation watchers on their own threads.
        stop();
        workers.shutdownNow(); watchers.shutdownNow();
        Thread cleanup = new Thread(() -> {
            // Conscrypt can send TLS close_notify while closing even an idle
            // socket. Never evict/cancel TLS sockets on Android's UI thread.
            for (Call call : calls) call.cancel();
            upstream.connectionPool().evictAll();
            upstream.dispatcher().executorService().shutdownNow();
        }, "PHOENIX TLS cleanup");
        cleanup.setDaemon(true);
        cleanup.start();
    }

    private static final class Client {
        final Socket socket;
        final ByteArrayOutputStream line = new ByteArrayOutputStream();
        final InputStream input;
        boolean recorded;
        Client(Socket socket, InputStream input) {
            this.socket = socket;
            // Retain only the raw request line; NanoHTTPD owns all HTTP parsing/framing.
            this.input = new FilterInputStream(input) {
                private void record(int value) throws IOException {
                    if (recorded || value < 0) return;
                    if (line.size() >= 8192) throw new IOException("Request line too long.");
                    line.write(value);
                    if (value == '\n') recorded = true;
                }
                @Override public int read() throws IOException { int value = super.read(); record(value); return value; }
                @Override public int read(byte[] bytes, int offset, int length) throws IOException {
                    int count = in.read(bytes, offset, length);
                    for (int i = 0; i < count && !recorded; i++) record(bytes[offset + i] & 255);
                    return count;
                }
            };
        }
    }
}
