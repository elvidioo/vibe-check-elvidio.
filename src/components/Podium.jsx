const SLOTS = [
  { index: 1, cls: 'podium-second', crown: 'Ⅱ', avatar: 'avatar-silver', step: '2' },
  { index: 0, cls: 'podium-first', crown: '♛', avatar: 'avatar-gold', step: '1' },
  { index: 2, cls: 'podium-third', crown: 'Ⅲ', avatar: 'avatar-bronze', step: '3' },
];

export default function Podium({ rows }) {
  return (
    <section className="podium" aria-label="Podium des meilleurs joueurs">
      {SLOTS.map((s) => {
        const r = rows[s.index];
        return (
          <article key={s.step} className={`podium-player ${s.cls}`}>
            <div className="podium-crown">{s.crown}</div>
            <div className={`podium-avatar ${s.avatar}`}>{r ? r.pseudo[0].toUpperCase() : '–'}</div>
            <strong>{r ? r.pseudo : '—'}</strong>
            <small>{r ? `NIVEAU ${r.level}` : 'PLACE LIBRE'}</small>
            <b>{r ? Number(r.xp).toLocaleString('fr-FR') : '0'} <i>XP</i></b>
            <div className="podium-step">{s.step}</div>
          </article>
        );
      })}
    </section>
  );
}
