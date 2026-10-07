package io.github.judus.phoenix;

import android.Manifest;
import android.annotation.SuppressLint;
import android.content.ActivityNotFoundException;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.pm.PackageManager;
import android.content.res.Configuration;
import android.net.Uri;
import android.os.Bundle;
import android.os.Message;
import android.view.View;
import android.view.WindowInsets;
import android.view.WindowInsetsController;
import android.view.WindowManager;
import android.view.inputmethod.EditorInfo;
import android.view.inputmethod.InputMethodManager;
import android.webkit.CookieManager;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceError;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Button;
import android.widget.EditText;
import android.widget.FrameLayout;
import android.widget.TextView;
import android.widget.Toast;
import androidx.activity.ComponentActivity;
import androidx.activity.OnBackPressedCallback;
import androidx.activity.result.ActivityResultLauncher;
import androidx.activity.result.contract.ActivityResultContracts;
import com.journeyapps.barcodescanner.ScanContract;
import com.journeyapps.barcodescanner.ScanOptions;
import java.io.IOException;
import java.util.Locale;
import java.util.Objects;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

/** Native lifecycle and connection settings only. All PHOENIX behavior remains in apps/web. */
public final class MainActivity extends ComponentActivity {
    private SharedPreferences preferences;
    private volatile ServerAddress server;
    private WebView webView;
    private View connection;
    private EditText address;
    private TextView error;
    private Button resume;
    private boolean clearHistoryOnLoad;
    private String persistedCookies;
    private EditText pairingCode;
    private boolean manualMode;
    private boolean connecting;
    private final ExecutorService pairingWorker = Executors.newSingleThreadExecutor();
    private final ActivityResultLauncher<String> cameraPermission = registerForActivityResult(
            new ActivityResultContracts.RequestPermission(), granted -> {
                if (granted) launchScanner();
                else cameraUnavailable();
            });
    private final ActivityResultLauncher<ScanOptions> scanner = registerForActivityResult(
            new ScanContract(), result -> {
                if (result.getContents() == null) return; // Cancel returns to the card, not an error.
                try {
                    ServerAddress scanned = ServerAddress.parse(result.getContents());
                    if (scanned.pairingCode().isBlank()) throw new IllegalArgumentException("Missing pairing code");
                    address.setText(scanned.origin());
                    pairingCode.setText(scanned.pairingCode());
                    ((TextView) connection.findViewById(R.id.scanned_server))
                            .setText(getString(R.string.scanned_server, scanned.origin()));
                    connection.findViewById(R.id.scanned_server).setVisibility(View.VISIBLE);
                    setMode(false);
                    error.setVisibility(View.GONE);
                } catch (IllegalArgumentException invalid) {
                    showError(getString(R.string.invalid_qr));
                }
            });

