#!/usr/bin/env python3
"""
Cronos GDM — servidor local com autenticação.
Uso: python3 server.py
     http://localhost:8181
"""

import http.server
import json
import sqlite3
import hashlib
import secrets
import uuid
import os
from urllib.parse import urlparse

SERVE_DIR = os.path.dirname(os.path.abspath(__file__))

# Em produção (Render), DATA_DIR aponta para um disco persistente (ex.: /var/data),
# pois o filesystem padrão é efêmero e os dados seriam perdidos a cada deploy.
DATA_DIR  = os.environ.get('DATA_DIR', SERVE_DIR)
DB_PATH   = os.path.join(DATA_DIR, 'cronos.db')

# Render injeta a porta via variável de ambiente PORT.
PORT      = int(os.environ.get('PORT', 8181))

# Origens permitidas para CORS, separadas por vírgula. Vazio = somente mesma origem
# (o front e a API são servidos pelo mesmo serviço, então CORS não é necessário).
ALLOWED_ORIGINS = {o.strip() for o in os.environ.get('ALLOWED_ORIGINS', '').split(',') if o.strip()}

# Validade da sessão em dias. Após esse período o token expira e exige novo login.
SESSION_TTL_DAYS = int(os.environ.get('SESSION_TTL_DAYS', 30))
SESSION_TTL_MOD  = f'+{SESSION_TTL_DAYS} days'  # modificador de data do SQLite

# ─────────────────────────────────────────────────────────── banco de dados ──

def get_db():
    conn = sqlite3.connect(DB_PATH, timeout=10)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    conn.execute("PRAGMA busy_timeout = 5000")  # espera em vez de falhar sob concorrência
    return conn

def init_db():
    os.makedirs(DATA_DIR, exist_ok=True)
    with get_db() as conn:
        conn.execute("PRAGMA journal_mode = WAL")  # leituras/escritas concorrentes
        conn.executescript("""
            CREATE TABLE IF NOT EXISTS users (
                id            INTEGER PRIMARY KEY AUTOINCREMENT,
                name          TEXT    NOT NULL,
                email         TEXT    UNIQUE NOT NULL,
                password_hash TEXT    NOT NULL,
                role          TEXT    NOT NULL DEFAULT 'user',
                created_at    TEXT    DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now'))
            );

            CREATE TABLE IF NOT EXISTS sessions (
                token      TEXT    PRIMARY KEY,
                user_id    INTEGER NOT NULL,
                created_at TEXT    DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now')),
                expires_at TEXT,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
            );

            CREATE TABLE IF NOT EXISTS projects (
                id           TEXT    PRIMARY KEY,
                user_id      INTEGER NOT NULL,
                data         TEXT    NOT NULL,
                share_token  TEXT    UNIQUE,
                share_active INTEGER NOT NULL DEFAULT 0,
                updated_at   TEXT    DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now')),
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
            );

            CREATE TABLE IF NOT EXISTS comments (
                id         INTEGER PRIMARY KEY AUTOINCREMENT,
                project_id TEXT    NOT NULL,
                author     TEXT    NOT NULL,
                content    TEXT    NOT NULL,
                created_at TEXT    DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now')),
                FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
            );
        """)
    # Migrations for databases created before these columns existed.
    for stmt in (
        "ALTER TABLE users    ADD COLUMN role         TEXT    NOT NULL DEFAULT 'user'",
        "ALTER TABLE projects ADD COLUMN share_token  TEXT",
        "ALTER TABLE projects ADD COLUMN share_active INTEGER NOT NULL DEFAULT 0",
        "ALTER TABLE sessions ADD COLUMN expires_at   TEXT",
    ):
        try:
            with get_db() as conn:
                conn.execute(stmt)
        except Exception:
            pass

    # Backfill: sessões pré-existentes sem expiração ganham um prazo a partir de agora.
    try:
        with get_db() as conn:
            conn.execute(
                "UPDATE sessions SET expires_at = strftime('%Y-%m-%dT%H:%M:%SZ','now',?) "
                "WHERE expires_at IS NULL",
                (SESSION_TTL_MOD,)
            )
    except Exception:
        pass

