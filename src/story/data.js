// Personagens, falas-chave, registros históricos e créditos.
// Para trocar nomes, cores ou textos, edite este arquivo.

export const PROTAGONISTS = [
  { id: 'inacio', look: 'inacio', chapter: 'puri', num: 'Capítulo I', name: 'Inácio', people: 'Povo Puri', era: 'Território Puri · c. 1855', color: '#e0703f',
    blurb: 'Antes dos mapas, havia caminhos. Leia a mata, perceba a chegada dos “de fora” e guie sua família rio acima.' },
  { id: 'bento', look: 'bento', chapter: 'bento', num: 'Capítulo II', name: 'Bento', people: 'Liberdade e quilombo · Pedra Branca', era: 'Fazendas da região · c. 1886', color: '#f0b350',
    blurb: 'Numa noite de lua, atravesse o terreiro pelas sombras e siga o tambor até os ranchos onde nasceria Pedra Branca.' },
  { id: 'pietro', look: 'pietro', chapter: 'pietro', num: 'Capítulo III', name: 'Pietro', people: 'Imigração italiana', era: 'Final do século XIX', color: '#8fbf5a',
    blurb: 'Uma mala, uma família e uma terra tomada pela mata. Plante o café, erga a casa e veja os trilhos chegarem.' },
  { id: 'youssef', look: 'youssef', chapter: 'youssef', num: 'Capítulo IV', name: 'Youssef', people: 'Imigração libanesa', era: 'Vila de Vargem Alta · 1927', color: '#5fb3c9',
    blurb: 'De mascate a comerciante: entregue as encomendas da vila e abra as portas do armazém da estação.' },
];

