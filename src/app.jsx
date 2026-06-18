// app.jsx — root component, route state, persistence wiring, JSON import/export, confirm-delete.

const { useState: useAppState, useEffect: useAppEffect, useCallback: useAppCallback, useRef: useAppRef } = React;

// Detect /share/:token in the URL at load time (before any React state).
const SHARE_TOKEN = (() => {
  const parts = window.location.pathname.split('/').filter(Boolean);
  return parts[0] === 'share' ? (parts[1] || null) : null;
})();

function App() {
  /* ── state ─────────────────────────────────────────────────────────────── */
  const [route, setRoute]             = useAppState({ name: 'list' });
  const [projects, setProjects]       = useAppState([]);
  const [user, setUser]               = useAppState(null);
  const [authLoading, setAuthLoading] = useAppState(true);
  const [confirm, setConfirm]         = useAppState(null);
  const [shareModal, setShareModal]       = useAppState(null);
  const [sharedProject, setSharedProject] = useAppState(null); // for /share/:token view
  const [sharedComments, setSharedComments] = useAppState([]);  // comments in shared view
  const [ganttComments, setGanttComments]   = useAppState([]);  // comments in owner view
  const [adminUsers, setAdminUsers]         = useAppState([]);  // full user list (admin view)
  const toast = window.useToast();
  const saveRef = useAppRef(null);

  /* ── session / share init ───────────────────────────────────────────────── */
  useAppEffect(() => {
    if (SHARE_TOKEN) {
      window.CronosStore.loadSharedProject(SHARE_TOKEN).then(result => {
        if (result) {
          setSharedProject(result.project);
          setSharedComments(result.comments);
        } else {
          setSharedProject(false);
        }
        setAuthLoading(false);
      });
      return;
    }
    (async () => {
      const me = await window.CronosStore.getMe();
      if (me) {
        const ps = await window.CronosStore.loadProjects();
        setUser(me);
        setProjects(ps);
      }
      setAuthLoading(false);
    })();
  }, []);

  /* ── persist on change (debounced, regular users only) ─────────────────── */
  useAppEffect(() => {
    if (!user || user.role === 'admin') return;
    clearTimeout(saveRef.current);
    saveRef.current = setTimeout(() => {
      window.CronosStore.saveProjects(projects).catch(console.error);
    }, 600);
  }, [projects]);

  /* ── load comments when owner views a project ──────────────────────────── */
  useAppEffect(() => {
    if (route.name !== 'gantt' || !route.id) return;
    window.CronosStore.loadComments(route.id).then(setGanttComments);
  }, [route.name, route.id]);

  /* ── load full user list for the admin view ────────────────────────────── */
  useAppEffect(() => {
    if (user && user.role === 'admin') {
      window.CronosStore.loadUsers().then(setAdminUsers);
    }
  }, [user]);

  /* ── auth callbacks ─────────────────────────────────────────────────────── */
  const handleAuth = useAppCallback(async (u, incomingPs) => {
    let ps = incomingPs;
    const LEGACY_KEY = 'cronos.gdm.projects.v1';
    if (ps.length === 0) {
      try {
        const raw = localStorage.getItem(LEGACY_KEY);
        if (raw) {
          const legacy = JSON.parse(raw);
          if (Array.isArray(legacy) && legacy.length > 0) {
            const migrated = legacy.map(p => ({
              ...p,
              id: window.CronosStore.uid(),
              tasks: (p.tasks || []).map(t => ({ ...t, id: window.CronosStore.uid() })),
            }));
            await window.CronosStore.saveProjects(migrated);
            localStorage.removeItem(LEGACY_KEY);
            ps = migrated;
            toast('Projetos locais migrados para sua conta', { kind: 'success' });
          }
        }
      } catch { /* best-effort */ }
    }
    setUser(u);
    setProjects(ps);
  }, [toast]);

  const handleLogout = useAppCallback(async () => {
    await window.CronosStore.logout();
    setUser(null);
    setProjects([]);
    setRoute({ name: 'list' });
    toast('Sessão encerrada', { kind: 'success' });
  }, [toast]);

  /* ── project actions (hooks must come before any early return) ──────────── */
  const onSaveProject = useAppCallback((p) => {
    setProjects(list => {
      const exists = list.find(x => x.id === p.id);
      if (exists) return list.map(x => x.id === p.id ? p : x);
      return [p, ...list];
    });
    toast('Projeto salvo', { kind: 'success' });
    setRoute({ name: 'gantt', id: p.id });
  }, [toast]);

  // Must be a hook (before early returns) so it's available in the shared view.
  const onPostComment = useAppCallback(async (author, content) => {
    const result = await window.CronosStore.postComment(SHARE_TOKEN, author, content);
    setSharedComments(prev => [...prev, result.comment]);
  }, []);

  /* ── shared view (public, no auth) ─────────────────────────────────────── */
  if (SHARE_TOKEN) {
    if (authLoading) {
      return (
        <div className="min-h-screen bg-canvas flex items-center justify-center">
          <span className="text-[13px] text-ink-400">Carregando…</span>
        </div>
      );
    }
    if (!sharedProject) {
      return (
        <div className="min-h-screen bg-canvas flex flex-col items-center justify-center gap-3">
          <window.BrandLogo height={28} />
          <p className="text-[14px] text-ink-500 mt-2">Este link está inativo ou não existe.</p>
        </div>
      );
    }
    return (
      <window.GanttView
        project={sharedProject}
        onBack={null}
        onEdit={null}
        onExportJSON={null}
        onShare={null}
        readOnly
        comments={sharedComments}
        onPostComment={onPostComment}
      />
    );
  }

  /* ── loading screen ─────────────────────────────────────────────────────── */
  if (authLoading) {
    return (
      <div className="min-h-screen bg-canvas flex items-center justify-center">
        <span className="text-[13px] text-ink-400">Carregando…</span>
      </div>
    );
  }

  /* ── auth gate ──────────────────────────────────────────────────────────── */
  if (!user) {
    return <window.AuthScreen onAuth={handleAuth} />;
  }

  /* ── helpers ────────────────────────────────────────────────────────────── */
  const isAdmin = user.role === 'admin';
  const findProject = (id) => projects.find(p => p.id === id);
  const goList  = () => setRoute({ name: 'list' });
  const goEdit  = (p) => setRoute({ name: 'form', id: p?.id });
  const goNew   = () => setRoute({ name: 'form' });
  const goGantt = (p) => setRoute({ name: 'gantt', id: p.id });

  const onDelete = (p) => setConfirm({
    title: 'Excluir projeto?',
    message: <>Tem certeza que deseja excluir <strong>"{p.name}"</strong>? Esta ação não pode ser desfeita.</>,
    confirmLabel: 'Excluir',
    danger: true,
    action: () => {
      setProjects(list => list.filter(x => x.id !== p.id));
      if (user.role === 'admin') {
        window.CronosStore.deleteProject(p.id).catch(console.error);
      }
      toast('Projeto excluído', { kind: 'success' });
      setConfirm(null);
    },
  });

  const onDeleteUser = (u) => setConfirm({
    title: 'Excluir usuário?',
    message: <>Isso remove <strong>{u.name}</strong> e todos os seus cronogramas permanentemente.</>,
    confirmLabel: 'Excluir usuário',
    danger: true,
    action: () => {
      window.CronosStore.deleteUser(u.id)
        .then(() => Promise.all([
          window.CronosStore.loadProjects().then(setProjects),
          window.CronosStore.loadUsers().then(setAdminUsers),
        ]))
        .catch(console.error);
      toast('Usuário excluído', { kind: 'success' });
      setConfirm(null);
    },
  });

  // Throws on error so the form can show the message inline.
  const onCreateUser = async (name, email, password) => {
    await window.CronosStore.createUser(name, email, password);
    const us = await window.CronosStore.loadUsers();
    setAdminUsers(us);
  };

  const onDuplicate = (p) => {
    const copy = JSON.parse(JSON.stringify(p));
    copy.id = window.CronosStore.uid();
    copy.name = `${copy.name} (cópia)`;
    copy.createdAt = window.CronosStore.todayISO();
    copy.tasks = copy.tasks.map(t => ({ ...t, id: window.CronosStore.uid() }));
    // Strip share fields — the copy starts with no share link.
    delete copy.shareToken;
    copy.shareActive = false;
    setProjects(list => [copy, ...list]);
    toast('Projeto duplicado', { kind: 'success' });
  };

  const onExportJSON = (p) => {
    const data = JSON.stringify({ projects: [p] }, null, 2);
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const safeName = (p.name || 'projeto').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');
    a.download = `cronos-${safeName}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    toast('Backup exportado', { kind: 'success' });
  };

  const onImportFile = async (file) => {
    try {
      const text = await file.text();
      const obj = JSON.parse(text);
      let imported = [];
      if (Array.isArray(obj.projects)) imported = obj.projects;
      else if (obj.id && Array.isArray(obj.tasks)) imported = [obj];
      else if (Array.isArray(obj)) imported = obj;
      else throw new Error('Formato não reconhecido');
      if (!imported.length) throw new Error('Arquivo vazio');

      imported = imported.map(p => ({
        id: window.CronosStore.uid(),
        name: p.name || 'Projeto importado',
        client: p.client || '',
        owner: p.owner || '',
        description: p.description || '',
        createdAt: p.createdAt || window.CronosStore.todayISO(),
        tasks: (p.tasks || []).map(t => ({
          id: window.CronosStore.uid(),
          name: t.name || '',
          owner: t.owner || '',
          startDate: t.startDate || window.CronosStore.todayISO(),
          endDate: t.endDate || window.CronosStore.todayISO(),
          progress: Math.max(0, Math.min(100, Number(t.progress) || 0)),
          status: window.CronosStore.STATUS[t.status] ? t.status : 'not_started',
        })),
      }));

      setProjects(list => [...imported, ...list]);
      toast(`${imported.length} projeto(s) importado(s)`, { kind: 'success' });
    } catch (e) {
      console.error(e);
      toast('Arquivo de backup inválido', { kind: 'error' });
    }
  };

  /* ── share modal handler ────────────────────────────────────────────────── */
  const onShareUpdate = (updatedProject) => {
    setProjects(list => list.map(p => p.id === updatedProject.id ? updatedProject : p));
    setShareModal(updatedProject);
  };

  /* ── comment handlers ───────────────────────────────────────────────────── */
  const onPostCommentAuth = async (author, content) => {
    const result = await window.CronosStore.postCommentAuth(route.id, author, content);
    setGanttComments(prev => [...prev, result.comment]);
    setProjects(list => list.map(p =>
      p.id === route.id ? { ...p, commentCount: (p.commentCount || 0) + 1 } : p
    ));
  };

  const onDeleteComment = async (commentId) => {
    await window.CronosStore.deleteComment(commentId);
    setGanttComments(prev => prev.filter(c => c.id !== commentId));
    setProjects(list => list.map(p =>
      p.id === route.id
        ? { ...p, commentCount: Math.max(0, (p.commentCount || 1) - 1) }
        : p
    ));
  };

  /* ── render ─────────────────────────────────────────────────────────────── */
  let body;
  let breadcrumb = null;

  if (route.name === 'list') {
    body = (
      <window.ProjectList
        projects={projects}
        users={adminUsers}
        isAdmin={isAdmin}
        onNew={isAdmin ? null : goNew}
        onEdit={isAdmin ? null : goEdit}
        onGantt={goGantt}
        onDelete={onDelete}
        onDeleteUser={isAdmin ? onDeleteUser : null}
        onCreateUser={isAdmin ? onCreateUser : null}
        onDuplicate={isAdmin ? null : onDuplicate}
        onExport={onExportJSON}
        onShare={isAdmin ? null : (p) => setShareModal(p)}
        onImport={isAdmin ? null : onImportFile}
      />
    );
  } else if (route.name === 'form' && !isAdmin) {
    const initial = route.id ? findProject(route.id) : null;
    breadcrumb = (
      <>
        <button onClick={goList} className="hover:text-ink-700">Projetos</button>
        <window.Icon name="chevronRight" className="w-3.5 h-3.5 text-ink-300" />
        <span className="text-ink-700">{initial ? 'Editar' : 'Novo projeto'}</span>
      </>
    );
    body = (
      <window.ProjectForm
        initial={initial}
        onCancel={goList}
        onSave={onSaveProject}
      />
    );
  } else if (route.name === 'gantt') {
    const project = findProject(route.id);
    if (!project) { setRoute({ name: 'list' }); return null; }
    breadcrumb = (
      <>
        <button onClick={goList} className="hover:text-ink-700">Projetos</button>
        <window.Icon name="chevronRight" className="w-3.5 h-3.5 text-ink-300" />
        <span className="text-ink-700 truncate max-w-[280px]">{project.name}</span>
      </>
    );
    body = (
      <window.GanttView
        project={project}
        onBack={goList}
        onEdit={isAdmin ? null : () => goEdit(project)}
        onExportJSON={onExportJSON}
        onShare={isAdmin ? null : () => setShareModal(project)}
        comments={ganttComments}
        onPostComment={onPostCommentAuth}
        onDeleteComment={onDeleteComment}
        defaultAuthor={user.name}
      />
    );
  } else {
    setRoute({ name: 'list' });
    return null;
  }

  return (
    <div className="min-h-screen">
      <window.Topbar breadcrumb={breadcrumb} onLogo={goList}>
        {route.name === 'list' && (
          <span className="hidden md:inline text-[12.5px] text-ink-400 mr-2">
            {isAdmin ? 'visão admin' : `${projects.length} ${projects.length === 1 ? 'projeto' : 'projetos'}`}
          </span>
        )}
        {isAdmin && (
          <span className="hidden md:inline text-[11px] font-semibold tracking-[0.1em] uppercase px-2 py-0.5 rounded bg-brand-50 text-brand border border-brand-100">
            Admin
          </span>
        )}
        <window.Button variant="ghost" onClick={handleLogout}>
          Sair
        </window.Button>
      </window.Topbar>
      {body}

      {/* Confirm modal */}
      <window.Modal
        open={!!confirm}
        onClose={() => setConfirm(null)}
        title={confirm?.title}
        footer={confirm && (
          <>
            <window.Button variant="ghost" onClick={() => setConfirm(null)}>Cancelar</window.Button>
            <window.Button
              className={confirm.danger ? '!bg-status-late hover:!bg-status-late/90' : ''}
              onClick={confirm.action}>
              {confirm.confirmLabel || 'Confirmar'}
            </window.Button>
          </>
        )}>
        {confirm?.message}
      </window.Modal>

      {/* Share modal */}
      {shareModal && (
        <window.ShareModal
          project={shareModal}
          onClose={() => setShareModal(null)}
          onUpdate={onShareUpdate}
        />
      )}
    </div>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <window.ToastProvider>
    <App />
  </window.ToastProvider>
);
