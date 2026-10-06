# Prompts para o Claude no Blender — “Caminhos da Memória”

Guia para criar **todos os modelos 3D e o mapa** do jogo com o Claude conectado ao Blender (Blender MCP), já no formato que o jogo consegue usar.

## Como usar

1. Abra o Blender com o Claude conectado (Blender MCP). Se puder, ative a integração **Poly Haven** (texturas gratuitas CC0) e a **busca na web** do Claude.
2. Em **toda conversa nova**, cole primeiro o **PROMPT 0** (estilo e regras técnicas). Depois cole o pedido da vez.
3. Faça **um pedido por vez, nesta ordem**: mapa → personagens → natureza → construções e objetos. Aprove cada etapa pelos screenshots antes de seguir.
4. Nos pedidos de personagens, **anexe a imagem de referência dos 4 personagens**.
5. Exporte tudo para a pasta `public/models/` do projeto (ou me envie os arquivos). Depois me peça: *“integre os modelos de public/models seguindo docs/prompts-blender.md”*.

> Dica: se o Claude do Blender não conseguir abrir imagens da internet, faça você as buscas sugeridas no Google Imagens e envie prints na conversa.

---

## PROMPT 0 — Estilo e regras do projeto (cole primeiro, sempre)

```text
Você é meu artista 3D técnico no Blender (via MCP). Vamos criar os modelos de um jogo educativo para navegador e óculos de realidade virtual (three.js + WebXR) chamado "Caminhos da Memória", sobre a formação de Vargem Alta (ES): o povo Puri (c. 1855), a origem da comunidade quilombola de Pedra Branca (c. 1886), a imigração italiana (fim do século XIX), a imigração libanesa (vila da estação, 1927) e a Vargem Alta de hoje.

ESTILO
- Estilizado de alta qualidade ("nível AAA"), como figuras de animação 3D: formas suaves, silhuetas claras, cores naturais e ricas, detalhes esculpidos. Não é fotorrealista nem "low-poly facetado".
- Tudo deve combinar entre si: mesma escala, mesma paleta e mesmo nível de detalhe.
- Respeito histórico e cultural: nada de caricatura ou estereótipo. Todos os personagens com dignidade.

PESQUISA ANTES DE MODELAR
- Para cada item, pesquise na web e no Google Imagens fotos, gravuras e plantas da época e da região (eu indico termos de busca em cada pedido). Abra as páginas com fotos sempre que puder.
- Antes de modelar, me mostre um resumo curto do que aprendeu (proporções, materiais, cores, detalhes típicos) e o plano do modelo.
- Se não conseguir ver as imagens, me peça prints que eu envio.
- Fotos da internet são SÓ referência: não use fotos como textura (direitos autorais). Use texturas CC0 do Poly Haven (integração do MCP) ou materiais procedurais "bakeados" em imagem.

REGRAS TÉCNICAS (obrigatórias)
1. Unidades métricas: 1 unidade = 1 metro, escala real (porta ≈ 2,1 m; adulto ≈ 1,70 m).
2. Eixo Z para cima. A FRENTE de todo modelo olha para −Y (vista Front do Blender, tecla 1 do teclado numérico).
3. Origem no centro da base, no chão (Z = 0). Aplique as transformações (Ctrl+A → All Transforms) antes de exportar.
4. Limites de triângulos (o jogo também roda no Meta Quest): personagem ≤ 12 mil; casa simples ≤ 6 mil; construção grande ≤ 15 mil; locomotiva ≤ 20 mil; objeto pequeno ≤ 1,5 mil; árvore ≤ 3 mil + versão simplificada "_LOD1" ≤ 600. Folhagem modelada em volumes (sem transparência), para rodar bem em VR. Para detalhes finos, esculpa em alta e faça bake de normal map na versão leve.
5. Materiais: apenas Principled BSDF (Base Color, Roughness, Metallic, Normal opcional; Emission para lampiões e janelas acesas). Nós procedurais precisam ser bakeados em imagens. Texturas de até 2048 px (1024 px em objetos pequenos), de preferência em atlas. Nomes claros nos materiais.
6. Malha limpa: normais para fora, sem faces duplicadas, sem buracos visíveis, UV sem sobreposição onde houver textura.
7. Dados para o jogo, dentro de cada arquivo:
   - COL_nome: caixas simples (cubos) onde o jogador NÃO pode passar (paredes, troncos grossos, carroça). Sem material; o jogo as esconde.
   - WALK_nome: planos na altura exata dos pisos onde o jogador PODE subir (assoalho, varanda, degraus, plataforma, ponte). Degraus ou rampas de no máximo 25 cm por passo. O jogador precisa conseguir chegar a todo ponto de interação.
   - PT_nome: Empties (Plain Axes) nos pontos de interação e de encaixe (ex.: PT_entrega, PT_porta, PT_mao).
   - STAGE_0_..., STAGE_1_...: partes que aparecem em etapas (construções em obra).
   - Variações como objetos separados com sufixo _A / _B (ex.: placa_fechada_A / placa_aberta_B).
8. Exportação: File → Export → glTF 2.0, formato .glb, "+Y Up" ligado, "Apply Modifiers" ligado, "Custom Properties" ligado, sem compressão Draco. Nome do arquivo em minúsculas, sem acentos e sem espaços (ex.: bld_casa_italiana.glb). Salve também o .blend de cada item.
9. Pasta de saída: <COLE AQUI O CAMINHO DA PASTA public/models DO PROJETO>
10. Ao terminar cada item: mostre screenshots do viewport (frente, 3/4 e de cima), informe a contagem de triângulos, confira escala e orientação e corrija o que precisar antes de exportar.

Confirme que entendeu e aguarde o primeiro pedido.
```

---