// Aparência (ver src/world/character.js)
export const LOOKS = {
  inacio: { skin: '#9a5f3a', hair: '#120c09', hairStyle: 'long', topType: 'none', bottomType: 'fiber', bottom: '#c9a96e', waistband: '#b5562a', barefoot: true, paint: 'puri', headdress: 'cocar', necklace: 'teeth', bands: '#b5562a' },
  avo: { skin: '#8a5636', hair: '#ddd6cc', hairStyle: 'long', topType: 'wrap', top: '#a88d60', bottomType: 'fiber', bottom: '#9a7f52', waistband: '#7a4a2a', barefoot: true, paint: 'puri', necklace: 'seeds', stoop: 0.22, scale: 0.92 },
  tio: { skin: '#94603c', hair: '#120c09', hairStyle: 'long', topType: 'none', bottomType: 'fiber', bottom: '#b0925e', waistband: '#2a1d16', barefoot: true, paint: 'puri', bands: '#2a1d16', necklace: 'seeds' },
  tia: { skin: '#9a6440', hair: '#140e0a', hairStyle: 'long', topType: 'wrap', top: '#b49868', bottomType: 'fiber', bottom: '#a8875a', waistband: '#b5562a', barefoot: true, paint: 'puri', necklace: 'seeds', scale: 0.95 },
  menino: { skin: '#9a6440', hair: '#140e0a', hairStyle: 'short', topType: 'none', bottomType: 'fiber', bottom: '#b0925e', barefoot: true, paint: 'puri', child: true },
  menina: { skin: '#a0683f', hair: '#140e0a', hairStyle: 'long', topType: 'wrap', top: '#b49868', bottomType: 'fiber', bottom: '#a8875a', barefoot: true, child: true },

  bento: { skin: '#4a2c1c', hair: '#0e0a08', hairStyle: 'curly', topType: 'none', bottomType: 'rolled', bottom: '#d9ccb0', belt: '#b89a6a', barefoot: true, cuffs: true },
  joana: { skin: '#3e2518', hair: '#0e0a08', hairStyle: 'scarf', scarf: '#c0472f', topType: 'shirt', top: '#e6dcc6', sleeves: 'short', bottomType: 'dress', bottom: '#8a6a4a', barefoot: true, stoop: 0.12, scale: 0.95 },
  benedito: { skin: '#3a2316', hair: '#c4bdb1', hairStyle: 'curly', topType: 'shirt', top: '#cfc3a8', sleeves: 'short', bottomType: 'rolled', bottom: '#8a7a5a', belt: '#6a4a2a', barefoot: true, beard: 'full', stoop: 0.08 },
  quilombola1: { skin: '#4a2a1a', hairStyle: 'scarf', scarf: '#e0a030', topType: 'shirt', top: '#efe6d2', bottomType: 'dress', bottom: '#5a6a8a', barefoot: true },
  quilombola2: { skin: '#54301e', hair: '#0e0a08', hairStyle: 'curly', topType: 'shirt', top: '#d8cdb4', sleeves: 'short', bottomType: 'rolled', bottom: '#9a8a6a', belt: '#6a4a2a', barefoot: true },
  quilombola3: { skin: '#3c2416', hairStyle: 'scarf', scarf: '#2f7a5a', topType: 'shirt', top: '#e8dcc0', bottomType: 'dress', bottom: '#a04a3a', barefoot: true },
  crianca: { skin: '#4a2c1c', hair: '#0e0a08', hairStyle: 'curly', topType: 'shirt', top: '#e6dcc6', sleeves: 'short', bottomType: 'rolled', bottom: '#b8a888', barefoot: true, child: true },
  capataz: { skin: '#c49072', hair: '#2a1d14', hairStyle: 'short', topType: 'shirt', top: '#5a4a3a', bottomType: 'pants', bottom: '#3a3028', shoes: '#2a1d14', hat: 'fedora', hatColor: '#3a2e24', beard: 'mustache' },

  pietro: { skin: '#e2b48f', hair: '#4a2f1c', hairStyle: 'short', topType: 'shirt', top: '#efe6d2', sleeves: 'long', vest: '#4a4a4c', bottomType: 'pants', bottom: '#4b4a4e', shoes: '#1e1a18', hat: 'flatcap', hatColor: '#3e3e42', beard: 'mustache', satchel: '#7a4a2a' },
  giuseppe: { skin: '#dcae88', hair: '#4a3a2a', hairStyle: 'short', topType: 'shirt', top: '#e6dcc6', vest: '#5a4636', bottomType: 'pants', bottom: '#5a5048', shoes: '#2a1d14', hat: 'fedora', hatColor: '#4a3a2a', beard: 'full', build: 1.08 },
  giuseppeVelho: { skin: '#d8a884', hair: '#c9c2b8', hairStyle: 'short', topType: 'shirt', top: '#e6dcc6', vest: '#5a4636', bottomType: 'pants', bottom: '#5a5048', shoes: '#2a1d14', hat: 'fedora', hatColor: '#4a3a2a', beard: 'full', build: 1.05, stoop: 0.14 },
  lucia: { skin: '#e8b892', hair: '#4a2f1c', hairStyle: 'scarf', scarf: '#2f4f7a', topType: 'shirt', top: '#efe6d2', bottomType: 'dress', bottom: '#3a3a52', apron: '#f2ece0', shoes: '#2a1d14' },
  nina: { skin: '#eab896', hair: '#6a4a2a', hairStyle: 'braid', topType: 'shirt', top: '#f0e6d0', bottomType: 'dress', bottom: '#b8402e', shoes: '#3a2a1e', child: true },
  bentoAdulto: { skin: '#4a2c1c', hair: '#0e0a08', hairStyle: 'curly', topType: 'shirt', top: '#e6dcc6', sleeves: 'short', bottomType: 'rolled', bottom: '#8a7a5a', belt: '#b89a6a', shoes: '#3a2a1e', hat: 'straw', hatColor: '#c9a35b' },

  youssef: { skin: '#c8956c', hair: '#1a120d', hairStyle: 'short', topType: 'shirt', top: '#f2ece0', sleeves: 'long', vest: '#1e1c1c', sash: '#a3201c', keffiyeh: true, bottomType: 'pants', bottom: '#1e1c1c', baggy: true, shoes: '#141210', hat: 'fez', beard: 'full' },
  chefe: { skin: '#d8a888', hair: '#2a1d14', hairStyle: 'short', topType: 'shirt', top: '#2a3550', coat: '#2a3550', sleeves: 'long', bottomType: 'pants', bottom: '#2a3550', shoes: '#141210', hat: 'cap', hatColor: '#2a3550', beard: 'mustache' },
  giulia: { skin: '#e6b48e', hair: '#5a3a22', hairStyle: 'bun', topType: 'shirt', top: '#f2e2e0', bottomType: 'dress', bottom: '#7a4a6a', shoes: '#2a1d14' },
  pietroVelho: { skin: '#dcac86', hair: '#a8a098', hairStyle: 'short', topType: 'shirt', top: '#efe6d2', sleeves: 'long', vest: '#4a4a4c', bottomType: 'pants', bottom: '#4b4a4e', shoes: '#1e1a18', hat: 'flatcap', hatColor: '#3e3e42', beard: 'mustache', stoop: 0.06 },
  bentoVelho: { skin: '#4a2c1c', hair: '#ddd6cc', hairStyle: 'curly', topType: 'shirt', top: '#e8e0cc', sleeves: 'long', bottomType: 'pants', bottom: '#5a4a3a', shoes: '#2a1d14', beard: 'full', hat: 'straw', stoop: 0.16 },
  mariana: { skin: '#9a6440', hair: '#d2cbc0', hairStyle: 'braid', topType: 'shirt', top: '#e8dcc0', bottomType: 'dress', bottom: '#5a6a3a', barefoot: true, stoop: 0.12, necklace: 'seeds' },
  morador1: { skin: '#c8956c', hair: '#2a1d14', hairStyle: 'short', topType: 'shirt', top: '#d8d0c0', bottomType: 'pants', bottom: '#4a4038', hat: 'straw' },
  moradora1: { skin: '#5a3420', hairStyle: 'scarf', scarf: '#e0c060', topType: 'shirt', top: '#f0e8d8', bottomType: 'dress', bottom: '#4a6a8a', shoes: '#3a2a1e' },
  morador2: { skin: '#e2b48f', hair: '#6a4a2a', hairStyle: 'short', topType: 'shirt', top: '#cfd8e0', vest: '#5a4636', bottomType: 'pants', bottom: '#3a3a3a', hat: 'fedora', hatColor: '#5a4a3a' },
  moradora2: { skin: '#d8a888', hair: '#3a2416', hairStyle: 'bun', topType: 'shirt', top: '#e8d8c8', bottomType: 'dress', bottom: '#8a5a3a', shoes: '#3a2a1e' },
  crianca2: { skin: '#c8956c', hair: '#3a2416', hairStyle: 'short', topType: 'shirt', top: '#e0b84a', bottomType: 'pants', bottom: '#5a6a8a', child: true },

  visitante: { skin: '#b07a52', hair: '#1a120d', hairStyle: 'curly', topType: 'shirt', top: '#e8b84a', sleeves: 'short', bottomType: 'pants', bottom: '#2f4a6a', shoes: '#f2f2f2', satchel: '#2a2a2a' },
};

