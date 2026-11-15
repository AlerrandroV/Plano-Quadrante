package io.github.alerrandrov.planoquadrante;

import android.annotation.SuppressLint;
import android.app.Activity;
import android.content.Intent;
import android.graphics.Insets;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.view.View;
import android.view.WindowInsets;
import android.view.WindowManager;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Toast;

import java.io.IOException;

/**
 * Tela única do app: uma WebView com o jogo, servido pelo LocalServer
 * deste próprio celular. Como a página é aberta em 127.0.0.1, o jogo se
 * reconhece como "criador da sala" (ver web/js/env.js).
 */
public class MainActivity extends Activity {

    private static final int FIRST_PORT = 8080;
    private static final int LAST_PORT = 8099;

    private LocalServer server;
    private WebView webView;

    @SuppressLint("SetJavaScriptEnabled")
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);

        server = startServer();

        webView = new WebView(this);
        WebSettings s = webView.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setMediaPlaybackRequiresUserGesture(false);
        webView.setWebViewClient(new WebViewClient() {
            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                Uri uri = request.getUrl();
                if ("127.0.0.1".equals(uri.getHost())) return false;
                // Links externos (ex.: GitHub) abrem no navegador.
                try {
                    startActivity(new Intent(Intent.ACTION_VIEW, uri));
                } catch (Exception ignored) {
                }
                return true;
            }
        });
        applySystemBarPadding(webView);
        setContentView(webView);

        if (server == null) {
            webView.loadData("<h2 style='font-family:sans-serif'>Não foi possível abrir a sala (nenhuma porta livre).</h2>",
                    "text/html; charset=utf-8", "UTF-8");
        } else {
            webView.loadUrl("http://127.0.0.1:" + server.getPortNumber() + "/");
        }
    }

    private LocalServer startServer() {
        for (int port = FIRST_PORT; port <= LAST_PORT; port++) {
            LocalServer s = new LocalServer(getAssets(), port);
            try {
                s.startServer();
                return s;
            } catch (IOException e) {
                // porta ocupada, tenta a próxima
            }
        }
        Toast.makeText(this, "Nenhuma porta livre para a sala", Toast.LENGTH_LONG).show();
        return null;
    }

    /** No Android 15 o app ocupa a tela toda; afasta o conteúdo das barras do sistema. */
    private void applySystemBarPadding(View v) {
        v.setOnApplyWindowInsetsListener((view, insets) -> {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
                Insets bars = insets.getInsets(WindowInsets.Type.systemBars() | WindowInsets.Type.displayCutout() | WindowInsets.Type.ime());
                view.setPadding(bars.left, bars.top, bars.right, bars.bottom);
            } else {
                view.setPadding(insets.getSystemWindowInsetLeft(), insets.getSystemWindowInsetTop(),
                        insets.getSystemWindowInsetRight(), insets.getSystemWindowInsetBottom());
            }
            return insets;
        });
    }

    @Override
    @SuppressWarnings("deprecation")
    public void onBackPressed() {
        if (webView != null && webView.canGoBack()) webView.goBack();
        else super.onBackPressed();
    }

    @Override
    protected void onDestroy() {
        if (webView != null) webView.destroy();
        if (server != null) server.stopServer();
        super.onDestroy();
    }
}