## PROMPT 1A — Mapa: o vale de Vargem Alta antiga (relevo)

```text
PEDIDO: o MAPA do jogo — o relevo do vale de Vargem Alta antiga, sem construções.

PESQUISE PRIMEIRO (web + Google Imagens):
- "Vargem Alta ES fotos antigas", "Vargem Alta vista aérea", "Vargem Alta relevo", "região serrana sul do Espírito Santo"
- "estação Vargem Alta Leopoldina" (veja o site estacoesferroviarias.com.br), "Arquivo Público do Espírito Santo fotos antigas Cachoeiro de Itapemirim"
- "Mata Atlântica serra capixaba", "pedra de granito montanha Espírito Santo", "cafezal em encosta Espírito Santo", "estrada de chão terra vermelha"
- Se possível, veja o relevo real no Google Maps/Earth (modo Relevo) em torno da sede de Vargem Alta (aprox. 20°40' S, 41°00' O — confirme no mapa).
Resuma: forma do vale, altura dos morros, cores do solo e da vegetação, onde ficava a vila antiga.

O QUE CRIAR:
- Área jogável de 700 × 700 m centrada na origem (X = leste, Y = norte). Em volta, uma moldura de serras até 2 × 2 km (objeto separado MAP_serras, bem mais simples) para o horizonte nunca acabar.
- Um vale alto ("vargem"): fundo largo e quase plano (inclinação ≤ 3%) com cerca de 200 m de largura no sentido oeste–leste, cortado por um rio sinuoso. Morros cobertos de mata dos dois lados (40 a 120 m acima do fundo do vale) e, ao fundo (sul e oeste), serras mais altas com afloramentos arredondados de granito (250 a 400 m).
- Recomendado: se o addon BlenderGIS estiver disponível, importe o relevo real (SRTM) da região de Vargem Alta como base, depois suavize e estilize. Se não, esculpa inspirado nas referências.
- Rio: entra no oeste em (−350, +45), passa por (−250, +55), (−150, +30), (−50, +20), (+50, +30), (+150, +10) e sai no leste em (+350, +25). Largura de 10 a 14 m, leito 1 a 1,5 m abaixo das margens, margens suaves de areia e lama. A superfície da água é um plano separado: MAP_rio_agua.
  • Vau raso (15 cm de água, fundo de pedras) em (−300, rio).
  • Cachoeira de 6 a 8 m descendo de uma grande pedra de granito (≈ 18 m de altura) junto ao novo acampamento Puri (ver lista).

PLATAFORMAS PLANAS (essencial — o mapa anterior falhou por ser irregular demais para as construções):
Cada área abaixo deve ser plana (desnível ≤ 10 cm), com entorno suave (rampas ≤ 15%), sem paredões. Z é a altura acima do fundo do vale.
 1. Mirante da tela inicial: Ø 30 m, topo de morro ao norte em (−40, +190), Z +30 m, com vista livre para oeste ao longo do vale.
 2. Acampamento Puri: clareira Ø 30 m em (−230, +95), Z +4 m, a 40 m do rio, dentro da mata.
 3. Novo acampamento Puri: Ø 24 m em (−330, +100), Z +8 m, ao pé da pedra de granito com a cachoeira.
 4. Terreiro da fazenda de café: 40 × 25 m em (−150, −55), Z +2 m (margem sul).
 5. Senzala: 30 × 12 m em (−190, −55), Z +2 m, ao lado do terreiro.
 6. Casa-grande: 30 × 20 m em (−150, −105), Z +10 m, numa elevação olhando para o norte (o vale), com caminho em rampa suave até o terreiro.
 7. Casa da família italiana: 20 × 18 m em (−185, −80), Z +4 m.
 8. Parada do café (embarque no trem, cap. III): 30 × 12 m junto à futura ferrovia em (−150, −28), Z +1,5 m.
 9. Quilombo (Pedra Branca/São Pedro): clareira Ø 36 m em (−110, +150), Z +22 m, na mata da encosta norte, ligada à margem do rio em (−150, +40) por uma rampa natural de ~120 m (inclinação ≤ 15%).
10. Vila de 1927 e praça de hoje: área de 220 × 90 m entre X −110 e +110 e Y −20 e −110, Z +1 a +3 m, levemente inclinada para o rio. Uma pequena elevação a oeste para a igreja em (−105, −70), Z +5 m.
11. Encostas de cafezal: inclinação moderada (10–20%) ao sul da fazenda, entre X −260 e −100 e Y −110 e −180; e ao sul da vila, entre X −40 e +120 e Y −120 e −170.

MALHA E MATERIAIS:
- Mais densa (1,5 a 2 m) onde o jogador anda, mais simples nos morros. No máximo 150 mil triângulos no terreno + 20 mil nas serras. Divida o terreno em 4 × 4 blocos (MAP_terreno_00 … MAP_terreno_33).
- 4 texturas CC0 do Poly Haven que se repetem: grama, terra vermelha capixaba, rocha/granito e areia/lama. Mais uma máscara de mistura map_splat.png (2048 px; R = grama, G = terra, B = rocha, A = areia), projetada de cima sobre o mapa inteiro. Rocha nas encostas íngremes, terra nas áreas de trabalho, areia nas margens do rio.
- NÃO coloque construções, árvores, estradas nem ferrovia no terreno: elas virão em camadas separadas.
Mostre screenshots de cima e de três ângulos e aguarde minha aprovação.
```

## PROMPT 1B — Mapa: camadas por época