// Nome e cor de quem fala
export const SPEAKERS = {
  inacio: ['Inácio', '#f08a55'], avo: ['Avó', '#e6a86a'], tio: ['Tio', '#d89a6a'], tia: ['Tia', '#d8a87a'],
  bento: ['Bento', '#f0b350'], joana: ['Tia Joana', '#e88a6a'], benedito: ['Seu Benedito', '#d8c08a'],
  pietro: ['Pietro', '#a8d070'], giuseppe: ['Papà Giuseppe', '#c8b878'], lucia: ['Mamma Lucia', '#8ab0e0'], nina: ['Nina', '#f0909a'], bentoAdulto: ['Bento', '#f0b350'],
  youssef: ['Youssef', '#7fcbe0'], chefe: ['Chefe da estação', '#a8b8e0'], giulia: ['Dona Giulia', '#e0a0c8'], pietroVelho: ['Seu Pietro', '#a8d070'], bentoVelho: ['Seu Bento', '#f0b350'], mariana: ['Dona Mariana', '#b8d890'],
  voce: ['Você', '#e3b964'],
  memInacio: ['Inácio', '#f08a55'], memBento: ['Bento', '#f0b350'], memPietro: ['Pietro', '#a8d070'], memYoussef: ['Youssef', '#7fcbe0'],
};