# ──────────────────────────────────────────────────────────── auth helpers ──

def hash_password(password: str) -> str:
    salt = secrets.token_hex(16)
    h = hashlib.pbkdf2_hmac('sha256', password.encode(), salt.encode(), 260_000)
    return f"pbkdf2:sha256:{salt}:{h.hex()}"

def verify_password(password: str, stored: str) -> bool:
    try:
        _, algo, salt, hx = stored.split(':')
        h = hashlib.pbkdf2_hmac(algo, password.encode(), salt.encode(), 260_000)
        return secrets.compare_digest(hx, h.hex())
    except Exception:
        return False

def create_session(user_id: int) -> str:
    token = secrets.token_urlsafe(32)
    with get_db() as conn:
        # Limpa sessões expiradas oportunisticamente (sem precisar de agendador).
        conn.execute(
            "DELETE FROM sessions WHERE expires_at IS NOT NULL "
            "AND expires_at <= strftime('%Y-%m-%dT%H:%M:%SZ','now')"
        )
        conn.execute(
            "INSERT INTO sessions (token, user_id, expires_at) "
            "VALUES (?, ?, strftime('%Y-%m-%dT%H:%M:%SZ','now',?))",
            (token, user_id, SESSION_TTL_MOD)
        )
    return token

def get_user_from_token(token: str):
    if not token:
        return None
    with get_db() as conn:
        row = conn.execute(
            "SELECT u.id, u.name, u.email, u.role "
            "FROM users u JOIN sessions s ON u.id = s.user_id "
            "WHERE s.token = ? "
            "AND (s.expires_at IS NULL OR s.expires_at > strftime('%Y-%m-%dT%H:%M:%SZ','now'))",
            (token,)
        ).fetchone()
    return dict(row) if row else None

def delete_session(token: str):
    with get_db() as conn:
        conn.execute("DELETE FROM sessions WHERE token = ?", (token,))

# ──────────────────────────────────────────────────────────── HTTP handler ──

