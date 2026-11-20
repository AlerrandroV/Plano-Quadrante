# Plano Quadrante · plataforma de jogos

Plataforma de **jogos de tabuleiro e de cartas para jogar junto, sem
internet**, com visual retrô pixelado. O app se chama Plano Quadrante e
começou com um jogo novo, hoje chamado *Domínio da Teia*, um
jogo novo sobre o plano cartesiano, e agora reúne vários jogos com a mesma
identidade visual.

| Jogo | Jogadores | Espectadores |
|---|---|---|
| **Domínio da Teia** (antes "Plano Quadrante") | 2 a 4 | sim |
| **Damas** (regras brasileiras, 8×8) | 2 | sim |
| **Dominó** (batida ou pontos) | 2 a 4 | sim (só na sala Wi-Fi ou você contra robôs) |
| **Última Carta** (cartas; regras oficiais ou de rua) | 2 a 6 | sim (só na sala Wi-Fi ou você contra robôs) |
| **Pife** (tradicional ou regras da casa) | 2 a 6 | sim (só na sala Wi-Fi ou você contra robôs) |
| **Poker** (Texas Hold'em) | 2 a 8 | sim (só na sala Wi-Fi ou você contra robôs) |
| **Solitário** (paciência; compra 1, 2 ou 3) | 1 | sim |

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

## Regras do Domínio da Teia

As peças são **aranhas** numa **teia** de 81 pontos, de (-4, -4) a (4, 4),
com o centro em (0, 0). Cada ponto se liga aos vizinhos por fios que se
curvam em direção aos eixos X0 e Y0, e os eixos são fios retos. Os fios da
borda têm cores fixas: azul em cima, laranja à direita, verde embaixo e
vermelho à esquerda. Cada jogador tem 8 aranhas na reserva.

1. **Na sua vez, role os dois dados octaedros (1 a 4).** O dado *quente* anda
   na horizontal: vermelho para a esquerda, laranja para a direita. O dado
   *frio* anda na vertical: verde para baixo, azul para cima.
2. **Use um dos dois dados** para:
   - **pôr** uma aranha da reserva, contando a partir do centro: em (dado quente, 0) ou (0, dado frio);
   - **mover** uma aranha sua essa quantidade de pontos na direção do dado.
3. **A teia acaba na borda:** um movimento que sairia da teia não pode ser
   feito. (Antes o tabuleiro era infinito, e quem saía voltava pelo outro lado.)
4. **Captura (obrigatória):** cair numa aranha inimiga a captura. Ela vai
   para o seu **cativeiro**, a sua aranha sobe um nível (máximo 4) e você joga
   de novo. Uma aranha posta capturando já entra no nível 1.
5. **Bônus de nível:** depois de mover, uma aranha de nível N pode andar até
   N pontos extras em linha reta, em qualquer uma das 8 direções, só até a
   borda. Pode pular por cima das próprias aranhas e capturar no fim.
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
`DECISÃO` em `web/js/games/dominio-da-teia/rules.js`):

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
  js/games/dominio-da-teia/rules.js, ui.js
  js/games/damas/rules.js, ui.js
  js/ui/pixel.js          pixel art 2x gerada em código (aranhas, peões, pedras, dados, peças de dominó, fonte 5x7)
  js/ui/table.js          "mesa" comum: grade simétrica, painéis, registro, ajuda
  js/ui/platform.js       catálogo, seletor de cores, placar
  js/ui/colors.js         as 10 cores e a regra de cores únicas
  js/games/domino/rules.js, ui.js
  js/games/ultima-carta/rules.js, ui.js, cards.js (cartas em pixel art), fx.js (efeitos)
  js/games/pife/rules.js, ui.js
  js/games/poker/rules.js, ui.js
  js/games/solitario/rules.js, ui.js
  js/ui/cards52.js        baralho francês em pixel art, desenhado em 64x92 (Pife, Poker, Solitário)
  js/bots/                robôs (damas: alfa-beta; Domínio da Teia: perigo; dominó: memória e bloqueio; Última Carta: ataque e memória de cores) + Web Worker
  js/ui/modal.js          janelas do próprio jogo (no lugar de confirm/prompt/dialog do navegador)
  js/modes/menu.js        menu do app: Mesma tela / Criar sala / Entrar numa sala (código ou salas na rede)
  js/ui/sound.js          efeitos sonoros 16 bits sintetizados (Web Audio, sem arquivos)
  js/modes/menu.js        menu do app (Mesma tela / Sala Wi-Fi)
  js/modes/local.js       mesma tela: catálogo → preparação → partida
  js/modes/host.js        sala: QR, jogo, quem joga/assiste, placar, autoridade
  js/modes/player.js      jogador/espectador no navegador
  js/net/relay-client.js  WebSocket com reconexão automática
  vendor/                 QR code e fontes pixel (licenças MIT e OFL)