    @Override
    public void onCreate(Bundle state) {
        super.onCreate(state);
        preferences = getSharedPreferences("connection", MODE_PRIVATE);
        FrameLayout root = new FrameLayout(this);
        webView = new WebView(this);
        webView.setBackgroundColor(0xff09090d);
        configureWebView();
        connection = getLayoutInflater().inflate(R.layout.connection, root, false);
        root.addView(webView);
        root.addView(connection);
        setContentView(root);
        getWindow().setDecorFitsSystemWindows(false);
        root.setOnApplyWindowInsetsListener((view, insets) -> {
            android.graphics.Insets bars = insets.getInsets(WindowInsets.Type.systemBars());
            int keyboard = insets.getInsets(WindowInsets.Type.ime()).bottom;
            boolean connecting = connection.getVisibility() == View.VISIBLE;
            view.setPadding(bars.left, connecting ? bars.top : 0, bars.right,
                    connecting ? Math.max(bars.bottom, keyboard) : keyboard);
            return insets;
        });
        connection.addOnLayoutChangeListener((view, left, top, right, bottom, oldLeft, oldTop, oldRight, oldBottom) -> {
            View card = connection.findViewById(R.id.connection_card);
            int width = Math.min(right - left - dp(48), dp(720));
            if (card.getLayoutParams().width != width) {
                card.getLayoutParams().width = width;
                card.requestLayout();
            }
        });
        address = connection.findViewById(R.id.server_address);
        pairingCode = connection.findViewById(R.id.pairing_code);
        error = connection.findViewById(R.id.connection_error);
        resume = connection.findViewById(R.id.resume);
        connection.findViewById(R.id.connect).setOnClickListener(view -> connect());
        connection.findViewById(R.id.connect).setSelected(true);
        connection.findViewById(R.id.scan_mode).setOnClickListener(view -> setMode(false));
        connection.findViewById(R.id.manual_mode).setOnClickListener(view -> setMode(true));
        connection.findViewById(R.id.scan).setOnClickListener(view -> scan());
        resume.setOnClickListener(view -> showWebView());
        pairingCode.setOnEditorActionListener((view, action, event) -> {
            if (action != EditorInfo.IME_ACTION_GO) return false;
            connect();
            return true;
        });
        getOnBackPressedDispatcher().addCallback(this, new OnBackPressedCallback(true) {
            @Override public void handleOnBackPressed() { navigateBack(); }
        });
        setMode(!getPackageManager().hasSystemFeature(PackageManager.FEATURE_CAMERA_ANY));
        String savedOrigin = preferences.getString("server", "");
        address.setText(savedOrigin);
        if (!savedOrigin.isEmpty()) {
            server = ServerAddress.parse(savedOrigin);
            // Restore only a same-origin route, never the pairing fragment or WebView history blob.
            String route = state == null ? null : state.getString("route");
            authorize(server, "", route != null && server.contains(route) ? route : server.origin());
        } else {
            showConnection(0);
        }
    }

    private int dp(int value) { return Math.round(value * getResources().getDisplayMetrics().density); }

    private void setMode(boolean manual) {
        manualMode = manual;
        connection.findViewById(R.id.scan_mode).setSelected(!manual);
        connection.findViewById(R.id.manual_mode).setSelected(manual);
        connection.findViewById(R.id.manual_panel).setVisibility(manual ? View.VISIBLE : View.GONE);
        connection.findViewById(R.id.scan_panel).setVisibility(manual ? View.GONE : View.VISIBLE);
        connection.findViewById(R.id.connect).setVisibility(manual || !pairingCode.getText().toString().isBlank()
                ? View.VISIBLE : View.GONE);
    }

    private void scan() {
        if (!getPackageManager().hasSystemFeature(PackageManager.FEATURE_CAMERA_ANY)) {
            cameraUnavailable();
        } else if (checkSelfPermission(Manifest.permission.CAMERA) == PackageManager.PERMISSION_GRANTED) {
            launchScanner();
        } else {
            cameraPermission.launch(Manifest.permission.CAMERA);
        }
    }

    private void launchScanner() {
        scanner.launch(new ScanOptions().setDesiredBarcodeFormats(ScanOptions.QR_CODE)
                .setCaptureActivity(QrScannerActivity.class).setOrientationLocked(false)
                .setBeepEnabled(false).setPrompt(getString(R.string.scan_prompt)));
    }

    private void cameraUnavailable() {
        setMode(true);
        showError(getString(R.string.camera_unavailable));
    }

    private void showError(String message) {
        error.setText(message);
        error.setVisibility(View.VISIBLE);
    }