```text
PEDIDO: camadas do mapa por época, em cima do terreno aprovado (mesmo .blend do mapa).

Crie as coleções ERA1_puri, ERA2_fazenda, ERA3_colonia, ERA4_vila1927 e ERA5_hoje. Cada uma contém só o que muda com o tempo:
- Caminhos como faixas finas que acompanham o terreno (2–3 cm acima dele, com material de terra):
  • ERA1: trilhas estreitas (0,8 m) na mata ligando o acampamento Puri ao rio, ao vau e ao novo acampamento.
  • ERA2: trilha da senzala até a pinguela (em −150, rio) e da pinguela até o quilombo; caminho da casa-grande ao terreiro.
  • ERA3: estrada de terra de 4 m aberta pelos italianos (embrião da rodovia ES-164), vinda do leste do mapa, passando pela vila e indo até a casa da família italiana; mais o leito da ferrovia.
  • ERA4: a mesma estrada + rua principal da vila (Y ≈ −68) + caminhos da estação e da igreja.
  • ERA5: rua calçada e calçadas, praça pavimentada em frente à antiga estação.
- Leito da ferrovia (aterro de 0,6 m com brita, 4 m de largura) nas ERA3 e ERA4, ao longo de Y ≈ −25 de oeste a leste. Pesquise o que aconteceu com a ferrovia em Vargem Alta depois (para a ERA5).
- Pinguela de madeira sobre o rio (ERA2) com WALK_pinguela e COL_ nos corrimãos.
- Áreas de lavoura e clareiras como Empties do tipo Cube (escala = tamanho da área): AREA_<era>_cafezal_N, AREA_<era>_pasto_N, AREA_<era>_clareira_N. O jogo usa essas áreas para espalhar a vegetação (mata fechada no resto).
- Não modele as construções aqui: o lugar de cada uma será marcado com Empties no próximo pedido.
Mostre screenshots de cada época e aguarde aprovação.
```

## PROMPT 1C — Mapa: marcadores do jogo e exportação

```text
PEDIDO: marcadores (Empties) usados pelo jogo e exportação do mapa.

Crie Empties do tipo Plain Axes, com o eixo −Y apontando para onde o objeto/personagem deve olhar, com estes nomes exatos (posicione de forma coerente com as plataformas e a pesquisa):
- HUB_centro (onde os 4 protagonistas ficam lado a lado no mirante, olhando para a câmera) e HUB_camera.
- Cap. I (Puri): C1_inicio, C1_fogueira, C1_abrigo_1, C1_abrigo_2, C1_rede_1, C1_rede_2, C1_avo, C1_tio, C1_tia, C1_menino, C1_menina, C1_urucum, C1_jucara, C1_pesca (na margem, de frente para a água), C1_machado (área de árvores cortadas a ~60 m do acampamento), C1_fumaca (bem longe, além da serra), C1_vau, C1_novo_acampamento, C1_nova_fogueira, C1_pedra_grande, C1_cachoeira.
- Cap. II (Bento): C2_inicio, C2_senzala, C2_terreiro, C2_casagrande, C2_joana, C2_pinguela, C2_borda_mata, C2_trilha_01 … C2_trilha_06 (até o quilombo), C2_patrulha_A_01 … _04 (volta ao redor do terreiro), C2_patrulha_B_01 e _02 (vai e volta entre a senzala e o rio), C2_quilombo (fogueira central), C2_rancho_pronto, C2_rancho_novo, C2_sape (pilha de sapê), C2_tambu, C2_candongueiro, C2_benedito, C2_quilombola_1 … _3, C2_crianca.
- Cap. III (Pietro): C3_inicio (na estrada, a leste), C3_estrada_01 … _08, C3_ruina_casagrande, C3_casa, C3_carroca, C3_muda_1 … _4 (encosta perto da casa), C3_sacas (perto da parada), C3_parada_trem, C3_capela, C3_giuseppe, C3_lucia, C3_nina.
- Cap. IV (Youssef): C4_inicio (plataforma da estação), C4_estacao, C4_chefe, C4_armazem, C4_giulia, C4_pietro_idoso, C4_bento_idoso, C4_mariana, C4_igreja, C4_casa_01 … C4_casa_12 (dos dois lados da rua), C4_rua_01 … _08.
- Epílogo (hoje): C5_inicio, C5_praca, C5_marco, C5_memoria_1 … _4 (em semicírculo voltado para o marco), C5_poste_1 … _4, C5_banco_1 … _4, C5_estacao_cultural, C5_casa_01 … _10, C5_igreja.
- TRILHO_01 … TRILHO_N: pontos da linha central da ferrovia, a cada 10 m, de oeste para leste.
- Limites de cada capítulo: Empties tipo Sphere C1_area … C5_area (escala = raio da área jogável).

EXPORTAÇÃO:
1. map_vargem_alta.glb com o terreno, as serras, a água, as coleções ERA* e todos os Empties (Custom Properties ligado).
2. map_altura.png: mapa de altura em tons de cinza 16 bits, 1025 × 1025, cobrindo a área de 700 × 700 m (linha 0 = norte, coluna 0 = oeste). Gere por script (ray_cast de cima para baixo em cada pixel, só no terreno).
3. map_info.json: {"tamanho_m": 700, "resolucao": 1025, "altura_min": ..., "altura_max": ..., "agua_z": ...}.
4. map_splat.png e as 4 texturas de terreno (jpg, 1024–2048 px) com nomes tex_grama.jpg, tex_terra.jpg, tex_rocha.jpg, tex_areia.jpg.
Mostre um screenshot de cima com os nomes dos Empties visíveis e me passe a lista final com as coordenadas.
```

---

## PROMPT 2 — Corpos-base, esqueleto e animações

