// ProjectList: cards with name/client/owner/period/status/progress.
// New project button + JSON import.

const { useState: useListState, useMemo: useListMemo, useRef: useListRef } = React;

function ProjectCard({ project, onEdit, onGantt, onDelete, onDuplicate, onExport, onShare, isAdmin }) {
  const stats = window.CronosStore.projectStats(project);
  const { fmtDateBR } = window.CronosStore;
  const [menuOpen, setMenuOpen] = useListState(false);
  const menuRef = useListRef(null);

  React.useEffect(() => {
    if (!menuOpen) return;
    const handler = (e) => {if (menuRef.current && !menuRef.current.contains(e.target)) setMenuOpen(false);};
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [menuOpen]);

  return (
    <div className="group relative bg-white border border-ink-100 rounded-xl2 shadow-card hover:shadow-card-hover hover:border-ink-200 transition-all duration-150 overflow-hidden">
      {/* status accent strip */}
      <div className="absolute left-0 top-0 bottom-0 w-1" style={{ background: window.CronosStore.STATUS[stats.status]?.fill }} />

      <button onClick={() => onGantt(project)} className="w-full text-left p-5 pl-6 focus-ring">
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="min-w-0 flex-1">
            <div className="text-[11px] font-semibold tracking-[0.1em] uppercase text-ink-400 mb-1">{project.client || 'Sem cliente'}</div>
            <h3 className="text-[17px] font-bold text-ink-900 leading-tight clamp-2 mb-1">{project.name || 'Projeto sem nome'}</h3>
            {/* Owner badge — shown only in admin view */}
            {isAdmin && project._owner && (
              <div className="inline-flex items-center gap-1 text-[11px] font-medium text-brand bg-brand-50 border border-brand-100 rounded px-1.5 py-0.5 mt-0.5">
                <window.Icon name="user" className="w-3 h-3" />
                {project._owner.name}
              </div>
            )}
          </div>
          <window.StatusPill status={stats.status} size="sm" />
        </div>

        {project.description &&
        <p className="text-[13px] text-ink-500 leading-relaxed clamp-2 mb-4">{project.description}</p>
        }

        <div className="grid grid-cols-2 gap-3 mb-4">
          <div>
            <div className="text-[10.5px] font-semibold tracking-[0.06em] uppercase text-ink-400 mb-0.5">Responsável</div>
            <div className="flex items-center gap-1.5 text-[13px] text-ink-800 font-medium truncate">
              <window.Icon name="user" className="w-3.5 h-3.5 text-ink-400 shrink-0" />
              <span className="truncate">{project.owner || '—'}</span>
            </div>
          </div>
          <div>
            <div className="text-[10.5px] font-semibold tracking-[0.06em] uppercase text-ink-400 mb-0.5">Etapas</div>
            <div className="flex items-center gap-1.5 text-[13px] text-ink-800 font-medium">
              <window.Icon name="chart" className="w-3.5 h-3.5 text-ink-400 shrink-0" />
              {stats.taskCount}
            </div>
          </div>
        </div>

        <div className="border-t border-ink-100 pt-3">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[12px] text-ink-500 font-medium tabular-nums">
              {fmtDateBR(stats.start)} <span className="text-ink-300 mx-1">→</span> {fmtDateBR(stats.end)}
            </span>
            <div className="flex items-center gap-2">
              {project.commentCount > 0 && (
                <span className="text-[11.5px] text-ink-400 tabular-nums">
                  {project.commentCount} {project.commentCount === 1 ? 'comentário' : 'comentários'}
                </span>
              )}
              <span className="text-[13px] font-bold text-ink-900 tabular-nums">{stats.progress}%</span>
            </div>
          </div>
          <window.ProgressBar value={stats.progress} barClass={
          stats.status === 'done' ? 'bg-status-done' :
          stats.status === 'late' ? 'bg-status-late' :
          stats.status === 'in_progress' ? 'bg-status-progress' :
          'bg-ink-300'
          } />
        </div>
      </button>

      <div className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity" ref={menuRef}>
        <window.IconButton size="sm" icon="more" title="Mais" variant="secondary"
        onClick={(e) => {e.stopPropagation();setMenuOpen((o) => !o);}} />
        {menuOpen &&
        <div className="absolute right-0 top-9 w-48 bg-white border border-ink-200 rounded-lg shadow-pop py-1 z-10">
            {onEdit && <MenuItem icon="edit" label="Editar projeto" onClick={() => {setMenuOpen(false);onEdit(project);}} />}
            <MenuItem icon="chart" label="Abrir Gantt" onClick={() => {setMenuOpen(false);onGantt(project);}} />
            {onShare && <MenuItem icon="sparkle" label="Compartilhar" onClick={() => {setMenuOpen(false);onShare(project);}} />}
            <MenuItem icon="json" label="Exportar backup" onClick={() => {setMenuOpen(false);onExport(project);}} />
            {onDuplicate && <MenuItem icon="folder" label="Duplicar" onClick={() => {setMenuOpen(false);onDuplicate(project);}} />}
            <div className="h-px bg-ink-100 my-1" />
            <MenuItem icon="trash" label="Excluir" danger onClick={() => {setMenuOpen(false);onDelete(project);}} />
          </div>
        }
      </div>
    </div>);

}

function MenuItem({ icon, label, onClick, danger }) {
  return (
    <button onClick={onClick}
    className={window.classNames(
      'w-full flex items-center gap-2.5 px-3 py-2 text-[13px] text-left transition-colors',
      danger ? 'text-status-late hover:bg-status-late/5' : 'text-ink-700 hover:bg-ink-50'
    )}>
      <window.Icon name={icon} className="w-3.5 h-3.5" />
      {label}
    </button>);

}

function EmptyState({ onNew, onImport }) {
  return (
    <div className="bg-white border border-dashed border-ink-200 rounded-xl2 px-10 py-16 text-center">
      <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-brand-50 text-brand mb-5">
        <window.Icon name="chart" className="w-7 h-7" strokeWidth={1.5} />
      </div>
      <h3 className="text-[20px] font-bold text-ink-900 mb-2">Nenhum projeto ainda</h3>
      <p className="text-[14px] text-ink-500 max-w-md mx-auto mb-6 leading-relaxed">
        Crie seu primeiro cronograma do zero ou importe um backup salvo anteriormente.
      </p>
      <div className="flex items-center justify-center gap-3">
        <window.Button icon="plus" onClick={onNew}>Novo projeto</window.Button>
        <window.Button variant="secondary" icon="upload" onClick={onImport}>Importar backup</window.Button>
      </div>
    </div>);

}

function ProjectList({ projects, onNew, onEdit, onGantt, onDelete, onDeleteUser, onDuplicate, onExport, onShare, onImport, isAdmin }) {
  const [q, setQ] = useListState('');
  const [filter, setFilter] = useListState('all');
  const fileInputRef = useListRef(null);

  const filtered = useListMemo(() => {
    const lower = q.trim().toLowerCase();
    return projects.filter((p) => {
      if (lower) {
        const ownerName = p._owner?.name || '';
        const hay = `${p.name} ${p.client} ${p.owner} ${p.description} ${ownerName}`.toLowerCase();
        if (!hay.includes(lower)) return false;
      }
      if (filter !== 'all') {
        const s = window.CronosStore.projectStats(p).status;
        if (s !== filter) return false;
      }
      return true;
    });
  }, [projects, q, filter]);

  // Aggregate stats
  const summary = useListMemo(() => {
    const s = { total: projects.length, late: 0, in_progress: 0, done: 0, not_started: 0 };
    projects.forEach((p) => {
      const st = window.CronosStore.projectStats(p).status;
      s[st]++;
    });
    return s;
  }, [projects]);

  // Admin: group filtered projects by owner
  const adminGroups = useListMemo(() => {
    if (!isAdmin) return null;
    const map = {};
    filtered.forEach((p) => {
      const key = p._owner?.email || 'unknown';
      if (!map[key]) map[key] = { owner: p._owner, projects: [] };
      map[key].projects.push(p);
    });
    return Object.values(map).sort((a, b) =>
      (a.owner?.name || '').localeCompare(b.owner?.name || '', 'pt')
    );
  }, [filtered, isAdmin]);

  const FILTERS = [
  { k: 'all', l: 'Todos', count: summary.total },
  { k: 'in_progress', l: 'Em andamento', count: summary.in_progress },
  { k: 'late', l: 'Atrasados', count: summary.late },
  { k: 'done', l: 'Concluídos', count: summary.done },
  { k: 'not_started', l: 'Não iniciados', count: summary.not_started }];

  const cardProps = (p) => ({
    key: p.id, project: p, isAdmin,
    onEdit, onGantt, onDelete, onDuplicate, onExport, onShare,
  });

  return (
    <div className="max-w-[1440px] mx-auto px-6 pt-8 pb-16">
      {/* Hero */}
      <div className="mb-8 flex items-end justify-between gap-6 flex-wrap">
        <div>
          {isAdmin ? (
            <>
              <div className="text-[12px] font-semibold tracking-[0.16em] uppercase text-brand mb-2">ADMINISTRADOR</div>
              <h1 className="text-[34px] font-extrabold text-ink-900 leading-[1.05] tracking-tight mb-2">
                Visão geral do sistema.
              </h1>
              <p className="text-[15px] text-ink-500 max-w-xl leading-relaxed">
                Todos os cronogramas de todos os usuários, agrupados por conta.
              </p>
            </>
          ) : (
            <>
              <div className="text-[12px] font-semibold tracking-[0.16em] uppercase text-brand mb-2">PAINEL DO GESTOR</div>
              <h1 className="text-[34px] font-extrabold text-ink-900 leading-[1.05] tracking-tight mb-2">
                Cronogramas, no comando.
              </h1>
              <p className="text-[15px] text-ink-500 max-w-xl leading-relaxed">
                Acompanhe os projetos do seu portfólio em um só lugar — escopo, etapas, prazos e progresso.
              </p>
            </>
          )}
        </div>
        {!isAdmin && (
          <div className="flex items-center gap-2">
            <input ref={fileInputRef} type="file" accept="application/json,.json" className="hidden"
            onChange={(e) => {const f = e.target.files?.[0];if (f) onImport(f);e.target.value = '';}} />
            <window.Button variant="secondary" icon="upload" onClick={() => fileInputRef.current?.click()}>
              Importar backup
            </window.Button>
            <window.Button icon="plus" onClick={onNew}>Novo projeto</window.Button>
          </div>
        )}
      </div>

      {/* Summary tiles */}
      {projects.length > 0 &&
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-7">
          <SummaryTile label="Em andamento" value={summary.in_progress} accent="bg-status-progress" />
          <SummaryTile label="Atrasados" value={summary.late} accent="bg-status-late" />
          <SummaryTile label="Concluídos" value={summary.done} accent="bg-status-done" />
          <SummaryTile label="Não iniciados" value={summary.not_started} accent="bg-ink-300" />
        </div>
      }

      {/* Search + filters */}
      {projects.length > 0 &&
      <div className="bg-white border border-ink-100 rounded-xl2 px-3 py-2 mb-5 flex items-center gap-2 shadow-card flex-wrap">
          <div className="relative flex-1 min-w-[200px]">
            <window.Icon name="search" className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-400" />
            <input value={q} onChange={(e) => setQ(e.target.value)}
            placeholder={isAdmin ? "Buscar por projeto, cliente, responsável, usuário…" : "Buscar por projeto, cliente, responsável…"}
            className="w-full h-9 pl-9 pr-3 text-[14px] bg-transparent outline-none placeholder:text-ink-400" />
          </div>
          <div className="flex items-center gap-1 bg-ink-50 rounded-lg p-1">
            {FILTERS.map((f) =>
          <button key={f.k} onClick={() => setFilter(f.k)}
          className={window.classNames(
            'h-7 px-2.5 rounded-md text-[12.5px] font-medium transition-colors flex items-center gap-1.5',
            filter === f.k ? 'bg-white text-ink-900 shadow-card' : 'text-ink-500 hover:text-ink-700'
          )}>
                {f.l}
                <span className={window.classNames(
              'text-[10.5px] tabular-nums font-semibold px-1.5 rounded',
              filter === f.k ? 'bg-brand-50 text-brand' : 'bg-ink-200/60 text-ink-500'
            )}>{f.count}</span>
              </button>
          )}
          </div>
        </div>
      }

      {/* Grid — regular user */}
      {!isAdmin && (
        projects.length === 0 ?
        <EmptyState onNew={onNew} onImport={() => fileInputRef.current?.click()} /> :
        filtered.length === 0 ?
        <div className="text-center py-16 text-ink-400 text-[14px]">Nenhum projeto corresponde aos filtros.</div> :
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map((p) => <ProjectCard {...cardProps(p)} />)}
        </div>
      )}

      {/* Grid — admin: grouped by user */}
      {isAdmin && (
        projects.length === 0 ?
        <div className="text-center py-16 text-ink-400 text-[14px]">Nenhum cronograma cadastrado no sistema.</div> :
        filtered.length === 0 ?
        <div className="text-center py-16 text-ink-400 text-[14px]">Nenhum projeto corresponde aos filtros.</div> :
        <div className="space-y-10">
          {adminGroups.map((group) => (
            <div key={group.owner?.email || 'unknown'}>
              {/* User section header */}
              <div className="flex items-center justify-between gap-4 mb-4">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-7 h-7 rounded-full bg-brand-100 flex items-center justify-center shrink-0">
                    <window.Icon name="user" className="w-3.5 h-3.5 text-brand" />
                  </div>
                  <div className="min-w-0">
                    <span className="text-[15px] font-bold text-ink-900">{group.owner?.name || 'Usuário desconhecido'}</span>
                    <span className="ml-2 text-[13px] text-ink-400">{group.owner?.email}</span>
                  </div>
                  <span className="text-[11.5px] font-semibold text-ink-500 bg-ink-100 rounded-full px-2 py-0.5 shrink-0">
                    {group.projects.length} {group.projects.length === 1 ? 'projeto' : 'projetos'}
                  </span>
                </div>
                {onDeleteUser && group.owner?.id && (
                  <window.Button variant="danger" size="sm" icon="trash"
                    onClick={() => onDeleteUser(group.owner)}>
                    Excluir usuário
                  </window.Button>
                )}
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {group.projects.map((p) => <ProjectCard {...cardProps(p)} />)}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>);

}

function SummaryTile({ label, value, accent }) {
  return (
    <div className="bg-white border border-ink-100 rounded-xl2 px-4 py-3.5 shadow-card flex items-center gap-3">
      <div className={window.classNames('w-1 self-stretch rounded-full', accent)} />
      <div>
        <div className="text-[11px] font-semibold tracking-[0.08em] uppercase text-ink-400">{label}</div>
        <div className="text-[24px] font-extrabold text-ink-900 tabular-nums leading-tight">{value}</div>
      </div>
    </div>);

}

Object.assign(window, { ProjectList });
