package io.github.alerrandrov.planoquadrante;

import android.annotation.SuppressLint;
import android.app.Activity;
import android.content.Context;
import android.content.Intent;
import android.net.wifi.WifiManager;
import android.graphics.Insets;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.view.DisplayCutout;
import android.view.View;
import android.view.WindowInsets;
import android.view.WindowInsetsController;
import android.view.WindowManager;
import android.webkit.JavascriptInterface;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.FrameLayout;
import android.widget.Toast;

import java.io.IOException;
import java.util.regex.Pattern;

/**
 * Tela única do app: uma WebView com o jogo, servido pelo LocalServer
 * deste próprio celular. Como a página é aberta em 127.0.0.1, o jogo se
 * reconhece como "criador da sala" (ver web/js/env.js).
 *
 * Para ENTRAR na sala de outro celular, a WebView abre o endereço dele
 * (http://192.168.x.x:8080/). Isso acontece:
 *  - pela tela "Entrar numa sala" (salas achadas na rede ou código de 4 dígitos);
 *  - pelo botão "Abrir no app" do convite no navegador
 *    (link planoquadrante://sala/?u=<endereço>).
 */
public class MainActivity extends Activity {

    private static final int FIRST_PORT = 8080;
    private static final int LAST_PORT = 8099;

    // Endereços de rede local (Wi-Fi/hotspot): só esses abrem dentro do app.
    private static final Pattern LAN = Pattern.compile(
            "^(127\\.0\\.0\\.1|10\\.\\d+\\.\\d+\\.\\d+|192\\.168\\.\\d+\\.\\d+|172\\.(1[6-9]|2\\d|3[01])\\.\\d+\\.\\d+)$");