```text
PEDIDO: corpos-base e animações compartilhadas por todos os personagens. (Anexei a imagem de referência dos 4 protagonistas.)

ESTILO: o da imagem — figura estilizada de animação 3D: cabeça grande (≈ 1/5,5 da altura), olhos grandes e expressivos, nariz e boca simples, mãos simplificadas, roupas com dobras suaves e materiais legíveis (tecido, couro, fibra, metal).

1. Crie 4 corpos-base com a mesma topologia limpa (loops nas articulações para deformar bem): adulto masculino (1,72 m), adulta feminina (1,62 m), pessoa idosa (1,62 m, levemente curvada; versões masculina e feminina por ajuste de forma) e criança (1,15 m).
2. Esqueleto (Armature) com nomes no padrão Mixamo SEM prefixo: Hips, Spine, Spine1, Spine2, Neck, Head, HeadTop_End, LeftShoulder, LeftArm, LeftForeArm, LeftHand, RightShoulder, RightArm, RightForeArm, RightHand, LeftUpLeg, LeftLeg, LeftFoot, LeftToeBase, RightUpLeg, RightLeg, RightFoot, RightToeBase (+ dedos simplificados). Pintura de pesos limpa; teste poses extremas.
3. Rosto: olhos separados (globo + íris) e shape keys "blink" (piscar) e "mouth_open" (fala).
4. Animações (Actions, 30 fps, no lugar — sem a raiz andar — e em loop perfeito quando contínuas):
   idle, walk, run, talk (gesticulando), carry_idle e carry_walk (segurando algo à frente com as duas mãos), sit (sentado num tronco de 45 cm), drum (tocando tambor de pé, inclinado, batidas alternadas), dance (roda: passos laterais, braços abertos), clap (palmas), work (curvado plantando/capinando), kneel (ajoelhado trabalhando), wave (acenar), point (apontar), bound_idle e bound_walk (pulsos juntos à frente, presos por grilhões), lantern_walk (mão direita segurando lampião), spear_idle e spear_walk (mão esquerda segurando lança vertical), suitcase_walk (mão direita carregando mala).
   Caminho rápido opcional: posso exportar o corpo em FBX, usar o auto-rig e animações "In Place" do Mixamo (mixamo.com) e você junta tudo com esses nomes de Action. Diga se prefere assim.
5. Adicione Empties de encaixe presos aos ossos das mãos: PT_mao_dir e PT_mao_esq (para lança, mala, lampião, carga).
6. Exporte as animações separadas por corpo: anim_adulto_m.glb, anim_adulta_f.glb, anim_idoso.glb, anim_crianca.glb (no exportador, aba Animation: modo "Actions", "Always Sample Animations" ligado). Os personagens das próximas etapas serão exportados SEM animações, só com o esqueleto (o jogo aplica as animações pelo nome dos ossos).
Guarde este .blend como biblioteca de bases.
```

## PROMPT 3 — Inácio (povo Puri, protagonista do cap. I)

```text
PEDIDO: protagonista INÁCIO — jovem do povo Puri, c. 1855 (personagem da direita na imagem de referência). Use o corpo-base adulto masculino, um pouco mais esguio (1,68 m), cerca de 17 anos.

PESQUISE: "povo Puri", "Puri Wied-Neuwied gravura", "indígenas Puri Espírito Santo Minas Gerais", "pintura corporal urucum jenipapo", "saia de fibra vegetal indígena", "colar de sementes e dentes".
APARÊNCIA (fiel à imagem): cabelo preto liso e comprido com franja; duas listras vermelhas de urucum em cada bochecha; testeira trançada com padrão geométrico e penas eretas vermelhas, amarelas e pretas (cocar); colar de sementes escuras com dentes brancos; braçadeiras e pulseiras com padrões geométricos vermelho/preto/laranja; tornozeleiras; saia de fibras vegetais com cintura trançada estampada; descalço; pele morena.
IMPORTANTE: a imagem é inspiração artística, não prova histórica. Faça adornos bem trabalhados e respeitosos, sem ar de fantasia ou caricatura.
OBJETOS SEPARADOS: prop_lanca.glb (haste de madeira de 1,9 m, ponta escura amarrada com fibra; origem na pegada, com PT_pega).
Exporte char_inacio.glb (só esqueleto, sem animações). Teste com spear_idle e walk e mostre screenshots.
```

## PROMPT 4 — Bento (cap. II) e suas versões mais velhas

```text
PEDIDO: protagonista BENTO — jovem negro escravizado que foge para os ranchos que dariam origem à comunidade quilombola de Pedra Branca (c. 1886); segundo da esquerda na imagem de referência. Corpo-base adulto masculino, cerca de 20 anos, porte forte.

PESQUISE: "escravizados fazendas de café século XIX fotografia", "roupas de algodão cru escravizados Brasil", "Pedra Branca Vargem Alta quilombo", "caxambu Espírito Santo".
APARÊNCIA (fiel à imagem): cabelo crespo curto; sem camisa; calça de algodão cru dobrada no meio da canela; cinto de corda; descalço; expressão digna e determinada. Pele negra com variação natural de tom e boa leitura sob luz noturna.
GRILHÕES: argolas de ferro nos dois pulsos ligadas por uma corrente, como objeto SEPARADO chamado acc_grilhoes, preso aos ossos das mãos, porque o jogo o remove quando a comunidade o liberta. Teste com bound_walk.
A narrativa diferencia a condição imposta (escravizado) da pessoa: nada de caricatura ou ênfase em sofrimento gratuito.
VERSÕES (mesmo rosto, envelhecido):
- char_bento_adulto.glb (~30 anos): camisa de algodão de manga curta, calça, cinto de corda, chapéu de palha, sapatos simples.
- char_bento_idoso.glb (~60 anos, 1927): cabelo e barba grisalhos, camisa clara de manga comprida, calça escura, chapéu de palha, levemente curvado (base idoso).
Exporte char_bento.glb (com acc_grilhoes), char_bento_adulto.glb e char_bento_idoso.glb.
```