android/                  app Android (WebView + servidor NanoHTTPD + anúncio/busca de salas na rede)
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

## Robôs (jogar contra o computador)

Os dois jogos têm robôs em **3 níveis**:
- **Na mesma tela:** na preparação, cada lugar alterna *Pessoa → Fácil → Médio → Difícil*.
- **Na sala Wi-Fi:** o mestre usa *+ Robô* na aba Pessoas. O robô entra como jogador: tem cor, joga ou assiste e conta no placar.

Os robôs pensam num Web Worker, sem travar a tela, e esperam as animações
para dar tempo de acompanhar a jogada.

**Damas** (`web/js/bots/damas.js`): minimax com poda alfa-beta. O nível é
quantos meios-lances o robô enxerga à frente:
- **Fácil:** 2 meios-lances. Julga com erro e às vezes faz um lance qualquer.
- **Médio:** 4 meios-lances.
- **Difícil:** até 12 meios-lances, com limite de tempo.

A busca nunca para no meio de uma sequência de capturas obrigatórias.

**Domínio da Teia** (`web/js/bots/dominio-da-teia.js`): o robô testa cada
jogada possível (colocar ou mover, cartas, bônus) e avalia o resultado. O
nível muda o que ele *percebe*:
- **Fácil:** jogador distraído. Em 1 de cada 4 jogadas ignora o perigo, julga com erro e esquece o bônus na metade das vezes.
- **Médio:** calcula a chance de cada peça sua ser capturada nas 64 combinações de dados dos adversários. Mas não percebe os movimentos extras das peças evoluídas, e usa o próprio bônus só para capturar.
- **Difícil:** inclui os movimentos extras dos adversários no cálculo de perigo, usa o bônus para se posicionar e escolhe o melhor alvo de cada carta.

Medido em partidas entre robôs (`test/bots.test.mjs` garante que continua assim):

| Confronto | Resultado |
|---|---|
| Damas: Médio × Fácil | ~80% de vitórias do Médio |
| Damas: Difícil × Médio | 9 vitórias, 1 empate e nenhuma derrota em 10 partidas |
| Domínio da Teia: Médio × Fácil | ~91% de vitórias do Médio |
| Domínio da Teia: Difícil × Médio | ~68% de vitórias do Difícil |

As simulações também mostraram algo sobre o Domínio da Teia: **perceber o
perigo de ser capturado é a habilidade que mais pesa**. Ignorá-la em 1/3 das
jogadas já faz perder ~80% das partidas, mesmo com a sorte dos dados.
Esquecer o próprio bônus, sozinho, quase não muda o resultado.

**Dominó** (`web/js/bots/domino.js`): o robô só enxerga a própria mão.
- **Fácil:** joga qualquer peça que encaixe.
- **Médio:** solta as carroças cedo, mantém variedade de números na mão e, no modo pontos, faz os pontos que estiverem à vista.
- **Difícil:** tudo isso e mais:
  - **Memória:** lembra quais números cada adversário não tem (porque comprou ou passou) e tenta trancá-lo.
  - **Pontas difíceis:** conta quantas peças desconhecidas ainda servem nas pontas que vão ficar e prefere as pontas difíceis para o próximo.
  - **Defesa:** no modo pontos, evita abrir pontos para o próximo jogador.

Na batida, a sorte da distribuição pesa bastante (é uma rodada só). Mesmo
assim, o Difícil vence o Fácil em ~68% das partidas e o Médio em ~61%. No
modo pontos, o Médio vence o Fácil em ~80%.

**Última Carta** (`web/js/bots/ultima-carta.js`): o robô só enxerga a própria mão.
- **Fácil:** joga qualquer carta que sirva; às vezes esquece de gritar "Última!" e raramente pega quem esqueceu.
- **Médio:** guarda os Coringas, solta cartas que valem mais pontos e escolhe a cor de que tem mais.
- **Difícil:** tudo isso e mais:
  - **Memória de cores:** lembra em que cor cada um teve que comprar e deixa a mesa nessa cor.
  - **Ataque:** usa Pula, +2 e +4 em quem está perto de bater; com 2 jogadores, encadeia jogadas.
  - **Desafio:** desafia o +4 quando quem jogou tinha muitas cartas (mais chance de blefe).

É um jogo de muita sorte: o Médio vence o Fácil em ~63% das partidas, o
Difícil vence o Médio em ~56% e o Fácil em ~68% (simulação, 2 jogadores).

