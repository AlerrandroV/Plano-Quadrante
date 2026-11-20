package io.github.alerrandrov.planoquadrante;

import android.content.res.AssetManager;

import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

import java.io.File;
import java.io.FileInputStream;
import java.io.FileNotFoundException;
import java.io.IOException;
import java.io.InputStream;
import java.net.Inet4Address;
import java.net.InetAddress;
import java.net.NetworkInterface;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.Executors;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.TimeUnit;
import java.util.regex.Pattern;
import java.security.SecureRandom;

import fi.iki.elonen.NanoWSD;

/**
 * Servidor da sala, rodando dentro do app.
 *
 * 1. Serve os arquivos do jogo (pasta web/, empacotada como assets do APK).
 * 2. Responde /pq-info.json, que o jogo usa para saber que está numa sala
 *    e quais endereços mostrar no QR code.
 * 3. Em /ws, repassa mensagens entre o host (a WebView deste app, conectada
 *    via 127.0.0.1) e os jogadores (navegadores na mesma rede).
 *
 * O protocolo precisa ficar IGUAL ao de server/dev-server.mjs.
 */
public class LocalServer extends NanoWSD {

    private static final int MAX_PLAYERS = 32;
    private static final Pattern ID_RE = Pattern.compile("^[A-Za-z0-9_-]{1,40}$");
    private static final long PING_EVERY_MS = 15_000;
    private static final long DEAD_AFTER_MS = 45_000;

    private final AssetManager assets;
    private final int port;
    private final String apkPath; // o próprio APK instalado (para quem quiser baixar)
    private final String code = String.format("%04d", new SecureRandom().nextInt(10000));
    private final RoomBeacon beacon;
    private final Object lock = new Object();
    private final Map<String, PlayerSocket> players = new ConcurrentHashMap<>();
    private HostSocket host;
    private ScheduledExecutorService pinger;

    public LocalServer(AssetManager assets, int port) {
        this(assets, port, null);
    }

    public LocalServer(AssetManager assets, int port, String apkPath) {
        super(port);
        this.assets = assets;
        this.port = port;
        this.apkPath = apkPath;
        this.beacon = new RoomBeacon(code, port);
    }

    /** Código de 4 dígitos da sala (aparece na sala e é anunciado na rede). */
    public String getCode() {
        return code;
    }

    public int getPortNumber() {
        return port;
    }

    /** Inicia sem timeout de leitura (WebSockets ficam abertos por muito tempo). */
    public void startServer() throws IOException {
        start(0, false);
        pinger = Executors.newSingleThreadScheduledExecutor();
        pinger.scheduleWithFixedDelay(this::pingAll, PING_EVERY_MS, PING_EVERY_MS, TimeUnit.MILLISECONDS);
    }

    public void stopServer() {
        beacon.stop();
        if (pinger != null) pinger.shutdownNow();
        stop();
    }

    // ------------------------------------------------------------------ HTTP

    @Override
    protected Response serveHttp(IHTTPSession session) {
        String uri = session.getUri();
        if ("/plano-quadrante.apk".equals(uri)) {
            // O app que está rodando entrega a si mesmo: dá para instalar pelo
            // hotspot do mestre, sem internet.
            if (apkPath == null) return newFixedLengthResponse(Response.Status.NOT_FOUND, MIME_PLAINTEXT, "404");
            try {
                File f = new File(apkPath);
                Response r = newFixedLengthResponse(Response.Status.OK, "application/vnd.android.package-archive",
                        new FileInputStream(f), f.length());
                r.addHeader("Content-Disposition", "attachment; filename=\"plano-quadrante.apk\"");
                return r;
            } catch (IOException e) {
                return newFixedLengthResponse(Response.Status.NOT_FOUND, MIME_PLAINTEXT, "404");
            }
        }
        if ("/pq-info.json".equals(uri)) {
            Response r = newFixedLengthResponse(Response.Status.OK, "application/json; charset=utf-8", info().toString());
            r.addHeader("Cache-Control", "no-store");
            return r;
        }
        if (uri.contains("..")) {
            return newFixedLengthResponse(Response.Status.FORBIDDEN, MIME_PLAINTEXT, "403");
        }
        String path = uri.startsWith("/") ? uri.substring(1) : uri;
        if (path.isEmpty() || path.endsWith("/")) path += "index.html";
        try {
            InputStream in = assets.open(path);
            Response r = newChunkedResponse(Response.Status.OK, mimeFor(path), in);
            r.addHeader("Cache-Control", "no-cache");
            return r;
        } catch (FileNotFoundException e) {
            return newFixedLengthResponse(Response.Status.NOT_FOUND, MIME_PLAINTEXT, "404");
        } catch (IOException e) {
            return newFixedLengthResponse(Response.Status.INTERNAL_ERROR, MIME_PLAINTEXT, "500");
        }
    }