## PROMPT 5 — Pietro (imigração italiana, cap. III)

```text
PEDIDO: protagonista PIETRO — jovem imigrante italiano, fim do século XIX (terceiro na imagem de referência). Corpo-base adulto masculino, cerca de 19 anos.

PESQUISE: "imigrantes italianos Espírito Santo fotos antigas", "vestimenta camponês italiano 1890", "boina coppola", "mala de couro antiga", "colono italiano Venda Nova do Imigrante".
APARÊNCIA (fiel à imagem): cabelo castanho-escuro curto; bigode fino; boina (coppola) cinza-escura; camisa creme com mangas dobradas; colete cinza-escuro abotoado; calça cinza-escura; sapatos pretos; bolsa de couro marrom a tiracolo (alça diagonal).
OBJETOS SEPARADOS: prop_mala.glb (mala de couro marrom com alça e cantoneiras; PT_pega na alça).
VERSÃO: char_pietro_idoso.glb (~48 anos, 1927): cabelo e bigode grisalhos, mesma boina e colete, levemente mais pesado.
Exporte char_pietro.glb e char_pietro_idoso.glb. Teste com suitcase_walk e work.
```

## PROMPT 6 — Youssef (imigração libanesa, cap. IV)

```text
PEDIDO: protagonista YOUSSEF — imigrante libanês, mascate que abre um armazém na vila da estação em 1927 (primeiro à esquerda na imagem de referência). Corpo-base adulto masculino, cerca de 28 anos.

PESQUISE: "imigrantes sírio-libaneses Brasil fotos antigas", "mascate libanês Brasil", "tarbush fez vermelho", "roupa tradicional libanesa século XX sirwal colete faixa", "imigração libanesa Espírito Santo".
APARÊNCIA (fiel à imagem): cabelo preto curto; barba cheia curta e bem aparada; fez (tarbush) vermelho com borla preta; camisa branca de manga comprida; colete preto aberto; faixa larga vermelha na cintura; calça preta larga (estilo sirwal) por dentro de sapatos pretos; lenço vermelho e branco com padrão quadriculado sobre um ombro.
ATENÇÃO: NÃO inclua a bandeira do Líbano que aparece na imagem — a bandeira atual só foi adotada em 1943, depois da época do capítulo. No lugar dela, pinte um pequeno cedro na mala de mascate.
OBJETO SEPARADO: prop_mala_mascate.glb (canastra/baú de mascate de madeira e couro com cedro pintado; PT_pega).
Exporte char_youssef.glb. Teste com suitcase_walk e talk.
```

## PROMPT 7 — Coadjuvantes (NPCs)

```text
PEDIDO: personagens coadjuvantes, todos derivados das bases (troque roupas, cabelos, cores e proporções; rostos variados e dignos). Use a pesquisa dos protagonistas de cada capítulo. Exporte cada um SEM animações.

Cap. I — família Puri (mesma estética de Inácio, adornos mais simples; mulheres com faixa trançada cobrindo o peito):
- char_avo_puri: avó, cabelos longos brancos, curvada, colar de sementes.
- char_tio_puri: adulto, braçadeiras pretas, segura lança (PT_mao_esq).
- char_tia_puri: adulta, cesto às costas.
- char_menino_puri e char_menina_puri: crianças (base criança).
Cap. II — fazenda e quilombo:
- char_joana: "Tia Joana", idosa negra, lenço vermelho na cabeça, blusa clara, saia longa, descalça.
- char_benedito: "Seu Benedito", idoso negro, barba e cabelo grisalhos, camisa clara, calça dobrada, ferreiro (mãos fortes).
- char_quilombola_1 (mulher, lenço amarelo), char_quilombola_2 (homem jovem, camisa clara), char_quilombola_3 (mulher, lenço verde), char_crianca_quilombo.
- char_capataz: capataz da fazenda, chapéu de feltro, camisa escura, botas, bigode (segura lampião).
Cap. III — família italiana:
- char_giuseppe: "Papà Giuseppe", ~45 anos, barba cheia, chapéu de feltro, colete; e char_giuseppe_idoso (~55 anos, grisalho).
- char_lucia: "Mamma Lucia", lenço azul na cabeça, vestido escuro, avental branco.
- char_nina: menina de ~8 anos, trança, vestido vermelho.
Cap. IV — vila de 1927 (pesquise "moda brasileira interior anos 1920", "chefe de estação ferroviária uniforme 1920"):
- char_chefe_estacao: uniforme azul-escuro com quepe e bigode.
- char_giulia: "Dona Giulia", costureira de origem italiana, coque, vestido de época.
- char_mariana: "Dona Mariana", idosa, neta de uma mulher Puri, trança grisalha, vestido simples, colar de sementes, descalça.
- char_morador_1 e char_morador_2 (homens: chapéu de palha / chapéu de feltro e colete), char_moradora_1 e char_moradora_2 (mulheres com lenço ou coque), char_crianca_vila.
Epílogo (hoje):
- char_visitante: jovem estudante de hoje, camiseta amarela, calça jeans, tênis branco, mochila.
Faça em lotes de 4 a 5 personagens, mostrando uma imagem lado a lado de cada lote para aprovação.
```

---

## PROMPT 8 — Natureza da Mata Atlântica e lavouras