    @SuppressLint("SetJavaScriptEnabled") // The existing React frontend requires JS; no native bridge is exposed.
    private void configureWebView() {
        WebSettings settings = webView.getSettings();
        // Product marker only: browser chrome can omit controls already managed by this host.
        settings.setUserAgentString(settings.getUserAgentString() + " PhoenixAndroid/" + BuildConfig.VERSION_NAME);
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setAllowFileAccess(false);
        settings.setAllowContentAccess(false);
        settings.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
        settings.setSupportMultipleWindows(true);
        CookieManager.getInstance().setAcceptCookie(true);
        CookieManager.getInstance().setAcceptThirdPartyCookies(webView, false);
        WebView.setWebContentsDebuggingEnabled(BuildConfig.DEBUG);
        webView.setWebViewClient(new WebViewClient() {
            @Override
            public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest request) {
                String url = request.getUrl().toString();
                if (server.contains(url)) persistChangedCookies(url);
                return null; // WebView still owns networking, response bodies and cookie acceptance.
            }

            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                String url = request.getUrl().toString();
                if (server.contains(url)) {
                    if (request.isForMainFrame() && "/pairing".equals(request.getUrl().getPath())) {
                        returnToPairing();
                        return true;
                    }
                    return false;
                }
                if (request.isForMainFrame()) openExternal(url);
                return true;
            }

            @Override
            public void onReceivedError(WebView view, WebResourceRequest request, WebResourceError failure) {
                if (request.isForMainFrame()) showConnection(R.string.load_failed);
            }

            @Override
            public void onReceivedHttpError(WebView view, WebResourceRequest request, WebResourceResponse response) {
                if (request.isForMainFrame()) showConnection(R.string.load_failed);
            }

            @Override
            public void onPageFinished(WebView view, String url) {
                if (clearHistoryOnLoad && server.contains(url)) {
                    view.clearHistory();
                    clearHistoryOnLoad = false;
                }
                CookieManager.getInstance().flush();
            }
        });
        webView.setWebChromeClient(new WebChromeClient() {
            @Override
            public boolean onCreateWindow(WebView view, boolean dialog, boolean userGesture, Message result) {
                if (!userGesture) return false;
                // target=_blank links go to the browser, not an untrusted second app WebView.
                WebView popup = new WebView(MainActivity.this);
                popup.setWebViewClient(new WebViewClient() {
                    @Override
                    public boolean shouldOverrideUrlLoading(WebView child, WebResourceRequest request) {
                        openExternal(request.getUrl().toString());
                        child.destroy();
                        return true;
                    }
                });
                ((WebView.WebViewTransport) result.obj).setWebView(popup);
                result.sendToTarget();
                return true;
            }
        });
        webView.setDownloadListener((url, agent, disposition, type, length) -> openExternal(url));
    }

    private synchronized void persistChangedCookies(String url) {
        CookieManager cookies = CookieManager.getInstance();
        String current = cookies.getCookie(url);
        if (Objects.equals(current, persistedCookies)) return;
        // Pairing happens via fetch after page load. Persist new cookies on subsequent app requests,
        // not only onPageFinished/onPause, which may never run before a foreground force-stop.
        cookies.flush();
        persistedCookies = current;
    }

    private void connect() {
        if (connecting) return;
        ServerAddress next;
        try {
            next = ServerAddress.parse(address.getText().toString());
        } catch (IllegalArgumentException invalid) {
            address.setError(getString(R.string.invalid_address));
            return;
        }
        String code = pairingCode.getText().toString().trim().toUpperCase(Locale.ROOT);
        if (code.isBlank()) code = next.pairingCode();
        getSystemService(InputMethodManager.class).hideSoftInputFromWindow(address.getWindowToken(), 0);
        authorize(next, code, next.origin());
    }

    private void setConnecting(boolean busy) {
        connecting = busy;
        for (int id : new int[] { R.id.connect, R.id.scan, R.id.scan_mode, R.id.manual_mode,
                R.id.server_address, R.id.pairing_code, R.id.resume }) {
            connection.findViewById(id).setEnabled(!busy);
        }
        ((Button) connection.findViewById(R.id.connect)).setText(busy ? R.string.connecting : R.string.connect);
        if (busy) connection.findViewById(R.id.connect).setVisibility(View.VISIBLE);
    }

    private void authorize(ServerAddress target, String code, String route) {
        setConnecting(true);
        error.setVisibility(View.GONE);
        String cookies = CookieManager.getInstance().getCookie(target.origin());
        pairingWorker.execute(() -> {
            try {
                String cookie = new PairingClient().authorize(target, code, cookies);
                runOnUiThread(() -> {
                    if (isDestroyed()) return;
                    if (cookie == null) finishConnection(target, route);
                    else CookieManager.getInstance().setCookie(target.origin(), cookie, accepted -> {
                        if (isDestroyed()) return;
                        if (accepted) {
                            CookieManager.getInstance().flush();
                            finishConnection(target, route);
                        } else connectionFailed(getString(R.string.cookie_rejected));
                    });
                });
            } catch (IOException failure) {
                String message = failure instanceof PairingClient.Rejected ? failure.getMessage() : getString(R.string.load_failed);
                runOnUiThread(() -> { if (!isDestroyed()) connectionFailed(message); });
            }
        });
    }

    private void connectionFailed(String message) {
        setConnecting(false);
        showConnection(0);
        resume.setVisibility(View.GONE);
        setMode(true);
        showError(message);
    }

    private void returnToPairing() {
        // Destroy the old page's JS context/SSE connection, not just its visible chrome.
        webView.stopLoading();
        webView.loadUrl("about:blank");
        pairingCode.setText("");
        connection.findViewById(R.id.scanned_server).setVisibility(View.GONE);
        showConnection(0);
        resume.setVisibility(View.GONE);
        setMode(!getPackageManager().hasSystemFeature(PackageManager.FEATURE_CAMERA_ANY));
        showError(getString(R.string.pairing_revoked));
    }

    private void finishConnection(ServerAddress target, String route) {
        setConnecting(false);
        server = target;
        preferences.edit().putString("server", server.origin()).apply();
        address.setText(server.origin());
        pairingCode.setText("");
        connection.findViewById(R.id.scanned_server).setVisibility(View.GONE);
        webView.stopLoading();
        clearHistoryOnLoad = true;
        showWebView();
        webView.loadUrl(route);
    }

    private void showConnection(int errorMessage) {
        webView.setVisibility(View.GONE);
        connection.setVisibility(View.VISIBLE);
        setMode(manualMode);
        error.setVisibility(errorMessage == 0 ? View.GONE : View.VISIBLE);
        if (errorMessage != 0) error.setText(errorMessage);
        resume.setVisibility(server != null && errorMessage == 0 ? View.VISIBLE : View.GONE);
        getWindow().clearFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
        getWindow().getInsetsController().show(WindowInsets.Type.systemBars());
        connection.getRootView().requestApplyInsets();
    }

    private void showWebView() {
        connection.setVisibility(View.GONE);
        webView.setVisibility(View.VISIBLE);
        webView.requestFocus();
        getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
        hideSystemBars();
        connection.getRootView().requestApplyInsets();
    }

    private void hideSystemBars() {
        WindowInsetsController insets = getWindow().getInsetsController();
        insets.setSystemBarsBehavior(WindowInsetsController.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE);
        insets.hide(WindowInsets.Type.systemBars());
    }

    private void openExternal(String url) {
        Uri uri = Uri.parse(url);
        if (!"http".equalsIgnoreCase(uri.getScheme()) && !"https".equalsIgnoreCase(uri.getScheme())) {
            Toast.makeText(this, R.string.unsupported_link, Toast.LENGTH_SHORT).show();
            return;
        }
        try {
            startActivity(new Intent(Intent.ACTION_VIEW, uri).addCategory(Intent.CATEGORY_BROWSABLE));
        } catch (ActivityNotFoundException unavailable) {
            Toast.makeText(this, R.string.external_unavailable, Toast.LENGTH_SHORT).show();
        }
    }

    private void navigateBack() {
        if (connection.getVisibility() == View.VISIBLE) finish();
        else if (webView.canGoBack()) webView.goBack();
        else showConnection(0);
    }

    @Override
    public void onWindowFocusChanged(boolean focused) {
        super.onWindowFocusChanged(focused);
        if (focused && connection.getVisibility() != View.VISIBLE) hideSystemBars();
    }

    @Override
    public void onConfigurationChanged(Configuration configuration) {
        super.onConfigurationChanged(configuration);
        if (connection.getVisibility() != View.VISIBLE) hideSystemBars();
    }

    @Override
    protected void onSaveInstanceState(Bundle state) {
        String url = webView.getUrl();
        if (server != null && url != null && server.contains(url) && !url.contains("#pair=")) {
            state.putString("route", url);
        }
        super.onSaveInstanceState(state);
    }

    @Override
    protected void onPause() {
        CookieManager.getInstance().flush();
        webView.onPause();
        super.onPause();
    }

    @Override
    protected void onResume() {
        super.onResume();
        webView.onResume();
    }

    @Override
    protected void onDestroy() {
        pairingWorker.shutdownNow();
        ((FrameLayout) webView.getParent()).removeView(webView);
        webView.destroy();
        super.onDestroy();
    }
}
