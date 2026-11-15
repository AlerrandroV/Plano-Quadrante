# Plano Quadrante

Jogo de tabuleiro 9×9 sobre o plano cartesiano, para 2 a 4 jogadores, com
visual retrô pixelado. O mesmo código roda de três jeitos, e **descobre
sozinho** em qual está:

| Onde abre | Modo | Como se joga |
|---|---|---|
| GitHub Pages (`*.github.io`) | **Mesma tela** | Todos no mesmo aparelho, passando a vez. O site oferece o APK para quem quiser jogar cada um no seu celular. |
| App Android (APK) | **Criador da sala** | O app abre um servidor no celular e mostra um QR code. |
| Navegador de um amigo, pelo QR code | **Jogador** | Basta estar no mesmo Wi-Fi (ou no hotspot de quem criou a sala). Funciona em Android e iPhone, sem instalar nada. |

## Regras

Cada jogador tem 8 peões na reserva. O tabuleiro tem 81 interseções, de
(-4, -4) a (4, 4), com o centro em (0, 0). A moldura tem cores fixas:
azul em cima, laranja à direita, verde embaixo e vermelho à esquerda.

1. **Na sua vez, role os dois dados octaedros (1 a 4).** O dado *quente* anda
   na horizontal: vermelho para a esquerda, laranja para a direita. O dado
   *frio* anda na vertical: verde para baixo, azul para cima.
2. **Use um dos dois dados** para:
   - **colocar** uma peça da reserva, contando a partir do centro: em (dado quente, 0) ou (0, dado frio);
   - **mover** uma peça sua essa quantidade de casas na direção do dado.
3. **Tabuleiro infinito:** quem sai por um lado volta pelo outro.
4. **Captura (obrigatória):** cair numa peça inimiga a captura. Ela vai para
   o seu **cativeiro**, a sua peça sobe um nível (máximo 4) e você joga de novo.
   Uma peça colocada capturando já entra no nível 1.
5. **Bônus de nível:** depois de mover, uma peça de nível N pode andar até N
   casas extras em linha reta, em qualquer uma das 8 direções. Pode pular por
   cima das próprias peças e capturar no fim.
6. **Cartas:** dados com o mesmo número dão uma carta especial, que você usa
   na hora ou descarta: Bloqueio, Reverso, Salvar, +1 de nível, -1 de nível e
   Jogar novamente.
7. **Vitória:** vence quem tiver **6 inimigos em cativeiro** (com 2 jogadores)
   ou **8** (com 3 ou 4), ou quem sobrar com peças. Quem fica sem nenhuma peça
   é eliminado. Quando restam 2 jogadores, quem ficar com 2 peças ou menos no
   tabuleiro e nenhuma na reserva também é eliminado.

### Decisões tomadas onde as fontes discordavam

O PDF de regras, o `manual.html` e o protótipo (`script.js`) às vezes
dizem coisas diferentes. Estas foram as escolhas (todas marcadas com
`DECISÃO` em `web/js/game/plano.js`):

| Ponto | Escolha | Por quê |
|---|---|---|
| Para onde vai a peça capturada | Cativeiro de quem capturou (manual) | No PDF/protótipo ela voltava para a reserva do dono, então as peças nunca acabavam e **a partida não terminava**. |
| Usar um ou os dois dados | Um só (protótipo) | Foi a decisão registrada no protótipo. |
| Empilhar peças amigas | Não pode (protótipo) | O manual permitia até 2. |
| Cartas | Usar na hora ou descartar (PDF/protótipo) | Por isso *Trocar baralho* e *Contra-ataque* ficaram fora do sorteio: só fazem sentido com cartas guardadas na mão. |
| "Jogar novamente" | Ganha uma ação extra depois da atual | No protótipo, a carta descartava a rolagem atual. |
| Peça travada | Se não houver jogada possível, aparece "Passar a vez" | No protótipo o jogo travava. |

## Jogando com os amigos (cada um no seu celular)

1. Quem vai criar a sala baixa o APK pelo site ou em
   [Releases](../../releases/latest) e instala. O Android pode pedir para
   permitir a instalação de "fontes desconhecidas".
2. Todos se conectam ao **mesmo Wi-Fi**. Sem roteador por perto? Quem criou a
   sala liga o **hotspot** do celular e os outros se conectam nele. Não precisa
   de internet.
3. Abra o app. Os amigos leem o QR code com a câmera, ou digitam o endereço
   mostrado (ex.: `http://192.168.0.12:8080`) no navegador.
4. Quando todos aparecerem na lista, toque em **Começar partida**.

Se a tela de alguém apagar ou a página recarregar, a pessoa volta para o mesmo
lugar na partida.

## Como funciona por dentro

```
            ┌──────────── celular do criador da sala (APK) ────────────┐
            │  WebView (jogo, modo host)  ←ws→  LocalServer (Java)     │
            │  http://127.0.0.1:8080             • serve a pasta web/  │
            │  guarda o estado e valida jogadas  • /pq-info.json       │
            └──────────────────────────────────  • /ws (repassa msgs) ─┘
                                                    ↑ws        ↑ws
                                     navegador do amigo   navegador do amigo
                                   http://192.168.x.x:8080  (modo jogador)
```

