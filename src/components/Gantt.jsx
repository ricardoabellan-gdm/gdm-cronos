// Gantt: SVG-based chart with day/week/month scales, today line, status colors, progress.
// Self-contained — pass { tasks, scale, height, onTaskClick }.

const { useMemo: useGanttMemo, useRef: useGanttRef, useEffect: useGanttEffect, useState: useGanttState } = React;

const ROW_HEIGHT = 48;
const HEADER_HEIGHT = 56;
const SIDEBAR_WIDTH = 280;
const COL_W = { day: 32, week: 28, month: 4 };  // px per day for each scale (month: thin daily bars)
const SCALE_COL_W = { day: 32, week: 28, month: 4 };

const STATUS_FILLS = {
  not_started: { bar: '#D6D5D1', track: '#EDECEA', fill: '#9CA39C', text: '#5E5A53' },
  in_progress: { bar: '#BFD3F5', track: '#E8EFFB', fill: '#2563EB', text: '#1B4FB6' },
  done:        { bar: '#BFE3CB', track: '#E6F4EA', fill: '#16A34A', text: '#0E6B30' },
  late:        { bar: '#F5C4C4', track: '#FCE8E8', fill: '#DC2626', text: '#9F1818' },
};

function startOfWeekUTC(d) {
  const dt = new Date(d.getTime());
  const day = dt.getUTCDay();
  const diff = (day === 0 ? -6 : 1 - day); // monday-start
  dt.setUTCDate(dt.getUTCDate() + diff);
  return dt;
}
function startOfMonthUTC(d) { return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1)); }
function isoUTC(d) { return d.toISOString().slice(0, 10); }
function isWeekend(d) { const dow = d.getUTCDay(); return dow === 0 || dow === 6; }

const MONTHS_PT = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
const MONTHS_PT_FULL = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
const DOW_PT = ['D','S','T','Q','Q','S','S'];

// JS-side truncation for SVG <text> (which has no native ellipsis).
function truncateSVG(s, maxChars) {
  if (!s) return '';
  if (s.length <= maxChars) return s;
  return s.slice(0, Math.max(1, maxChars - 1)) + '…';
}

// Compute extents and per-day pixel width for a given scale.
function computeExtents(tasks, scale) {
  const { todayISO, parseISO, addDaysISO } = window.CronosStore;
  const today = todayISO();
  let starts = tasks.map(t => t.startDate).filter(Boolean);
  let ends = tasks.map(t => t.endDate).filter(Boolean);
  if (!starts.length || !ends.length) {
    starts = [addDaysISO(today, -7)];
    ends = [addDaysISO(today, 21)];
  }
  starts.sort();
  ends.sort();
  let minISO = starts[0];
  let maxISO = ends[ends.length - 1];
  // Pad by a bit so bars don't touch the edges
  if (scale === 'day') {
    minISO = addDaysISO(minISO, -2);
    maxISO = addDaysISO(maxISO, 5);
  } else if (scale === 'week') {
    minISO = addDaysISO(minISO, -7);
    maxISO = addDaysISO(maxISO, 14);
  } else {
    minISO = addDaysISO(minISO, -10);
    maxISO = addDaysISO(maxISO, 30);
  }
  // align start to nice boundary for each scale
  const minD = parseISO(minISO);
  let alignedStart = minD;
  if (scale === 'week') alignedStart = startOfWeekUTC(minD);
  if (scale === 'month') alignedStart = startOfMonthUTC(minD);
  const maxD = parseISO(maxISO);
  let alignedEnd = maxD;
  if (scale === 'week') {
    const e = startOfWeekUTC(maxD);
    e.setUTCDate(e.getUTCDate() + 13); // include +2 weeks
    alignedEnd = e;
  }
  if (scale === 'month') {
    alignedEnd = new Date(Date.UTC(maxD.getUTCFullYear(), maxD.getUTCMonth() + 2, 0));
  }
  const totalDays = Math.round((alignedEnd - alignedStart) / 86400000) + 1;
  const pxPerDay = SCALE_COL_W[scale];
  return { startD: alignedStart, endD: alignedEnd, totalDays, pxPerDay };
}

function dayIndex(d, startD) {
  return Math.round((d - startD) / 86400000);
}

