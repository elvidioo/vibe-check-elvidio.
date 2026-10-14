import { Brain, Atom, Gamepad2, Clapperboard, Dribbble } from 'lucide-react';

export const LEVEL_SIZE = 300;

export const categories = [
  { name: 'Culture générale', icon: Brain, tone: 'cyan', difficulty: 'Facile', count: 10 },
  { name: 'Sciences & Nature', icon: Atom, tone: 'green', difficulty: 'Moyen', count: 10 },
  { name: 'Jeux vidéo', icon: Gamepad2, tone: 'pink', difficulty: 'Moyen', count: 10 },
  { name: 'Cinéma & Séries', icon: Clapperboard, tone: 'red', difficulty: 'Difficile', count: 10 },
  { name: 'Sport', icon: Dribbble, tone: 'green', difficulty: 'Facile', count: 10 },
];

export const demoQuiz = {
  title: 'Neon Trivia',
  theme: 'gaming-neon',
  description: 'Entre dans l’arène et teste ton niveau.',
  questions: [
    { id: 'demo-q1', text: 'Quelle planète est surnommée la planète rouge ?', options: [
      { id: 'demo-o1', text: 'Mars' }, { id: 'demo-o2', text: 'Vénus' }, { id: 'demo-o3', text: 'Jupiter' },
    ] },
    { id: 'demo-q2', text: 'Combien font 5 × 6 ?', options: [
      { id: 'demo-o4', text: '25' }, { id: 'demo-o5', text: '30' }, { id: 'demo-o6', text: '35' },
    ] },
  ],
};

// Bonnes réponses du quiz de démonstration uniquement (jamais utilisées pour un quiz Supabase).
export const demoCorrect = { 'demo-q1': 'demo-o1', 'demo-q2': 'demo-o5' };

// Classement fictif, affiché seulement quand Supabase n'est pas configuré.
export function demoLeaderboard(period, pseudo) {
  const pick = (day, week, all) => (period === 'Jour' ? day : period === 'Semaine' ? week : all);
  return [
    { pseudo: 'DarkGhost', level: 12, xp: pick(1240, 24560, 108420) },
    { pseudo: 'ZoroX', level: 10, xp: pick(980, 9870, 42650) },
    { pseudo: 'Naya', level: 9, xp: pick(760, 8650, 37910) },
    { pseudo, level: 3, xp: pick(420, 1250, 6430) },
    { pseudo: 'LeVrai', level: 8, xp: 7420 },
    { pseudo: 'PixelQueen', level: 7, xp: 6890 },
    { pseudo: 'KiraPlay', level: 6, xp: 5770 },
    { pseudo: 'NovaX', level: 5, xp: 4980 },
  ].sort((a, b) => b.xp - a.xp).map((r, i) => ({ ...r, rank: i + 1 }));
}
