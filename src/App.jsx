import { useEffect, useMemo, useState } from 'react';
import {
  Bell, Brain, Trophy, Store, MessageSquareText, Search, ChevronRight,
  Home, UserRound, Gamepad2, ArrowLeft,
  Check, Sparkles, Settings, Flame, Heart, ListChecks, X, LoaderCircle, Gift, Coins, CalendarDays, ShoppingBag, CircleCheck
} from 'lucide-react';
import { supabase } from './supabase';
import { api, QUIZ_SLUG } from './api';
import { categories, demoQuiz, demoCorrect, demoLeaderboard, LEVEL_SIZE } from './data';
import Podium from './components/Podium';

export default function App() {
  const [tab, setTab] = useState('Accueil');
  const [category, setCategory] = useState('Tous');
  const [search, setSearch] = useState('');
  const [quiz, setQuiz] = useState(null);
  const [questionIndex, setQuestionIndex] = useState(0);
  const [answers, setAnswers] = useState({});
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [notice, setNotice] = useState('');
  const [pseudo, setPseudo] = useState('Joueur');
  const [pseudoDraft, setPseudoDraft] = useState('Joueur');
  const [savingPseudo, setSavingPseudo] = useState(false);
  const [avatar, setAvatar] = useState(0);
  const [leaderboardPeriod, setLeaderboardPeriod] = useState('Semaine');
  const [completedChallenges, setCompletedChallenges] = useState([]);
  const [claimedRewards, setClaimedRewards] = useState([]);
  const [playerXp, setPlayerXp] = useState(120);
  const [playerInventory, setPlayerInventory] = useState([]);
  const [playerReady, setPlayerReady] = useState(false);
  const [leaderboardRows, setLeaderboardRows] = useState([]);
  const [lbStatus, setLbStatus] = useState('loading');
  const [lbRetry, setLbRetry] = useState(0);

  const filtered = useMemo(() => categories.filter(c =>
    (category === 'Tous' || c.name === category) &&
    c.name.toLowerCase().includes(search.toLowerCase())
  ), [category, search]);

  useEffect(() => {
    if (!notice) return;
    const t = setTimeout(() => setNotice(''), 3500);
    return () => clearTimeout(t);
  }, [notice]);

  useEffect(() => {
    let alive = true;
    async function bootPlayer() {
      if (!supabase) return;
      try {
        const state = await api.getPlayerState();
        if (!alive || !state) return;
        setPseudo(state.pseudo ?? 'Joueur');
        setPseudoDraft(state.pseudo ?? 'Joueur');
        setPlayerXp(Number(state.xp ?? 0));
        setCompletedChallenges(Array.isArray(state.completed_challenges) ? state.completed_challenges : []);
        setPlayerInventory(Array.isArray(state.inventory) ? state.inventory : []);
        setPlayerReady(true);
      } catch (e) {
        if (alive) setNotice(`Mode local actif. Connexion joueur non établie : ${e.message || 'configuration Supabase à vérifier'}`);
      }
    }
    bootPlayer();
    return () => { alive = false; };
  }, []);

  useEffect(() => {
    if (!supabase || tab !== 'Classement') return;
    let alive = true;
    setLbStatus('loading');
    api.getLeaderboard(leaderboardPeriod.toLowerCase())
      .then((rows) => { if (alive) { setLeaderboardRows(rows); setLbStatus('ok'); } })
      .catch(() => { if (alive) { setLeaderboardRows([]); setLbStatus('error'); } });
    return () => { alive = false; };
  }, [tab, leaderboardPeriod, lbRetry]);

  async function savePseudo() {
    const wanted = pseudoDraft.trim();
    if (!supabase || !playerReady) {
      setPseudo(wanted || 'Joueur');
      setNotice('Pseudo modifié localement. Il sera enregistré quand la session joueur sera active.');
      return;
    }
    setSavingPseudo(true);
    try {
      const res = await api.setPseudo(wanted);
      setPseudo(res.pseudo);
      setPseudoDraft(res.pseudo);
      setNotice('Pseudo enregistré.');
    } catch (e) {
      setNotice(e.message || 'Pseudo refusé.');
    } finally { setSavingPseudo(false); }
  }

  // Seule la mission « explore » est réclamée par le client ; quiz et perfect sont attribuées par le serveur.
  async function completeChallenge(challengeId) {
    if (!supabase || !playerReady) {
      setCompletedChallenges(v => v.includes(challengeId) ? v : [...v, challengeId]);
      setNotice('Défi marqué localement. Connecte Supabase pour sauvegarder les XP.');
      return;
    }
    try {
      const state = await api.completeChallenge(challengeId);
      setPlayerXp(x => Number(state?.xp ?? x));
      setCompletedChallenges(v => v.includes(challengeId) ? v : [...v, challengeId]);
      const gained = Number(state?.reward_xp ?? 0) + Number(state?.bonus_xp ?? 0);
      setNotice(state?.already_completed ? 'Mission déjà accomplie aujourd’hui.' : `Mission terminée : +${gained} XP !`);
    } catch (e) {
      setNotice(`Impossible d’enregistrer le défi : ${e.message || 'erreur Supabase'}`);
    }
  }

  async function purchaseReward(item) {
    if (!supabase || !playerReady) {
      setNotice('La boutique nécessite une session Supabase pour enregistrer les achats.');
      return;
    }
    try {
      const state = await api.purchaseReward(item.id);
      setPlayerXp(x => Number(state?.xp ?? x));
      setPlayerInventory(v => v.includes(item.id) ? v : [...v, item.id]);
      setNotice(state?.already_owned ? 'Tu possèdes déjà cet objet.' : `${item.name} débloqué !`);
    } catch (e) {
      setNotice(`Achat non effectué : ${e.message || 'vérifie ton solde XP'}`);
    }
  }

  async function loadTestQuiz() {
    setLoading(true); setNotice('');
    try {
      if (!supabase) throw new Error('Ajoute les identifiants Supabase dans le fichier .env.');
      const quizData = await api.getQuiz(QUIZ_SLUG);
      setQuiz({ ...quizData, source: 'supabase' });
      setQuestionIndex(0); setAnswers({}); setResult(null); setTab('Quiz');
    } catch (e) {
      setNotice(e.message || 'Impossible de charger le quiz Supabase.');
    } finally { setLoading(false); }
  }

  function startDemo() {
    setQuiz({ ...demoQuiz, source: 'demo' });
    setQuestionIndex(0); setAnswers({}); setResult(null); setTab('Quiz');
  }

  async function finishQuiz() {
    const qs = quiz.questions || [];
    setLoading(true);
    try {
      if (quiz.source === 'supabase') {
        const payload = qs.map(q => ({ question_id: q.id, selected_option_id: answers[q.id] ?? null }));
        const res = await api.submitQuiz({ slug: quiz.slug ?? QUIZ_SLUG, pseudo, payload, authed: playerReady });
        setResult({ score: res.score, total: res.total || qs.length, saved: true });
        if (playerReady && res.xp != null) {
          setPlayerXp(Number(res.xp));
          if (Array.isArray(res.completed_challenges)) setCompletedChallenges(res.completed_challenges);
          const gained = Number(res.reward_xp ?? 0) + Number(res.bonus_xp ?? 0);
          if (gained > 0) setNotice(`+${gained} XP gagnés !`);
        }
      } else {
        const score = qs.reduce((n, q) => n + (answers[q.id] === demoCorrect[q.id] ? 1 : 0), 0);
        setResult({ score, total: qs.length, saved: false });
      }
    } catch (e) {
      // Pas de faux score pour un quiz Supabase : on reste sur la question pour réessayer.
      setNotice(`Tes réponses n’ont pas pu être envoyées : ${e.message || 'erreur inconnue'}. Réessaie.`);
    } finally { setLoading(false); }
  }

  const activeQuestion = quiz?.questions?.[questionIndex];
  const progress = quiz?.questions?.length ? ((questionIndex + 1) / quiz.questions.length) * 100 : 0;
  const level = Math.floor(playerXp / LEVEL_SIZE) + 1;
  const levelXp = playerXp % LEVEL_SIZE;
  const lbRows = supabase ? leaderboardRows : demoLeaderboard(leaderboardPeriod, pseudo);
  const lbShown = supabase ? lbStatus : 'ok';

  return <div className="app-shell">
    <div className="ambient ambient-a" /><div className="ambient ambient-b" />
    <header className="topbar">
      <button className="brand" onClick={() => setTab('Accueil')} aria-label="Accueil">
        <span className="brand-mark">♛</span><span>VIBE <b>CHECK</b><small>par Elvidio</small></span>
      </button>
      <div className="top-actions">
        <button className="icon-button" aria-label="Notifications" onClick={() => setNotice('Tu es à jour. Aucune nouvelle notification.')}><Bell size={19}/></button>
        <button className="avatar avatar-small" onClick={() => setTab('Profil')} aria-label="Ouvrir le profil">E</button>
      </div>
    </header>

    {tab === 'Accueil' && <main className="page social-home">
      <div className="live-heading"><div><p className="eyebrow">VIBE CHECK / GAMING SOCIAL</p><h1>LIVE GAMING <span className="muted">DISCOVER</span></h1></div><span className="live-pill"><i/> EN DIRECT</span></div>
      <section className="stream-hero" onClick={loadTestQuiz} role="button" tabIndex="0" aria-label="Ouvrir le défi principal">
        <div className="stream-city"/><div className="stream-rings"><i/><i/><i/></div>
        <div className="stream-character"><div className="stream-hood"/><div className="stream-head"><i/><i/><b/></div><div className="stream-body"/><div className="stream-arm left"/><div className="stream-arm right"/></div>
        <span className="stream-live"><i/> LIVE GAMING</span><div className="stream-copy"><span className="stream-kicker">FEATURED PLAYER</span><h2>Shadow<em>X</em></h2><p>Fortnite · 14,5 k followers</p><button className="stream-follow" onClick={e=>{e.stopPropagation();loadTestQuiz()}}>Voir le défi <ChevronRight size={14}/></button></div>
        <div className="stream-reactions"><span>💜</span><span>✦</span><span>↗</span></div>
      </section>
      <div className="creator-line"><div className="avatar avatar-small">E</div><div><strong>{pseudo}</strong><small><i/> Joueur actif · Niveau {level}</small></div><button onClick={()=>setTab('Profil')}>Profil <ChevronRight size={14}/></button></div>
      <section className="section-head"><div><p className="eyebrow">TRENDING NOW</p><h2>Streams populaires</h2></div><button className="text-button" onClick={() => setTab('Streams')}>Voir tout <ChevronRight size={16}/></button></section>
      <div className="trending-row">
        <button className="trend-card trend-one" onClick={loadTestQuiz}><div className="trend-art"><span>♜</span><i>✦</i></div><span className="trend-live">● QUIZ</span><strong>Neon Trivia</strong><small>Culture générale</small></button>
        <button className="trend-card trend-two" onClick={()=>{setCategory('Jeux vidéo');setTab('Quiz')}}><div className="trend-art"><span>🎮</span><i>✧</i></div><span className="trend-live">CHALLENGE</span><strong>Game Rush</strong><small>Jeux vidéo</small></button>
        <button className="trend-card trend-three" onClick={()=>{setCategory('Sciences & Nature');setTab('Quiz')}}><div className="trend-art"><span>✺</span><i>✦</i></div><span className="trend-live">NOUVEAU</span><strong>Brain Storm</strong><small>Sciences & Nature</small></button>
      </div>
      <section className="section-head"><div><p className="eyebrow">FOLLOWING</p><h2>Joueurs à suivre</h2></div><button className="text-button" onClick={()=>setTab('Classement')}>Classement <ChevronRight size={16}/></button></section>
      <div className="players-strip"><button onClick={()=>setTab('Profil')}><span className="player-avatar pa1">✦</span><strong>ShadowX</strong><small>12,4 k XP</small></button><button onClick={()=>setTab('Profil')}><span className="player-avatar pa2">◈</span><strong>NovaGirl</strong><small>9,8 k XP</small></button><button onClick={()=>setTab('Profil')}><span className="player-avatar pa3">⚡</span><strong>ZoroX</strong><small>8,6 k XP</small></button><button onClick={()=>setTab('Profil')}><span className="player-avatar pa4">👾</span><strong>{pseudo}</strong><small>1,2 k XP</small></button></div>
      <section className="section-head"><div><p className="eyebrow">YOUR PROGRESS</p><h2>Ton niveau</h2></div><button className="text-button" onClick={()=>setTab('Profil')}>Voir profil <ChevronRight size={16}/></button></section>
      <div className="level-card"><div className="avatar avatar-large">E</div><div className="level-info"><div className="level-line"><strong>Niveau {level}</strong><span>{Math.round(levelXp / LEVEL_SIZE * 100)}%</span></div><div className="xp-track"><i style={{width:`${Math.min(100,levelXp/LEVEL_SIZE*100)}%`}}/></div><small>{levelXp} / {LEVEL_SIZE} XP</small></div></div>
    </main>}

    {tab === 'Quiz' && !quiz && <main className="page quiz-library-page">
      <div className="quiz-library-heading"><div><p className="eyebrow">VIBE CHECK / GAME SELECT</p><h1>Choisis ton <span>arène</span></h1><p className="muted">Chaque défi te rapproche du prochain rang.</p></div><div className="quiz-rank-mark"><Trophy size={22}/><small>RANK 03</small></div></div>
      <button className="quiz-feature-card" onClick={loadTestQuiz} disabled={loading}>
        <div className="quiz-feature-art"><div className="quiz-feature-moon"/><div className="quiz-feature-ridge ridge-one"/><div className="quiz-feature-ridge ridge-two"/><div className="quiz-feature-avatar"><i/><b/><span/></div><div className="quiz-feature-grid"/></div>
        <span className="quiz-feature-tag"><Sparkles size={12}/> DÉFI À LA UNE</span>
        <div className="quiz-feature-copy"><small>01 / CULTURE GÉNÉRALE</small><h2>NEON <b>TRIVIA</b></h2><p>2 questions · Débutant · +XP</p><span className="quiz-feature-cta">{loading ? 'Chargement…' : 'Entrer dans l’arène'} <ChevronRight size={15}/></span></div>
      </button>
      <label className="searchbox"><Search size={18}/><input value={search} onChange={e => setSearch(e.target.value)} placeholder="Rechercher un univers…"/></label>
      <div className="quiz-library-section-head"><div><p className="eyebrow">EXPLORE LES MONDES</p><h2>Catégories</h2></div><span>{filtered.length} univers</span></div>
      <div className="chips"><button className={category==='Tous'?'selected':''} onClick={() => setCategory('Tous')}>Tous</button>{categories.map(c=><button key={c.name} className={category===c.name?'selected':''} onClick={() => setCategory(c.name)}>{c.name}</button>)}</div>
      <div className="quiz-world-grid">{filtered.map((c,i)=>{const Icon=c.icon;return <button key={c.name} className={`quiz-world-card world-${c.tone}`} onClick={() => c.name==='Culture générale' ? loadTestQuiz() : setNotice('Ce thème sera disponible lorsque ses quiz auront été ajoutés dans Supabase.')}><div className="quiz-world-art"><span className="quiz-world-orbit orbit-a"/><span className="quiz-world-orbit orbit-b"/><span className="quiz-world-icon"><Icon size={27}/></span><small>0{i+1}</small></div><div className="quiz-world-info"><strong>{c.name}</strong><span>{c.count} questions <i>·</i> {c.difficulty}</span><b><ChevronRight size={15}/></b></div></button>})}</div>
      <div className="quiz-library-footnote"><Gamepad2 size={16}/><span>Choisis une catégorie pour découvrir les défis disponibles.</span></div>
    </main>}

    {tab === 'Quiz' && quiz && !result && activeQuestion && <main className="page quiz-page">
      <button className="back-button" onClick={() => setQuiz(null)}><ArrowLeft size={18}/> Quitter le quiz</button>
      <div className="quiz-title"><div><p className="eyebrow">NEON CHALLENGE</p><h1>{quiz.title}</h1><p className="muted">{quiz.questions.length} questions</p></div><span className="question-count">{questionIndex+1}/{quiz.questions.length}</span></div>
      <div className="progress-track"><i style={{width:`${progress}%`}}/></div>
      <article className="question-card"><div className="planet-art"><span>🌐</span><i className="orbit orbit-one"/><i className="orbit orbit-two"/><b>NEON ARENA</b></div><h2>{activeQuestion.text}</h2></article>
      <div className="answer-list">{activeQuestion.options.map((o,i) => <button key={o.id} className={`answer-option ${answers[activeQuestion.id]===o.id?'chosen':''}`} onClick={() => setAnswers(a=>({...a,[activeQuestion.id]:o.id}))}><span className="answer-letter">{String.fromCharCode(65+i)}</span>{o.text}{answers[activeQuestion.id]===o.id && <Check className="answer-check"/>}</button>)}</div>
      <div className="quiz-controls"><button className="secondary-button" onClick={() => setQuestionIndex(i=>Math.max(0,i-1))} disabled={questionIndex===0}>Précédent</button>
      {questionIndex < quiz.questions.length-1 ? <button className="primary-button" onClick={() => setQuestionIndex(i=>i+1)} disabled={!answers[activeQuestion.id]}>Suivant <ChevronRight/></button> : <button className="primary-button" onClick={finishQuiz} disabled={loading || !answers[activeQuestion.id]}>{loading?<LoaderCircle className="spin"/>:<Check/>} Terminer</button>}</div>
    </main>}

    {tab === 'Quiz' && result && <main className="page result-page">
      <div className="result-orb">🏆</div><p className="eyebrow">QUIZ TERMINÉ</p><h1>{result.score}/{result.total}</h1><p className="muted">{result.score===result.total?'Score parfait ! Tu maîtrises le sujet.':'Bien joué ! Continue à progresser.'}</p>
      <div className="result-status">{result.saved ? '✓ Résultat envoyé à Supabase' : 'Résultat de démonstration, non enregistré'}</div>
      <button className="primary-button" onClick={() => {setQuiz(null);setResult(null);setTab('Accueil')}}>Retour à l’accueil</button>
      <button className="secondary-button" onClick={() => {setAnswers({});setQuestionIndex(0);setResult(null)}}>Rejouer</button>
    </main>}

    {tab === 'Défis' && <main className="page challenges-page">
      <div className="challenge-heading"><div><p className="eyebrow">VIBE CHECK / DAILY QUESTS</p><h1>Défis <span>quotidiens</span></h1><p className="muted">Chaque petite victoire te rapproche du prochain rang.</p></div><div className="challenge-streak"><Flame size={22}/><strong>03</strong><small>JOURS</small></div></div>
      <section className="challenge-hero"><div className="challenge-hero-orb">✦</div><div className="challenge-hero-copy"><span>MISSION DU JOUR</span><h2>La série continue</h2><p>Termine 3 missions pour gagner un bonus de 50 XP.</p><div className="challenge-progress"><i style={{width:`${Math.min(100,completedChallenges.length/3*100)}%`}}/></div><small>{Math.min(3,completedChallenges.length)} / 3 missions terminées</small></div></section>
      <div className="challenge-summary"><div><span className="challenge-summary-icon"><Coins size={18}/></span><strong>{playerXp} XP</strong><small>XP disponibles</small></div><div><span className="challenge-summary-icon pink"><CalendarDays size={18}/></span><strong>{3-completedChallenges.length>0?3-completedChallenges.length:0}</strong><small>missions restantes</small></div></div>
      <section className="challenge-section-head"><div><p className="eyebrow">À TOI DE JOUER</p><h2>Ta liste de missions</h2></div><span>RESET QUOTIDIEN</span></section>
      <div className="challenge-list">
        {[{id:'quiz',icon:Brain,title:'Échauffement mental',desc:'Termine un quiz',reward:25,progress:completedChallenges.includes('quiz')?'1 / 1':'0 / 1',tone:'cyan'},{id:'perfect',icon:Trophy,title:'Sans faute',desc:'Réussis le quiz de test',reward:40,progress:completedChallenges.includes('perfect')?'1 / 1':'0 / 1',tone:'gold'},{id:'explore',icon:Gamepad2,title:'Explorateur',desc:'Visite l’écran des streams',reward:25,progress:completedChallenges.includes('explore')?'1 / 1':'0 / 1',tone:'pink'}].map(item=>{const Icon=item.icon,done=completedChallenges.includes(item.id);return <article className={`challenge-card ${done?'is-complete':''}`} key={item.id}><div className={`challenge-card-icon ${item.tone}`}><Icon size={22}/></div><div className="challenge-card-copy"><strong>{item.title}</strong><p>{item.desc}</p><div className="challenge-card-progress"><span>{item.progress}</span><span>+{item.reward} XP</span></div></div><button className="challenge-action" disabled={done} onClick={()=>{if(item.id==='quiz'){setTab('Quiz');setQuiz(null);setNotice('Termine un quiz pour accomplir cette mission.')}else if(item.id==='explore'){setTab('Streams');completeChallenge(item.id)}else{setTab('Quiz');setQuiz(null);setNotice('Réussis le quiz de test pour accomplir cette mission.')}}}>{done?<CircleCheck size={19}/>:<ChevronRight size={19}/>}</button></article>})}
      </div>
      <section className="challenge-reward-banner"><div className="reward-gift"><Gift size={24}/></div><div><strong>Récompense de série</strong><p>3 missions terminées = bonus de 50 XP</p></div><span>{completedChallenges.length>=3?'DÉBLOQUÉ':'50 XP'}</span></section>
      <button className="challenge-shop-link" onClick={()=>setTab('Boutique')}><ShoppingBag size={18}/> Découvrir la boutique de récompenses <ChevronRight size={17}/></button>
    </main>}

    {tab === 'Boutique' && <main className="page shop-page">
      <div className="challenge-heading"><div><p className="eyebrow">VIBE CHECK / REWARD LAB</p><h1>Boutique <span>des joueurs</span></h1><p className="muted">Des objets de profil à débloquer avec tes XP.</p></div><div className="shop-wallet"><Coins size={19}/><strong>{playerXp}</strong><small>XP</small></div></div>
      <section className="shop-feature"><div className="shop-feature-art"><div className="shop-portal"/><span>✦</span><b>V</b></div><div className="shop-feature-copy"><span>OBJET À LA UNE</span><h2>Neon Aura</h2><p>Un halo violet pour ton profil joueur.</p><button className="primary-button" onClick={()=>purchaseReward({id:'aura',name:'Neon Aura',cost:150})}><Coins size={16}/> Débloquer · 150 XP</button></div></section>
      <div className="challenge-section-head"><div><p className="eyebrow">PERSONNALISE TON STYLE</p><h2>Objets disponibles</h2></div><span>APERÇU</span></div>
      <div className="shop-grid">{[{id:'frame',symbol:'◈',name:'Cadre Cyber',desc:'Cadre de profil',cost:80,tone:'cyan'},{id:'badge',symbol:'✦',name:'Badge Élite',desc:'Badge de joueur',cost:100,tone:'pink'},{id:'trail',symbol:'⚡',name:'Trace éclair',desc:'Effet de pseudo',cost:120,tone:'gold'},{id:'avatar',symbol:'👾',name:'Avatar Pixel',desc:'Avatar alternatif',cost:60,tone:'green'}].map(item=><article className="shop-item" key={item.id}><div className={`shop-item-art ${item.tone}`}>{item.symbol}</div><strong>{item.name}</strong><small>{item.desc}</small><button disabled={playerInventory.includes(item.id)} onClick={()=>purchaseReward(item)}>{playerInventory.includes(item.id)?<CircleCheck size={14}/>:<Coins size={14}/>} {playerInventory.includes(item.id)?'Possédé':`${item.cost} XP`}</button></article>)}</div>
      <p className="shop-disclaimer"><Heart size={14}/> Les achats sont enregistrés dans ton inventaire Supabase lorsque la session joueur est active.</p>
    </main>}

    {tab === 'Streams' && <main className="page streams-page">
      <div className="streams-heading"><div><p className="eyebrow">VIBE CHECK / COMMUNITY FEED</p><h1>Streams & <span>parties</span></h1><p className="muted">Les univers à explorer et les défis à relancer.</p></div><span className="live-pill"><i/> GAME ON</span></div>
      <section className="streams-feature" onClick={startDemo} role="button" tabIndex="0" aria-label="Lancer le défi Neon Arena">
        <div className="streams-feature-sky"><div className="streams-sun"/><div className="streams-tower tower-a"/><div className="streams-tower tower-b"/><div className="streams-tower tower-c"/><div className="streams-hero-person"><i/><b/><span/></div><div className="streams-floor"/></div>
        <span className="streams-label"><i/> À LA UNE</span><div className="streams-feature-copy"><p className="eyebrow">PARTIE RECOMMANDÉE</p><h2>NEON <b>ARENA</b></h2><p>Quiz gaming · 2 manches · Niveau débutant</p><button className="stream-follow" onClick={e=>{e.stopPropagation();startDemo()}}>Rejoindre la partie <ChevronRight size={14}/></button></div>
      </section>
      <div className="streams-filter-row"><span>À découvrir</span><span className="streams-filter-active">Tout</span><span>Quiz</span><span>Défis</span><span>Communauté</span></div>
      <section className="section-head"><div><p className="eyebrow">PICK YOUR NEXT RUN</p><h2>Parties récentes</h2></div><span className="streams-count">03 ACTIVITÉS</span></section>
      <div className="streams-list">
        <article className="activity-card activity-purple"><div className="activity-art"><div className="activity-portal"><i>⚔</i></div><span className="activity-corner">01</span></div><div className="activity-info"><div className="activity-meta"><span>QUIZ GAMING</span><small>Récemment joué</small></div><h3>Neon Arena</h3><p>Entre dans l’arène et teste tes réflexes.</p><div className="activity-bottom"><span><Flame size={13}/> Défi rapide</span><button onClick={startDemo}>Rejouer <ChevronRight size={14}/></button></div></div></article>
        <article className="activity-card activity-cyan"><div className="activity-art"><div className="activity-portal"><i>◈</i></div><span className="activity-corner">02</span></div><div className="activity-info"><div className="activity-meta"><span>MODE EXPLORATION</span><small>5 min</small></div><h3>Cyber Quest</h3><p>Résous des énigmes dans un monde futuriste.</p><div className="activity-bottom"><span><Sparkles size={13}/> Aventure</span><button onClick={startDemo}>Lancer <ChevronRight size={14}/></button></div></div></article>
        <article className="activity-card activity-pink"><div className="activity-art"><div className="activity-portal"><i>✦</i></div><span className="activity-corner">03</span></div><div className="activity-info"><div className="activity-meta"><span>CHALLENGE CERVEAU</span><small>Solo</small></div><h3>Brain Storm</h3><p>Une série de questions pour faire grimper ton XP.</p><div className="activity-bottom"><span><Brain size={13}/> Culture & logique</span><button onClick={()=>{setCategory('Sciences & Nature');setTab('Quiz');setQuiz(null)}}>Explorer <ChevronRight size={14}/></button></div></div></article>
      </div>
      <div className="streams-note"><Gamepad2 size={17}/><p><strong>Le salon est ouvert.</strong> Les streams présentés ici sont des aperçus de démonstration. Les directs réels et les invitations multijoueurs seront branchés plus tard.</p></div>
    </main>}

    {tab === 'Classement' && <main className="page leaderboard-page">
      <div className="leaderboard-heading"><div><p className="eyebrow">HALL OF FAME / SAISON 01</p><h1>Classement <span>des joueurs</span></h1><p className="muted">Chaque défi te rapproche du sommet.</p></div><div className="leaderboard-trophy"><Trophy size={24}/><small>TOP XP</small></div></div>
      <div className="leaderboard-periods" role="group" aria-label="Période du classement">{['Jour','Semaine','Global'].map(period=><button key={period} className={leaderboardPeriod===period?'selected':''} onClick={()=>setLeaderboardPeriod(period)}>{period}</button>)}</div>
      <Podium rows={lbRows} />
      <section className="leaderboard-list-section"><div className="leaderboard-list-title"><div><p className="eyebrow">LEADERBOARD</p><h2>Classement général</h2></div><span>TOP 10</span></div>
        <div className="leaderboard">
          {lbShown==='loading' && <p className="muted small-note">Chargement du classement…</p>}
          {lbShown==='error' && <p className="muted small-note">Classement indisponible pour le moment. <button className="text-button" onClick={()=>setLbRetry(n=>n+1)}>Réessayer</button></p>}
          {lbShown==='ok' && lbRows.length===0 && <p className="muted small-note">Personne n’a encore marqué de points sur cette période. Sois le premier !</p>}
          {lbShown==='ok' && lbRows.map(r=>{const you=r.pseudo.toLowerCase()===pseudo.toLowerCase();return <div className={`rank-row ${you?'you':''}`} key={`${r.rank}-${r.pseudo}`}><span className="rank-medal">{r.rank}</span><div className="avatar avatar-rank">{r.pseudo[0]}</div><div className="rank-name"><strong>{r.pseudo}{you&&<em>VOUS</em>}</strong><small>Niveau {r.level}</small></div><b>{Number(r.xp).toLocaleString('fr-FR')} XP</b></div>})}
        </div>
      </section>{!supabase && <p className="muted small-note">Classement de démonstration : Supabase n’est pas configuré.</p>}
    </main>}

    {(tab === 'Profil' || tab === 'Mes quiz') && <main className="page profile-page">
      <div className="profile-topline"><div><p className="eyebrow">PLAYER CHANNEL / ONLINE</p><h1>{tab==='Profil'?'Player profile':'Mes quiz'}</h1></div><button className="profile-settings" onClick={()=>setTab('Paramètres')} aria-label="Paramètres"><Settings size={18}/></button></div>
      <section className="profile-cover">
        <div className="profile-cover-grid"/>
        <div className="profile-cover-art"><div className="profile-moon"/><div className="profile-character"><span className="character-hood"/><span className="character-face"/><span className="character-eye eye-left"/><span className="character-eye eye-right"/><span className="character-jacket"/></div><span className="cover-label">ELVIDIO // PLAYER 001</span></div>
        <div className="profile-identity"><div className="avatar avatar-profile">{['E','⚡','🎧','👾'][avatar]}</div><div className="profile-identity-copy"><h2>{pseudo}</h2><p>NEON EXPLORER <span className="online-dot"/> EN LIGNE</p><div className="profile-tags"><span>RANK 03</span><span>ROOKIE</span></div></div></div>
        <div className="profile-follow-stats"><div><strong>1.2K</strong><small>ABONNÉS</small></div><div><strong>284</strong><small>ABONNEMENTS</small></div><div><strong>12</strong><small>QUIZ JOUÉS</small></div></div>
      </section>
      <section className="profile-xp-panel"><div className="xp-heading"><span>PLAYER EXPERIENCE</span><strong>{levelXp} <small>/ {LEVEL_SIZE} XP</small></strong></div><div className="xp-track wide"><i style={{width:`${Math.min(100,levelXp/LEVEL_SIZE*100)}%`}}/></div><p>Continue à jouer pour débloquer le prochain rang.</p></section>
      <div className="profile-section-title"><div><p className="eyebrow">RECENT ACTIVITY</p><h2>Streams & parties récentes</h2></div><button onClick={()=>setTab('Streams')}>Voir tout <ChevronRight size={15}/></button></div>
      <div className="profile-stream-grid">
        <button className="profile-stream stream-one" onClick={startDemo}><span className="stream-art"><i>⚔</i></span><span className="stream-live">RECENT</span><strong>NEON ARENA</strong><small>Quiz gaming · 2 rounds</small></button>
        <button className="profile-stream stream-two" onClick={startDemo}><span className="stream-art"><i>◈</i></span><span className="stream-live">PLAY AGAIN</span><strong>CYBER QUEST</strong><small>Défi rapide · 5 min</small></button>
      </div>
      <section className="profile-edit-panel"><div className="profile-section-title"><div><p className="eyebrow">CUSTOMIZE</p><h2>Personnaliser le profil</h2></div></div>
        <label className="field-label">Ton pseudo<input value={pseudoDraft} onChange={e=>setPseudoDraft(e.target.value.slice(0,24))} maxLength={24}/></label>
        <button className="primary-button" onClick={savePseudo} disabled={savingPseudo || !pseudoDraft.trim() || pseudoDraft.trim()===pseudo}>{savingPseudo?<LoaderCircle className="spin"/>:<Check/>} Enregistrer le pseudo</button>
        <p className="field-label">Choisir un avatar</p><div className="avatar-picker">{['E','⚡','🎧','👾'].map((a,i)=><button key={a} className={avatar===i?'active':''} onClick={()=>setAvatar(i)}>{a}</button>)}</div>
        <button className="secondary-button" onClick={()=>setTab('Paramètres')}><Settings/> Paramètres</button>
      </section>
    </main>}

    {tab === 'Paramètres' && <main className="page"><button className="back-button" onClick={()=>setTab('Profil')}><ArrowLeft/> Retour au profil</button><p className="eyebrow">SYSTEM CONFIG</p><h1>Paramètres</h1><div className="settings-list"><div><span>Notifications</span><span className="pill easy">Activées</span></div><div><span>Son & vibration</span><span className="pill">À venir</span></div><div><span>Langue</span><strong>Français</strong></div><div><span>Confidentialité</span><strong>À configurer</strong></div></div><p className="muted small-note">Les réglages seront persistés avec un compte utilisateur lors de l’ajout de l’authentification.</p></main>}

    <nav className="bottom-nav">{[{name:'Accueil',icon:Home},{name:'Quiz',icon:MessageSquareText},{name:'Défis',icon:ListChecks},{name:'Classement',icon:Trophy},{name:'Profil',icon:UserRound}].map(item=><button key={item.name} className={tab===item.name?'active':''} onClick={()=>{setTab(item.name);if(item.name==='Quiz')setQuiz(null)}}><item.icon size={20}/><span>{item.name}</span></button>)}</nav>
    {notice && <div className="toast" role="status"><span>{notice}</span><button onClick={()=>setNotice('')} aria-label="Fermer"><X size={16}/></button></div>}
  </div>;
}

function CategoryCard({item,onClick}) {
  const Icon=item.icon;
  return <button className={`category-card ${item.tone}`} onClick={onClick}><span className={`category-icon ${item.tone}`}><Icon/></span><span className="category-copy"><strong>{item.name}</strong><small>{item.count} questions</small></span><span className={`pill ${item.difficulty==='Facile'?'easy':item.difficulty==='Difficile'?'hard':'medium'}`}>{item.difficulty}</span><ChevronRight size={18}/></button>;
}
function Stat({icon,value,label}) { return <div className="stat-card">{icon}<strong>{value}</strong><small>{label}</small></div>; }