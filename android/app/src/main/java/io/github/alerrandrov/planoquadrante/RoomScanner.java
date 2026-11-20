package io.github.alerrandrov.planoquadrante;

import org.json.JSONArray;
import org.json.JSONObject;

import java.net.DatagramPacket;
import java.net.DatagramSocket;
import java.net.InetSocketAddress;
import java.net.SocketTimeoutException;
import java.nio.charset.StandardCharsets;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Procura salas na rede local: escuta os anúncios do RoomBeacon e guarda
 * as salas vistas nos últimos segundos (código, endereço, nome, jogo).
 */
public class RoomScanner {

    private static final long FORGET_MS = 4000;
    private static final Pattern MSG = Pattern.compile("^PQ1 (\\d{4}) (\\d{2,5}) (.*)$", Pattern.DOTALL);

    private final String ownCode;
    private final Map<String, Room> rooms = new ConcurrentHashMap<>();
    private volatile Thread thread;

    static final class Room {
        final String code;
        final String url;
        final String info;
        final long seen;

        Room(String code, String url, String info, long seen) {
            this.code = code;
            this.url = url;
            this.info = info;
            this.seen = seen;
        }
    }

    /** ownCode: código da sala deste próprio aparelho (para não listar a si mesmo). */
    public RoomScanner(String ownCode) {
        this.ownCode = ownCode;
    }

    public synchronized void start() {
        if (thread != null) return;
        Thread t = new Thread(this::run, "pq-scanner");
        t.setDaemon(true);
        thread = t;
        t.start();
    }

    public synchronized void stop() {
        Thread t = thread;
        thread = null;
        if (t != null) t.interrupt();
    }

    private void run() {
        try (DatagramSocket socket = new DatagramSocket(null)) {
            socket.setReuseAddress(true);
            socket.setBroadcast(true);
            socket.bind(new InetSocketAddress(RoomBeacon.PORT));
            socket.setSoTimeout(500);
            byte[] buf = new byte[1024];
            while (thread == Thread.currentThread()) {
                DatagramPacket p = new DatagramPacket(buf, buf.length);
                try {
                    socket.receive(p);
                } catch (SocketTimeoutException e) {
                    continue;
                }
                handle(new String(p.getData(), 0, p.getLength(), StandardCharsets.UTF_8),
                        p.getAddress().getHostAddress());
            }
        } catch (Exception ignored) {
            // porta ocupada ou sem rede: a lista fica vazia
        }
    }

    /** Trata um anúncio (público para os testes). */
    void handle(String text, String ip) {
        Matcher m = MSG.matcher(text);
        if (!m.matches()) return;
        String code = m.group(1);
        if (code.equals(ownCode)) return;
        if (ip.contains(":")) return; // só IPv4
        String url = "http://" + ip + ":" + m.group(2) + "/";
        rooms.put(code, new Room(code, url, m.group(3), System.currentTimeMillis()));
    }

    /** Salas vistas há pouco, em JSON: [{ code, url, info }]. */
    public String roomsJson() {
        long now = System.currentTimeMillis();
        JSONArray out = new JSONArray();
        for (Room r : rooms.values()) {
            if (now - r.seen > FORGET_MS) {
                rooms.remove(r.code, r);
                continue;
            }
            try {
                JSONObject o = new JSONObject();
                o.put("code", r.code);
                o.put("url", r.url);
                try {
                    o.put("info", new JSONObject(r.info));
                } catch (Exception e) {
                    o.put("info", new JSONObject());
                }
                out.put(o);
            } catch (Exception ignored) {
            }
        }
        return out.toString();
    }
}
