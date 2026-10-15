import {
  Brain, Atom, Gamepad2, Clapperboard, Dribbble,
  Globe, Landmark, GraduationCap, Timer, Puzzle, CircleCheck,
} from 'lucide-react';

export const LEVEL_SIZE = 300;

// Niveaux proposés pour les 5 catégories principales.
// Niveau 1 à 3 : quiz de 10 questions (slugs « <prefix>-niveau-N » dans Supabase).
// Marathon : quiz complet de 26 questions (slug « vibe-… » dans Supabase).
export const LEVELS = ['Niveau 1', 'Niveau 2', 'Niveau 3', 'Marathon'];

export const categories = [
  { name: 'Culture générale', icon: Brain, tone: 'cyan', difficulty: 'Facile', prefix: 'culture', marathon: 'vibe-culture-generale' },
  { name: 'Sciences & Nature', icon: Atom, tone: 'green', difficulty: 'Moyen', prefix: 'sciences', marathon: 'vibe-sciences-nature' },
  { name: 'Jeux vidéo', icon: Gamepad2, tone: 'pink', difficulty: 'Moyen', prefix: 'jeux', marathon: 'vibe-gaming-tech' },
  { name: 'Cinéma & Séries', icon: Clapperboard, tone: 'red', difficulty: 'Difficile', prefix: 'cinema', marathon: 'vibe-cinema-series-musique' },
  { name: 'Sport', icon: Dribbble, tone: 'green', difficulty: 'Facile', prefix: 'sport', marathon: 'vibe-sports' },
  // Univers à quiz unique (26 questions).
  { name: 'Afrique & Francophonie', icon: Globe, tone: 'green', difficulty: 'Moyen', slug: 'vibe-afrique-francophonie', count: 26 },
  { name: 'Histoire & Civilisations', icon: Landmark, tone: 'red', difficulty: 'Moyen', slug: 'vibe-histoire-civilisations', count: 26 },
  { name: 'Logique & Énigmes', icon: Puzzle, tone: 'pink', difficulty: 'Difficile', slug: 'vibe-logique-enigmes', count: 26 },
  { name: 'Éducation', icon: GraduationCap, tone: 'cyan', difficulty: 'Facile', slug: 'vibe-education', count: 26 },
  { name: 'Vrai ou Faux', icon: CircleCheck, tone: 'green', difficulty: 'Facile', slug: 'vibe-vrai-faux', count: 26 },
  { name: 'Défis chrono', icon: Timer, tone: 'pink', difficulty: 'Moyen', slug: 'vibe-chrono', count: 26 },
];

// Quiz Supabase à ouvrir pour une catégorie et un niveau donnés.
export function quizTarget(category, level) {
  if (category.slug) return { slug: category.slug, count: category.count };
  if (level === 'Marathon') return { slug: category.marathon, count: 26 };
  const n = Math.max(1, LEVELS.indexOf(level) + 1);
  return { slug: `${category.prefix}-niveau-${n}`, count: 10 };
}

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