```text
PEDIDO: kit de vegetação e rochas. Pesquise cada planta no Google Imagens ("Mata Atlântica Espírito Santo", "jequitibá", "palmeira juçara", "ipê-amarelo florido", "ipê-rosa", "embaúba", "samambaiaçu", "bromélias", "bananeira", "pé de café com frutos vermelhos", "muda de café", "afloramento de granito Espírito Santo").
Regras: folhagem em volumes estilizados (sem planos transparentes), cores ricas, troncos com textura; cada árvore com versão _LOD1 ≤ 600 triângulos; origem na base do tronco. O balanço do vento será feito no jogo.

Arquivos:
- veg_arvore_mata_1, _2, _3 (copas variadas, 8–14 m), veg_jequitiba (árvore emergente, 25 m, copa em guarda-chuva)
- veg_jucara (palmeira esguia, 9–12 m, com cacho de frutos roxos), veg_ipe_amarelo e veg_ipe_rosa (floridos), veg_embauba (folhas prateadas)
- veg_samambaiacu (samambaia arborescente), veg_samambaia, veg_bromelia, veg_arbusto_1, veg_arbusto_2
- veg_bananeira (com cacho), veg_cafe_adulto (1,8 m, frutos vermelhos e verdes), veg_cafe_muda (40 cm)
- veg_capim (3 tufos), veg_flores (5 tipos pequenos), veg_pedras (5 pedras de 0,3 a 2 m), veg_pedra_granito (domo de granito de 20 m, cinza com manchas escuras e liquens), veg_tronco_caido, veg_toco
Mostre todas lado a lado com uma pessoa de 1,70 m para escala.
```

## PROMPT 9 — Acampamento Puri (cap. I)

```text
PEDIDO: objetos do acampamento Puri (c. 1855).
PESQUISE: "Puri Wied-Neuwied gravura cabana rede", "abrigo indígena de folhas de palmeira", "rede de dormir indígena de fibra", "cerâmica indígena pote de barro", "cesto indígena trançado", "urucum planta frutos".
Arquivos:
- bld_abrigo_puri (2 variações _A e _B): abrigo baixo de varas e folhas de palmeira sobrepostas (~3 m de largura, 2 m de altura), aberto na frente; COL_ simples.
- prop_rede: rede de fibra natural de 3,2 m com cordas, feita para ficar entre duas árvores a 3,6 m uma da outra; PT_ancora_A e PT_ancora_B nas pontas.
- prop_fogueira: anel de pedras + lenha cruzada (o fogo é efeito do jogo; coloque PT_fogo no centro).
- prop_cesto, prop_pote_barro_1 e _2, prop_arco_flechas (opcional).
- prop_urucuzeiro: arbusto de 1,8 m com cachos de frutos vermelhos espinhosos; variação _B depois da colheita (sem frutos).
- prop_peixe: peixe de rio pequeno (25 cm).
- prop_marcas_machado: conjunto com 2 árvores com cortes de machado claros, 3 tocos e 2 troncos derrubados (área de 8 m).
```

## PROMPT 10 — Fazenda de café (cap. II) e suas ruínas (cap. III)

```text
PEDIDO: fazenda de café do século XIX na região de Vargem Alta.
PESQUISE: "fazenda de café século XIX casa-grande Espírito Santo", "fazendas históricas Cachoeiro de Itapemirim", "senzala fazenda de café", "terreiro de café antigo de pedra", "telha capa e canal", "janela colonial com veneziana", "lampião a querosene antigo".
Arquivos:
- bld_casagrande: térrea sobre porão de pedra de 1,1 m, ~16 × 9 m, paredes caiadas, telhado de quatro águas com telhas capa-e-canal, 6 janelas com folhas azuis + porta central com escadaria de pedra. Janelas em versão apagada _A e acesa _B (Emission quente). COL_ nas paredes; WALK_escada.
- bld_casagrande_ruina: a mesma casa abandonada e tomada pela mata (o histórico do IBGE fala em fazendas abandonadas invadidas pela mata): sem telhado, paredes parcialmente caídas, manchas, trepadeiras, arvoretas crescendo dentro.
- bld_senzala: construção longa e baixa (~22 × 5,5 m) de pau-a-pique/taipa, telhado de telhas, portas estreitas e janelinhas gradeadas; versão com luz fraca _B. Retrate a dureza do lugar com sobriedade.
- bld_terreiro: pátio de secagem de ~40 × 25 m com piso de pedra/tijolo, mureta baixa, café espalhado em faixas (vermelho, marrom) e montes; WALK_ no piso.
- prop_lampiao (de mão e de pendurar, chama com Emission), prop_rodo_cafe, prop_cerca (módulo de 3 m), prop_porteira, prop_banco_madeira.
```

## PROMPT 11 — Quilombo de Pedra Branca (cap. II)

```text
PEDIDO: os ranchos e a roda de caxambu na mata (c. 1886).
PESQUISE: "casa de pau a pique coberta de sapê", "rancho de sapê", "caxambu Espírito Santo tambores", "jongo caxambu tambu candongueiro", "grupo Caxambu Pedra Branca Vargem Alta", "pilão de madeira", "panela de barro".
Arquivos:
- bld_rancho (para ser construído no jogo): ~5 × 4 m, esteios de madeira, paredes de pau-a-pique, cobertura de sapê grossa. Separe em STAGE_0_estrutura_paredes, STAGE_1_sape, STAGE_2_sape, STAGE_3_sape (a cobertura entra em 3 partes). COL_ nas paredes, porta aberta e PT_entrega na frente da porta (alcançável).
- bld_rancho_pronto: rancho completo, com pequenas variações.
- prop_tambu (tambor grande, ~1 m, tronco escavado, couro tensionado, amarrações) e prop_candongueiro (menor, ~70 cm). Pesquise bem a forma real dos tambores de caxambu capixaba.
- prop_feixe_sape (feixe de capim amarrado, para carregar nos braços) e prop_pilha_sape.
- prop_panela_barro, prop_pilao, prop_banco_tronco, prop_bigorna_martelo (pedra/bigorna pequena e martelo de ferreiro).
```

