// ui.jsx — shared UI primitives: Icon, BrandLogo, Button, IconButton,
// Input, Textarea, Select, Field, StatusPill, ProgressBar,
// ToastProvider/useToast, Modal, Topbar.
// Exposed on window.* so other component scripts can consume them.

const {
  useEffect: useUiEffect,
  useState: useUiState,
  useCallback: useUiCallback,
} = React;

function classNames(...xs) { return xs.filter(Boolean).join(' '); }

/* ----------------------------------------------------------------- Icons -- */
const Icon = ({ name, className = 'w-4 h-4', strokeWidth = 1.75 }) => {
  const paths = {
    plus:          <><path d="M12 5v14"/><path d="M5 12h14"/></>,
    search:        <><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></>,
    upload:        <><path d="M12 16V4"/><path d="m7 9 5-5 5 5"/><path d="M5 20h14"/></>,
    download:      <><path d="M12 4v12"/><path d="m7 11 5 5 5-5"/><path d="M5 20h14"/></>,
    chevronLeft:   <><path d="m15 18-6-6 6-6"/></>,
    chevronRight:  <><path d="m9 18 6-6-6-6"/></>,
    chevronDown:   <><path d="m6 9 6 6 6-6"/></>,
    close:         <><path d="M18 6 6 18"/><path d="m6 6 12 12"/></>,
    drag:          <><circle cx="9" cy="6" r="1"/><circle cx="9" cy="12" r="1"/><circle cx="9" cy="18" r="1"/><circle cx="15" cy="6" r="1"/><circle cx="15" cy="12" r="1"/><circle cx="15" cy="18" r="1"/></>,
    trash:         <><path d="M3 6h18"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><path d="m6 6 1 14a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-14"/></>,
    edit:          <><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/></>,
    chart:         <><path d="M3 3v18h18"/><rect x="7" y="13" width="3" height="5"/><rect x="12" y="9" width="3" height="9"/><rect x="17" y="5" width="3" height="13"/></>,
    calendar:      <><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4"/><path d="M8 2v4"/><path d="M3 10h18"/></>,
    user:          <><circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/></>,
    folder:        <><path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Z"/></>,
    check:         <><path d="m5 12 5 5L20 7"/></>,
    arrowLeft:     <><path d="M19 12H5"/><path d="m12 19-7-7 7-7"/></>,
    more:          <><circle cx="5" cy="12" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/></>,
    pdf:           <><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/><path d="M8 13h.5a1.5 1.5 0 0 1 0 3H8v-3z"/><path d="M16 13v3"/><path d="M12 13v3"/></>,
    json:          <><path d="M8 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h2"/><path d="M16 3h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-2"/></>,
    today:         <><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></>,
    sparkle:       <><path d="M12 3v4"/><path d="M12 17v4"/><path d="M3 12h4"/><path d="M17 12h4"/><path d="m5.6 5.6 2.8 2.8"/><path d="m15.6 15.6 2.8 2.8"/><path d="m5.6 18.4 2.8-2.8"/><path d="m15.6 8.4 2.8-2.8"/></>,
  };
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth}
         strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      {paths[name] || null}
    </svg>
  );
};

/* --------------------------------------------------------------- BrandLogo -- */
const BrandLogo = ({ height = 28, className = '' }) => (
  <img
    src="assets/gdm-logo.png"
    alt="GDM"
    style={{ height }}
    className={classNames('block w-auto select-none', className)}
    draggable="false"
  />
);

/* ----------------------------------------------------------------- Buttons -- */
const buttonBase = 'inline-flex items-center justify-center gap-2 font-medium rounded-lg transition-all duration-150 focus-ring whitespace-nowrap disabled:opacity-50 disabled:cursor-not-allowed';

const buttonSizes = {
  sm: 'text-[13px] h-8 px-3',
  md: 'text-[14px] h-10 px-4',
  lg: 'text-[15px] h-11 px-5',
};

