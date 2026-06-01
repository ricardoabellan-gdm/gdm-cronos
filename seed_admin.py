#!/usr/bin/env python3
"""
Cria (ou atualiza) o usuário administrador do Cronos GDM.

Uso:
    ADMIN_EMAIL=admin@gdm.com ADMIN_PASSWORD=suasenha python3 seed_admin.py

Variáveis de ambiente:
    ADMIN_EMAIL     — e-mail do admin (obrigatório)
    ADMIN_PASSWORD  — senha do admin, mínimo 6 caracteres (obrigatório)
    ADMIN_NAME      — nome exibido (opcional, padrão: "Administrador")
"""

import os
import sys
import sqlite3
import hashlib
import secrets

SERVE_DIR = os.path.dirname(os.path.abspath(__file__))
DATA_DIR  = os.environ.get('DATA_DIR', SERVE_DIR)
DB_PATH   = os.path.join(DATA_DIR, 'cronos.db')


def hash_password(password: str) -> str:
    salt = secrets.token_hex(16)
    h = hashlib.pbkdf2_hmac('sha256', password.encode(), salt.encode(), 260_000)
    return f"pbkdf2:sha256:{salt}:{h.hex()}"


def main():
    email    = os.environ.get('ADMIN_EMAIL', '').strip().lower()
    password = os.environ.get('ADMIN_PASSWORD', '')
    name     = os.environ.get('ADMIN_NAME', 'Administrador').strip()

    if not email or '@' not in email:
        print("Erro: defina ADMIN_EMAIL com um e-mail válido.")
        print("  Exemplo: ADMIN_EMAIL=admin@gdm.com ADMIN_PASSWORD=senha123 python3 seed_admin.py")
        sys.exit(1)
    if len(password) < 6:
        print("Erro: defina ADMIN_PASSWORD com pelo menos 6 caracteres.")
        sys.exit(1)
    if not os.path.exists(DB_PATH):
        print(f"Erro: banco de dados não encontrado em {DB_PATH}")
        print("  Inicie o servidor ao menos uma vez antes de criar o admin: python3 server.py")
        sys.exit(1)

    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")

    # Garante que a coluna role existe (banco pode ser de antes da migration)
    try:
        conn.execute("ALTER TABLE users ADD COLUMN role TEXT NOT NULL DEFAULT 'user'")
        conn.commit()
    except Exception:
        pass

    existing_admin = conn.execute("SELECT id FROM users WHERE role = 'admin'").fetchone()

    if existing_admin:
        conn.execute(
            "UPDATE users SET name = ?, email = ?, password_hash = ? WHERE role = 'admin'",
            (name, email, hash_password(password))
        )
        conn.commit()
        print(f"✓ Admin atualizado: {email}")
    else:
        try:
            conn.execute(
                "INSERT INTO users (name, email, password_hash, role) VALUES (?, ?, ?, 'admin')",
                (name, email, hash_password(password))
            )
            conn.commit()
            print(f"✓ Admin criado: {email}")
        except sqlite3.IntegrityError:
            # E-mail já existe como usuário comum — promove para admin
            conn.execute(
                "UPDATE users SET name = ?, password_hash = ?, role = 'admin' WHERE email = ?",
                (name, hash_password(password), email)
            )
            conn.commit()
            print(f"✓ Usuário existente promovido a admin: {email}")

    conn.close()


if __name__ == '__main__':
    main()
