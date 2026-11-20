package io.github.alerrandrov.planoquadrante;

import java.net.DatagramPacket;
import java.net.DatagramSocket;
import java.net.InetAddress;
import java.net.InterfaceAddress;
import java.net.NetworkInterface;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;

/**
 * "Farol" da sala: enquanto uma sala está aberta, anuncia na rede local
 * (UDP broadcast, a cada segundo) o código de 4 dígitos, a porta e o que
 * o mestre informar (nome, jogo, nº de pessoas). Outros celulares com o
 * app escutam (RoomScanner) e mostram a sala para entrar.
 *
 * Só usa java.net: funciona igual no Android e no PC (testes).
 */
public class RoomBeacon {

    public static final int PORT = 47321;

    private final String code;
    private final int httpPort;
    private volatile String info = "{}";
    private volatile Thread thread;

    public RoomBeacon(String code, int httpPort) {
        this.code = code;
        this.httpPort = httpPort;
    }

    /** JSON com nome do mestre, jogo etc. (vem da página da sala). */
    public void setInfo(String json) {
        if (json != null && json.length() < 600) info = json;
    }

    public synchronized void start() {
        if (thread != null) return;
        Thread t = new Thread(this::run, "pq-beacon");
        t.setDaemon(true);
        thread = t;
        t.start();
    }

    public synchronized void stop() {
        Thread t = thread;
        thread = null;
        if (t != null) t.interrupt();
    }

    public boolean isRunning() {
        return thread != null;
    }

    String message() {
        // Formato: PQ1 <código> <porta> <json>
        return "PQ1 " + code + " " + httpPort + " " + info;
    }

    private void run() {
        try (DatagramSocket socket = new DatagramSocket()) {
            socket.setBroadcast(true);
            while (thread == Thread.currentThread()) {
                byte[] data = message().getBytes(StandardCharsets.UTF_8);
                for (InetAddress target : targets()) {
                    try {
                        socket.send(new DatagramPacket(data, data.length, target, PORT));
                    } catch (Exception ignored) {
                        // uma interface pode não aceitar broadcast; tenta as outras
                    }
                }
                Thread.sleep(1000);
            }
        } catch (InterruptedException ignored) {
            // parou
        } catch (Exception ignored) {
            // sem rede: o farol simplesmente não anuncia
        }
    }

    /** Endereços de broadcast de cada rede (Wi-Fi, hotspot) + o geral. */
    static List<InetAddress> targets() {
        List<InetAddress> out = new ArrayList<>();
        try {
            for (NetworkInterface ni : Collections.list(NetworkInterface.getNetworkInterfaces())) {
                if (!ni.isUp() || ni.isLoopback()) continue;
                for (InterfaceAddress ia : ni.getInterfaceAddresses()) {
                    InetAddress b = ia.getBroadcast();
                    if (b != null && !out.contains(b)) out.add(b);
                }
            }
        } catch (Exception ignored) {
        }
        try {
            InetAddress all = InetAddress.getByName("255.255.255.255");
            if (!out.contains(all)) out.add(all);
        } catch (Exception ignored) {
        }
        return out;
    }
}