**Pife** (`web/js/bots/pife.js`): o robô só enxerga a própria mão e o descarte. Todos guardam os melés e, armados, batem com o descarte fora da vez (o Fácil às vezes demora; o Difícil nunca perde a chance).
- **Fácil:** guarda os jogos prontos, mas descarta meio ao acaso e quase não pega do descarte.
- **Médio:** conta jogos prontos e "pares" (duplas que viram jogo com mais uma carta) e descarta o que menos ajuda.
- **Difícil:** pesa cada par pelas cartas que ainda podem sair (as do descarte já eram) e não descarta o que combina com o que o próximo já pegou do descarte.

Simulação (2 jogadores, com melé): Médio vence o Fácil em ~67%; Difícil vence o Fácil em ~67% e o Médio em ~51%. Sem melé, o Difícil vence o Fácil em ~80%. Os melés deixam o jogo mais rápido e com mais sorte.

**Poker** (`web/js/bots/poker.js`): a força da mão vem de simulações (Monte Carlo): o robô sorteia as cartas que faltam centenas de vezes e conta quantas vezes venceria.
- **Fácil:** poucas simulações e muito "achismo": paga demais, desiste à toa.
- **Médio:** compara a chance de vencer com o preço de pagar (pot odds) e aposta quando está forte.
- **Difícil:** mais simulações; aposta conforme a força, semi-blefa, desconfia de aposta grande (desconta da chance) e só entra em guerra de aumentos com mão muito forte.

Simulação (mano a mano, 1000 fichas): Médio vence o Fácil em ~88%; Difícil vence o Médio em ~62% e o Fácil em ~82%.

## Dominó

Dominó duplo-seis (28 peças), de 2 a 4 jogadores, 7 peças para cada um.

**Rodada**
- **Monte:** com 2 ou 3 jogadores sobra o monte. Quem não tem peça que encaixe compra até poder jogar; com o monte vazio, passa a vez.
- **Quem começa:** na primeira rodada, quem tem a maior carroça, jogando ela.
- **Trancado:** se ninguém consegue jogar, vence quem tem menos pontos na mão.

**Variações** (o mestre escolhe na aba *Jogo*):
- **Batida:** vence quem descartar todas as peças da mão primeiro.
- **Pontos:**
  - Se a soma das pontas for múltiplo de 5 depois da sua jogada, você marca essa soma (carroça na ponta conta dobrado).
  - Quem bate ganha os pontos das mãos dos outros, arredondados para o múltiplo de 5 mais próximo.
  - Rodadas até alguém chegar a **100**.

**Sem modo de mesma tela:** cada um vê só a própria mão, e o
celular de quem joga recebe apenas as próprias peças (dos outros, só a
quantidade). No site e na opção *Mesma tela* do app, o dominó é só **você
contra robôs**. Para jogar com amigos, use a sala Wi-Fi.

## Última Carta

Jogo de cartas de descarte, da família do *Crazy Eights* e do *Mau-Mau*,
com nome, naipes e cartas próprios da plataforma. 108 cartas em 4 naipes
(**Chama**, **Gota**, **Folha** e **Sol**): um 0 e dois de cada 1 a 9,
dois **Pula**, dois **Volta** e dois **+2** por naipe, mais 4 **Coringas** e
4 **Coringas +4**. De 2 a 6 jogadores, 7 cartas para cada.

**Regras oficiais** (padrão):
- **Na vez:** jogue uma carta da mesma cor ou do mesmo número/símbolo da carta da mesa, ou um Coringa. Sem jogar, compre 1; se ela servir, pode jogar na hora; se não, passa.
- **Pula:** o próximo perde a vez. **Volta:** inverte o sentido; com 2 jogadores, vale como Pula. **+2:** o próximo compra 2 e perde a vez. **Coringa:** escolhe a cor.
- **+4:** escolhe a cor; o próximo compra 4 e perde a vez. Só vale sem carta da cor da mesa. O próximo pode **desafiar**: se quem jogou tinha a cor, ele compra 4; se não tinha, o desafiante compra 6.
- **Carta virada no começo:** Pula, Volta, +2 e Coringa valem para o primeiro jogador; um +4 volta para o monte.
- **"Última!":** ao ficar com 1 carta, aperte o botão. Se alguém apertar **Pegar** antes de o próximo jogar, você compra 2.
- **Vitória:** quem ficar sem cartas. No modo **500 pontos**, quem bate ganha os pontos das mãos dos outros (número = valor; Pula, Volta e +2 = 20; Coringas = 50).

