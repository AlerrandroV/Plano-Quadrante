# Plano Quadrante · plataforma de jogos

Plataforma de **jogos de tabuleiro e de cartas para jogar junto, sem
internet**, com visual retrô pixelado. Começou com o *Plano Quadrante*, um
jogo novo sobre o plano cartesiano, e agora reúne vários jogos com a mesma
identidade visual.

| Jogo | Jogadores | Espectadores |
|---|---|---|
| **Plano Quadrante** | 2 a 4 | sim |
| **Damas** (regras brasileiras, 8×8) | 2 | sim |

O mesmo código roda de três jeitos, e **descobre sozinho** em qual está:

| Onde abre | Modo | Como se joga |
|---|---|---|
| GitHub Pages (`*.github.io`) | **Mesma tela** | Catálogo → nomes e cores → todos no mesmo aparelho. O site oferece o APK para jogar cada um no seu celular. |
| App Android (APK) | **Menu**: Mesma tela ou Sala Wi-Fi | Na sala, o app abre um servidor no celular e mostra um QR code. |
| Navegador de um amigo, pelo QR code | **Jogador** ou **espectador** | Basta estar no mesmo Wi-Fi (ou no hotspot de quem criou a sala). Funciona em Android e iPhone, sem instalar nada. |

**Em todos os jogos:**
- **Cor das peças:** cada jogador escolhe a sua entre 10 cores. Duas pessoas não podem ter a mesma.
- **Mestre da sala:** escolhe o jogo de cada partida no catálogo e decide quem joga e quem assiste.
- **Placar da sala:** mostra quem ganhou mais partidas. Na mesma tela, o placar da mesa soma as vitórias por nome.

## Regras do Plano Quadrante

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
`DECISÃO` em `web/js/games/plano-quadrante/rules.js`):

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
4. Na sala (abas *Convidar · Pessoas · Jogo · Placar*), o mestre escolhe o
   jogo e toca em **Joga/Assiste** para decidir quem joga. Cada um escolhe a
   cor das suas peças. Depois, **Começar**.
5. Quem assiste vê a partida ao vivo. Quem chegar no meio entra assistindo.
   Ao fim, a vitória vai para o **placar da sala**.

Se a tela de alguém apagar ou a página recarregar, a pessoa volta para o mesmo
lugar na partida.

Durante a partida, o botão **Tela cheia** esconde o cabeçalho (e, onde o
navegador permite, as barras do navegador). No app, as barras do Android
ficam escondidas automaticamente; deslize da borda para vê-las.

**Tudo cabe em uma tela**, sem rolagem nem "puxar para atualizar". A partida
é uma grade simétrica: em pé, *lado A / tabuleiro / lado B* (as duas faixas
sempre do mesmo tamanho); deitado, as faixas viram colunas. O tabuleiro é
calculado para o espaço que sobra, e o painel de quem está na vez se expande
enquanto quem divide o lado com ele fica recolhido (só ícone e números).

## Como funciona por dentro

```
            ┌──────────── celular do mestre da sala (APK) ─────────────┐
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
  roda no JavaScript do mestre da sala, que envia a cada jogador apenas o que
  ele pode ver (`game.view`).
- **Sem internet:** nada vem de CDN. A biblioteca do QR code fica em
  `web/vendor/`.

## Estrutura

```
web/                      a plataforma (HTML/CSS/JS puro, sem build)
  js/env.js               detecção do modo + link do APK
  js/games/index.js       ← CATÁLOGO: lista de jogos, ilustrações, capacidade
  js/games/plano-quadrante/rules.js, ui.js
  js/games/damas/rules.js, ui.js
  js/ui/pixel.js          paleta, peões, pedras, dados (pixel art em canvas)
  js/ui/table.js          "mesa" comum: grade simétrica, painéis, registro, ajuda
  js/ui/platform.js       catálogo, seletor de cores, placar
  js/ui/colors.js         as 10 cores e a regra de cores únicas
  js/modes/menu.js        menu do app (Mesma tela / Sala Wi-Fi)
  js/modes/local.js       mesma tela: catálogo → preparação → partida
  js/modes/host.js        sala: QR, jogo, quem joga/assiste, placar, autoridade
  js/modes/player.js      jogador/espectador no navegador
  js/net/relay-client.js  WebSocket com reconexão automática
  vendor/                 QR code e fontes pixel (licenças MIT e OFL)
android/                  app Android (WebView + servidor NanoHTTPD)
server/dev-server.mjs     o mesmo servidor do app, em Node, para testar no PC
test/                     testes das regras de cada jogo
```

## Desenvolvimento

```bash
npm install
npm test          # testes das regras de cada jogo (inclui partidas aleatórias completas)
npm run dev       # sobe a sala no PC
```

- `http://localhost:8080`: você vê o menu do app (Mesma tela ou Sala Wi-Fi).
- No celular, no mesmo Wi-Fi, abra o endereço que aparece no terminal: você é um jogador.
- `http://localhost:8080/?modo=local`: modo mesma tela (igual ao GitHub Pages).

