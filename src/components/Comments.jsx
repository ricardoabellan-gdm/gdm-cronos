// Comments — seção de comentários públicos do cronograma compartilhado.

const { useState: useCmtState } = React;

function Comments({ comments, onPost, onDelete, defaultAuthor = '' }) {
  const [author,  setAuthor]  = useCmtState(defaultAuthor);
  const [content, setContent] = useCmtState('');
  const [busy,    setBusy]    = useCmtState(false);
  const [error,   setError]   = useCmtState('');
  const toast = window.useToast();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      await onPost(author.trim(), content.trim());
      setContent('');
    } catch (err) {
      setError(err.message || 'Erro ao enviar comentário.');
    } finally {
      setBusy(false);
    }
  };

  const fmtDate = (iso) => {
    if (!iso) return '';
    const d = new Date(iso.endsWith('Z') ? iso : iso + 'Z');
    return d.toLocaleString('pt-BR', {
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });
  };

  return (
    <div className="mt-10 border-t border-ink-100 pt-8 no-print">
      <h2 className="text-[16px] font-bold text-ink-900 mb-6">
        Comentários
        {comments.length > 0 && (
          <span className="ml-2 text-[13px] font-normal text-ink-400">({comments.length})</span>
        )}
      </h2>

      {/* Form — only in shared (public) view */}
      {onPost && (
        <form onSubmit={handleSubmit} className="mb-8 space-y-3 max-w-lg">
          <window.Field label="Seu nome" required>
            <window.Input
              type="text"
              value={author}
              onChange={e => setAuthor(e.target.value)}
              placeholder="Como quer ser identificado"
              required
            />
          </window.Field>
          <window.Field label="Comentário" required>
            <window.Textarea
              value={content}
              onChange={e => setContent(e.target.value)}
              placeholder="Deixe seu comentário sobre o cronograma…"
              rows={3}
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
            disabled={busy || !author.trim() || !content.trim()}>
            {busy ? 'Enviando…' : 'Enviar comentário'}
          </window.Button>
        </form>
      )}

      {/* List */}
      {comments.length === 0 ? (
        <p className="text-[13px] text-ink-400">Nenhum comentário ainda.</p>
      ) : (
        <div className="space-y-3 max-w-2xl">
          {comments.map(c => (
            <div key={c.id} className="bg-white border border-ink-100 rounded-xl2 px-4 py-3.5 shadow-card">
              <div className="flex items-start gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-[13px] font-semibold text-ink-900">{c.author}</span>
                    <span className="text-[11px] text-ink-400 tabular-nums">{fmtDate(c.created_at)}</span>
                  </div>
                  <p className="text-[13px] text-ink-700 leading-relaxed whitespace-pre-wrap">{c.content}</p>
                </div>
                {onDelete && (
                  <window.IconButton
                    icon="trash"
                    title="Excluir comentário"
                    size="sm"
                    variant="ghost"
                    onClick={() => onDelete(c.id)}
                    className="shrink-0 text-ink-400 hover:text-status-late"
                  />
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

Object.assign(window, { Comments });
