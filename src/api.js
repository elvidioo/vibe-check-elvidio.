import { supabase } from './supabase';

export const QUIZ_SLUG = 'quiz-test-v1';

const unwrap = (data) => (Array.isArray(data) ? data[0] : data);

async function rpc(name, args) {
  const { data, error } = await supabase.rpc(name, args);
  if (error) throw error;
  return unwrap(data);
}

// Une seule connexion anonyme, même si plusieurs appels démarrent en même temps
// (React StrictMode exécute les effets deux fois en développement).
let sessionPromise = null;
export function ensureSession() {
  if (!supabase) return Promise.resolve(null);
  if (!sessionPromise) {
    sessionPromise = (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) return session;
      const { data, error } = await supabase.auth.signInAnonymously();
      if (error) throw error;
      return data.session;
    })().catch((e) => { sessionPromise = null; throw e; });
  }
  return sessionPromise;
}

// Ne garde que id + texte : aucun champ supplémentaire du serveur n'est conservé côté client.
function normalizeQuiz(raw, slug) {
  const qs = raw.questions ?? raw.quiz?.questions ?? [];
  const questions = qs.map((q, i) => ({
    id: q.id ?? q.question_id ?? `q-${i}`,
    text: q.text ?? q.question_text ?? q.prompt ?? `Question ${i + 1}`,
    options: (q.options ?? q.answer_options ?? []).map((o, j) => ({
      id: o.id ?? o.option_id ?? `o-${i}-${j}`,
      text: o.text ?? o.option_text ?? o.label ?? '',
    })),
  }));
  return {
    slug: raw.slug ?? slug,
    title: raw.title ?? raw.quiz_title ?? 'Quiz VIBE CHECK',
    description: raw.description ?? '',
    questions,
  };
}

export const api = {
  async getPlayerState() {
    await ensureSession();
    return rpc('vibe_get_player_state');
  },
  async setPseudo(pseudo) {
    await ensureSession();
    return rpc('vibe_set_pseudo', { p_pseudo: pseudo });
  },
  async completeChallenge(challengeId) {
    await ensureSession();
    return rpc('vibe_complete_daily_challenge', { p_challenge_id: challengeId });
  },
  async purchaseReward(itemId) {
    await ensureSession();
    return rpc('vibe_purchase_reward', { p_item_id: itemId });
  },
  async getLeaderboard(period) {
    await ensureSession();
    const { data, error } = await supabase.rpc('vibe_get_leaderboard', { p_period: period });
    if (error) throw error;
    return (Array.isArray(data) ? data : []).map((r, i) => ({
      rank: Number(r.rank ?? i + 1),
      pseudo: r.pseudo ?? 'Joueur',
      level: Number(r.level ?? 1),
      xp: Number(r.xp ?? 0),
    }));
  },
  async getQuiz(slug = QUIZ_SLUG) {
    const raw = await rpc('get_public_quiz', { p_slug: slug });
    if (!raw) throw new Error(`Quiz introuvable. Vérifie le slug ${slug} dans Supabase.`);
    const quiz = normalizeQuiz(raw, slug);
    if (!quiz.questions.length) throw new Error('Le quiz est chargé, mais son format de questions doit être ajusté.');
    return quiz;
  },
  // Avec session joueur : le serveur calcule le score ET attribue les XP.
  // Sans session : repli sur la fonction publique existante (aucun XP).
  async submitQuiz({ slug, pseudo, payload, authed }) {
    if (authed) {
      const r = await rpc('vibe_submit_quiz', { p_slug: slug, p_answers: payload });
      return { ...r, score: Number(r?.score ?? 0), total: Number(r?.total ?? payload.length) };
    }
    const r = await rpc('submit_public_quiz', { p_slug: slug, p_participant_name: pseudo, p_answers: payload });
    return { score: Number(r?.score ?? r?.correct_answers ?? 0), total: Number(r?.total_questions ?? payload.length) };
  },
};