    private JSONObject info() {
        JSONObject o = new JSONObject();
        try {
            o.put("server", "plano-quadrante");
            o.put("app", true);
            o.put("code", code);
            o.put("apk", apkPath != null);
            o.put("port", port);
            JSONArray urls = new JSONArray();
            for (String ip : lanAddresses()) urls.put("http://" + ip + ":" + port + "/");
            o.put("lanUrls", urls);
        } catch (JSONException ignored) {
        }
        return o;
    }

    /** IPs locais por onde os amigos alcançam este celular (Wi-Fi e hotspot primeiro). */
    static List<String> lanAddresses() {
        List<String> preferred = new ArrayList<>();
        List<String> others = new ArrayList<>();
        try {
            for (NetworkInterface ni : Collections.list(NetworkInterface.getNetworkInterfaces())) {
                if (!ni.isUp() || ni.isLoopback()) continue;
                String name = ni.getName().toLowerCase();
                // Dados móveis não servem para jogar em rede local.
                if (name.startsWith("rmnet") || name.startsWith("ccmni") || name.startsWith("pdp")
                        || name.startsWith("v4-") || name.startsWith("dummy") || name.startsWith("tun")) {
                    continue;
                }
                for (InetAddress a : Collections.list(ni.getInetAddresses())) {
                    if (!(a instanceof Inet4Address) || a.isLoopbackAddress()) continue;
                    String ip = a.getHostAddress();
                    if (name.startsWith("wlan") || name.startsWith("ap") || name.startsWith("swlan")) preferred.add(ip);
                    else others.add(ip);
                }
            }
        } catch (Exception ignored) {
        }
        preferred.addAll(others);
        return preferred;
    }

    private static String mimeFor(String path) {
        String p = path.toLowerCase();
        if (p.endsWith(".html")) return "text/html; charset=utf-8";
        if (p.endsWith(".js") || p.endsWith(".mjs")) return "text/javascript; charset=utf-8";
        if (p.endsWith(".css")) return "text/css; charset=utf-8";
        if (p.endsWith(".json")) return "application/json; charset=utf-8";
        if (p.endsWith(".svg")) return "image/svg+xml";
        if (p.endsWith(".png")) return "image/png";
        if (p.endsWith(".jpg") || p.endsWith(".jpeg")) return "image/jpeg";
        if (p.endsWith(".webp")) return "image/webp";
        if (p.endsWith(".ico")) return "image/x-icon";
        if (p.endsWith(".woff2")) return "font/woff2";
        if (p.endsWith(".mp3")) return "audio/mpeg";
        if (p.endsWith(".ogg")) return "audio/ogg";
        return "application/octet-stream";
    }

    // ------------------------------------------------------------- WebSocket

    @Override
    protected WebSocket openWebSocket(IHTTPSession handshake) {
        Map<String, String> q = handshake.getParms();
        if ("host".equals(q.get("role"))) {
            return new HostSocket(handshake, isLoopback(handshake.getRemoteIpAddress()));
        }
        return new PlayerSocket(handshake, q.get("role"), q.get("id"), q.get("name"));
    }

    private static boolean isLoopback(String ip) {
        return "127.0.0.1".equals(ip) || "::1".equals(ip) || "0:0:0:0:0:0:0:1".equals(ip);
    }

    private void pingAll() {
        long now = System.currentTimeMillis();
        List<BaseSocket> all = new ArrayList<>(players.values());
        synchronized (lock) {
            if (host != null) all.add(host);
        }
        for (BaseSocket s : all) {
            if (now - s.lastSeen > DEAD_AFTER_MS) {
                s.closeQuietly("timeout");
            } else {
                try {
                    s.ping(new byte[0]);
                } catch (IOException e) {
                    s.closeQuietly("ping failed");
                }
            }
        }
    }

    private abstract class BaseSocket extends WebSocket {
        volatile long lastSeen = System.currentTimeMillis();

        BaseSocket(IHTTPSession handshake) {
            super(handshake);
        }

        void sendText(String text) {
            if (!isOpen()) return;
            try {
                synchronized (this) {
                    send(text);
                }
            } catch (IOException e) {
                closeQuietly("send failed");
            }
        }

        void closeQuietly(String reason) {
            try {
                close(WebSocketFrame.CloseCode.PolicyViolation, reason, false);
            } catch (IOException ignored) {
            }
        }

