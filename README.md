# Cronos · GDM

Gerador de cronogramas Gantt para uso interno da equipe GDM. Crie projetos, adicione etapas com datas e progresso, visualize em gráfico de Gantt e exporte em PDF profissional.

Funciona 100% offline — requer apenas Python 3 (já incluído no macOS).

---

## Funcionalidades

- **Autenticação** com cadastro e login (senha com hash PBKDF2, sessão persistente)
- **Dados por usuário** — cada conta vê apenas seus próprios projetos
- **Lista de projetos** com busca textual e filtros por status
- **Formulário de projeto** com etapas reordenáveis por drag-and-drop
- **Gráfico de Gantt** em escalas diária, semanal e mensal
- **Exportação PDF** via jsPDF (texto nítido, sem html2canvas)
- **Backup/restore** via JSON (importar e exportar projetos)

---

## Como rodar localmente

```bash
cd "/Users/mac/Documents/GDM Cronos"
python3 server.py
```

Abra: [http://localhost:8181](http://localhost:8181)

O banco de dados `cronos.db` é criado automaticamente na primeira execução.

### Parar o servidor

```bash
Ctrl+C
```

---

## Estrutura do projeto

```
GDM Cronos/
├── index.html              # Ponto de entrada — carrega tudo
├── server.py               # Servidor HTTP + API REST + SQLite (Python stdlib)
├── DESIGN.md               # Design tokens (fonte da verdade visual)
├── README.md               # Este arquivo
│
├── assets/
│   ├── gdm-logo.png        # Logo da marca
│   └── fonts/              # Fontes self-hosted (WOFF2)
│       ├── manrope-400.woff2 … manrope-800.woff2
│       └── jetbrains-mono-400.woff2, jetbrains-mono-500.woff2
│
├── vendor/                 # Dependências locais (sem CDN)
│   ├── tailwind-v4.js      # @tailwindcss/browser — processa classes utilitárias
│   ├── react.production.min.js
│   ├── react-dom.production.min.js
│   ├── babel.min.js        # Transpila JSX em tempo de execução
│   └── jspdf.umd.min.js    # Geração nativa de PDF
│
├── styles/
│   ├── fonts.css           # @font-face das fontes locais
│   └── globals.css         # Scrollbars, animações, print
│
└── src/
    ├── store.js            # Token de sessão, helpers de data, chamadas de API
    ├── pdf-export.js       # Renderização do PDF (jsPDF nativo)
    └── components/
        ├── ui.jsx          # Primitivos: Icon, Button, Input, Modal, Toast, Topbar…
        ├── Auth.jsx        # Tela de login / cadastro
        ├── Gantt.jsx       # Gráfico SVG com escalas dia/semana/mês
        ├── GanttView.jsx   # Página do Gantt (header, stats, escala toggle)
        ├── ProjectList.jsx # Lista de projetos com busca e filtros
        ├── ProjectForm.jsx # Formulário de criação/edição com drag-and-drop
        └── app.jsx         # Shell: autenticação, roteamento, estado global
```

---

## Dados e persistência

Os projetos são salvos em `cronos.db` (SQLite), isolados por usuário. O `server.py` cria o arquivo automaticamente ao iniciar.

**Backup manual:** No card de cada projeto → menu `···` → **Exportar backup** → gera um `.json`.

**Restaurar:** Botão **Importar backup** na tela principal → selecione o `.json`.

**Migração de dados legados:** Ao fazer login pela primeira vez, projetos salvos em `localStorage` (formato antigo) são migrados automaticamente para a conta.

---

## API

| Método | Rota | Descrição |
|---|---|---|
| POST | `/api/register` | Cria conta (name, email, password) |
| POST | `/api/login` | Autentica e retorna token Bearer |
| POST | `/api/logout` | Invalida sessão |
| GET | `/api/me` | Retorna usuário autenticado |
| GET | `/api/projects` | Lista projetos do usuário |
| PUT | `/api/projects` | Substitui todos os projetos do usuário |

---

## Dependências

| Biblioteca | Versão | Uso |
|---|---|---|
| React | 18.3.1 | Componentes de UI |
| ReactDOM | 18.3.1 | Renderização no DOM |
| Babel Standalone | 7.29.0 | Transpilação de JSX em runtime |
| @tailwindcss/browser | 4.3.0 | Utilitários CSS + design tokens |
| jsPDF | 2.5.2 | Geração nativa de PDF |
| Manrope | — | Fonte principal (self-hosted) |
| JetBrains Mono | — | Fonte mono / números (self-hosted) |

Todas as dependências estão vendorizadas em `/vendor` e `/assets/fonts` — sem internet necessária após a instalação inicial.

---

## Manutenção e extensão

- **Mudanças visuais:** consulte `DESIGN.md` antes de alterar qualquer cor, espaçamento ou tipografia.
- **Novos componentes:** crie em `src/components/`, exporte via `Object.assign(window, {...})` e adicione a tag `<script>` correspondente no `index.html`.
- **Atualizar dependências:** substitua o arquivo em `vendor/` e atualize a versão no `README.md`.