**Regras de rua** (as mais citadas em fóruns; o mestre liga as que quiser):
- **Empilhar +2/+4:** recebeu +2? Jogue outro +2 (ou um +4) e a compra acumulada passa adiante. Um +4 sobre outro +4 também.
- **Corte:** quem tem a carta idêntica à da mesa (mesma cor e número) joga fora da vez, e o jogo segue a partir dele.
- **7 troca, 0 gira:** o 7 troca a sua mão com a de quem você escolher; o 0 gira todas as mãos no sentido do jogo.
- **Compra até jogar:** sem carta que sirva, compra até achar uma.
- **Bate com número:** a última carta não pode ser especial.
- **+4 sem desafio:** o +4 vale a qualquer hora e ninguém desafia.

**Efeitos visuais:** cada carta especial tem animação, em todos os celulares
da sala. No **Pula**, o símbolo de bloqueio sai do meio da roda e vai até
quem perde a vez. No **+2/+4**, o "+2"/"+4" voa até quem vai comprar, e as
cartas saem do monte rapidinho, uma a uma. No **Volta**, o símbolo de reverso
surge no meio da roda, gira no novo sentido e some. Qualquer compra (inclusive
o *compra até jogar*) tira uma carta por vez do monte até a mão, e o contador
de cartas só sobe quando cada uma chega. Os robôs esperam a animação acabar.

Como o dominó, **não tem modo de mesma tela**: cada celular recebe só a
própria mão. Quem jogou um +4 também não revela se tinha a cor (só o
servidor sabe, para julgar o desafio).

## Pife

Dois baralhos (104 cartas), de 2 a 6 jogadores, 9 cartas para cada.

- **A vira e os melés:** antes de distribuir, uma carta é virada e fica exposta ao lado do monte (fora do jogo). Ela define os **melés**, os curingas da partida: o **clone** da vira (a mesma carta do outro baralho) e as cartas do **valor seguinte da mesma cor**. Ex.: vira 4 de Ouros → melés: 4 de Ouros, 5 de Ouros e 5 de Copas (dois de cada) = **5 melés**. Depois do Rei vem o Ás. Na mão, os melés aparecem com uma estrela.
- **Na vez:** compre 1 carta (do monte ou a de cima do descarte) e descarte 1. Quem pegou do descarte não pode descartar a mesma carta. **Melé do descarte** só pode ser pego se for a última carta que falta para bater.
- **Bater:** formar 3 jogos de 3 cartas com as 9 e descartar a 10ª.
  - **Trinca:** 3 cartas do mesmo valor, de naipes diferentes.
  - **Sequência:** 3 cartas seguidas do mesmo naipe (A-2-3 e Q-K-A valem; K-A-2 não).
  - O melé vale qualquer carta (um por jogo) ou ele mesmo.
- **Armado, fora da vez:** quem só precisa de uma carta pode bater com a carta de cima do descarte **mesmo fora da vez** (botão "Bater com..."), mas tem que ser rápido: se outra carta já tiver sido descartada por cima, é **choque**.
- **Caixas:** a mão fica numa caixa de 9 lugares e, embaixo, 3 caixas de 3 lugares para montar os jogos. Toque numa carta e depois noutro lugar para mover ou trocar. As cartas começam em ordem: A, 2-10, J, Q, K; Ouros, Paus, Copas, Espadas. A caixa de baixo fica verde quando o jogo fecha. Com as 3 caixas cheias, aparece **Bater!**, e a carta que sobrou em cima é o descarte.

**Regras da casa** (cada uma liga e desliga):
- **Bater de naipe:** as 9 cartas do mesmo naipe batem; o melé vale qualquer naipe.
- **Mão sem par:** se as 9 cartas recebidas não formam nem um par, bate de cara. Par aqui é valor repetido ou dupla do mesmo naipe que possa virar sequência (seguidas ou com um buraco, ex.: 5 e 7).
- **Choque:** anunciou que bateu sem ter batido, ou chegou atrasado no descarte? "Deu choque": a partir daí só pode bater com carta comprada do **monte**.
- **Com coringa** (desligada): entram os 4 coringas do baralho, que também valem qualquer carta.

A opção *Sem melé* joga sem a vira.

## Poker

Texas Hold'em sem limite, de 2 a 8 jogadores.

