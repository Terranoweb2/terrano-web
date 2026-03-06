package com.terrano.terranoweb;

import android.annotation.SuppressLint;
import android.app.DownloadManager;
import android.content.Intent;
import android.graphics.Bitmap;
import android.net.Uri;
import android.os.Bundle;
import android.os.Environment;
import android.view.KeyEvent;
import android.view.View;
import android.view.inputmethod.EditorInfo;
import android.view.inputmethod.InputMethodManager;
import android.webkit.*;
import android.widget.*;
import androidx.appcompat.app.AppCompatActivity;
import androidx.swiperefreshlayout.widget.SwipeRefreshLayout;
import com.google.android.material.bottomnavigation.BottomNavigationView;

public class MainActivity extends AppCompatActivity {

    private static final String HOME_URL = "https://terranoweb.win/";
    private static final String SEARCH_URL = "https://terranoweb.win/search?q=";
    private static final String NEWS_URL = "https://terranoweb.win/#news";
    private static final String MAIL_URL = "https://terranoweb.win/mail";

    private WebView webView;
    private EditText urlBar;
    private ProgressBar progressBar;
    private SwipeRefreshLayout swipeRefresh;
    private BottomNavigationView bottomNav;
    private ImageButton btnBack, btnForward, btnRefresh, btnHome;
    private View topBar;
    private int currentTab = R.id.nav_home;