/* ----------------------- Header (timeline scale row) ---------------------- */
function GanttHeader({ scale, startD, totalDays, pxPerDay, contentWidth }) {
  // Renders two-row header: top = month/year-week, bottom = day/week/month label
  if (scale === 'day') {
    // Top row: months spanning their days; Bottom row: day numbers
    const months = [];
    let i = 0;
    while (i < totalDays) {
      const d = new Date(startD.getTime()); d.setUTCDate(d.getUTCDate() + i);
      const monthStart = i;
      const monthIndex = d.getUTCMonth();
      const year = d.getUTCFullYear();
      let j = i + 1;
      while (j < totalDays) {
        const dd = new Date(startD.getTime()); dd.setUTCDate(dd.getUTCDate() + j);
        if (dd.getUTCMonth() !== monthIndex || dd.getUTCFullYear() !== year) break;
        j++;
      }
      months.push({ start: monthStart, len: j - monthStart, label: `${MONTHS_PT_FULL[monthIndex]} ${year}` });
      i = j;
    }
    return (
      <svg width={contentWidth} height={HEADER_HEIGHT} className="block">
        {/* month bands */}
        {months.map((m, idx) => (
          <g key={idx}>
            <rect x={m.start * pxPerDay} y="0" width={m.len * pxPerDay} height={28}
                  fill={idx % 2 === 0 ? '#FBFAF7' : '#F4F2EE'} />
            <text x={m.start * pxPerDay + 12} y={18} fontSize="11.5" fontWeight="600" fill="#5E5A53" style={{ letterSpacing: '0.04em', textTransform: 'uppercase' }}>{m.label}</text>
            <line x1={m.start * pxPerDay} x2={m.start * pxPerDay} y1={0} y2={HEADER_HEIGHT} stroke="#E5E3DF" />
          </g>
        ))}
        {/* day cells */}
        {Array.from({ length: totalDays }, (_, k) => {
          const d = new Date(startD.getTime()); d.setUTCDate(d.getUTCDate() + k);
          const x = k * pxPerDay;
          const weekend = isWeekend(d);
          return (
            <g key={k}>
              {weekend && <rect x={x} y={28} width={pxPerDay} height={HEADER_HEIGHT - 28} fill="#F4F2EE" />}
              <text x={x + pxPerDay / 2} y={42} textAnchor="middle" fontSize="10" fill="#8A857D" fontWeight="500">{DOW_PT[d.getUTCDay()]}</text>
              <text x={x + pxPerDay / 2} y={53} textAnchor="middle" fontSize="11.5" fill="#2A2825" fontWeight="600">{d.getUTCDate()}</text>
              <line x1={x} x2={x} y1={28} y2={HEADER_HEIGHT} stroke="#EDECEA" />
            </g>
          );
        })}
        <line x1={0} x2={contentWidth} y1={HEADER_HEIGHT - 0.5} y2={HEADER_HEIGHT - 0.5} stroke="#D9D7D3" />
      </svg>
    );
  }

  if (scale === 'week') {
    // Top: month names; Bottom: week numbers + start-day
    const months = [];
    let i = 0;
    while (i < totalDays) {
      const d = new Date(startD.getTime()); d.setUTCDate(d.getUTCDate() + i);
      const monthIndex = d.getUTCMonth();
      const year = d.getUTCFullYear();
      let j = i + 1;
      while (j < totalDays) {
        const dd = new Date(startD.getTime()); dd.setUTCDate(dd.getUTCDate() + j);
        if (dd.getUTCMonth() !== monthIndex || dd.getUTCFullYear() !== year) break;
        j++;
      }
      months.push({ start: i, len: j - i, label: `${MONTHS_PT_FULL[monthIndex]} ${year}` });
      i = j;
    }
    return (
      <svg width={contentWidth} height={HEADER_HEIGHT} className="block">
        {months.map((m, idx) => (
          <g key={idx}>
            <rect x={m.start * pxPerDay} y="0" width={m.len * pxPerDay} height={28}
                  fill={idx % 2 === 0 ? '#FBFAF7' : '#F4F2EE'} />
            <text x={m.start * pxPerDay + 12} y={18} fontSize="11.5" fontWeight="600" fill="#5E5A53" style={{ letterSpacing: '0.04em', textTransform: 'uppercase' }}>{m.label}</text>
            <line x1={m.start * pxPerDay} x2={m.start * pxPerDay} y1={0} y2={HEADER_HEIGHT} stroke="#E5E3DF" />
          </g>
        ))}
        {/* week cells */}
        {Array.from({ length: Math.ceil(totalDays / 7) }, (_, w) => {
          const startDayIdx = w * 7;
          const d = new Date(startD.getTime()); d.setUTCDate(d.getUTCDate() + startDayIdx);
          const x = startDayIdx * pxPerDay;
          return (
            <g key={w}>
              <line x1={x} x2={x} y1={28} y2={HEADER_HEIGHT} stroke="#E5E3DF" />
              <text x={x + (7 * pxPerDay) / 2} y={45} textAnchor="middle" fontSize="10.5" fill="#8A857D" fontWeight="500">sem</text>
              <text x={x + (7 * pxPerDay) / 2} y={56} textAnchor="middle" fontSize="11.5" fill="#2A2825" fontWeight="600">{String(d.getUTCDate()).padStart(2,'0')}/{String(d.getUTCMonth()+1).padStart(2,'0')}</text>
            </g>
          );
        })}
        <line x1={0} x2={contentWidth} y1={HEADER_HEIGHT - 0.5} y2={HEADER_HEIGHT - 0.5} stroke="#D9D7D3" />
      </svg>
    );
  }

  // month scale
  const months = [];
  let i = 0;
  while (i < totalDays) {
    const d = new Date(startD.getTime()); d.setUTCDate(d.getUTCDate() + i);
    const monthIndex = d.getUTCMonth();
    const year = d.getUTCFullYear();
    let j = i + 1;
    while (j < totalDays) {
      const dd = new Date(startD.getTime()); dd.setUTCDate(dd.getUTCDate() + j);
      if (dd.getUTCMonth() !== monthIndex || dd.getUTCFullYear() !== year) break;
      j++;
    }
    months.push({ start: i, len: j - i, label: MONTHS_PT[monthIndex], year, monthIndex });
    i = j;
  }
  // group months by year for top row
  const yearRows = [];
  months.forEach(m => {
    const last = yearRows[yearRows.length - 1];
    if (last && last.year === m.year) { last.len += m.len; last.endIndex = m.start + m.len; }
    else yearRows.push({ year: m.year, start: m.start, len: m.len, endIndex: m.start + m.len });
  });
  return (
    <svg width={contentWidth} height={HEADER_HEIGHT} className="block">
      {yearRows.map((y, idx) => (
        <g key={idx}>
          <rect x={y.start * pxPerDay} y="0" width={y.len * pxPerDay} height={26}
                fill={idx % 2 === 0 ? '#FBFAF7' : '#F4F2EE'} />
          <text x={y.start * pxPerDay + 10} y={17} fontSize="11.5" fontWeight="700" fill="#403D38" style={{ letterSpacing: '0.06em' }}>{y.year}</text>
          <line x1={y.start * pxPerDay} x2={y.start * pxPerDay} y1={0} y2={HEADER_HEIGHT} stroke="#D9D7D3" />
        </g>
      ))}
      {months.map((m, idx) => (
        <g key={idx}>
          <line x1={m.start * pxPerDay} x2={m.start * pxPerDay} y1={26} y2={HEADER_HEIGHT} stroke="#E5E3DF" />
          {m.len * pxPerDay > 30 && (
            <text x={m.start * pxPerDay + (m.len * pxPerDay) / 2} y={47} textAnchor="middle" fontSize="11.5" fill="#2A2825" fontWeight="600">{m.label}</text>
          )}
        </g>
      ))}
      <line x1={0} x2={contentWidth} y1={HEADER_HEIGHT - 0.5} y2={HEADER_HEIGHT - 0.5} stroke="#D9D7D3" />
    </svg>
  );
}