## PROMPT 12 — Colônia italiana (cap. III)

```text
PEDIDO: casa e objetos da família italiana (fim do século XIX).
PESQUISE: "casa de colono italiano Espírito Santo", "casas antigas Venda Nova do Imigrante", "casa de madeira colonial italiana Santa Teresa ES", "capela de imigrantes italianos Espírito Santo", "carro de boi", "carroça antiga de madeira", "mula com cangalha", "saca de café de juta", "baú de imigrante".
Arquivos:
- bld_casa_italiana (construída em etapas no jogo): ~7 × 5,5 m, tábuas verticais com mata-juntas sobre alicerce de pedra (0,7 m), telhado de duas águas com telhas, chaminé de pedra, varanda frontal de 1,9 m com guarda-corpo e ESCADA de pedra (degraus ≤ 25 cm). Etapas: STAGE_0_alicerce_estrutura (base, assoalho e esteios), STAGE_1_paredes, STAGE_2_telhado, STAGE_3_detalhes (porta, janelas verdes, varanda, chaminé). WALK_ no assoalho, na varanda e em cada degrau; COL_paredes; PT_entrega no centro da varanda (o jogador precisa subir pela escada e alcançá-lo).
- bld_capela: capela branca pequena (~5 × 8 m) com sineira, cruz, porta azul; COL_ e WALK_ nos degraus.
- prop_carroca (carroça de duas rodas, versões _vazia, _tabuas e _sacas), prop_carro_de_boi (opcional).
- prop_tabuas_pilha e prop_tabuas_carga (par de tábuas para carregar nos braços).
- prop_saca_cafe e prop_sacas_pilha; prop_bau; prop_enxada; prop_cova_plantio (buraco de terra com muda).
- anim_mula.glb (opcional): mula com cangalha e baú, rig simples com Actions idle e walk.
```

## PROMPT 13 — Ferrovia e estação (caps. III a V)

```text
PEDIDO: ferrovia da Estrada de Ferro Leopoldina e a estação de Vargem Alta.
PESQUISE: "estação Vargem Alta Estrada de Ferro Leopoldina" e "estação Jaciguá" (site estacoesferroviarias.com.br), "Leopoldina Railway locomotiva a vapor", "maria fumaça Espírito Santo", "vagão de passageiros de madeira antigo", "vagão gôndola antigo", "estação ferroviária antiga Espírito Santo plataforma", "poste de telégrafo ferrovia".
Arquivos:
- rail_trilho_reto (módulo de 10 m: trilhos + dormentes + brita) e rail_trilho_curva (10 m, raio 150 m).
- veh_locomotiva: locomotiva a vapor da época, com tênder (ou veh_tender separado). Rodas como objetos separados WHEEL_01… (o jogo gira as rodas), PT_fumaca no topo da chaminé, farol com Emission. ≤ 20 mil triângulos.
- veh_vagao_aberto (gôndola de madeira, com PT_carga e WALK_ no assoalho), veh_vagao_fechado, veh_vagao_passageiros (madeira, janelas com Emission opcional).
- bld_estacao: estação térrea de alvenaria (pesquise o modelo real de Vargem Alta ou das estações vizinhas), plataforma elevada (WALK_plataforma com rampa ou degraus ≤ 25 cm), cobertura com mãos-francesas, sino, relógio, bancos e a placa "VARGEM ALTA" como objeto separado (placa_nome) — o jogo troca o texto na época atual.
- bld_estacao_hoje: a mesma estação restaurada como centro cultural (pintura nova, luminárias com Emission, sem trilhos).
- bld_parada_cafe: plataforma simples de embarque de café de madeira, com WALK_.
- prop_poste_telegrafo.
```

## PROMPT 14 — Vila da estação em 1927 (cap. IV)

```text
PEDIDO: a vila de Vargem Alta em 1927.
PESQUISE: "Vargem Alta fotos antigas centro", "cidades do interior do Espírito Santo anos 1920", "casario eclético com platibanda", "armazém de secos e molhados antigo", "igreja matriz antiga interior Espírito Santo", "comércio sírio-libanês interior Brasil foto antiga".
Arquivos:
- bld_casa_vila_1 … _6: casas térreas variadas (6–9 m de frente), algumas com platibanda e ornamentos simples, outras com telhado aparente; cores de cal (ocre, azul-claro, rosa, verde-claro, branco), portas e janelas de madeira; COL_ por casa.
- bld_armazem: armazém de secos e molhados de Youssef (~9 × 6,5 m), três portas largas; objetos separados portas_fechadas_A e portas_abertas_B; placa "ARMAZÉM YOUSSEF — SECOS E MOLHADOS · TECIDOS · ARMARINHO" como objeto separado placa_B (antes da abertura: placa_A de madeira lisa); interior raso visível pelas portas (balcão, prateleiras, sacos, rolos de tecido); toldo; PT_porta; luz interna com Emission.
- bld_igreja: igreja matriz da época (~9 × 17 m), torre central com sino e cruz, frontão, escadaria (WALK_); pesquise a igreja antiga de Vargem Alta.
- prop_balcao, prop_prateleira, prop_rolos_tecido, prop_barril, prop_caixote, prop_saco_mantimento, prop_lampiao_rua (pesquise a iluminação da época), prop_banco_estacao.
```

## PROMPT 15 — Vargem Alta hoje (epílogo)