// Registros históricos (conteúdo da pesquisa que fundamenta o jogo)
export const CARDS = {
  puri_terra: {
    kicker: 'Povo Puri', title: 'Os Puri, povo desta terra',
    body: 'Antes da colonização, os indígenas Puri habitavam o território onde hoje está Vargem Alta, segundo o histórico da Prefeitura Municipal.\nReconhecer essa presença desfaz a ideia de que a região era uma “terra vazia”: o espaço já tinha formas de ocupação, saberes e relações sociais anteriores à expansão colonial.',
    source: 'Prefeitura Municipal de Vargem Alta — histórico do município.',
  },
  puri_aldeamento: {
    kicker: 'Povo Puri · 1845–1860', title: 'O Aldeamento Imperial Afonsino',
    body: 'Entre 1845 e 1860, indígenas Puri do sul do Espírito Santo viveram a experiência do Aldeamento Imperial Afonsino. O trabalho compulsório imposto aos indígenas limitava sua liberdade e permitia o uso forçado de sua mão de obra em serviços públicos. A pesquisa também evidencia estratégias de resistência diante dessas imposições.\nO jogo usa esse episódio como contexto regional do sul capixaba — sem afirmar que o aldeamento ficava no atual território de Vargem Alta.',
    source: 'OLIVEIRA, Tatiana Gonçalves de; COSTA, Henrique Antônio Valadares. Os Puri no sul do Espírito Santo: ocupação, territorialização e trabalho compulsório (2019).',
  },
  pb_origem: {
    kicker: 'Pedra Branca · c. 1886', title: 'A origem da comunidade de Pedra Branca',
    body: 'Segundo o Inventário Nacional de Referências Culturais do IPHAN (ficha preenchida em 2014), a área foi ocupada por volta de 1886 por pessoas saídas das fazendas Pedra Branca, São Pedro e Prosperidade. O texto relaciona esse processo às fugas do cativeiro e à formação de agrupamentos que abrigavam famílias em ranchos.\nA comunidade também foi conhecida como São Pedro. A data de 1886 é aproximada, conforme a própria fonte.',
    source: 'IPHAN — Inventário Nacional de Referências Culturais (INRC), ficha sobre bens culturais de Vargem Alta, 2014.',
  },
  pb_caxambu: {
    kicker: 'Pedra Branca · patrimônio vivo', title: 'Jongo e caxambu',
    body: 'O inventário descreve celebrações comunitárias com rodas de jongo e caxambu, tambores, fogueiras e preparo coletivo de alimentos, registradas a partir das memórias de Amélia Santos da Cunha. Essas práticas mostram a força dos vínculos comunitários e da transmissão de saberes na preservação da memória negra.\nO grupo “Caxambu Fé Raça em um Só Coração — Pedra Branca”, cadastrado no IPHAN, mantém essa tradição viva. Hoje, Pedra Branca é uma comunidade quilombola de Vargem Alta.',
    source: 'IPHAN — INRC (2014); cadastro do grupo Caxambu Fé Raça em um Só Coração — Pedra Branca.',
  },
  pb_bento: {
    kicker: 'Sobre a narrativa', title: 'A condição não é a pessoa',
    body: 'Bento é um personagem ficcional: representa uma experiência de busca por autonomia e de construção de uma vida comunitária, e não corresponde a um fundador historicamente identificado.\nA narrativa distingue a condição de escravizado — imposta pela violência — da identidade e da trajetória completa de uma pessoa.',
    source: 'Nota de concepção do jogo “Caminhos da Memória”, a partir da pesquisa realizada.',
  },
  it_chegada: {
    kicker: 'Imigração italiana · fim do século XIX', title: 'Italianos em Vargem Alta',
    body: 'O perfil histórico da Prefeitura relaciona a chegada de imigrantes italianos, no final do século XIX, à ocupação agrícola da região. O histórico municipal do IBGE registra que os italianos encontraram fazendas abandonadas, tomadas pela mata, e abriram a estrada que deu origem à atual rodovia ES-164.\nPietro, sua família, sua propriedade e suas experiências foram criados para o jogo.',
    source: 'Prefeitura Municipal de Vargem Alta — perfil histórico; IBGE — histórico do município.',
  },
  it_ferrovia: {
    kicker: 'Os trilhos', title: 'A Estrada de Ferro Leopoldina',
    body: 'A Estrada de Ferro Leopoldina participou do desenvolvimento local e da formação de núcleos populacionais na região.\nNo jogo, o trem aparece “anos depois” da chegada de Pietro: a ferrovia representa uma transformação histórica posterior e não estava em funcionamento no momento da chegada da família.',
    source: 'Prefeitura Municipal de Vargem Alta — perfil histórico; IBGE — histórico do município.',
  },
  lb_comercio: {
    kicker: 'Imigração libanesa · 1927', title: 'Comerciantes libaneses na vila',
    body: 'Mintaha Alcuri Campos registra nove comerciantes libaneses em Vargem Alta em 1927 e relaciona a circulação comercial no sul capixaba à importância de Cachoeiro de Itapemirim e às conexões ferroviárias.\nYoussef é um personagem ficcional: os registros fiscais originais citados pela autora não foram consultados, nem foi identificado documentalmente um comerciante com esse nome.',
    source: 'CAMPOS, Mintaha Alcuri. A trajetória do migrante libanês no Espírito Santo. Revista IJSN, ano IV, n. 2, 1985 (reproduzido no portal Morro do Moreno).',
  },
  va_municipio: {
    kicker: 'Vargem Alta · 1988–1989', title: 'Nasce o município',
    body: 'Vargem Alta foi elevada à categoria de município pela Lei Estadual nº 4.063, de 6 de maio de 1988, desmembrando-se de Cachoeiro de Itapemirim. A instalação ocorreu em 1º de janeiro de 1989.\nA criação administrativa é recente — mas a formação social do lugar começou muito antes, com os Puri, com as comunidades negras, com os imigrantes italianos e libaneses e com tantas outras pessoas.',
    source: 'IBGE — histórico do município de Vargem Alta.',
  },
};

