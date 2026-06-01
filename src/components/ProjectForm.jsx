// ProjectForm: project metadata + editable task list with drag-and-drop reorder.

const { useState: useFormState, useRef: useFormRef, useEffect: useFormEffect, useMemo: useFormMemo } = React;

function buildEmptyProject() {
  const { uid, todayISO, addDaysISO } = window.CronosStore;
  const today = todayISO();
  return {
    id: uid(),
    name: '',
    client: '',
    owner: '',
    description: '',
    createdAt: today,
    tasks: [
      { id: uid(), name: '', owner: '', startDate: today, endDate: addDaysISO(today, 7), progress: 0, status: 'not_started' },
    ],
  };
}

function StatusSelector({ value, onChange }) {
  return (
    <window.Select size="sm" value={value} onChange={e => onChange(e.target.value)}>
      {Object.values(window.CronosStore.STATUS).map(s => (
        <option key={s.key} value={s.key}>{s.label}</option>
      ))}
    </window.Select>
  );
}

function TaskRow({ task, index, onChange, onDelete, isDragging, dragHandlers }) {
  const update = (patch) => onChange({ ...task, ...patch });
  const { fmtDateBR, diffDays } = window.CronosStore;
  const duration = task.startDate && task.endDate ? Math.max(0, diffDays(task.startDate, task.endDate) + 1) : 0;

  return (
    <div
      {...dragHandlers}
      className={window.classNames(
        'group bg-white border rounded-xl2 transition-all',
        isDragging ? 'opacity-50 border-brand shadow-pop' : 'border-ink-100 hover:border-ink-200 shadow-card'
      )}>
      <div className="grid items-center" style={{ gridTemplateColumns: '28px 1.4fr 1fr 0.9fr 0.9fr 1.1fr 70px 36px', gap: '10px' }}>
        {/* drag handle */}
        <div className="flex items-center justify-center py-3 pl-2 drag-handle text-ink-300 hover:text-ink-500"
             draggable="true"
             onDragStart={dragHandlers.onRowDragStart}
             onDragEnd={dragHandlers.onRowDragEnd}>
          <window.Icon name="drag" className="w-4 h-4" />
        </div>
        {/* name */}
        <div className="py-2.5">
          <input value={task.name} onChange={e => update({ name: e.target.value })}
            placeholder={`Etapa ${index + 1}`}
            className="w-full h-9 px-2.5 text-[14px] font-medium text-ink-900 placeholder:text-ink-400 bg-transparent border border-transparent hover:border-ink-200 focus:border-brand focus:bg-white focus:ring-2 focus:ring-brand/15 rounded-md outline-none transition-colors" />
        </div>
        {/* owner */}
        <div className="py-2.5">
          <input value={task.owner || ''} onChange={e => update({ owner: e.target.value })}
            placeholder="Responsável"
            className="w-full h-9 px-2.5 text-[13.5px] text-ink-700 placeholder:text-ink-400 bg-transparent border border-transparent hover:border-ink-200 focus:border-brand focus:bg-white focus:ring-2 focus:ring-brand/15 rounded-md outline-none" />
        </div>
        {/* start */}
        <div className="py-2.5">
          <input type="date" value={task.startDate} onChange={e => update({ startDate: e.target.value })}
            className="w-full h-9 px-2 text-[13px] text-ink-700 bg-transparent border border-transparent hover:border-ink-200 focus:border-brand focus:bg-white focus:ring-2 focus:ring-brand/15 rounded-md outline-none font-mono tabular-nums" />
        </div>
        {/* end */}
        <div className="py-2.5">
          <input type="date" value={task.endDate} onChange={e => update({ endDate: e.target.value })}
            className="w-full h-9 px-2 text-[13px] text-ink-700 bg-transparent border border-transparent hover:border-ink-200 focus:border-brand focus:bg-white focus:ring-2 focus:ring-brand/15 rounded-md outline-none font-mono tabular-nums" />
        </div>
        {/* status */}
        <div className="py-2.5">
          <StatusSelector value={task.status || 'not_started'} onChange={v => update({ status: v })} />
        </div>
        {/* progress */}
        <div className="py-2.5">
          <div className="relative">
            <input type="number" min="0" max="100" value={task.progress || 0}
              onChange={e => update({ progress: Math.max(0, Math.min(100, Number(e.target.value) || 0)) })}
              className="w-full h-9 pl-2 pr-6 text-[13px] text-right font-mono tabular-nums bg-transparent border border-transparent hover:border-ink-200 focus:border-brand focus:bg-white focus:ring-2 focus:ring-brand/15 rounded-md outline-none" />
            <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[11px] text-ink-400 pointer-events-none">%</span>
          </div>
        </div>
        {/* delete */}
        <div className="py-2.5 pr-2 flex items-center justify-center">
          <button onClick={onDelete} title="Remover etapa"
            className="w-8 h-8 inline-flex items-center justify-center rounded-md text-ink-400 hover:text-status-late hover:bg-status-late/5 transition-colors">
            <window.Icon name="trash" className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* footer micro: duration */}
      {duration > 0 && (
        <div className="border-t border-ink-100 px-4 py-1.5 flex items-center justify-between text-[11px] text-ink-400">
          <span>Duração: <span className="font-semibold text-ink-600 tabular-nums">{duration} {duration === 1 ? 'dia' : 'dias'}</span></span>
          <span className="text-ink-300">{fmtDateBR(task.startDate)} → {fmtDateBR(task.endDate)}</span>
        </div>
      )}
    </div>
  );
}