const buttonVariants = {
  primary:     'bg-brand text-white hover:bg-brand-700 active:bg-brand-800 shadow-card',
  secondary:   'bg-white text-ink-800 border border-ink-200 hover:border-ink-300 hover:bg-ink-50',
  ghost:       'bg-transparent text-ink-700 hover:bg-ink-100',
  danger:      'bg-white border border-status-late/30 text-status-late hover:bg-status-late/5',
  brandSubtle: 'bg-brand-50 text-brand hover:bg-brand-100 border border-brand-100',
};

const Button = ({ children, size = 'md', variant = 'primary', icon, iconRight, className = '', ...props }) => (
  <button {...props} className={classNames(buttonBase, buttonSizes[size], buttonVariants[variant], className)}>
    {icon && <Icon name={icon} className={size === 'sm' ? 'w-3.5 h-3.5' : 'w-4 h-4'} />}
    {children}
    {iconRight && <Icon name={iconRight} className={size === 'sm' ? 'w-3.5 h-3.5' : 'w-4 h-4'} />}
  </button>
);

const IconButton = ({ icon, title, className = '', variant = 'ghost', size = 'md', ...props }) => {
  const sz     = { sm: 'w-7 h-7',   md: 'w-9 h-9',   lg: 'w-10 h-10' }[size];
  const iconSz = { sm: 'w-3.5 h-3.5', md: 'w-4 h-4', lg: 'w-5 h-5'   }[size];
  return (
    <button {...props} title={title} aria-label={title}
      className={classNames(buttonBase, sz, buttonVariants[variant], 'p-0', className)}>
      <Icon name={icon} className={iconSz} />
    </button>
  );
};

/* --------------------------------------------------------- Form primitives -- */
const fieldBase = 'w-full bg-white border border-ink-200 rounded-lg text-ink-900 placeholder:text-ink-400 transition-colors focus:border-brand focus:ring-2 focus:ring-brand/15 outline-none';

const Input = ({ className = '', size = 'md', ...props }) => (
  <input {...props}
    className={classNames(fieldBase, size === 'sm' ? 'h-8 px-2.5 text-[13px]' : 'h-10 px-3 text-[14px]', className)}
  />
);

const Textarea = ({ className = '', rows = 3, ...props }) => (
  <textarea rows={rows} {...props}
    className={classNames(fieldBase, 'py-2.5 px-3 text-[14px] leading-relaxed resize-y', className)}
  />
);

const Select = ({ className = '', size = 'md', children, ...props }) => (
  <div className="relative">
    <select {...props}
      className={classNames(fieldBase, 'appearance-none pr-8',
        size === 'sm' ? 'h-8 pl-2.5 text-[13px]' : 'h-10 pl-3 text-[14px]', className)}>
      {children}
    </select>
    <Icon name="chevronDown" className="absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-400 pointer-events-none" />
  </div>
);

const Field = ({ label, hint, error, required, children }) => (
  <label className="block">
    <div className="flex items-baseline gap-1 mb-1.5">
      <span className="text-[12.5px] font-semibold text-ink-700 tracking-tight">{label}</span>
      {required && <span className="text-status-late text-[12.5px]">*</span>}
      {hint && <span className="text-[12px] text-ink-400 ml-1">{hint}</span>}
    </div>
    {children}
    {error && <div className="text-[12px] text-status-late mt-1">{error}</div>}
  </label>
);

/* ---------------------------------------------------------- StatusPill, ProgressBar -- */
const StatusPill = ({ status, size = 'md' }) => {
  const s = window.CronosStore.STATUS[status] || window.CronosStore.STATUS.not_started;
  return (
    <span className={classNames(
      'inline-flex items-center gap-1.5 font-medium rounded-full',
      size === 'sm' ? 'text-[11px] px-2 py-0.5' : 'text-[12px] px-2.5 py-1'
    )} style={{ background: s.bg, color: s.color }}>
      <span className="w-1.5 h-1.5 rounded-full" style={{ background: s.dot }} />
      {s.label}
    </span>
  );
};

