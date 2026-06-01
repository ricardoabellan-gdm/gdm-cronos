// GanttView: full-page Gantt with header, scale toggle, PDF + JSON export.

const { useState: useGVState, useRef: useGVRef, useMemo: useGVMemo } = React;

function StatusLegend() {
  const items = Object.values(window.CronosStore.STATUS);
  return (
    <div className="flex items-center gap-4 flex-wrap">
      {items.map(s => (
        <div key={s.key} className="flex items-center gap-1.5 text-[12px] text-ink-600">
          <span className="w-2.5 h-2.5 rounded-sm" style={{ background: s.dot }} />
          {s.label}
        </div>
      ))}
      <div className="flex items-center gap-1.5 text-[12px] text-ink-600">
        <span className="w-2.5 h-0.5 rounded-full" style={{ background: '#3D0F26' }} />
        Hoje
      </div>
    </div>
  );
}

function ScaleToggle({ value, onChange }) {
  const OPTS = [
    { k: 'day',   l: 'Diário' },
    { k: 'week',  l: 'Semanal' },
    { k: 'month', l: 'Mensal' },
  ];
  return (
    <div className="inline-flex bg-ink-100/70 rounded-lg p-1">
      {OPTS.map(o => (
        <button key={o.k} onClick={() => onChange(o.k)}
          className={window.classNames(
            'h-8 px-3 rounded-md text-[12.5px] font-medium transition-all',
            value === o.k ? 'bg-white text-ink-900 shadow-card' : 'text-ink-500 hover:text-ink-700'
          )}>
          {o.l}
        </button>
      ))}
    </div>
  );
}

function GanttView({ project, onBack, onEdit, onExportJSON, onShare, readOnly = false,
                     comments, onPostComment, onDeleteComment, defaultAuthor }) {
  const [scale, setScale] = useGVState('day');
  const [pdfBusy, setPdfBusy] = useGVState(false);
  const toast = window.useToast();
  const stats = useGVMemo(() => window.CronosStore.projectStats(project), [project]);
  const exportRef = useGVRef(null);

  const exportPDF = async () => {
    try {
      setPdfBusy(true);
      toast('Gerando PDF…', { kind: 'info', timeout: 1500 });
      await new Promise(r => setTimeout(r, 30)); // let toast paint
      await window.exportGanttPDF(project, scale);
      toast('PDF gerado com sucesso', { kind: 'success' });
    } catch (e) {
      console.error(e);
      toast('Falha ao gerar PDF', { kind: 'error' });
    } finally {
      setPdfBusy(false);
    }
  };

  return (
    <div className="max-w-[1600px] mx-auto px-6 pt-6 pb-12">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 mb-5 flex-wrap no-print">
        <div className="flex items-start gap-3 min-w-0">
          {!readOnly && <window.IconButton icon="arrowLeft" title="Voltar" variant="secondary" onClick={onBack} />}
          <div className="min-w-0">
            <div className="text-[11px] font-semibold tracking-[0.16em] uppercase text-brand mb-1">{project.client || 'Sem cliente'}</div>
            <h1 className="text-[26px] font-bold text-ink-900 leading-tight truncate" title={project.name}>{project.name || 'Projeto sem nome'}</h1>
            <div className="mt-1.5 flex items-center gap-3 text-[13px] text-ink-500">
              <span className="inline-flex items-center gap-1.5"><window.Icon name="user" className="w-3.5 h-3.5" /> {project.owner || '—'}</span>
              <span className="text-ink-300">·</span>
              <span className="inline-flex items-center gap-1.5 tabular-nums">
                <window.Icon name="calendar" className="w-3.5 h-3.5" />
                {window.CronosStore.fmtDateBR(stats.start)} → {window.CronosStore.fmtDateBR(stats.end)}
              </span>
              <span className="text-ink-300">·</span>
              <window.StatusPill status={stats.status} size="sm" />
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {!readOnly && onEdit && <window.Button variant="secondary" size="md" icon="edit" onClick={onEdit}>Editar</window.Button>}
          {!readOnly && onExportJSON && <window.Button variant="secondary" size="md" icon="json" onClick={() => onExportJSON(project)}>Backup</window.Button>}
          {!readOnly && onShare && <window.Button variant="secondary" size="md" icon="sparkle" onClick={onShare}>Compartilhar</window.Button>}
          <window.Button size="md" icon="pdf" onClick={exportPDF} disabled={pdfBusy}>
            {pdfBusy ? 'Gerando…' : 'Exportar PDF'}
          </window.Button>
        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5 no-print">
        <StatTile label="Etapas" value={stats.taskCount} />
        <StatTile label="Progresso médio" value={`${stats.progress}%`} bar={stats.progress} />
        <StatTile label="Início" value={window.CronosStore.fmtDateBR(stats.start)} />
        <StatTile label="Término" value={window.CronosStore.fmtDateBR(stats.end)} />
      </div>

      {/* Scale toggle + legend */}
      <div className="flex items-center justify-between gap-3 mb-3 flex-wrap no-print">
        <ScaleToggle value={scale} onChange={setScale} />
        <StatusLegend />
      </div>

      {/* PDF capture area: header + chart */}
      <div ref={exportRef} className="bg-canvas">
        {/* Print-only header */}
        <div className="hidden print:block px-6 pb-4 pt-2 border-b border-ink-200 mb-4">
          <div className="flex items-start justify-between">
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-widest text-brand">{project.client || '—'}</div>
              <h2 className="text-[22px] font-bold text-ink-900">{project.name}</h2>
              <div className="text-[13px] text-ink-500">{project.owner || '—'} · {window.CronosStore.fmtDateBR(stats.start)} → {window.CronosStore.fmtDateBR(stats.end)}</div>
            </div>
            <window.BrandLogo height={26} />
          </div>
        </div>

        <window.Gantt tasks={project.tasks || []} scale={scale} onTaskClick={() => {}} />
      </div>

      {/* Comments — visible in both shared view (with form) and owner view (with delete) */}
      {comments !== undefined && (
        <window.Comments
          comments={comments}
          onPost={onPostComment || null}
          onDelete={onDeleteComment || null}
          defaultAuthor={defaultAuthor || ''}
        />
      )}
    </div>
  );
}

function StatTile({ label, value, bar }) {
  return (
    <div className="bg-white border border-ink-100 rounded-xl2 px-4 py-3 shadow-card">
      <div className="text-[10.5px] font-semibold tracking-[0.08em] uppercase text-ink-400 mb-1">{label}</div>
      <div className="text-[19px] font-bold text-ink-900 tabular-nums leading-tight">{value}</div>
      {typeof bar === 'number' && <window.ProgressBar value={bar} className="mt-2" />}
    </div>
  );
}

Object.assign(window, { GanttView });
