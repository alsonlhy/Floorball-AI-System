import { useBoardStore } from '../store/boardStore';

const KIND_NAMES = { player: 'Player', goalie: 'Goalie', ball: 'Ball', cone: 'Cone' } as const;

/**
 * Edit panel for the current selection (label, team, duplicate, delete), floating over the
 * bottom of the board so it never resizes the board.
 */
export function Inspector() {
  const selection = useBoardStore((s) => s.selection);
  const entities = useBoardStore((s) => s.board.entities);
  const setLabel = useBoardStore((s) => s.setLabel);
  const setTeam = useBoardStore((s) => s.setTeam);
  const deleteEntities = useBoardStore((s) => s.deleteEntities);
  const duplicateEntities = useBoardStore((s) => s.duplicateEntities);

  const selected = entities.filter((e) => selection.includes(e.id));
  if (selected.length === 0) return null;
  const single = selected.length === 1 ? selected[0] : undefined;
  const teamable = selected.filter((e) => e.kind === 'player' || e.kind === 'goalie');
  const commonTeam = teamable.every((e) => e.team === teamable[0]?.team) ? teamable[0]?.team : '';

  return (
    <div
      className="float-strip inspector"
      data-testid="inspector"
      role="group"
      aria-label="Selection"
    >
      <span className="what">
        {single ? KIND_NAMES[single.kind] : `${selected.length} selected`}
      </span>
      {single && (single.kind === 'player' || single.kind === 'goalie') && (
        <label className="field">
          Label
          <input
            key={single.id}
            data-testid="label-input"
            value={single.label ?? ''}
            maxLength={12}
            onChange={(e) => setLabel(single.id, e.target.value)}
          />
        </label>
      )}
      {teamable.length > 0 && (
        <label className="field">
          Team
          <select
            data-testid="team-select"
            value={commonTeam ?? ''}
            onChange={(e) =>
              setTeam(
                teamable.map((t) => t.id),
                e.target.value as 'home' | 'away',
              )
            }
          >
            {commonTeam === '' && <option value="">Mixed</option>}
            <option value="home">Home</option>
            <option value="away">Away</option>
          </select>
        </label>
      )}
      <button data-testid="duplicate" onClick={() => duplicateEntities(selection)}>
        Duplicate
      </button>
      <button data-testid="delete" className="danger" onClick={() => deleteEntities(selection)}>
        Delete
      </button>
    </div>
  );
}