/* ------------------------------- The Gantt chart ------------------------------- */
function Gantt({ tasks, scale = 'day', onTaskClick, scrollRef, sidebarRef, contentRef }) {
  const { todayISO, parseISO, fmtDateBR, diffDays } = window.CronosStore;
  const today = todayISO();

  const { startD, totalDays, pxPerDay } = useGanttMemo(() => computeExtents(tasks, scale), [tasks, scale]);
  const contentWidth = totalDays * pxPerDay;
  const chartHeight = Math.max(tasks.length, 4) * ROW_HEIGHT + 8;

  // Scroll to today on first render / scale change
  const localScrollRef = useGanttRef(null);
  const scrollerRef = scrollRef || localScrollRef;
  useGanttEffect(() => {
    if (!scrollerRef.current) return;
    const todayIdx = dayIndex(parseISO(today), startD);
    const targetX = Math.max(0, todayIdx * pxPerDay - 240);
    scrollerRef.current.scrollLeft = targetX;
  }, [scale, startD.getTime(), tasks.length]);

  // Sync scroll between sidebar and chart vertically (achieved via shared parent container)

  return (
    <div className="flex border border-ink-200 rounded-xl2 overflow-hidden bg-white shadow-card">
      {/* Sidebar: task list - SVG-based for reliable rendering in html2canvas */}
      <div className="shrink-0 border-r border-ink-200 bg-white" style={{ width: SIDEBAR_WIDTH }} ref={sidebarRef}>
        <div className="h-[56px] border-b border-ink-200 flex items-center px-4 bg-ink-50/60">
          <span className="text-[11.5px] font-semibold tracking-[0.08em] text-ink-500 uppercase">Etapas</span>
          <span className="ml-auto text-[11.5px] text-ink-400 font-medium">{tasks.length}</span>
        </div>
        {tasks.length === 0 ? (
          <div className="px-4 py-6 text-[13px] text-ink-400">Nenhuma etapa cadastrada.</div>
        ) : (
          <svg width={SIDEBAR_WIDTH} height={tasks.length * ROW_HEIGHT + 1} className="block"
               style={{ fontFamily: 'Manrope, ui-sans-serif, system-ui, sans-serif' }}>
            {tasks.map((t, i) => {
              const y = i * ROW_HEIGHT;
              const status = STATUS_FILLS[t.status] || STATUS_FILLS.not_started;
              const name = truncateSVG(t.name || 'Sem nome', 26);
              const owner = truncateSVG(t.owner || '—', 30);
              return (
                <g key={t.id || i} className="cursor-pointer" onClick={() => onTaskClick && onTaskClick(t)}>
                  <rect x={0} y={y} width={SIDEBAR_WIDTH} height={ROW_HEIGHT} fill="white" />
                  <rect x={16} y={y + (ROW_HEIGHT - 20) / 2} width={4} height={20} rx={2} fill={status.fill} />
                  <text x={28} y={y + ROW_HEIGHT / 2 - 2} fontSize="13" fontWeight="600" fill="#2A2825">{name}</text>
                  <text x={28} y={y + ROW_HEIGHT / 2 + 14} fontSize="11" fontWeight="500" fill="#8A857D">{owner}</text>
                  <text x={SIDEBAR_WIDTH - 16} y={y + ROW_HEIGHT / 2 + 4} fontSize="11"
                        fontFamily="JetBrains Mono, ui-monospace, monospace" textAnchor="end" fill="#8A857D">
                    {(t.progress || 0) + '%'}
                  </text>
                  <line x1={0} x2={SIDEBAR_WIDTH} y1={y + ROW_HEIGHT - 0.5} y2={y + ROW_HEIGHT - 0.5} stroke="#EDECEA" />
                </g>
              );
            })}
          </svg>
        )}
      </div>

      {/* Chart: header + body, horizontally scrollable */}
      <div ref={scrollerRef} className="flex-1 overflow-x-auto overflow-y-hidden scroll-thin">
        <div ref={contentRef} style={{ width: contentWidth }}>
          <GanttHeader scale={scale} startD={startD} totalDays={totalDays} pxPerDay={pxPerDay} contentWidth={contentWidth} />

          <svg width={contentWidth} height={chartHeight} className="block">
            {/* weekend stripes (day scale only) */}
            {scale === 'day' && Array.from({ length: totalDays }, (_, k) => {
              const d = new Date(startD.getTime()); d.setUTCDate(d.getUTCDate() + k);
              if (!isWeekend(d)) return null;
              return <rect key={k} x={k * pxPerDay} y={0} width={pxPerDay} height={chartHeight} fill="#F7F5F2" />;
            })}
            {/* month boundary lines (month scale) */}
            {scale === 'month' && (() => {
              const out = [];
              for (let k = 0; k < totalDays; k++) {
                const d = new Date(startD.getTime()); d.setUTCDate(d.getUTCDate() + k);
                if (d.getUTCDate() === 1) out.push(<line key={'mb'+k} x1={k*pxPerDay} x2={k*pxPerDay} y1={0} y2={chartHeight} stroke="#EDECEA" />);
              }
              return out;
            })()}
            {/* vertical grid lines for day/week */}
            {scale === 'day' && Array.from({ length: totalDays + 1 }, (_, k) => (
              <line key={'g'+k} x1={k*pxPerDay} x2={k*pxPerDay} y1={0} y2={chartHeight} stroke="#F1F0EE" />
            ))}
            {scale === 'week' && Array.from({ length: Math.ceil(totalDays/7) + 1 }, (_, w) => (
              <line key={'gw'+w} x1={w*7*pxPerDay} x2={w*7*pxPerDay} y1={0} y2={chartHeight} stroke="#EDECEA" />
            ))}
            {/* row separators */}
            {Array.from({ length: tasks.length }, (_, r) => (
              <line key={'rs'+r} x1={0} x2={contentWidth} y1={(r+1)*ROW_HEIGHT} y2={(r+1)*ROW_HEIGHT} stroke="#F1F0EE" />
            ))}

            {/* Today line */}
            {(() => {
              const t = parseISO(today);
              if (t < startD) return null;
              const idx = dayIndex(t, startD);
              const x = idx * pxPerDay + pxPerDay / 2;
              return (
                <g>
                  <line x1={x} x2={x} y1={0} y2={chartHeight} stroke="#3D0F26" strokeWidth="1.5" strokeDasharray="4 3" opacity="0.7" />
                  <circle cx={x} cy={0} r={4} fill="#3D0F26" />
                </g>
              );
            })()}

            {/* Bars */}
            {tasks.map((task, i) => {
              if (!task.startDate || !task.endDate) return null;
              const s = parseISO(task.startDate);
              const e = parseISO(task.endDate);
              if (e < s) return null;
              const startIdx = dayIndex(s, startD);
              const days = diffDays(task.startDate, task.endDate) + 1;
              const x = startIdx * pxPerDay;
              const w = Math.max(days * pxPerDay, 6);
              const y = i * ROW_HEIGHT + 9;
              const h = 26;
              const status = task.status || 'not_started';
              const palette = STATUS_FILLS[status] || STATUS_FILLS.not_started;
              const progress = Math.max(0, Math.min(100, Number(task.progress) || 0));
              const filled = Math.max(0, (w - 2) * progress / 100);
              const label = task.name || 'Sem nome';
              const labelFitsInside = w > 80 && label.length * 6.5 < w - 16;

              return (
                <g key={task.id || i} className="cursor-pointer" onClick={() => onTaskClick && onTaskClick(task)}>
                  {/* hover hit area */}
                  <rect x={x - 2} y={y - 4} width={w + 4} height={h + 8} fill="transparent">
                    <title>{`${label}\n${fmtDateBR(task.startDate)} → ${fmtDateBR(task.endDate)}\n${progress}% · ${window.CronosStore.STATUS[status]?.label || ''}`}</title>
                  </rect>
                  {/* track (light) */}
                  <rect x={x} y={y} width={w} height={h} rx={6} fill={palette.track} />
                  {/* progress fill */}
                  <rect x={x + 1} y={y + 1} width={filled} height={h - 2} rx={5} fill={palette.fill} />
                  {/* hairline outline */}
                  <rect x={x + 0.5} y={y + 0.5} width={w - 1} height={h - 1} rx={5.5} fill="none" stroke={palette.fill} strokeOpacity="0.35" />
                  {/* label */}
                  {labelFitsInside && (
                    <text x={x + 10} y={y + h/2 + 4} fontSize="12" fontWeight="600"
                          fill={progress > 50 ? 'white' : palette.text}
                          style={{ pointerEvents: 'none' }}>
                      {label}
                    </text>
                  )}
                  {!labelFitsInside && w > 30 && (
                    <text x={x + w + 8} y={y + h/2 + 4} fontSize="12" fontWeight="500" fill="#2A2825" style={{ pointerEvents: 'none' }}>
                      {label}
                    </text>
                  )}
                </g>
              );
            })}
          </svg>
        </div>
      </div>
    </div>
  );
}

Object.assign(window, { Gantt });