    private LocalServer server;
    private WebView webView;
    private RoomScanner scanner;
    private WifiManager.MulticastLock multicastLock;

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
        // Marca o app no "user agent": a página sabe que não precisa oferecer o app.
        s.setUserAgentString(s.getUserAgentString() + " PlanoQuadranteApp/1");
        webView.addJavascriptInterface(new Bridge(), "PQAndroid");
        // Jogo cabe em uma tela: sem zoom e sem o efeito de "esticar" ao rolar.
        s.setSupportZoom(false);
        s.setBuiltInZoomControls(false);
        webView.setOverScrollMode(View.OVER_SCROLL_NEVER);
        webView.setVerticalScrollBarEnabled(false);
        webView.setHorizontalScrollBarEnabled(false);
        webView.setWebViewClient(new WebViewClient() {
            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                Uri uri = request.getUrl();
                if ("http".equals(uri.getScheme()) && isLan(uri.getHost())) return false;
                // Links externos (ex.: GitHub) abrem no navegador.
                try {
                    startActivity(new Intent(Intent.ACTION_VIEW, uri));
                } catch (Exception ignored) {
                }
                return true;
            }
        });
        // A WebView ignora padding no próprio conteúdo, então ela fica dentro
        // de um contêiner, e é ele que recebe as margens de segurança.
        FrameLayout root = new FrameLayout(this);
        root.setBackgroundColor(0xFF1A1C2C);
        root.addView(webView, new FrameLayout.LayoutParams(
                FrameLayout.LayoutParams.MATCH_PARENT, FrameLayout.LayoutParams.MATCH_PARENT));
        applySafeAreaPadding(root);
        setContentView(root);
        enterImmersiveMode();

        if (server == null) {
            webView.loadData("<h2 style='font-family:sans-serif'>Não foi possível abrir a sala (nenhuma porta livre).</h2>",
                    "text/html; charset=utf-8", "UTF-8");
        } else {
            String room = roomFromIntent(getIntent());
            webView.loadUrl(room != null ? room : homeUrl());
        }
    }

    private String homeUrl() {
        return "http://127.0.0.1:" + server.getPortNumber() + "/";
    }

    static boolean isLan(String host) {
        return host != null && LAN.matcher(host).matches();
    }

    /** Endereço da sala vindo de planoquadrante://sala/?u=http://192.168.x.x:8080/ (ou null). */
    static String roomFromIntent(Intent intent) {
        if (intent == null || intent.getData() == null) return null;
        Uri data = intent.getData();
        if (!"planoquadrante".equals(data.getScheme())) return null;
        return safeRoomUrl(data.getQueryParameter("u"));
    }

    /** Aceita só http://<IP da rede local>:<porta>/ */
    static String safeRoomUrl(String u) {
        if (u == null) return null;
        Uri uri = Uri.parse(u);
        if (!"http".equals(uri.getScheme()) || !isLan(uri.getHost()) || uri.getPort() <= 0) return null;
        return "http://" + uri.getHost() + ":" + uri.getPort() + "/";
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        // App já aberto e alguém tocou em "Abrir no app" num convite.
        String room = roomFromIntent(intent);
        if (room != null && webView != null) webView.loadUrl(room);
    }

    /** Ponte com a página (window.PQAndroid no JavaScript). */
    private class Bridge {
        @JavascriptInterface
        public void startScan() {
            runOnUiThread(() -> {
                if (scanner != null) return;
                // Sem este "lock", vários Android descartam os anúncios (broadcast) da rede.
                try {
                    WifiManager wm = (WifiManager) getApplicationContext().getSystemService(Context.WIFI_SERVICE);
                    if (wm != null) {
                        multicastLock = wm.createMulticastLock("pq-salas");
                        multicastLock.setReferenceCounted(false);
                        multicastLock.acquire();
                    }
                } catch (Exception ignored) {
                }
                scanner = new RoomScanner(server != null ? server.getCode() : "");
                scanner.start();
            });
        }

        @JavascriptInterface
        public void stopScan() {
            runOnUiThread(MainActivity.this::stopScanning);
        }

        /** Salas achadas na rede: [{ code, url, info: { name, game, count } }] */
        @JavascriptInterface
        public String rooms() {
            RoomScanner sc = scanner;
            return sc == null ? "[]" : sc.roomsJson();
        }

        /** Entra na sala de outro celular. */
        @JavascriptInterface
        public void join(String url) {
            String safe = safeRoomUrl(url);
            if (safe == null) return;
            runOnUiThread(() -> { stopScanning(); webView.loadUrl(safe); });
        }

        /** Volta para o menu deste próprio app. */
        @JavascriptInterface
        public void home() {
            runOnUiThread(() -> { if (server != null) webView.loadUrl(homeUrl()); });
        }

        /** Código desta sala (para não listar a si mesmo). */
        @JavascriptInterface
        public String ownCode() {
            return server != null ? server.getCode() : "";
        }
    }

    private void stopScanning() {
        if (scanner != null) { scanner.stop(); scanner = null; }
        if (multicastLock != null) {
            try { multicastLock.release(); } catch (Exception ignored) { }
            multicastLock = null;
        }
    }

    private LocalServer startServer() {
        for (int port = FIRST_PORT; port <= LAST_PORT; port++) {
            // O app entrega o próprio APK para quem estiver no hotspot do mestre.
            LocalServer s = new LocalServer(getAssets(), port, getApplicationInfo().sourceDir);
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

    /**
     * Tela cheia "imersiva": esconde a barra de notificações e a de navegação.
     * Elas reaparecem por alguns segundos ao deslizar a partir da borda.
     */
    @SuppressWarnings("deprecation")
    private void enterImmersiveMode() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
            WindowManager.LayoutParams lp = getWindow().getAttributes();
            lp.layoutInDisplayCutoutMode = WindowManager.LayoutParams.LAYOUT_IN_DISPLAY_CUTOUT_MODE_SHORT_EDGES;
            getWindow().setAttributes(lp);
        }
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
            getWindow().setDecorFitsSystemWindows(false);
            WindowInsetsController c = getWindow().getInsetsController();
            if (c != null) {
                c.hide(WindowInsets.Type.statusBars() | WindowInsets.Type.navigationBars());
                c.setSystemBarsBehavior(WindowInsetsController.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE);
            }
        } else {
            getWindow().getDecorView().setSystemUiVisibility(
                    View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY
                            | View.SYSTEM_UI_FLAG_FULLSCREEN
                            | View.SYSTEM_UI_FLAG_HIDE_NAVIGATION
                            | View.SYSTEM_UI_FLAG_LAYOUT_STABLE
                            | View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION
                            | View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN);
        }
    }

    @Override
    public void onWindowFocusChanged(boolean hasFocus) {
        super.onWindowFocusChanged(hasFocus);
        // Volta para tela cheia depois de um diálogo, do teclado ou de trocar de app.
        if (hasFocus) enterImmersiveMode();
    }

    /**
     * Afasta o jogo do recorte da câmera (notch) e do teclado. As barras do
     * sistema ficam escondidas; quando aparecem por um instante, passam por cima.
     */
    @SuppressWarnings("deprecation")
    private void applySafeAreaPadding(View v) {
        v.setOnApplyWindowInsetsListener((view, insets) -> {
            int l = 0, t = 0, r = 0, b = 0;
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
                Insets cut = insets.getInsets(WindowInsets.Type.displayCutout());
                Insets ime = insets.getInsets(WindowInsets.Type.ime());
                l = cut.left;
                t = cut.top;
                r = cut.right;
                b = Math.max(cut.bottom, ime.bottom);
            } else if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
                DisplayCutout cut = insets.getDisplayCutout();
                if (cut != null) {
                    l = cut.getSafeInsetLeft();
                    t = cut.getSafeInsetTop();
                    r = cut.getSafeInsetRight();
                    b = cut.getSafeInsetBottom();
                }
            }
            view.setPadding(l, t, r, b);
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
        stopScanning();
        if (webView != null) webView.destroy();
        if (server != null) server.stopServer();
        super.onDestroy();
    }
}
