import type { EntityKind, Team } from '../model/types';
import { useBoardStore } from '../store/boardStore';

/** Add pieces. A column at the right edge in landscape (thumb reach). */
export function PieceRail() {
  const teamColors = useBoardStore((s) => s.board.teamColors);
  const addEntity = useBoardStore((s) => s.addEntity);

  const items: {
    testid: string;
    kind: EntityKind;
    team?: Team;
    label: string;
    title: string;
    swatch: React.ReactNode;
  }[] = [
    {
      testid: 'add-home-player',
      kind: 'player',
      team: 'home',
      label: 'Home',
      title: 'Add home player',
      swatch: <span className="swatch round big" style={{ background: teamColors.home }} />,
    },
    {
      testid: 'add-away-player',
      kind: 'player',
      team: 'away',
      label: 'Away',
      title: 'Add away player',
      swatch: <span className="swatch round big" style={{ background: teamColors.away }} />,
    },
    {
      testid: 'add-home-goalie',
      kind: 'goalie',
      team: 'home',
      label: 'H goalie',
      title: 'Add home goalie',
      swatch: <span className="swatch big goalie" style={{ background: teamColors.home }} />,
    },
    {
      testid: 'add-away-goalie',
      kind: 'goalie',
      team: 'away',
      label: 'A goalie',
      title: 'Add away goalie',
      swatch: <span className="swatch big goalie" style={{ background: teamColors.away }} />,
    },
    {
      testid: 'add-ball',
      kind: 'ball',
      label: 'Ball',
      title: 'Add ball',
      swatch: <span className="swatch round ball" />,
    },
    {
      testid: 'add-cone',
      kind: 'cone',
      label: 'Cone',
      title: 'Add cone',
      swatch: <span className="swatch cone" />,
    },
  ];

  return (
    <nav className="rail pieces-rail" role="toolbar" aria-label="Add pieces">
      {items.map((it) => (
        <button
          key={it.testid}
          className="rail-btn"
          data-testid={it.testid}
          title={it.title}
          aria-label={it.title}
          onClick={() => addEntity(it.kind, it.team)}
        >
          {it.swatch}
          <span>{it.label}</span>
        </button>
      ))}
    </nav>
  );
}