- **Detecção do modo** (`web/js/env.js`): no `*.github.io` é sempre "mesma
  tela". Fora dele, o jogo procura `/pq-info.json`, que só o servidor da sala
  tem. Se existe e a página foi aberta em `127.0.0.1`/`localhost`, este
  aparelho é o criador; se foi aberta por um IP da rede, é um jogador.
- **O host manda no jogo:** o servidor só repassa mensagens. Toda a lógica
  roda no JavaScript do criador da sala, que envia a cada jogador apenas o que
  ele pode ver (`game.view`).
- **Sem internet:** nada vem de CDN. A biblioteca do QR code fica em
  `web/vendor/`.

## Estrutura

```
web/                    o jogo (HTML/CSS/JS puro, sem build)
  js/env.js             detecção do modo + link do APK
  js/game/plano.js      ← regras do jogo
  js/game/plano-ui.js   ← tabuleiro, painéis, dados e animações
  js/game/pixel.js      ← paleta e sprites em pixel art
  vendor/fonts/         fontes pixel (Press Start 2P, VT323; licença OFL)
  js/modes/local.js     mesma tela (GitHub Pages)
  js/modes/host.js      criador da sala: QR code, lobby, autoridade do jogo
  js/modes/player.js    jogador no navegador
  js/net/relay-client.js  WebSocket com reconexão automática
android/                app Android (WebView + servidor NanoHTTPD)
server/dev-server.mjs   o mesmo servidor do app, em Node, para testar no PC
test/                   testes da lógica do jogo
```

## Desenvolvimento

```bash
npm install
npm test          # testes das regras (inclui partidas aleatórias completas)
npm run dev       # sobe a sala no PC
```

- `http://localhost:8080`: você é o criador da sala (igual ao app).
- No celular, no mesmo Wi-Fi, abra o endereço que aparece no terminal: você é um jogador.
- `http://localhost:8080/?modo=local`: modo mesma tela (igual ao GitHub Pages).

O app Android abre no Android Studio pela pasta `android/`. A pasta `web/` é
empacotada automaticamente dentro do APK.

## Como o jogo se liga aos modos

As regras ficam em `web/js/game/plano.js` (funções puras, testadas em
`test/plano.test.mjs`) e a tela em `web/js/game/plano-ui.js` +
`pixel.js` (pixel art desenhada em canvas). O jogo segue este contrato:

```js
meta                        // { id, name, minPlayers, maxPlayers }
setup(players)              // estado inicial; players = [{ id, name }]
act(state, playerId, action)// novo estado, ou null se a jogada é inválida
view(state, playerId)       // o que esse jogador pode ver (esconda segredos aqui!)
activePlayers(state)        // ids de quem pode jogar agora
render(root, view, ctx)     // desenha; ctx = { me, send(action), shared }
```

Os três modos (mesma tela, criador da sala e jogador) só conversam com o
jogo por esse contrato, então mudar uma regra não exige mexer na rede.

## Publicação (GitHub Actions)

- **Regras originais:** `docs/regras-oficiais.pdf` e `docs/manual-original.html`.
- **Site:** `.github/workflows/pages.yml` publica `web/` a cada push na
  `main`. Ative uma vez em *Settings → Pages → Source: GitHub Actions*.
- **APK:** `.github/workflows/android.yml` compila e cria uma Release nova a
  cada mudança em `web/` ou `android/` na `main`. O botão do site aponta
  sempre para a mais recente.

### Chave de assinatura (recomendado)

Sem uma chave fixa, cada APK sai assinado com uma chave diferente e o Android
**não deixa atualizar** por cima da versão anterior (é preciso desinstalar
antes). Para resolver, gere uma chave uma única vez:

```bash
keytool -genkeypair -v -keystore pq.jks -alias planoquadrante \
  -keyalg RSA -keysize 2048 -validity 10000
base64 -w0 pq.jks   # copie a saída
```

E crie em *Settings → Secrets and variables → Actions*:

| Secret | Valor |
|---|---|
| `PQ_KEYSTORE_BASE64` | a saída do `base64` |
| `PQ_KEYSTORE_PASSWORD` | a senha do keystore |
| `PQ_KEY_ALIAS` | `planoquadrante` |
| `PQ_KEY_PASSWORD` | a senha da chave |

Guarde o `pq.jks` em lugar seguro e **nunca** o coloque no repositório.

## Limitações conhecidas

- O criador da sala precisa manter o app aberto. Se o Android fechar o app,
  a sala cai; ao reabrir, a partida em andamento é recuperada (até 30 min).
- Algumas redes (Wi-Fi de escola, faculdade, hotel) isolam os aparelhos entre
  si. Nesse caso, use o hotspot do celular de quem criou a sala.
- O app é só para Android. Jogadores podem usar qualquer navegador.
