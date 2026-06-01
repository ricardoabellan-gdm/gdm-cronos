// Auth.jsx — tela de login / cadastro.
// Usa apenas primitivos e tokens já existentes do design system.
// Não introduz nenhum estilo novo.

const { useState: useAuthState } = React;

function AuthScreen({ onAuth }) {
  const [tab, setTab] = useAuthState('login'); // 'login' | 'register'
  const [name, setName] = useAuthState('');
  const [email, setEmail] = useAuthState('');
  const [password, setPassword] = useAuthState('');
  const [error, setError] = useAuthState('');
  const [busy, setBusy] = useAuthState(false);
  const toast = window.useToast();

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      const endpoint = tab === 'login' ? '/api/login' : '/api/register';
      const body = tab === 'login'
        ? { email, password }
        : { name, email, password };

      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Ocorreu um erro. Tente novamente.');
        return;
      }

      window.CronosStore.setToken(data.token);

      const ps = await window.CronosStore.loadProjects();
      toast(
        tab === 'login' ? `Bem-vindo, ${data.user.name}` : 'Conta criada com sucesso',
        { kind: 'success' }
      );
      onAuth(data.user, ps);
    } catch (err) {
      setError('Não foi possível conectar ao servidor.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen bg-canvas flex flex-col items-center justify-center px-4">
      <div className="w-full max-w-sm">
        {/* Brand */}
        <div className="flex flex-col items-center mb-8">
          <window.BrandLogo height={36} className="mb-3" />
          <span className="text-[12px] tracking-[0.18em] font-semibold uppercase text-ink-400">
            Cronos
          </span>
        </div>

        {/* Card */}
        <div className="bg-white border border-ink-100 rounded-xl2 shadow-pop p-6">
          {/* Tab toggle */}
          <div className="flex bg-ink-100/70 rounded-lg p-1 mb-6">
            {[
              { k: 'login',    l: 'Entrar'      },
              { k: 'register', l: 'Criar conta' },
            ].map(t => (
              <button
                key={t.k}
                type="button"
                onClick={() => { setTab(t.k); setError(''); }}
                className={window.classNames(
                  'flex-1 h-8 rounded-md text-[13px] font-medium transition-all',
                  tab === t.k
                    ? 'bg-white text-ink-900 shadow-card'
                    : 'text-ink-500 hover:text-ink-700'
                )}>
                {t.l}
              </button>
            ))}
          </div>

          {/* Form */}
          <form onSubmit={submit} className="space-y-4">
            {tab === 'register' && (
              <window.Field label="Nome" required>
                <window.Input
                  type="text"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  placeholder="Seu nome"
                  autoComplete="name"
                  required
                />
              </window.Field>
            )}

            <window.Field label="E-mail" required>
              <window.Input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="seu@email.com"
                autoComplete="email"
                required
              />
            </window.Field>

            <window.Field label="Senha" required>
              <window.Input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder={tab === 'register' ? 'Mínimo 6 caracteres' : '••••••••'}
                autoComplete={tab === 'login' ? 'current-password' : 'new-password'}
                required
              />
            </window.Field>

            {error && (
              <div className="text-[12.5px] text-status-late bg-status-late/5 border border-status-late/20 rounded-lg px-3 py-2">
                {error}
              </div>
            )}

            <window.Button
              type="submit"
              className="w-full"
              disabled={busy}>
              {busy
                ? 'Aguarde…'
                : tab === 'login' ? 'Entrar no sistema' : 'Criar conta'}
            </window.Button>
          </form>
        </div>

        <p className="text-center text-[12px] text-ink-400 mt-6">
          Cronos · GDM — dados salvos localmente
        </p>
      </div>
    </div>
  );
}

Object.assign(window, { AuthScreen });