const ProgressBar = ({ value, className = '', barClass = 'bg-brand' }) => (
  <div className={classNames('w-full h-1.5 bg-ink-100 rounded-full overflow-hidden', className)}>
    <div
      className={classNames('h-full rounded-full transition-all duration-300', barClass)}
      style={{ width: `${Math.max(0, Math.min(100, value))}%` }}
    />
  </div>
);

/* ------------------------------------------------------------------- Toast -- */
const ToastContext = React.createContext(null);
const useToast = () => React.useContext(ToastContext);

const ToastProvider = ({ children }) => {
  const [toasts, setToasts] = useUiState([]);

  const push = useUiCallback((msg, opts = {}) => {
    const id = Math.random().toString(36).slice(2);
    const t = { id, msg, kind: opts.kind || 'success', timeout: opts.timeout ?? 2800 };
    setToasts(ts => [...ts, t]);
    if (t.timeout > 0) {
      setTimeout(() => setToasts(ts => ts.filter(x => x.id !== id)), t.timeout);
    }
  }, []);

  return (
    <ToastContext.Provider value={push}>
      {children}
      <div className="fixed bottom-6 right-6 z-50 flex flex-col gap-2 items-end no-print">
        {toasts.map(t => (
          <div key={t.id} className="toast-in flex items-center gap-2.5 bg-ink-900 text-white text-[13.5px] font-medium px-4 py-2.5 rounded-lg shadow-pop max-w-sm">
            <span className={classNames(
              'w-1.5 h-1.5 rounded-full',
              t.kind === 'success' && 'bg-status-done',
              t.kind === 'error'   && 'bg-status-late',
              t.kind === 'info'    && 'bg-status-progress'
            )} />
            {t.msg}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
};

/* ------------------------------------------------------------------- Modal -- */
const Modal = ({ open, onClose, title, children, footer, size = 'md' }) => {
  useUiEffect(() => {
    if (!open) return;
    const onKey = e => { if (e.key === 'Escape') onClose && onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  const w = { sm: 'max-w-sm', md: 'max-w-md', lg: 'max-w-lg' }[size];
  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center no-print">
      <div className="absolute inset-0 bg-ink-900/40" onClick={onClose} />
      <div className={classNames('relative bg-white rounded-xl2 shadow-pop w-full mx-4 overflow-hidden', w)}>
        <div className="px-5 pt-5 pb-3 flex items-center justify-between">
          <h3 className="text-[16px] font-semibold text-ink-900">{title}</h3>
          <IconButton icon="close" title="Fechar" onClick={onClose} size="sm" />
        </div>
        <div className="px-5 pb-4 text-[14px] text-ink-700">{children}</div>
        {footer && (
          <div className="px-5 py-3 bg-ink-50 border-t border-ink-100 flex justify-end gap-2">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
};

/* ------------------------------------------------------------------ Topbar -- */
const Topbar = ({ children, breadcrumb, onLogo }) => (
  <header className="sticky top-0 z-30 bg-canvas/85 backdrop-blur-md border-b border-ink-100 no-print">
    <div className="max-w-[1440px] mx-auto px-6 h-16 flex items-center gap-4">
      <button onClick={onLogo} className="flex items-center gap-3 focus-ring rounded -ml-1 pr-2 py-1 hover:bg-ink-100/60">
        <BrandLogo height={22} />
        <span className="text-[12px] tracking-[0.16em] text-ink-400 font-semibold uppercase border-l border-ink-200 pl-3">Cronos</span>
      </button>
      {breadcrumb && (
        <div className="hidden md:flex items-center gap-2 text-[13.5px] text-ink-500">
          <Icon name="chevronRight" className="w-3.5 h-3.5 text-ink-300" />
          {breadcrumb}
        </div>
      )}
      <div className="flex-1" />
      <div className="flex items-center gap-2">{children}</div>
    </div>
  </header>
);

/* ----------------------------------------------------------- Export to window -- */
Object.assign(window, {
  classNames,
  Icon,
  BrandLogo,
  Button,
  IconButton,
  Input,
  Textarea,
  Select,
  Field,
  StatusPill,
  ProgressBar,
  ToastProvider,
  useToast,
  Modal,
  Topbar,
});