    @SuppressLint("SetJavaScriptEnabled")
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_main);

        // Views
        webView = findViewById(R.id.webView);
        urlBar = findViewById(R.id.urlBar);
        progressBar = findViewById(R.id.progressBar);
        swipeRefresh = findViewById(R.id.swipeRefresh);
        bottomNav = findViewById(R.id.bottomNav);
        topBar = findViewById(R.id.topBar);
        btnBack = findViewById(R.id.btnBack);
        btnForward = findViewById(R.id.btnForward);
        btnRefresh = findViewById(R.id.btnRefresh);
        btnHome = findViewById(R.id.btnHome);

        // WebView Settings
        WebSettings ws = webView.getSettings();
        ws.setJavaScriptEnabled(true);
        ws.setDomStorageEnabled(true);
        ws.setDatabaseEnabled(true);
        ws.setAllowFileAccess(true);
        ws.setLoadWithOverviewMode(true);
        ws.setUseWideViewPort(true);
        ws.setBuiltInZoomControls(true);
        ws.setDisplayZoomControls(false);
        ws.setSupportMultipleWindows(false);
        ws.setMixedContentMode(WebSettings.MIXED_CONTENT_ALWAYS_ALLOW);
        ws.setMediaPlaybackRequiresUserGesture(false);
        ws.setCacheMode(WebSettings.LOAD_DEFAULT);
        ws.setUserAgentString(ws.getUserAgentString() + " TerranoWeb/1.0");

        // WebViewClient
        webView.setWebViewClient(new WebViewClient() {
            @Override
            public void onPageStarted(WebView view, String url, Bitmap favicon) {
                progressBar.setVisibility(View.VISIBLE);
                if (topBar.getVisibility() == View.VISIBLE) {
                    urlBar.setText(url);
                }
                updateNavButtons();
            }

            @Override
            public void onPageFinished(WebView view, String url) {
                progressBar.setVisibility(View.GONE);
                swipeRefresh.setRefreshing(false);
                if (topBar.getVisibility() == View.VISIBLE) {
                    urlBar.setText(url);
                }
                updateNavButtons();
            }

            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                String url = request.getUrl().toString();
                if (url.startsWith("tel:") || url.startsWith("mailto:") || url.startsWith("intent:")) {
                    try {
                        startActivity(new Intent(Intent.ACTION_VIEW, Uri.parse(url)));
                    } catch (Exception ignored) {}
                    return true;
                }
                return false;
            }
        });

        // WebChromeClient for progress
        webView.setWebChromeClient(new WebChromeClient() {
            @Override
            public void onProgressChanged(WebView view, int newProgress) {
                progressBar.setProgress(newProgress);
                if (newProgress >= 100) {
                    progressBar.setVisibility(View.GONE);
                }
            }
        });

        // Download support
        webView.setDownloadListener((url, userAgent, contentDisposition, mimetype, contentLength) -> {
            try {
                String filename = URLUtil.guessFileName(url, contentDisposition, mimetype);
                DownloadManager.Request req = new DownloadManager.Request(Uri.parse(url));
                req.setMimeType(mimetype);
                req.addRequestHeader("User-Agent", userAgent);
                req.setTitle(filename);
                req.setNotificationVisibility(DownloadManager.Request.VISIBILITY_VISIBLE_NOTIFY_COMPLETED);
                req.setDestinationInExternalPublicDir(Environment.DIRECTORY_DOWNLOADS, filename);
                DownloadManager dm = (DownloadManager) getSystemService(DOWNLOAD_SERVICE);
                if (dm != null) dm.enqueue(req);
                Toast.makeText(this, "Téléchargement: " + filename, Toast.LENGTH_SHORT).show();
            } catch (Exception e) {
                Toast.makeText(this, "Erreur de téléchargement", Toast.LENGTH_SHORT).show();
            }
        });

        // SwipeRefresh
        swipeRefresh.setColorSchemeColors(0xFF10B981);
        swipeRefresh.setProgressBackgroundColorSchemeColor(0xFF1E293B);
        swipeRefresh.setOnRefreshListener(() -> webView.reload());

        // URL bar actions
        urlBar.setOnEditorActionListener((v, actionId, event) -> {
            if (actionId == EditorInfo.IME_ACTION_GO || actionId == EditorInfo.IME_ACTION_SEARCH ||
                (event != null && event.getKeyCode() == KeyEvent.KEYCODE_ENTER)) {
                navigateTo(urlBar.getText().toString().trim());
                hideKeyboard();
                return true;
            }
            return false;
        });

        urlBar.setOnFocusChangeListener((v, hasFocus) -> {
            if (hasFocus) urlBar.selectAll();
        });

        // Navigation buttons
        btnBack.setOnClickListener(v -> { if (webView.canGoBack()) webView.goBack(); });
        btnForward.setOnClickListener(v -> { if (webView.canGoForward()) webView.goForward(); });
        btnRefresh.setOnClickListener(v -> webView.reload());
        btnHome.setOnClickListener(v -> {
            webView.loadUrl(HOME_URL);
            bottomNav.setSelectedItemId(R.id.nav_home);
        });

        // Bottom Navigation
        bottomNav.setOnItemSelectedListener(item -> {
            int id = item.getItemId();
            if (id == currentTab && id != R.id.nav_search) {
                webView.reload();
                return true;
            }
            currentTab = id;

            if (id == R.id.nav_home) {
                webView.loadUrl(HOME_URL);
                topBar.setVisibility(View.GONE);
            } else if (id == R.id.nav_search) {
                topBar.setVisibility(View.VISIBLE);
                urlBar.setText("");
                urlBar.setHint("Rechercher sur le web...");
                urlBar.requestFocus();
                showKeyboard();
            } else if (id == R.id.nav_news) {
                webView.loadUrl(NEWS_URL);
                topBar.setVisibility(View.GONE);
            } else if (id == R.id.nav_email) {
                webView.loadUrl(MAIL_URL);
                topBar.setVisibility(View.GONE);
            } else if (id == R.id.nav_browser) {
                topBar.setVisibility(View.VISIBLE);
                String currentUrl = webView.getUrl();
                if (currentUrl != null) urlBar.setText(currentUrl);
            }
            return true;
        });

        // Handle intent URLs
        String intentUrl = null;
        Intent intent = getIntent();
        if (intent != null && Intent.ACTION_VIEW.equals(intent.getAction()) && intent.getData() != null) {
            intentUrl = intent.getData().toString();
        }

        // Start on home — hide top bar for immersive experience
        topBar.setVisibility(View.GONE);
        webView.loadUrl(intentUrl != null ? intentUrl : HOME_URL);
    }

    private void navigateTo(String input) {
        if (input.isEmpty()) return;
        String url;
        if (input.startsWith("http://") || input.startsWith("https://")) {
            url = input;
        } else if (input.matches("^[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}(/.*)?$")) {
            url = "https://" + input;
        } else {
            // Use TerranoWeb internal search
            url = SEARCH_URL + Uri.encode(input);
        }
        webView.loadUrl(url);
        // Switch to browser tab
        if (currentTab != R.id.nav_browser) {
            currentTab = R.id.nav_browser;
            bottomNav.setSelectedItemId(R.id.nav_browser);
        }
        topBar.setVisibility(View.VISIBLE);
    }

    private void updateNavButtons() {
        btnBack.setAlpha(webView.canGoBack() ? 1.0f : 0.3f);
        btnForward.setAlpha(webView.canGoForward() ? 1.0f : 0.3f);
    }

    private void hideKeyboard() {
        InputMethodManager imm = (InputMethodManager) getSystemService(INPUT_METHOD_SERVICE);
        if (imm != null && getCurrentFocus() != null) {
            imm.hideSoftInputFromWindow(getCurrentFocus().getWindowToken(), 0);
        }
        urlBar.clearFocus();
    }

    private void showKeyboard() {
        urlBar.postDelayed(() -> {
            InputMethodManager imm = (InputMethodManager) getSystemService(INPUT_METHOD_SERVICE);
            if (imm != null) imm.showSoftInput(urlBar, InputMethodManager.SHOW_IMPLICIT);
        }, 200);
    }

    @Override
    public void onBackPressed() {
        if (webView.canGoBack()) {
            webView.goBack();
        } else if (currentTab != R.id.nav_home) {
            bottomNav.setSelectedItemId(R.id.nav_home);
        } else {
            super.onBackPressed();
        }
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        if (intent != null && Intent.ACTION_VIEW.equals(intent.getAction()) && intent.getData() != null) {
            webView.loadUrl(intent.getData().toString());
            currentTab = R.id.nav_browser;
            bottomNav.setSelectedItemId(R.id.nav_browser);
            topBar.setVisibility(View.VISIBLE);
        }
    }
}