class CronosHandler(http.server.SimpleHTTPRequestHandler):

    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=SERVE_DIR, **kwargs)

    def end_headers(self):
        # Cabeçalhos de segurança em todas as respostas (estáticas e de API).
        self.send_header('X-Content-Type-Options', 'nosniff')
        self.send_header('X-Frame-Options', 'SAMEORIGIN')
        self.send_header('Referrer-Policy', 'no-referrer')
        super().end_headers()

    def log_message(self, fmt, *args):
        if self.path.startswith('/api/') or self.path.startswith('/share/'):
            print(f"  {args[1]}  {args[0]}")

    # ── routing ──────────────────────────────────────────────────────────────

    def do_GET(self):
        path = urlparse(self.path).path
        if path.startswith('/api/'):
            self._dispatch('GET')
        elif path.startswith('/share/'):
            # SPA route — serve index.html and let the client handle the token.
            self.path = '/index.html'
            super().do_GET()
        else:
            super().do_GET()

    def do_POST(self):
        if self.path.startswith('/api/'):
            self._dispatch('POST')
        else:
            self._json(405, {'error': 'Method not allowed'})

    def do_PUT(self):
        if self.path.startswith('/api/'):
            self._dispatch('PUT')
        else:
            self._json(405, {'error': 'Method not allowed'})

    def do_DELETE(self):
        if self.path.startswith('/api/'):
            self._dispatch('DELETE')
        else:
            self._json(405, {'error': 'Method not allowed'})

    def do_OPTIONS(self):
        self.send_response(204)
        self._cors()
        self.end_headers()

    def _dispatch(self, method):
        path = urlparse(self.path).path

        def _try(fn, *args):
            try:
                fn(*args)
            except Exception:
                import traceback; traceback.print_exc()
                self._json(500, {'error': 'Erro interno'})

        # ── parametric routes ─────────────────────────────────────────────────

        # /api/share/:token  and  POST /api/share/:token/comments
        if path.startswith('/api/share/'):
            rem = path[len('/api/share/'):]
            if method == 'GET' and '/' not in rem and rem:
                return _try(self._get_shared_project, rem)
            if method == 'POST' and rem.endswith('/comments'):
                token = rem[:-len('/comments')]
                if token:
                    return _try(self._post_comment, token)

        # /api/projects/:id/share  |  /api/projects/:id/comments  |  /api/projects/:id
        if method in ('GET', 'POST', 'DELETE') and path.startswith('/api/projects/'):
            rem = path[len('/api/projects/'):]
            if rem.endswith('/share'):
                pid = rem[:-len('/share')]
                if pid:
                    if method == 'POST':   return _try(self._enable_share,  pid)
                    if method == 'DELETE': return _try(self._disable_share, pid)
            elif rem.endswith('/comments'):
                pid = rem[:-len('/comments')]
                if pid:
                    if method == 'GET':  return _try(self._get_comments,      pid)
                    if method == 'POST': return _try(self._post_comment_auth,  pid)
            elif rem:
                if method == 'DELETE': return _try(self._delete_project, rem)

        # DELETE /api/users/:id  (admin)
        if method == 'DELETE' and path.startswith('/api/users/'):
            uid = path[len('/api/users/'):]
            if uid:
                return _try(self._delete_user, uid)

        # DELETE /api/comments/:id
        if method == 'DELETE' and path.startswith('/api/comments/'):
            cid = path[len('/api/comments/'):]
            if cid:
                return _try(self._delete_comment, cid)

        # ── static routes ─────────────────────────────────────────────────────
        table = {
            ('POST', '/api/register'):  self._register,
            ('POST', '/api/login'):     self._login,
            ('POST', '/api/logout'):    self._logout,
            ('GET',  '/api/me'):        self._me,
            ('GET',  '/api/projects'):  self._get_projects,
            ('PUT',  '/api/projects'):  self._put_projects,
            ('GET',  '/api/users'):     self._get_users,
            ('POST', '/api/users'):     self._create_user,
        }
        fn = table.get((method, path))
        if fn:
            try:
                fn()
            except Exception:
                import traceback; traceback.print_exc()
                self._json(500, {'error': 'Erro interno do servidor'})
        else:
            self._json(404, {'error': 'Rota não encontrada'})

    # ── request / response helpers ────────────────────────────────────────────

    def _body(self):
        n = int(self.headers.get('Content-Length', 0))
        return json.loads(self.rfile.read(n)) if n else {}

    def _json(self, status, data):
        body = json.dumps(data, ensure_ascii=False).encode('utf-8')
        self.send_response(status)
        self.send_header('Content-Type', 'application/json; charset=utf-8')
        self.send_header('Content-Length', len(body))
        self._cors()
        self.end_headers()
        self.wfile.write(body)

    def _cors(self):
        # Só emite cabeçalhos CORS para origens explicitamente permitidas.
        # Requisições de mesma origem (o caso normal em produção) não precisam.
        origin = self.headers.get('Origin')
        if origin and origin in ALLOWED_ORIGINS:
            self.send_header('Access-Control-Allow-Origin', origin)
            self.send_header('Vary', 'Origin')
            self.send_header('Access-Control-Allow-Headers', 'Authorization, Content-Type')
            self.send_header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS')

    def _token(self):
        auth = self.headers.get('Authorization', '')
        return auth[7:] if auth.startswith('Bearer ') else None

    def _auth(self):
        user = get_user_from_token(self._token())
        if not user:
            self._json(401, {'error': 'Não autenticado'})
        return user

    def _admin(self):
        user = self._auth()
        if not user:
            return None
        if user.get('role') != 'admin':
            self._json(403, {'error': 'Acesso restrito ao administrador'})
            return None
        return user

    # ── routes ────────────────────────────────────────────────────────────────

    def _register(self):
        b = self._body()
        name     = (b.get('name')     or '').strip()
        email    = (b.get('email')    or '').strip().lower()
        password = (b.get('password') or '')

        if not name:
            return self._json(400, {'error': 'Nome obrigatório'})
        if not email or '@' not in email:
            return self._json(400, {'error': 'E-mail inválido'})
        if len(password) < 6:
            return self._json(400, {'error': 'Senha deve ter no mínimo 6 caracteres'})

        try:
            with get_db() as conn:
                cur = conn.execute(
                    "INSERT INTO users (name, email, password_hash, role) VALUES (?, ?, ?, 'user')",
                    (name, email, hash_password(password))
                )
                uid = cur.lastrowid
        except sqlite3.IntegrityError:
            return self._json(409, {'error': 'E-mail já cadastrado'})

        token = create_session(uid)
        self._json(200, {'user': {'id': uid, 'name': name, 'email': email, 'role': 'user'}, 'token': token})

    def _login(self):
        b = self._body()
        email    = (b.get('email')    or '').strip().lower()
        password = (b.get('password') or '')

        with get_db() as conn:
            row = conn.execute(
                "SELECT id, name, email, role, password_hash FROM users WHERE email = ?",
                (email,)
            ).fetchone()

        if not row or not verify_password(password, row['password_hash']):
            return self._json(401, {'error': 'E-mail ou senha incorretos'})

        token = create_session(row['id'])
        self._json(200, {
            'user':  {'id': row['id'], 'name': row['name'], 'email': row['email'], 'role': row['role']},
            'token': token,
        })

    def _logout(self):
        token = self._token()
        if token:
            delete_session(token)
        self._json(200, {'ok': True})

    def _me(self):
        user = self._auth()
        if not user:
            return
        self._json(200, {'user': user})

    def _get_projects(self):
        user = self._auth()
        if not user:
            return

        def _attach_meta(p, row):
            p['shareToken']   = row['share_token']
            p['shareActive']  = bool(row['share_active'])
            p['commentCount'] = row['comment_count']
            return p

        if user.get('role') == 'admin':
            with get_db() as conn:
                rows = conn.execute(
                    "SELECT p.data, p.share_token, p.share_active, "
                    "COUNT(c.id) AS comment_count, "
                    "u.id AS owner_id, u.name AS owner_name, u.email AS owner_email "
                    "FROM projects p "
                    "JOIN users u ON p.user_id = u.id "
                    "LEFT JOIN comments c ON c.project_id = p.id "
                    "GROUP BY p.id ORDER BY u.name, p.updated_at DESC"
                ).fetchall()
            projects = []
            for r in rows:
                p = _attach_meta(json.loads(r['data']), r)
                p['_owner'] = {'id': r['owner_id'], 'name': r['owner_name'], 'email': r['owner_email']}
                projects.append(p)
            return self._json(200, {'projects': projects})

        with get_db() as conn:
            rows = conn.execute(
                "SELECT p.data, p.share_token, p.share_active, COUNT(c.id) AS comment_count "
                "FROM projects p LEFT JOIN comments c ON c.project_id = p.id "
                "WHERE p.user_id = ? GROUP BY p.id ORDER BY p.updated_at DESC",
                (user['id'],)
            ).fetchall()
        self._json(200, {'projects': [_attach_meta(json.loads(r['data']), r) for r in rows]})

    def _put_projects(self):
        user = self._auth()
        if not user:
            return

        if user.get('role') == 'admin':
            return self._json(200, {'ok': True})

        projects = self._body().get('projects', [])
        _strip = {'_owner', 'shareToken', 'shareActive'}

        with get_db() as conn:
            ids = [p['id'] for p in projects if p.get('id')]
            if ids:
                conn.execute(
                    f"DELETE FROM projects WHERE user_id = ? AND id NOT IN ({','.join('?'*len(ids))})",
                    [user['id']] + ids
                )
            else:
                conn.execute("DELETE FROM projects WHERE user_id = ?", (user['id'],))

            for p in projects:
                if not p.get('id'):
                    continue
                clean = {k: v for k, v in p.items() if k not in _strip}
                conn.execute("""
                    INSERT INTO projects (id, user_id, data, updated_at)
                    VALUES (?, ?, ?, strftime('%Y-%m-%dT%H:%M:%SZ','now'))
                    ON CONFLICT(id) DO UPDATE SET
                        data       = excluded.data,
                        updated_at = excluded.updated_at
                """, (p['id'], user['id'], json.dumps(clean, ensure_ascii=False)))

        self._json(200, {'ok': True})

    # ── share routes (authenticated) ──────────────────────────────────────────

    def _enable_share(self, project_id: str):
        user = self._auth()
        if not user:
            return
        with get_db() as conn:
            q = "SELECT share_token FROM projects WHERE id = ?"
            args = (project_id,)
            if user.get('role') != 'admin':
                q += " AND user_id = ?"
                args = (project_id, user['id'])
            row = conn.execute(q, args).fetchone()
            if not row:
                return self._json(404, {'error': 'Projeto não encontrado'})
            token = row['share_token'] or uuid.uuid4().hex
            conn.execute(
                "UPDATE projects SET share_token = ?, share_active = 1 WHERE id = ?",
                (token, project_id)
            )
        self._json(200, {'shareToken': token, 'shareActive': True})

    def _disable_share(self, project_id: str):
        user = self._auth()
        if not user:
            return
        with get_db() as conn:
            q = "UPDATE projects SET share_active = 0 WHERE id = ?"
            args = (project_id,)
            if user.get('role') != 'admin':
                q += " AND user_id = ?"
                args = (project_id, user['id'])
            conn.execute(q, args)
        self._json(200, {'ok': True})

    def _get_shared_project(self, token: str):
        with get_db() as conn:
            row = conn.execute(
                "SELECT id, data FROM projects WHERE share_token = ? AND share_active = 1",
                (token,)
            ).fetchone()
            if not row:
                return self._json(404, {'error': 'Link inativo ou inexistente'})
            comments = conn.execute(
                "SELECT id, author, content, created_at FROM comments "
                "WHERE project_id = ? ORDER BY created_at ASC",
                (row['id'],)
            ).fetchall()
        self._json(200, {
            'project':  json.loads(row['data']),
            'comments': [dict(c) for c in comments],
        })

    # ── comment routes ────────────────────────────────────────────────────────

    def _post_comment(self, token: str):
        b = self._body()
        author  = (b.get('author')  or '').strip()
        content = (b.get('content') or '').strip()
        if not author:
            return self._json(400, {'error': 'Nome obrigatório'})
        if not content:
            return self._json(400, {'error': 'Comentário não pode ser vazio'})
        if len(author) > 100:
            return self._json(400, {'error': 'Nome muito longo (máx. 100 caracteres)'})
        if len(content) > 2000:
            return self._json(400, {'error': 'Comentário muito longo (máx. 2000 caracteres)'})
        with get_db() as conn:
            proj = conn.execute(
                "SELECT id FROM projects WHERE share_token = ? AND share_active = 1", (token,)
            ).fetchone()
            if not proj:
                return self._json(404, {'error': 'Link inativo ou inexistente'})
            cur = conn.execute(
                "INSERT INTO comments (project_id, author, content) VALUES (?, ?, ?)",
                (proj['id'], author, content)
            )
            c = conn.execute(
                "SELECT id, author, content, created_at FROM comments WHERE id = ?",
                (cur.lastrowid,)
            ).fetchone()
        self._json(201, {'comment': dict(c)})

    def _post_comment_auth(self, project_id: str):
        user = self._auth()
        if not user:
            return
        b = self._body()
        author  = (b.get('author') or user['name']).strip()
        content = (b.get('content') or '').strip()
        if not content:
            return self._json(400, {'error': 'Comentário não pode ser vazio'})
        if len(content) > 2000:
            return self._json(400, {'error': 'Comentário muito longo (máx. 2000 caracteres)'})
        with get_db() as conn:
            if user.get('role') != 'admin':
                if not conn.execute(
                    "SELECT id FROM projects WHERE id = ? AND user_id = ?",
                    (project_id, user['id'])
                ).fetchone():
                    return self._json(404, {'error': 'Projeto não encontrado'})
            cur = conn.execute(
                "INSERT INTO comments (project_id, author, content) VALUES (?, ?, ?)",
                (project_id, author, content)
            )
            c = conn.execute(
                "SELECT id, author, content, created_at FROM comments WHERE id = ?",
                (cur.lastrowid,)
            ).fetchone()
        self._json(201, {'comment': dict(c)})

    def _get_comments(self, project_id: str):
        user = self._auth()
        if not user:
            return
        with get_db() as conn:
            if user.get('role') != 'admin':
                if not conn.execute(
                    "SELECT id FROM projects WHERE id = ? AND user_id = ?",
                    (project_id, user['id'])
                ).fetchone():
                    return self._json(404, {'error': 'Projeto não encontrado'})
            rows = conn.execute(
                "SELECT id, author, content, created_at FROM comments "
                "WHERE project_id = ? ORDER BY created_at ASC",
                (project_id,)
            ).fetchall()
        self._json(200, {'comments': [dict(r) for r in rows]})

    def _delete_comment(self, comment_id: str):
        user = self._auth()
        if not user:
            return
        try:
            cid = int(comment_id)
        except ValueError:
            return self._json(400, {'error': 'ID inválido'})
        with get_db() as conn:
            if user.get('role') == 'admin':
                conn.execute("DELETE FROM comments WHERE id = ?", (cid,))
            else:
                conn.execute(
                    "DELETE FROM comments WHERE id = ? AND project_id IN "
                    "(SELECT id FROM projects WHERE user_id = ?)",
                    (cid, user['id'])
                )
        self._json(200, {'ok': True})

    # ── admin-only routes ─────────────────────────────────────────────────────

    def _get_users(self):
        user = self._admin()
        if not user:
            return
        with get_db() as conn:
            rows = conn.execute(
                "SELECT id, name, email, role, created_at FROM users "
                "WHERE role != 'admin' ORDER BY name"
            ).fetchall()
        self._json(200, {'users': [dict(r) for r in rows]})

    def _create_user(self):
        admin = self._admin()
        if not admin:
            return
        b = self._body()
        name     = (b.get('name')     or '').strip()
        email    = (b.get('email')    or '').strip().lower()
        password = (b.get('password') or '')

        if not name:
            return self._json(400, {'error': 'Nome obrigatório'})
        if not email or '@' not in email:
            return self._json(400, {'error': 'E-mail inválido'})
        if len(password) < 6:
            return self._json(400, {'error': 'Senha deve ter no mínimo 6 caracteres'})

        try:
            with get_db() as conn:
                cur = conn.execute(
                    "INSERT INTO users (name, email, password_hash, role) VALUES (?, ?, ?, 'user')",
                    (name, email, hash_password(password))
                )
                uid = cur.lastrowid
        except sqlite3.IntegrityError:
            return self._json(409, {'error': 'E-mail já cadastrado'})

        self._json(201, {'user': {'id': uid, 'name': name, 'email': email, 'role': 'user'}})

    def _delete_project(self, project_id: str):
        user = self._admin()
        if not user:
            return
        with get_db() as conn:
            conn.execute("DELETE FROM projects WHERE id = ?", (project_id,))
        self._json(200, {'ok': True})

    def _delete_user(self, user_id: str):
        admin = self._admin()
        if not admin:
            return
        try:
            uid = int(user_id)
        except ValueError:
            return self._json(400, {'error': 'ID inválido'})
        if uid == admin['id']:
            return self._json(400, {'error': 'Admin não pode excluir a si mesmo'})
        with get_db() as conn:
            conn.execute("DELETE FROM users WHERE id = ? AND role != 'admin'", (uid,))
        self._json(200, {'ok': True})


# ────────────────────────────────────────────────────────────── entry point ──

if __name__ == '__main__':
    init_db()
    # ThreadingHTTPServer atende requisições concorrentes (uma thread por conexão),
    # ao contrário do TCPServer single-threaded.
    httpd = http.server.ThreadingHTTPServer(('0.0.0.0', PORT), CronosHandler)
    print(f"Cronos GDM  →  http://0.0.0.0:{PORT}")
    print("Ctrl+C para parar.\n")
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        httpd.shutdown()