export const CREDITS_HTML = `
<h2>Caminhos da Memória</h2>
<p>Um jogo educativo em 3D e realidade virtual sobre os povos e processos que formaram Vargem Alta, no sul do Espírito Santo.</p>

<h3>OS CAMINHOS</h3>
<ul>
<li><b>Capítulo I · Inácio (Povo Puri)</b> — presença indígena anterior à colonização, trabalho compulsório e resistência.</li>
<li><b>Capítulo II · Bento (Pedra Branca)</b> — fugas do cativeiro, ranchos, jongo e caxambu na origem da comunidade quilombola.</li>
<li><b>Capítulo III · Pietro (imigração italiana)</b> — lavoura de café, construção da vida familiar e a chegada da ferrovia.</li>
<li><b>Capítulo IV · Youssef (imigração libanesa)</b> — o comércio, a estação e os vínculos da vila em 1927.</li>
<li><b>Epílogo</b> — a emancipação de 1988–1989 e a memória viva desses caminhos.</li>
</ul>

<h3>SOBRE A PESQUISA</h3>
<p>Para fundamentar o jogo, foi realizado um levantamento bibliográfico e documental pela internet, com estudos acadêmicos, registros do IPHAN, informações da Prefeitura de Vargem Alta e o histórico municipal do IBGE. O levantamento não incluiu entrevistas, pesquisa presencial nem consulta direta aos documentos originais dos arquivos.</p>

<h3>FONTES</h3>
<ul>
<li>OLIVEIRA, Tatiana Gonçalves de; COSTA, Henrique Antônio Valadares. <i>Os Puri no sul do Espírito Santo: ocupação, territorialização e trabalho compulsório</i>. 2019.</li>
<li>IPHAN. Inventário Nacional de Referências Culturais (INRC) — ficha sobre bens culturais de Vargem Alta, preenchida em 2014 (comunidade quilombola de Pedra Branca; memórias de Amélia Santos da Cunha).</li>
<li>IPHAN. Cadastro do grupo “Caxambu Fé Raça em um Só Coração — Pedra Branca”.</li>
<li>CAMPOS, Mintaha Alcuri. A trajetória do migrante libanês no Espírito Santo. <i>Revista IJSN</i>, ano IV, n. 2, 1985. Reproduzido no portal Morro do Moreno.</li>
<li>PREFEITURA MUNICIPAL DE VARGEM ALTA. Histórico e perfil do município.</li>
<li>IBGE. Histórico do município de Vargem Alta (Lei Estadual nº 4.063, de 6 de maio de 1988; instalação em 1º de janeiro de 1989).</li>
</ul>

<h3>FICÇÃO E HISTÓRIA</h3>
<p class="note">Os nomes dos protagonistas, suas falas, os encontros, as tarefas e a disposição das construções foram criados para a experiência educativa. Bento, Pietro e Youssef não correspondem a pessoas historicamente identificadas. O nome de batismo “Inácio” é ficcional e remete à imposição de nomes nos aldeamentos.<br><br>
A imagem de referência dos personagens serviu como inspiração artística, sem que roupas e adereços sejam considerados provas históricas — especialmente no caso da representação Puri. Os cenários são interpretações visuais, sem reconstrução documental precisa da geografia ou da arquitetura de época. A bandeira libanesa da imagem de referência foi omitida porque o modelo atual só foi adotado em 1943, depois da época do capítulo.<br><br>
A proposta pedagógica é reconhecer diferentes sujeitos e experiências na formação de Vargem Alta: uma história que envolve contribuições econômicas e culturais, mas também disputas por território, liberdade e reconhecimento.</p>

<h3>TECNOLOGIA</h3>
<p>Desenvolvido para navegador com three.js e WebXR (compatível com óculos de realidade virtual). Cenários, personagens, música e sons são gerados proceduralmente, sem arquivos externos.</p>
<p style="margin-top:40px;color:var(--gold2);font-family:var(--serif)">Obrigado por caminhar com estas histórias.</p>
`;