function ProjectForm({ initial, onCancel, onSave }) {
  const [project, setProject] = useFormState(() => initial ? JSON.parse(JSON.stringify(initial)) : buildEmptyProject());
  const [errors, setErrors] = useFormState({});
  const [dragId, setDragId] = useFormState(null);
  const [dragOverId, setDragOverId] = useFormState(null);
  const toast = window.useToast();

  const setField = (k, v) => setProject(p => ({ ...p, [k]: v }));
  const addTask = () => {
    const { uid, todayISO, addDaysISO } = window.CronosStore;
    // Default the next task to start where the last one ends.
    const last = project.tasks[project.tasks.length - 1];
    const start = last?.endDate || todayISO();
    const end = addDaysISO(start, 7);
    setProject(p => ({
      ...p,
      tasks: [...p.tasks, { id: uid(), name: '', owner: '', startDate: start, endDate: end, progress: 0, status: 'not_started' }],
    }));
  };
  const updateTask = (id, next) => setProject(p => ({ ...p, tasks: p.tasks.map(t => t.id === id ? next : t) }));
  const deleteTask = (id) => setProject(p => ({ ...p, tasks: p.tasks.filter(t => t.id !== id) }));

  /* Drag-and-drop reorder */
  const reorder = (fromId, toId) => {
    if (fromId === toId) return;
    setProject(p => {
      const arr = [...p.tasks];
      const fromIdx = arr.findIndex(t => t.id === fromId);
      const toIdx = arr.findIndex(t => t.id === toId);
      if (fromIdx < 0 || toIdx < 0) return p;
      const [moved] = arr.splice(fromIdx, 1);
      arr.splice(toIdx, 0, moved);
      return { ...p, tasks: arr };
    });
  };

  const validate = () => {
    const errs = {};
    if (!project.name?.trim()) errs.name = 'Informe o nome do projeto';
    project.tasks.forEach((t, i) => {
      if (t.startDate && t.endDate && t.endDate < t.startDate) {
        errs[`task_${t.id}`] = `Etapa ${i + 1}: data de término anterior ao início`;
      }
    });
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const submit = () => {
    if (!validate()) {
      toast('Verifique os campos destacados', { kind: 'error' });
      return;
    }
    onSave(project);
  };

  const totalDuration = useFormMemo(() => {
    const starts = project.tasks.map(t => t.startDate).filter(Boolean).sort();
    const ends = project.tasks.map(t => t.endDate).filter(Boolean).sort();
    if (!starts.length || !ends.length) return null;
    const start = starts[0], end = ends[ends.length - 1];
    return { start, end, days: window.CronosStore.diffDays(start, end) + 1 };
  }, [project.tasks]);

  return (
    <div className="max-w-[1100px] mx-auto px-6 pt-6 pb-24">
      <div className="flex items-center justify-between mb-7">
        <div className="flex items-center gap-3">
          <window.IconButton icon="arrowLeft" title="Voltar" variant="secondary" onClick={onCancel} />
          <div>
            <div className="text-[11px] font-semibold tracking-[0.16em] uppercase text-brand">{initial ? 'Editando' : 'Novo'}</div>
            <h1 className="text-[24px] font-bold text-ink-900 leading-tight">{initial ? project.name || 'Editar projeto' : 'Novo projeto'}</h1>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <window.Button variant="ghost" onClick={onCancel}>Cancelar</window.Button>
          <window.Button icon="check" onClick={submit}>Salvar projeto</window.Button>
        </div>
      </div>

      {/* Project metadata card */}
      <div className="bg-white border border-ink-100 rounded-xl2 p-6 mb-6 shadow-card">
        <div className="text-[11px] font-semibold tracking-[0.1em] uppercase text-ink-400 mb-4">Identificação</div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <window.Field label="Nome do projeto" required error={errors.name}>
            <window.Input value={project.name} onChange={e => setField('name', e.target.value)} placeholder="ex.: Campanha de Lançamento Q2" />
          </window.Field>
          <window.Field label="Cliente">
            <window.Input value={project.client} onChange={e => setField('client', e.target.value)} placeholder="ex.: Banco Mirante" />
          </window.Field>
          <window.Field label="Responsável (gestora)">
            <window.Input value={project.owner} onChange={e => setField('owner', e.target.value)} placeholder="ex.: Carolina Tavares" />
          </window.Field>
          <window.Field label="Data de criação">
            <window.Input type="date" value={project.createdAt} onChange={e => setField('createdAt', e.target.value)} />
          </window.Field>
          <div className="md:col-span-2">
            <window.Field label="Descrição" hint="(opcional)">
              <window.Textarea value={project.description} onChange={e => setField('description', e.target.value)}
                placeholder="Contexto, escopo e principais entregas do projeto…" rows={3} />
            </window.Field>
          </div>
        </div>
      </div>

      {/* Tasks card */}
      <div className="bg-white border border-ink-100 rounded-xl2 p-6 shadow-card">
        <div className="flex items-end justify-between mb-4 flex-wrap gap-3">
          <div>
            <div className="text-[11px] font-semibold tracking-[0.1em] uppercase text-ink-400 mb-1">Etapas do cronograma</div>
            <div className="text-[14px] text-ink-500">
              {project.tasks.length} {project.tasks.length === 1 ? 'etapa' : 'etapas'}
              {totalDuration && (
                <> · <span className="text-ink-700 font-medium">{totalDuration.days} dias</span>
                  <span className="text-ink-400"> ({window.CronosStore.fmtDateBR(totalDuration.start)} → {window.CronosStore.fmtDateBR(totalDuration.end)})</span></>
              )}
            </div>
          </div>
          <window.Button size="sm" variant="brandSubtle" icon="plus" onClick={addTask}>Adicionar etapa</window.Button>
        </div>

        {/* Column header */}
        <div className="hidden md:grid items-center px-1 mb-2 text-[11px] font-semibold tracking-[0.06em] uppercase text-ink-400"
             style={{ gridTemplateColumns: '28px 1.4fr 1fr 0.9fr 0.9fr 1.1fr 70px 36px', gap: '10px' }}>
          <div></div>
          <div className="pl-2.5">Nome</div>
          <div className="pl-2.5">Responsável</div>
          <div className="pl-2">Início</div>
          <div className="pl-2">Término</div>
          <div className="pl-2.5">Status</div>
          <div className="pr-2 text-right">Progresso</div>
          <div></div>
        </div>

        {/* Rows */}
        <div className="space-y-2.5">
          {project.tasks.map((t, i) => (
            <div key={t.id}
                 onDragOver={e => { e.preventDefault(); setDragOverId(t.id); }}
                 onDragLeave={() => setDragOverId(prev => prev === t.id ? null : prev)}
                 onDrop={e => { e.preventDefault(); if (dragId) reorder(dragId, t.id); setDragId(null); setDragOverId(null); }}
                 className={window.classNames(dragOverId === t.id && dragId !== t.id ? 'ring-2 ring-brand/30 rounded-xl2' : '')}>
              <TaskRow
                task={t}
                index={i}
                isDragging={dragId === t.id}
                onChange={(next) => updateTask(t.id, next)}
                onDelete={() => deleteTask(t.id)}
                dragHandlers={{
                  onRowDragStart: (e) => { setDragId(t.id); e.dataTransfer.effectAllowed = 'move'; },
                  onRowDragEnd: () => { setDragId(null); setDragOverId(null); },
                }}
              />
              {errors[`task_${t.id}`] && (
                <div className="mt-1 text-[12px] text-status-late px-3">{errors[`task_${t.id}`]}</div>
              )}
            </div>
          ))}
          {project.tasks.length === 0 && (
            <button onClick={addTask} className="w-full py-10 border-2 border-dashed border-ink-200 rounded-xl2 text-ink-500 hover:text-brand hover:border-brand-300 hover:bg-brand-50/30 transition-colors text-[14px] font-medium">
              + Adicionar primeira etapa
            </button>
          )}
        </div>
      </div>

      {/* Sticky save bar */}
      <div className="fixed bottom-0 left-0 right-0 bg-white/95 backdrop-blur-md border-t border-ink-100 shadow-[0_-4px_24px_-12px_rgba(15,14,13,0.1)] no-print">
        <div className="max-w-[1100px] mx-auto px-6 py-3 flex items-center justify-between gap-4">
          <div className="text-[12.5px] text-ink-500">
            {project.tasks.length > 0 && totalDuration && (
              <>Período total: <span className="font-semibold text-ink-800 tabular-nums">{window.CronosStore.fmtDateBR(totalDuration.start)} → {window.CronosStore.fmtDateBR(totalDuration.end)}</span></>
            )}
          </div>
          <div className="flex items-center gap-2">
            <window.Button variant="ghost" onClick={onCancel}>Cancelar</window.Button>
            <window.Button icon="check" onClick={submit}>Salvar projeto</window.Button>
          </div>
        </div>
      </div>
    </div>
  );
}

Object.assign(window, { ProjectForm });