- **Blinds:** o botão (D) gira a cada mão e os dois seguintes põem o small e o big blind. No mano a mano, o botão é o small blind. Os blinds sobem a cada 10 ou 5 mãos, ou ficam fixos.
- **Cartas:** cada um recebe 2 fechadas; 5 abertas vão para a mesa (flop 3, turn 1, river 1). Vale a melhor mão de 5 entre as 7.
- **Na vez:** desistir, passar, pagar, apostar ou aumentar (no mínimo o último aumento) ou all-in. O painel de aumento tem atalhos: mínimo, ½ pote, pote e tudo.
- **Showdown:** quem chega até o fim mostra as cartas (só essas são enviadas aos outros celulares). All-in com menos fichas cria **potes paralelos**: cada um só disputa o que cobriu. Empate divide o pote.
- **Fim:** quem fica sem fichas sai. Vence quem ficar com todas, ou quem tiver mais depois de 20 mãos (opção).

## Solitário

A paciência clássica (Klondike), para 1 jogador; na sala Wi-Fi, os outros assistem.

- **Objetivo:** levar as 52 cartas para as 4 fundações, uma por naipe, do Ás ao Rei.
- **Colunas:** carta sobre outra de cor diferente e valor 1 acima; dá para mover uma sequência aberta inteira; coluna vazia só recebe Rei.
- **Níveis:** o monte tira **1** carta por vez no Fácil, **2** no Médio e **3** no Difícil (só a de cima do descarte vale). O descarte volta para o monte sem limite.
- **Toque inteligente:** toque numa carta e ela vai sozinha para a fundação ou para o único lugar possível; se couber em mais de um lugar, ela fica marcada e você toca no destino. Tem **Desfazer** e **Recolher**.

## Convites e app com app

**Convite pelo QR code, num Android:** antes de entrar, a pessoa escolhe:
- **Abrir no app:** se o app estiver instalado, a sala abre nele. É um link `intent://` do Android; sem o app, o navegador volta para o convite avisando que não achou o app.
- **Baixar app Android:** o APK vem **do próprio celular do mestre** (`/plano-quadrante.apk`), então funciona até no hotspot, sem internet.
- **Continuar no navegador:** sem instalar nada.

No iPhone e no computador (onde o APK não serve), a pessoa entra direto.

**Dois ou mais celulares com o app:** no menu, use **Entrar numa sala**.
- **Salas achadas na rede:** cada sala aberta anuncia na rede local (UDP broadcast, a cada segundo) o seu **código de 4 dígitos**, o nome do mestre, o jogo e quantas pessoas estão nela. A sala aparece sozinha na lista.
- **Código:** também dá para digitar o código. Ele aparece em *Convidar*, ao lado do QR.

**Por que não abre "por padrão" no app direto do QR code?** Isso exige *App
Links verificados*: um endereço **https** com um arquivo de verificação na
raiz do domínio. O convite aponta para o IP local do celular do mestre
(`http://192.168.x.x:8080`), que o Android não consegue verificar. Daria para
fazer com um site `AlerrandroV.github.io`, mas aí quem **não** tem o app
precisaria de internet para abrir o convite. O botão *Abrir no app* resolve
com um toque, sem domínio e sem internet.

## Pixel art em 2x

Tudo o que é desenhado nos jogos tem o dobro de pixels por peça:

| Peça | Tamanho |
|---|---|
| Peão | 24×24 |
| Pedra de damas | 28×28 |
| Dado | 42×42 |
| Peça de dominó | 24×48 |
| Aranha | 24×24 |
| Teia do Domínio da Teia | 300 px |
| Tabuleiro de damas | 316 px |
| Mesa do dominó | 352 px |

Continua pixelado, mas com espaço para detalhe:
- sombreado em 5 tons, brilho e contornos;
- espessura e anel nas pedras, coroa com pedra vermelha;
- chanfro, pino e pontos redondos no dominó;
- a teia com fios curvos, nós de seda e orvalho, e os números das coordenadas no Domínio da Teia;
- textura nas casas e no feltro.

As peças são geradas por forma + luz (`ui/pixel.js`) e guardadas em cache,
e o fundo dos tabuleiros é desenhado uma vez só. Num celular comum, o
Domínio da Teia e as damas aparecem em 100%, nítidos. Em telas menores que
o tabuleiro, a redução é suavizada, para não sumir linha fina.

## Sons e janelas

- **Efeitos sonoros 16 bits** nos três jogos:
  - quais são: dados, peça pousando, captura, carta, promoção a dama, peça de dominó batendo, compra, pontos, vitória e derrota;
  - são sintetizados na hora (Web Audio), então funcionam sem internet e não pesam no app;
  - liga e desliga em *Menu → Som* (fica salvo no aparelho).
- **Sem janelas nativas do navegador:** confirmações, nome, placar, ajuda,
  cores e menu usam janelas do próprio jogo (`ui/modal.js`). O `confirm()`
  e o `prompt()` do navegador nem aparecem na WebView do app Android (os
  botões "Sair", "Desistir" e "Empate" não funcionavam lá por isso).

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
