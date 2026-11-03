import { createRoot } from 'react-dom/client';
import './styles.css';
import { App } from './App';
import { MusicPlayer } from './MusicPlayer';
createRoot(document.getElementById('root')!).render(<><App/><MusicPlayer/></>);