O app Android abre no Android Studio pela pasta `android/`. A pasta `web/` é
empacotada automaticamente dentro do APK.

## Como adicionar um jogo

Cada jogo é uma pasta em `web/js/games/<id>/` com:

- `rules.js`: regras como funções puras (fáceis de testar), seguindo o contrato abaixo;
- `ui.js`: `render(root, view, ctx)` usando a mesa comum (`ui/table.js`) e a
  pixel art (`ui/pixel.js`), para manter a identidade visual, e `RULES`, o
  texto do botão "?".

```js
meta                         // { id, name, minPlayers, maxPlayers }
defaultColors(n)             // cores padrão de cada assento
setup(players)               // players = [{ id, name, color }] -> estado
act(state, playerId, action) // novo estado, ou null se a jogada é inválida
view(state, playerId)        // o que esse jogador vê (null = espectador); esconda segredos aqui!
activePlayers(state)         // ids de quem joga agora
outcome(state)               // null, ou { winners: [ids] } (vazio = empate) -> placar
```

Depois é só registrar o jogo em `web/js/games/index.js`, com nome,
ilustração (desenhada em código, 64×40) e a dica de cada assento. Os modos
(mesma tela, sala, jogador, espectador), as cores e o placar passam a
funcionar sem mexer na rede.

## Damas: regras brasileiras

Damas olímpicas no tabuleiro 8×8, casa a1 escura, 12 pedras de cada lado.

- **Começo:** as brancas começam. Em "Jogar de novo", os lados se invertem.
- **Pedra:** anda uma casa na diagonal para frente e captura para frente e para trás.
- **Dama voadora:** anda e captura em qualquer distância e pode parar em qualquer casa livre depois da peça capturada.
- **Captura obrigatória, pela lei da maioria:** vale o lance que captura mais peças, e pedra e dama valem o mesmo.
- **Peças capturadas** só saem no fim do lance e não podem ser saltadas duas vezes.
- **Promoção:** a pedra só vira dama se *terminar* o lance na última fileira.
- **Fim de jogo:** perde quem fica sem peças ou sem lances. Há empate por acordo ou por 20 lances seguidos de cada lado só com damas, sem captura. Também dá para desistir.

Para personalizar, cada jogador pode trocar a cor das pedras (o padrão é
branco e preto). O tabuleiro continua preto e branco.

## Publicação (GitHub Actions)

- **Regras originais:** `docs/regras-oficiais.pdf` e `docs/manual-original.html`.
- **Site:** `.github/workflows/pages.yml` publica `web/` a cada push na
  `main`. Ative uma vez em *Settings → Pages → Source: GitHub Actions*.
- **APK:** `.github/workflows/android.yml` compila e cria uma Release nova a
  cada mudança em `web/` ou `android/` na `main`. O botão do site aponta
  sempre para a mais recente.

### Chave de assinatura

O Android só instala uma versão nova **por cima** da antiga se as duas
tiverem a mesma chave. Por isso o APK é sempre assinado com a chave fixa
`android/app/plano-quadrante.jks`, que está no repositório.

> Até a v0.1.9, cada build saía com uma chave diferente e a atualização dava
> "conflito com o pacote existente". **Desinstale a versão antiga uma vez**;
> daí em diante, as atualizações instalam por cima.

Como a chave está no repositório público, qualquer pessoa poderia assinar um
APK que o celular aceitaria como atualização. Para um projeto escolar isso
basta, desde que você só instale o APK das Releases deste repositório. Se
quiser uma chave secreta, gere uma (`keytool -genkeypair -keystore pq.jks
-alias planoquadrante -keyalg RSA -keysize 2048 -validity 10000`) e
cadastre em *Settings → Secrets and variables → Actions* os secrets
`PQ_KEYSTORE_BASE64` (saída de `base64 -w0 pq.jks`), `PQ_KEYSTORE_PASSWORD`,
`PQ_KEY_ALIAS` e `PQ_KEY_PASSWORD`. Trocar de chave exige desinstalar uma
última vez.

## Limitações conhecidas

- O mestre da sala precisa manter o app aberto. Se o Android fechar o app,
  a sala cai; ao reabrir, a partida em andamento é recuperada (até 30 min).
- Algumas redes (Wi-Fi de escola, faculdade, hotel) isolam os aparelhos entre
  si. Nesse caso, use o hotspot do celular de quem criou a sala.
- O app é só para Android. Jogadores podem usar qualquer navegador.
