// store.js — helpers de data, status, estatísticas e funções de API.
// Exposto em window.CronosStore para todos os componentes.

(function () {
  'use strict';

  // ── token de sessão ─────────────────────────────────────────────────────────
  const TOKEN_KEY = 'cronos.gdm.auth.token';

  function getToken()        { return localStorage.getItem(TOKEN_KEY) || null; }
  function setToken(t)       { localStorage.setItem(TOKEN_KEY, t); }
  function clearToken()      { localStorage.removeItem(TOKEN_KEY); }

  // ── helpers de data ──────────────────────────────────────────────────────────
  function uid() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
      const r = (Math.random() * 16) | 0;
      return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
    });
  }

  function todayISO() {
    const d = new Date();
    return new Date(d - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
  }

  function addDaysISO(iso, n) {
    const [y, m, d] = iso.split('-').map(Number);
    const dt = new Date(Date.UTC(y, m - 1, d));
    dt.setUTCDate(dt.getUTCDate() + n);
    return dt.toISOString().slice(0, 10);
  }

  function parseISO(iso) {
    if (!iso) return null;
    const [y, m, d] = iso.split('-').map(Number);
    return new Date(Date.UTC(y, m - 1, d));
  }

  function diffDays(aISO, bISO) {
    return Math.round((parseISO(bISO) - parseISO(aISO)) / 86400000);
  }

  function fmtDateBR(iso) {
    if (!iso) return '—';
    const [y, m, d] = iso.split('-');
    return `${d}/${m}/${y}`;
  }

  function fmtMonthYearBR(iso) {
    if (!iso) return '—';
    const months = ['jan','fev','mar','abr','mai','jun','jul','ago','set','out','nov','dez'];
    const [y, m] = iso.split('-');
    return `${months[+m - 1]}/${y.slice(2)}`;
  }

  // ── status ───────────────────────────────────────────────────────────────────
  const STATUS = {
    not_started: { key: 'not_started', label: 'Não iniciada', color: '#9CA39C', bg: '#F1F0EE', dot: '#9CA39C' },
    in_progress: { key: 'in_progress', label: 'Em andamento', color: '#2563EB', bg: '#E8F0FE', dot: '#2563EB' },
    done:        { key: 'done',        label: 'Concluída',    color: '#16A34A', bg: '#E6F4EA', dot: '#16A34A' },
    late:        { key: 'late',        label: 'Atrasada',     color: '#DC2626', bg: '#FCE8E8', dot: '#DC2626' },
  };

  // ── estatísticas derivadas ────────────────────────────────────────────────────
  function projectStats(p) {
    const tasks = p.tasks || [];
    if (!tasks.length) return { progress: 0, status: 'not_started', start: null, end: null, taskCount: 0 };

    const starts  = tasks.map(t => t.startDate).filter(Boolean).sort();
    const ends    = tasks.map(t => t.endDate).filter(Boolean).sort();
    const start   = starts[0] || null;
    const end     = ends[ends.length - 1] || null;
    const progress = Math.round(tasks.reduce((s, t) => s + (Number(t.progress) || 0), 0) / tasks.length);
    const today   = todayISO();

    const hasLate    = tasks.some(t => t.status === 'late' || (t.status !== 'done' && t.endDate && t.endDate < today));
    const allDone    = tasks.every(t => t.status === 'done');
    const anyProgress = tasks.some(t => t.status === 'in_progress' || (t.progress > 0 && t.progress < 100));

    let status = 'not_started';
    if (hasLate) status = 'late';
    else if (allDone) status = 'done';
    else if (anyProgress || (start && start <= today)) status = 'in_progress';

    return { progress, status, start, end, taskCount: tasks.length };
  }

  // ── chamadas de API ───────────────────────────────────────────────────────────
  function authHeaders() {
    const t = getToken();
    return t ? { 'Authorization': `Bearer ${t}` } : {};
  }

  async function getMe() {
    const token = getToken();
    if (!token) return null;
    try {
      const res = await fetch('/api/me', { headers: authHeaders() });
      if (!res.ok) return null;
      const data = await res.json();
      return data.user || null;
    } catch {
      return null;
    }
  }

  async function loadProjects() {
    try {
      const res = await fetch('/api/projects', { headers: authHeaders() });
      if (!res.ok) return [];
      const data = await res.json();
      return data.projects || [];
    } catch (e) {
      console.error('[Cronos] loadProjects falhou:', e);
      return [];
    }
  }

  async function saveProjects(projects) {
    const res = await fetch('/api/projects', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', ...authHeaders() },
      body: JSON.stringify({ projects }),
    });
    if (!res.ok) throw new Error(`saveProjects: HTTP ${res.status}`);
  }

  async function logout() {
    try {
      await fetch('/api/logout', { method: 'POST', headers: authHeaders() });
    } catch { /* best-effort */ }
    clearToken();
  }

  async function deleteProject(id) {
    const res = await fetch(`/api/projects/${id}`, {
      method: 'DELETE',
      headers: authHeaders(),
    });
    if (!res.ok) throw new Error(`deleteProject: HTTP ${res.status}`);
  }

  async function deleteUser(id) {
    const res = await fetch(`/api/users/${id}`, {
      method: 'DELETE',
      headers: authHeaders(),
    });
    if (!res.ok) throw new Error(`deleteUser: HTTP ${res.status}`);
  }

  async function loadUsers() {
    try {
      const res = await fetch('/api/users', { headers: authHeaders() });
      if (!res.ok) return [];
      const data = await res.json();
      return data.users || [];
    } catch {
      return [];
    }
  }

  async function createUser(name, email, password) {
    const res = await fetch('/api/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeaders() },
      body: JSON.stringify({ name, email, password }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || `createUser: HTTP ${res.status}`);
    return data; // { user }
  }

  async function enableShare(projectId) {
    const res = await fetch(`/api/projects/${projectId}/share`, {
      method: 'POST',
      headers: authHeaders(),
    });
    if (!res.ok) throw new Error(`enableShare: HTTP ${res.status}`);
    return await res.json(); // { shareToken, shareActive }
  }

  async function disableShare(projectId) {
    const res = await fetch(`/api/projects/${projectId}/share`, {
      method: 'DELETE',
      headers: authHeaders(),
    });
    if (!res.ok) throw new Error(`disableShare: HTTP ${res.status}`);
  }

  async function loadSharedProject(token) {
    try {
      const res = await fetch(`/api/share/${token}`);
      if (!res.ok) return null;
      const data = await res.json();
      if (!data.project) return null;
      return { project: data.project, comments: data.comments || [] };
    } catch {
      return null;
    }
  }

  async function postComment(token, author, content) {
    const res = await fetch(`/api/share/${token}/comments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ author, content }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || `postComment: HTTP ${res.status}`);
    return data; // { comment }
  }

  async function loadComments(projectId) {
    try {
      const res = await fetch(`/api/projects/${projectId}/comments`, { headers: authHeaders() });
      if (!res.ok) return [];
      const data = await res.json();
      return data.comments || [];
    } catch {
      return [];
    }
  }

  async function postCommentAuth(projectId, author, content) {
    const res = await fetch(`/api/projects/${projectId}/comments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeaders() },
      body: JSON.stringify({ author, content }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || `postCommentAuth: HTTP ${res.status}`);
    return data; // { comment }
  }

  async function deleteComment(id) {
    const res = await fetch(`/api/comments/${id}`, {
      method: 'DELETE',
      headers: authHeaders(),
    });
    if (!res.ok) throw new Error(`deleteComment: HTTP ${res.status}`);
  }

  window.CronosStore = {
    // token
    getToken, setToken, clearToken,
    // data
    uid, todayISO, addDaysISO, parseISO, diffDays, fmtDateBR, fmtMonthYearBR,
    // status / stats
    STATUS, projectStats,
    // API
    getMe, loadProjects, saveProjects, logout,
    deleteProject, deleteUser, loadUsers, createUser,
    enableShare, disableShare, loadSharedProject,
    postComment, postCommentAuth, loadComments, deleteComment,
  };
})();
