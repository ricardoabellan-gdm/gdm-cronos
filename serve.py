#!/usr/bin/env python3
# Servidor HTTP local para o Cronos GDM.
# Uso: python3 serve.py
# Acesse: http://localhost:8181

import http.server, socketserver, os

SERVE_DIR = os.path.dirname(os.path.abspath(__file__))
PORT = 8181

class Handler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=SERVE_DIR, **kwargs)
    def log_message(self, fmt, *args):
        print(f"  {args[0]} {args[1]}")

with socketserver.TCPServer(("", PORT), Handler) as httpd:
    httpd.allow_reuse_address = True
    print(f"Cronos GDM rodando em http://localhost:{PORT}")
    print("Pressione Ctrl+C para parar.\n")
    httpd.serve_forever()