```text
PEDIDO: a praça de hoje em frente à antiga estação.
PESQUISE: "Vargem Alta ES praça", "centro de Vargem Alta hoje", "monumento emancipação Vargem Alta".
Arquivos:
- bld_praca: praça pavimentada (~28 m), canteiros com flores, árvores pequenas, meio-fio; WALK_ no piso.
- prop_marco: marco/monumento de pedra com placa como objeto separado (texto "VARGEM ALTA — Lei nº 4.063 · 6/5/1988"); PT_placa na frente.
- prop_poste_moderno (luminária com Emission), prop_banco_praca, prop_lixeira, prop_placa_rua.
- bld_casa_hoje_1 … _3: casas atuais do centro (com janelas acesas em variação _B).
```

---

## PROMPT 16 — Revisão final e lista de arquivos

```text
PEDIDO: revisão final de todos os arquivos exportados na pasta de saída.
Para cada .glb: confira orientação (frente para −Y antes da exportação), escala real, origem no chão, transformações aplicadas, contagem de triângulos dentro do limite, materiais Principled com texturas embutidas, presença dos objetos COL_/WALK_/PT_/STAGE_ pedidos e tamanho do arquivo (ideal ≤ 8 MB cada; o total do jogo deve ficar abaixo de ~80 MB).
Gere models_manifest.json com: arquivo, categoria, triângulos, tamanho em MB, lista de objetos especiais (COL_, WALK_, PT_, STAGE_, _A/_B) e, nos arquivos anim_*, a lista de Actions com a duração.
Corrija o que estiver fora do padrão e me mostre um resumo final.
```

---

## Lista de arquivos esperados (`public/models/`)

| Grupo | Arquivos |
|---|---|
| Mapa | `map_vargem_alta.glb`, `map_altura.png`, `map_info.json`, `map_splat.png`, `tex_grama.jpg`, `tex_terra.jpg`, `tex_rocha.jpg`, `tex_areia.jpg` |
| Animações | `anim_adulto_m.glb`, `anim_adulta_f.glb`, `anim_idoso.glb`, `anim_crianca.glb`, `anim_mula.glb` (opcional) |
| Protagonistas | `char_inacio`, `char_bento`, `char_bento_adulto`, `char_bento_idoso`, `char_pietro`, `char_pietro_idoso`, `char_youssef` |
| Coadjuvantes | `char_avo_puri`, `char_tio_puri`, `char_tia_puri`, `char_menino_puri`, `char_menina_puri`, `char_joana`, `char_benedito`, `char_quilombola_1..3`, `char_crianca_quilombo`, `char_capataz`, `char_giuseppe`, `char_giuseppe_idoso`, `char_lucia`, `char_nina`, `char_chefe_estacao`, `char_giulia`, `char_mariana`, `char_morador_1..2`, `char_moradora_1..2`, `char_crianca_vila`, `char_visitante` |
| Natureza | `veg_arvore_mata_1..3`, `veg_jequitiba`, `veg_jucara`, `veg_ipe_amarelo`, `veg_ipe_rosa`, `veg_embauba`, `veg_samambaiacu`, `veg_samambaia`, `veg_bromelia`, `veg_arbusto_1..2`, `veg_bananeira`, `veg_cafe_adulto`, `veg_cafe_muda`, `veg_capim`, `veg_flores`, `veg_pedras`, `veg_pedra_granito`, `veg_tronco_caido`, `veg_toco` |
| Cap. I | `bld_abrigo_puri`, `prop_rede`, `prop_fogueira`, `prop_cesto`, `prop_pote_barro_1..2`, `prop_lanca`, `prop_urucuzeiro`, `prop_peixe`, `prop_marcas_machado`, `prop_arco_flechas` (opcional) |
| Cap. II | `bld_casagrande`, `bld_casagrande_ruina`, `bld_senzala`, `bld_terreiro`, `bld_rancho`, `bld_rancho_pronto`, `prop_tambu`, `prop_candongueiro`, `prop_feixe_sape`, `prop_pilha_sape`, `prop_panela_barro`, `prop_pilao`, `prop_banco_tronco`, `prop_bigorna_martelo`, `prop_lampiao`, `prop_rodo_cafe`, `prop_cerca`, `prop_porteira`, `prop_banco_madeira` |
| Cap. III | `bld_casa_italiana`, `bld_capela`, `prop_carroca`, `prop_carro_de_boi` (opcional), `prop_tabuas_pilha`, `prop_tabuas_carga`, `prop_saca_cafe`, `prop_sacas_pilha`, `prop_bau`, `prop_enxada`, `prop_cova_plantio`, `prop_mala` |
| Ferrovia | `rail_trilho_reto`, `rail_trilho_curva`, `veh_locomotiva`, `veh_tender`, `veh_vagao_aberto`, `veh_vagao_fechado`, `veh_vagao_passageiros`, `bld_estacao`, `bld_estacao_hoje`, `bld_parada_cafe`, `prop_poste_telegrafo` |
| Cap. IV | `bld_casa_vila_1..6`, `bld_armazem`, `bld_igreja`, `prop_mala_mascate`, `prop_balcao`, `prop_prateleira`, `prop_rolos_tecido`, `prop_barril`, `prop_caixote`, `prop_saco_mantimento`, `prop_lampiao_rua`, `prop_banco_estacao` |
| Epílogo | `bld_praca`, `prop_marco`, `prop_poste_moderno`, `prop_banco_praca`, `prop_lixeira`, `prop_placa_rua`, `bld_casa_hoje_1..3` |

## Depois: integração no jogo

Quando os arquivos estiverem em `public/models/`, peça ao Claude Code (aqui no projeto):

> *Integre os modelos de public/models seguindo docs/prompts-blender.md: use o mapa e os Empties para posicionar tudo, os COL_/WALK_ para colisão e pisos, os STAGE_ nas construções em etapas e os arquivos anim_* nos personagens. Mantenha os modelos procedurais como reserva caso algum arquivo falte.*

Dá para integrar por partes (por exemplo, só o mapa e os protagonistas primeiro).
