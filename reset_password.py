#!/usr/bin/env python3
"""
Redefine a senha de qualquer usuário (exceto admin).

Uso:
    USER_EMAIL=usuario@email.com NEW_PASSWORD=novasenha python3 reset_password.py
"""

import os, sys, sqlite3, hashlib, secrets

SERVE_DIR = os.path.dirname(os.path.abspath(__file__))
DATA_DIR  = os.environ.get('DATA_DIR', SERVE_DIR)
DB_PATH   = os.path.join(DATA_DIR, 'cronos.db')

def hash_password(password: str) -> str:
    salt = secrets.token_hex(16)
    h = hashlib.pbkdf2_hmac('sha256', password.encode(), salt.encode(), 260_000)
    return f"pbkdf2:sha256:{salt}:{h.hex()}"

def main():
    email    = os.environ.get('USER_EMAIL', '').strip().lower()
    password = os.environ.get('NEW_PASSWORD', '')

    if not email:
        print("Erro: defina USER_EMAIL com o e-mail do usuário.")
        print("  Exemplo: USER_EMAIL=usuario@email.com NEW_PASSWORD=novasenha python3 reset_password.py")
        sys.exit(1)
    if len(password) < 6:
        print("Erro: defina NEW_PASSWORD com pelo menos 6 caracteres.")
        sys.exit(1)

    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row

    row = conn.execute("SELECT id, name, role FROM users WHERE email = ?", (email,)).fetchone()
    if not row:
        print(f"Erro: usuário '{email}' não encontrado.")
        sys.exit(1)

    conn.execute(
        "UPDATE users SET password_hash = ? WHERE email = ?",
        (hash_password(password), email)
    )
    # Invalida todas as sessões ativas do usuário
    conn.execute("DELETE FROM sessions WHERE user_id = ?", (row['id'],))
    conn.commit()
    conn.close()

    print(f"✓ Senha atualizada para {row['name']} ({email})")
    print("  Sessões anteriores foram encerradas.")

if __name__ == '__main__':
    main()
