// ShareModal — gera/desativa link público de um cronograma.

const { useState: useShareState } = React;

function ShareModal({ project, onClose, onUpdate }) {
  const [busy, setBusy] = useShareState(false);
  const [copied, setCopied] = useShareState(false);
  const toast = window.useToast();

  const shareUrl = project.shareToken
    ? `${window.location.origin}/share/${project.shareToken}`
    : null;

  const handleEnable = async () => {
    setBusy(true);
    try {
      const result = await window.CronosStore.enableShare(project.id);
      onUpdate({ ...project, shareToken: result.shareToken, shareActive: true });
    } catch {
      toast('Não foi possível gerar o link.', { kind: 'error' });
    } finally {
      setBusy(false);
    }
  };

  const handleDisable = async () => {
    setBusy(true);
    try {
      await window.CronosStore.disableShare(project.id);
      onUpdate({ ...project, shareActive: false });
    } catch {
      toast('Não foi possível desativar o link.', { kind: 'error' });
    } finally {
      setBusy(false);
    }
  };

  const handleCopy = async () => {
    if (!shareUrl) return;
    try {
      await navigator.clipboard.writeText(shareUrl);
    } catch {
      const el = document.createElement('input');
      el.value = shareUrl;
      document.body.appendChild(el);
      el.select();
      document.execCommand('copy');
      el.remove();
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <window.Modal
      open={true}
      onClose={onClose}
      title="Compartilhar cronograma"
      footer={<window.Button variant="ghost" onClick={onClose}>Fechar</window.Button>}>

      {project.shareActive && shareUrl ? (
        <div className="space-y-4">
          <p className="text-[13px] text-ink-600 leading-relaxed">
            Qualquer pessoa com este link pode visualizar o cronograma sem precisar de login.
          </p>
          <div className="bg-ink-50 border border-ink-200 rounded-lg px-3 py-2.5">
            <span className="text-[12px] font-mono text-ink-700 break-all select-all">{shareUrl}</span>
          </div>
          <div className="flex items-center gap-2">
            <window.Button
              onClick={handleCopy}
              variant={copied ? 'secondary' : 'primary'}
              icon={copied ? 'check' : 'upload'}>
              {copied ? 'Link copiado!' : 'Copiar link'}
            </window.Button>
            <window.Button variant="danger" onClick={handleDisable} disabled={busy}>
              {busy ? 'Aguarde…' : 'Desativar link'}
            </window.Button>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <p className="text-[13px] text-ink-600 leading-relaxed">
            Gere um link único para compartilhar este cronograma em modo somente leitura.
            Você pode desativá-lo a qualquer momento.
          </p>
          <window.Button onClick={handleEnable} disabled={busy}>
            {busy ? 'Gerando…' : 'Gerar link de compartilhamento'}
          </window.Button>
        </div>
      )}
    </window.Modal>
  );
}

Object.assign(window, { ShareModal });
