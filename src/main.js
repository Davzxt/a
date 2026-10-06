import '@fontsource/cinzel/600.css';
import '@fontsource/cinzel/700.css';
import '@fontsource/nunito/400.css';
import '@fontsource/nunito/400-italic.css';
import '@fontsource/nunito/600.css';
import '@fontsource/nunito/700.css';
import '@fontsource/nunito/800.css';
import './style.css';
import { Game } from './game.js';

const game = new Game();
game.boot().catch((e) => {
  console.error(e);
  const m = document.getElementById('load-msg');
  if (m) m.textContent = 'Não foi possível iniciar o jogo neste navegador (WebGL 2 é necessário).';
});