        @Override
        protected void onPong(WebSocketFrame pong) {
            lastSeen = System.currentTimeMillis();
        }

        @Override
        protected void onException(IOException exception) {
            // A conexão caiu; onClose cuida do resto.
        }
    }

    /** A WebView deste app: dona da partida. */
    private class HostSocket extends BaseSocket {
        private final boolean allowed;

        HostSocket(IHTTPSession handshake, boolean allowed) {
            super(handshake);
            this.allowed = allowed;
        }

        @Override
        protected void onOpen() {
            if (!allowed) {
                closeQuietly("host only on loopback");
                return;
            }
            HostSocket old;
            synchronized (lock) {
                old = host;
                host = this;
            }
            if (old != null) old.closeQuietly("replaced");
            beacon.start(); // sala aberta: anuncia na rede

            JSONArray list = new JSONArray();
            try {
                for (Map.Entry<String, PlayerSocket> e : players.entrySet()) {
                    list.put(new JSONObject().put("id", e.getKey()).put("name", e.getValue().name));
                }
                sendText(new JSONObject().put("t", "clients").put("list", list).toString());
            } catch (JSONException ignored) {
            }
        }

        @Override
        protected void onMessage(WebSocketFrame frame) {
            lastSeen = System.currentTimeMillis();
            try {
                JSONObject m = new JSONObject(frame.getTextPayload());
                String t = m.optString("t");
                if ("info".equals(t)) {
                    // Nome do mestre, jogo etc., para o anúncio da sala na rede.
                    JSONObject info = m.optJSONObject("data");
                    if (info != null) beacon.setInfo(info.toString());
                    return;
                }
                Object data = m.opt("data");
                if (data == null) return;
                String text = data.toString();
                if ("send".equals(t)) {
                    PlayerSocket p = players.get(m.optString("to"));
                    if (p != null) p.sendText(text);
                } else if ("broadcast".equals(t)) {
                    for (PlayerSocket p : players.values()) p.sendText(text);
                }
            } catch (JSONException ignored) {
            }
        }

        @Override
        protected void onClose(WebSocketFrame.CloseCode code, String reason, boolean initiatedByRemote) {
            boolean wasHost;
            synchronized (lock) {
                wasHost = host == this;
                if (wasHost) host = null;
                if (wasHost) beacon.stop(); // sala fechada: para de anunciar
            }
            if (!wasHost) return;
            String msg = "{\"type\":\"_host-offline\"}";
            for (PlayerSocket p : players.values()) p.sendText(msg);
        }
    }

    /** Navegador de um amigo. */
    private class PlayerSocket extends BaseSocket {
        final String role;
        final String id;
        final String name;

        PlayerSocket(IHTTPSession handshake, String role, String id, String name) {
            super(handshake);
            this.role = role;
            this.id = id == null ? "" : id;
            String n = name == null ? "" : name;
            this.name = n.length() > 20 ? n.substring(0, 20) : n;
        }

        @Override
        protected void onOpen() {
            if (!"player".equals(role) || !ID_RE.matcher(id).matches()) {
                closeQuietly("bad request");
                return;
            }
            if (!players.containsKey(id) && players.size() >= MAX_PLAYERS) {
                sendText("{\"type\":\"_full\"}");
                closeQuietly("full");
                return;
            }
            PlayerSocket old = players.put(id, this);
            if (old != null) old.closeQuietly("replaced");
            try {
                sendToHost(new JSONObject().put("t", "join").put("id", id).put("name", name));
            } catch (JSONException ignored) {
            }
            synchronized (lock) {
                if (host == null) sendText("{\"type\":\"_host-offline\"}");
            }
        }

        @Override
        protected void onMessage(WebSocketFrame frame) {
            lastSeen = System.currentTimeMillis();
            if (players.get(id) != this) return;
            try {
                // Reconstrói o JSON para que um jogador não consiga se passar por outro.
                JSONObject data = new JSONObject(frame.getTextPayload());
                sendToHost(new JSONObject().put("t", "msg").put("id", id).put("data", data));
            } catch (JSONException ignored) {
            }
        }

        @Override
        protected void onClose(WebSocketFrame.CloseCode code, String reason, boolean initiatedByRemote) {
            // remove(key, value): se já reconectou com outro socket, não mexe.
            if (players.remove(id, this)) {
                try {
                    sendToHost(new JSONObject().put("t", "leave").put("id", id));
                } catch (JSONException ignored) {
                }
            }
        }

        private void sendToHost(JSONObject msg) {
            HostSocket h;
            synchronized (lock) {
                h = host;
            }
            if (h != null) h.sendText(msg.toString());
        }
    }
}
