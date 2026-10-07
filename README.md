# Caminhos da Memória — Vargem Alta (ES)

Jogo educativo em **3D para navegador**, compatível com **óculos de realidade virtual (WebXR)**, sobre os povos e processos que formaram o município de **Vargem Alta**, no sul do Espírito Santo.

> Quatro histórias. Um mesmo chão.

| Capítulo | Protagonista | Tema | Época |
|---|---|---|---|
| I · Os Primeiros Caminhos | **Inácio** | Povo Puri: presença anterior à colonização, aldeamento e resistência | c. 1855 |
| II · O Caminho do Tambor | **Bento** | Fugas do cativeiro, ranchos, jongo e caxambu na origem de Pedra Branca | c. 1886 |
| III · Terra, Café e Trilhos | **Pietro** | Imigração italiana, café e a chegada da Estrada de Ferro Leopoldina | fim do séc. XIX |
| IV · O Armazém da Estação | **Youssef** | Imigração libanesa e comércio na vila da estação | 1927 |
| Epílogo · Vargem Alta | — | A emancipação (Lei nº 4.063/1988; instalação em 1/1/1989) | hoje |

Cada capítulo leva cerca de 3 minutos (jornada completa ≈ 15 min). O mesmo vale aparece em todas as épocas: a fazenda do capítulo II vira ruína no capítulo III, e o entorno da estação vira a vila de 1927 e a praça de hoje.

## Destaques

- Cenários, personagens, música e sons **100% procedurais** (sem arquivos de modelo, textura ou áudio para baixar).
- Visual **estilizado** (estilo animação): vale plano com morros e pedras de granito ao fundo, copas "fofas", capim com a cor do chão, casas coloniais com telhas capa-e-canal, luz envolvente com recorte e sombras suaves.
- Personagens com **corpo contínuo (skinning)** que dobra nos ombros, cotovelos, quadril e joelhos, rostos expressivos e cabelos em mechas — uma chamada de desenho por personagem.
- **Otimizado**: construções e objetos assados numa malha só com cores por vértice, vegetação instanciada em blocos com nível de detalhe por distância, capim só perto da câmera e resolução dinâmica.
- Iluminação por hora do dia (amanhecer, noite de lua, manhã, entardecer), neblina de vale, água animada, vegetação da Mata Atlântica com vento, ipês floridos, cafezais, bloom e gradação de cor.
- Mecânicas curtas e variadas: coleta, pesca com lança, furtividade sob a luz dos lampiões, seguir o som do tambor, construir o rancho, **minijogo de ritmo do caxambu**, plantar café, carregar sacas até o trem, entregas na vila.
- **Acervo Histórico**: cartões com os registros da pesquisa e as fontes (separando fato de ficção).
- Funciona com teclado e mouse, toque (celular/tablet), controle (gamepad) e **óculos VR** (Meta Quest e similares).
- Modo exposição: sem interação por 3 minutos, o jogo volta sozinho ao menu.

## Rodar localmente

```bash
npm install
npm run dev      # desenvolvimento
npm run build    # gera a pasta dist/
npm run preview  # testa o build
```

## Publicar na Vercel

1. Envie este repositório para o GitHub.
2. Na Vercel: **Add New → Project**, importe o repositório.
3. A Vercel detecta **Vite** automaticamente (build `npm run build`, saída `dist`) — já configurado em `vercel.json`.
4. Clique em **Deploy**. O endereço gerado já usa HTTPS, necessário para o modo VR.

## Realidade virtual

Abra o endereço no navegador dos óculos (ex.: Meta Quest Browser) e toque em **Entrar em Realidade Virtual** na tela inicial.
Analógico esquerdo anda, analógico direito gira, gatilho interage/avança, botão B/Y abre a pausa. Em VR a qualidade gráfica “Leve” é usada automaticamente.

## Controles

- **Teclado/mouse**: WASD ou setas andam · Shift corre · arraste para olhar · roda aproxima · `E`/`Espaço`/clique interage · `Esc` pausa
- **Toque**: lado esquerdo move · lado direito olha · botão ● interage
- **Controle**: analógicos · `A` interage · Start pausa

## Editar textos e personagens

- Nomes, falas-chave, aparência, registros históricos e créditos: `src/story/data.js`
- Roteiro de cada capítulo: `src/story/ch1_puri.js` … `ch5_epilogo.js`
- Motor: `src/core/` (gráficos, áudio, VR, interface) e `src/world/` (terreno, vegetação, construções, personagens)

Parâmetros úteis de URL para testes: `?ch=bento` abre direto um capítulo; `?q=low|medium|high` força a qualidade.

## Fontes da pesquisa

- OLIVEIRA, T. G. de; COSTA, H. A. V. *Os Puri no sul do Espírito Santo: ocupação, territorialização e trabalho compulsório* (2019).
- IPHAN — Inventário Nacional de Referências Culturais (ficha de 2014 sobre Vargem Alta; comunidade quilombola de Pedra Branca) e cadastro do grupo “Caxambu Fé Raça em um Só Coração — Pedra Branca”.
- CAMPOS, M. A. *A trajetória do migrante libanês no Espírito Santo*. Revista IJSN, ano IV, n. 2, 1985 (portal Morro do Moreno).
- Prefeitura Municipal de Vargem Alta — histórico e perfil do município.
- IBGE — histórico do município de Vargem Alta.

Os protagonistas, falas e tarefas são ficcionais e foram criados para a experiência educativa; a imagem de referência dos personagens serviu como inspiração artística, não como prova histórica (ver “Fontes e Créditos” dentro do jogo).
