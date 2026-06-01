// Native jsPDF renderer for the Gantt chart.
// Avoids html2canvas entirely — draws shapes and text directly into the PDF
// so text is crisp, selectable, and never clipped.

(function () {
  const STATUS_COLORS = {
    not_started: { fill: [156, 163, 156], track: [241, 240, 238], text: [94, 90, 83] },
    in_progress: { fill: [37, 99, 235],   track: [232, 239, 251], text: [27, 79, 182] },
    done:        { fill: [22, 163, 74],   track: [230, 244, 234], text: [14, 107, 48] },
    late:        { fill: [220, 38, 38],   track: [252, 232, 232], text: [159, 24, 24] },
  };
  const STATUS_LABELS = {
    not_started: 'Não iniciada',
    in_progress: 'Em andamento',
    done:        'Concluída',
    late:        'Atrasada',
  };
  const BRAND = [61, 15, 38];
  const INK_900 = [26, 25, 23];
  const INK_700 = [42, 40, 37];
  const INK_500 = [94, 90, 83];
  const INK_400 = [138, 133, 125];
  const INK_300 = [182, 178, 172];
  const INK_200 = [217, 215, 211];
  const INK_100 = [237, 236, 234];
  const INK_50  = [247, 245, 242];
  const WHITE   = [255, 255, 255];

  const MONTHS_FULL = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
  const MONTHS_SHORT = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
  const DOW = ['D','S','T','Q','Q','S','S'];

  function startOfWeekUTC(d) {
    const dt = new Date(d.getTime());
    const day = dt.getUTCDay();
    const diff = (day === 0 ? -6 : 1 - day);
    dt.setUTCDate(dt.getUTCDate() + diff);
    return dt;
  }
  function startOfMonthUTC(d) { return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1)); }
  function isWeekend(d) { const dow = d.getUTCDay(); return dow === 0 || dow === 6; }
  function diffDaysDates(a, b) { return Math.round((b - a) / 86400000); }

  function computeExtentsPDF(tasks, scale) {
    const { todayISO, parseISO, addDaysISO } = window.CronosStore;
    let starts = tasks.map(t => t.startDate).filter(Boolean);
    let ends   = tasks.map(t => t.endDate).filter(Boolean);
    const today = todayISO();
    if (!starts.length || !ends.length) {
      starts = [addDaysISO(today, -7)];
      ends   = [addDaysISO(today, 21)];
    }
    starts.sort(); ends.sort();
    let minISO = starts[0];
    let maxISO = ends[ends.length - 1];
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
    let alignedStart = parseISO(minISO);
    if (scale === 'week')  alignedStart = startOfWeekUTC(alignedStart);
    if (scale === 'month') alignedStart = startOfMonthUTC(alignedStart);
    let alignedEnd = parseISO(maxISO);
    if (scale === 'week') {
      alignedEnd = startOfWeekUTC(alignedEnd);
      alignedEnd.setUTCDate(alignedEnd.getUTCDate() + 13);
    }
    if (scale === 'month') {
      alignedEnd = new Date(Date.UTC(alignedEnd.getUTCFullYear(), alignedEnd.getUTCMonth() + 2, 0));
    }
    const totalDays = Math.round((alignedEnd - alignedStart) / 86400000) + 1;
    return { startD: alignedStart, endD: alignedEnd, totalDays };
  }

  /* Draw the per-page title block at the top of the page. */
  function drawHeader(pdf, project, pageW, margin) {
    const stats = window.CronosStore.projectStats(project);
    // brand bar
    pdf.setFillColor(...BRAND); pdf.rect(0, 0, pageW, 5, 'F');
    // client
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(8);
    pdf.setTextColor(...BRAND);
    pdf.text((project.client || 'Sem cliente').toUpperCase(), margin, 26);
    // project name
    pdf.setFontSize(16);
    pdf.setTextColor(...INK_900);
    pdf.text(project.name || 'Projeto sem nome', margin, 44);
    // meta line
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(9.5);
    pdf.setTextColor(...INK_500);
    const meta = `${project.owner || '—'}    ·    ${window.CronosStore.fmtDateBR(stats.start)} → ${window.CronosStore.fmtDateBR(stats.end)}    ·    ${stats.progress}% concluído    ·    ${STATUS_LABELS[stats.status]}`;
    pdf.text(meta, margin, 58);
    // GDM wordmark right
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(22);
    pdf.setTextColor(...BRAND);
    pdf.text('gdm_', pageW - margin, 46, { align: 'right' });
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(7);
    pdf.setTextColor(140);
    pdf.text('Cronos · Cronogramas', pageW - margin, 58, { align: 'right' });
    // separator
    pdf.setDrawColor(...INK_200);
    pdf.setLineWidth(0.5);
    pdf.line(margin, 70, pageW - margin, 70);
  }

  function drawFooter(pdf, pageIdx, totalPages, pageW, pageH, margin) {
    pdf.setFont('helvetica','normal');
    pdf.setFontSize(7.5);
    pdf.setTextColor(...INK_400);
    const dateStr = new Date().toLocaleDateString('pt-BR');
    pdf.text(`Cronos · GDM    ·    Gerado em ${dateStr}`, margin, pageH - 16);
    pdf.text(`Página ${pageIdx} de ${totalPages}`, pageW - margin, pageH - 16, { align: 'right' });
  }

  /* Timeline header (months row + day/week/month sub-row) */
  function drawTimelineHeader(pdf, scale, startD, totalDays, pxPerDay, x0, y0, headerH) {
    const topRowH = 18;
    const subRowH = headerH - topRowH;

    // Outer rect & dividers
    pdf.setDrawColor(...INK_200); pdf.setLineWidth(0.4);

    // Find month boundaries
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
      months.push({ start: i, len: j - i, label: `${MONTHS_FULL[monthIndex]} ${year}`, short: MONTHS_SHORT[monthIndex], monthIndex, year });
      i = j;
    }

    // Top row backgrounds + labels
    months.forEach((m, idx) => {
      const mx = x0 + m.start * pxPerDay;
      const mw = m.len * pxPerDay;
      pdf.setFillColor(...(idx % 2 === 0 ? [251, 250, 247] : [244, 242, 238]));
      pdf.rect(mx, y0, mw, topRowH, 'F');
      // month label
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(7.5);
      pdf.setTextColor(...INK_500);
      const text = mw > 80 ? m.label.toUpperCase() : (m.short + '/' + String(m.year).slice(2)).toUpperCase();
      pdf.text(text, mx + 6, y0 + 12);
      // boundary line
      pdf.setDrawColor(...INK_200);
      pdf.line(mx, y0, mx, y0 + headerH);
    });

    // Sub-row
    pdf.setFillColor(...WHITE);
    pdf.rect(x0, y0 + topRowH, totalDays * pxPerDay, subRowH, 'F');

    if (scale === 'day') {
      for (let k = 0; k < totalDays; k++) {
        const d = new Date(startD.getTime()); d.setUTCDate(d.getUTCDate() + k);
        const cx = x0 + k * pxPerDay + pxPerDay / 2;
        if (isWeekend(d)) {
          pdf.setFillColor(...INK_50);
          pdf.rect(x0 + k * pxPerDay, y0 + topRowH, pxPerDay, subRowH, 'F');
        }
        // DOW letter
        pdf.setFont('helvetica', 'normal');
        pdf.setFontSize(6);
        pdf.setTextColor(...INK_400);
        pdf.text(DOW[d.getUTCDay()], cx, y0 + topRowH + 10, { align: 'center' });
        // day number
        pdf.setFont('helvetica', 'bold');
        pdf.setFontSize(8);
        pdf.setTextColor(...INK_900);
        pdf.text(String(d.getUTCDate()), cx, y0 + topRowH + 22, { align: 'center' });
        // boundary line
        if (k > 0) {
          pdf.setDrawColor(...INK_100);
          pdf.line(x0 + k * pxPerDay, y0 + topRowH, x0 + k * pxPerDay, y0 + headerH);
        }
      }
    } else if (scale === 'week') {
      const weeks = Math.ceil(totalDays / 7);
      for (let w = 0; w < weeks; w++) {
        const startDayIdx = w * 7;
        if (startDayIdx >= totalDays) break;
        const d = new Date(startD.getTime()); d.setUTCDate(d.getUTCDate() + startDayIdx);
        const wx = x0 + startDayIdx * pxPerDay;
        const ww = Math.min(7, totalDays - startDayIdx) * pxPerDay;
        pdf.setFont('helvetica', 'normal');
        pdf.setFontSize(6);
        pdf.setTextColor(...INK_400);
        pdf.text('SEM', wx + ww / 2, y0 + topRowH + 10, { align: 'center' });
        pdf.setFont('helvetica', 'bold');
        pdf.setFontSize(7.5);
        pdf.setTextColor(...INK_900);
        pdf.text(`${String(d.getUTCDate()).padStart(2,'0')}/${String(d.getUTCMonth()+1).padStart(2,'0')}`, wx + ww / 2, y0 + topRowH + 22, { align: 'center' });
        pdf.setDrawColor(...INK_200);
        pdf.line(wx, y0 + topRowH, wx, y0 + headerH);
      }
    } else {
      // month scale: sub-row shows day numbers every 5 days? actually just the month abbreviation in larger size
      // Already labeled in top row. Just draw boundary lines.
      months.forEach(m => {
        const mx = x0 + m.start * pxPerDay;
        const mw = m.len * pxPerDay;
        if (mw > 22) {
          pdf.setFont('helvetica', 'bold');
          pdf.setFontSize(8);
          pdf.setTextColor(...INK_700);
          pdf.text(m.short, mx + mw / 2, y0 + topRowH + 16, { align: 'center' });
        }
      });
    }

    // Bottom border line
    pdf.setDrawColor(...INK_200);
    pdf.line(x0, y0 + headerH, x0 + totalDays * pxPerDay, y0 + headerH);
  }

  /* One row in the sidebar */
  function drawSidebarRow(pdf, task, x, y, w, h) {
    const status = STATUS_COLORS[task.status] || STATUS_COLORS.not_started;
    // Row separator (bottom)
    pdf.setDrawColor(...INK_100);
    pdf.setLineWidth(0.3);
    pdf.line(x, y + h, x + w, y + h);
    // Status strip
    pdf.setFillColor(...status.fill);
    const stripH = Math.min(14, h - 8);
    pdf.roundedRect(x + 8, y + (h - stripH) / 2, 2.5, stripH, 1, 1, 'F');
    // Task name
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(9);
    pdf.setTextColor(...INK_900);
    const name = ellipsize(pdf, task.name || 'Sem nome', w - 24 - 30);
    pdf.text(name, x + 16, y + h / 2 - 1);
    // Owner
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(7.5);
    pdf.setTextColor(...INK_400);
    const owner = ellipsize(pdf, task.owner || '—', w - 24 - 30);
    pdf.text(owner, x + 16, y + h / 2 + 9);
    // Progress
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(7.5);
    pdf.setTextColor(...INK_400);
    pdf.text((task.progress || 0) + '%', x + w - 8, y + h / 2 + 3, { align: 'right' });
  }

  function ellipsize(pdf, s, maxW) {
    if (!s) return '';
    const w = pdf.getTextWidth(s);
    if (w <= maxW) return s;
    let lo = 0, hi = s.length;
    while (lo < hi) {
      const mid = Math.floor((lo + hi) / 2);
      const candidate = s.slice(0, mid) + '…';
      if (pdf.getTextWidth(candidate) <= maxW) lo = mid + 1;
      else hi = mid;
    }
    return s.slice(0, Math.max(1, lo - 1)) + '…';
  }

  /* Chart row: bar + label */
  function drawChartRow(pdf, task, startD, pxPerDay, x0, y, areaW, rowH, totalDays) {
    if (!task.startDate || !task.endDate) return;
    const { parseISO, diffDays } = window.CronosStore;
    const s = parseISO(task.startDate);
    const e = parseISO(task.endDate);
    if (e < s) return;
    const startIdx = Math.round((s - startD) / 86400000);
    const days = diffDays(task.startDate, task.endDate) + 1;
    // Clip to visible timeline area
    const startClipped = Math.max(0, startIdx);
    const endClipped = Math.min(totalDays, startIdx + days);
    if (endClipped <= 0 || startClipped >= totalDays) return;
    const x = x0 + startClipped * pxPerDay;
    const wRaw = (endClipped - startClipped) * pxPerDay;
    const w = Math.max(wRaw, 3);
    const barH = Math.min(16, rowH - 12);
    const barY = y + (rowH - barH) / 2;
    const status = STATUS_COLORS[task.status] || STATUS_COLORS.not_started;
    const progress = Math.max(0, Math.min(100, Number(task.progress) || 0));

    // Track
    pdf.setFillColor(...status.track);
    pdf.roundedRect(x, barY, w, barH, 3, 3, 'F');
    // Filled progress
    if (progress > 0) {
      const fillW = Math.max(0, (w - 1) * progress / 100);
      pdf.setFillColor(...status.fill);
      pdf.roundedRect(x + 0.5, barY + 0.5, fillW, barH - 1, 2.5, 2.5, 'F');
    }
    // Bar label
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(7.5);
    const label = task.name || 'Sem nome';
    const labelWidth = pdf.getTextWidth(label);
    if (w >= labelWidth + 12) {
      // inside the bar
      pdf.setTextColor(...(progress > 55 ? WHITE : status.text));
      pdf.text(label, x + 6, barY + barH / 2 + 2.5);
    } else if (areaW - (x + w) > labelWidth + 8) {
      // to the right of the bar
      pdf.setTextColor(...INK_700);
      pdf.text(label, x + w + 5, barY + barH / 2 + 2.5);
    }
    // tiny percentage at right end if room
    if (w > 30) {
      const pctText = progress + '%';
      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(6.5);
      pdf.setTextColor(...(progress > 55 ? [255,255,255] : INK_500));
      const pctW = pdf.getTextWidth(pctText);
      if (pctW + 12 < w) pdf.text(pctText, x + w - 4, barY + barH / 2 + 2.5, { align: 'right' });
    }
  }

  /* Today line */
  function drawTodayLine(pdf, startD, totalDays, pxPerDay, x0, yTop, yBottom) {
    const { todayISO, parseISO } = window.CronosStore;
    const t = parseISO(todayISO());
    if (t < startD) return;
    const idx = Math.round((t - startD) / 86400000);
    if (idx >= totalDays) return;
    const x = x0 + idx * pxPerDay + pxPerDay / 2;
    pdf.setDrawColor(...BRAND);
    pdf.setLineWidth(0.8);
    pdf.setLineDashPattern([2, 2], 0);
    pdf.line(x, yTop, x, yBottom);
    pdf.setLineDashPattern([], 0);
    pdf.setFillColor(...BRAND);
    pdf.circle(x, yTop, 1.5, 'F');
    // "Hoje" label
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(6.5);
    pdf.setTextColor(...BRAND);
    pdf.text('HOJE', x, yTop - 3, { align: 'center' });
  }

  /* Legend */
  function drawLegend(pdf, x, y, pageW, margin) {
    const items = [
      { color: STATUS_COLORS.not_started.fill, label: 'Não iniciada' },
      { color: STATUS_COLORS.in_progress.fill, label: 'Em andamento' },
      { color: STATUS_COLORS.done.fill,        label: 'Concluída' },
      { color: STATUS_COLORS.late.fill,        label: 'Atrasada' },
    ];
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(7.5);
    let cx = x;
    items.forEach(it => {
      pdf.setFillColor(...it.color);
      pdf.roundedRect(cx, y - 5, 7, 7, 1.5, 1.5, 'F');
      pdf.setTextColor(...INK_500);
      pdf.text(it.label, cx + 11, y);
      cx += pdf.getTextWidth(it.label) + 26;
    });
    // today indicator
    pdf.setDrawColor(...BRAND);
    pdf.setLineWidth(1);
    pdf.setLineDashPattern([1.5, 1.5], 0);
    pdf.line(cx, y - 1.5, cx + 12, y - 1.5);
    pdf.setLineDashPattern([], 0);
    pdf.setTextColor(...INK_500);
    pdf.text('Hoje', cx + 16, y);
  }

  function formatDatePDF(d) {
    const dd = String(d.getUTCDate()).padStart(2, '0');
    const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
    return `${dd}/${mm}/${d.getUTCFullYear()}`;
  }

  /* Render one "band section" — a slice of the timeline showing the given tasks
     for the given band's date range. Returns the height consumed. */
  function renderBandSection(pdf, project, scale, section, chartLeft, yTop, sidebarW, timelineWidth, titleH, headerH, rowH) {
    const { band, tasks, rowChunkIdx, rowChunkTotal } = section;
    const timelineLeft = chartLeft + sidebarW;
    const chartRight = chartLeft + sidebarW + timelineWidth;

    // Title row above the band: date range (left) + "Período X de Y" (right)
    const bandEndDate = new Date(band.startD.getTime());
    bandEndDate.setUTCDate(bandEndDate.getUTCDate() + band.days - 1);
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(7.5);
    pdf.setTextColor(...INK_500);
    pdf.text(`${formatDatePDF(band.startD)}  →  ${formatDatePDF(bandEndDate)}`, chartLeft, yTop + 9);

    const periodParts = [];
    if (band.total > 1) periodParts.push(`Período ${band.idx} de ${band.total}`);
    if (rowChunkTotal > 1) periodParts.push(`Etapas ${rowChunkIdx + 1}/${rowChunkTotal}`);
    if (periodParts.length) {
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(7);
      pdf.setTextColor(...BRAND);
      pdf.text(periodParts.join('    ·    ').toUpperCase(), chartRight, yTop + 9, { align: 'right' });
    }

    const headerY = yTop + titleH;
    const rowsY = headerY + headerH;
    const rowsH = tasks.length * rowH;
    const rowsBottom = rowsY + rowsH;

    // Sidebar header
    pdf.setFillColor(...INK_50);
    pdf.rect(chartLeft, headerY, sidebarW, headerH, 'F');
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(7);
    pdf.setTextColor(...INK_500);
    pdf.text('ETAPAS', chartLeft + 10, headerY + headerH / 2 + 2.5);
    pdf.text(`${tasks.length}`, timelineLeft - 10, headerY + headerH / 2 + 2.5, { align: 'right' });

    // Timeline header
    drawTimelineHeader(pdf, scale, band.startD, band.days, band.pxPerDay, timelineLeft, headerY, headerH);

    // Weekend stripes (day scale only)
    if (scale === 'day' && rowsH > 0) {
      for (let k = 0; k < band.days; k++) {
        const d = new Date(band.startD.getTime()); d.setUTCDate(d.getUTCDate() + k);
        if (isWeekend(d)) {
          pdf.setFillColor(247, 245, 242);
          pdf.rect(timelineLeft + k * band.pxPerDay, rowsY, band.pxPerDay, rowsH, 'F');
        }
      }
    }

    // Gridlines
    if (rowsH > 0) {
      pdf.setDrawColor(...INK_100); pdf.setLineWidth(0.2);
      if (scale === 'day') {
        for (let k = 1; k < band.days; k++) {
          const gx = timelineLeft + k * band.pxPerDay;
          pdf.line(gx, rowsY, gx, rowsBottom);
        }
      } else if (scale === 'week') {
        for (let w = 1; w * 7 < band.days; w++) {
          const gx = timelineLeft + w * 7 * band.pxPerDay;
          pdf.line(gx, rowsY, gx, rowsBottom);
        }
      } else {
        for (let k = 0; k < band.days; k++) {
          const d = new Date(band.startD.getTime()); d.setUTCDate(d.getUTCDate() + k);
          if (d.getUTCDate() === 1 && k > 0) {
            const gx = timelineLeft + k * band.pxPerDay;
            pdf.line(gx, rowsY, gx, rowsBottom);
          }
        }
      }
    }

    // Rows
    tasks.forEach((t, i) => {
      const y = rowsY + i * rowH;
      if (i % 2 === 1) {
        pdf.setFillColor(252, 251, 249);
        pdf.rect(chartLeft, y, sidebarW + timelineWidth, rowH, 'F');
      }
      drawSidebarRow(pdf, t, chartLeft, y, sidebarW, rowH);
      drawChartRow(pdf, t, band.startD, band.pxPerDay, timelineLeft, y, timelineWidth, rowH, band.days);
      pdf.setDrawColor(...INK_100); pdf.setLineWidth(0.2);
      pdf.line(timelineLeft, y + rowH, chartRight, y + rowH);
    });

    if (!tasks.length) {
      pdf.setFont('helvetica', 'italic');
      pdf.setFontSize(9);
      pdf.setTextColor(...INK_400);
      pdf.text('Nenhuma etapa cadastrada.', chartLeft + 10, rowsY + 20);
    }

    // Today line (only if today falls inside band's date range)
    if (rowsH > 0) {
      drawTodayLine(pdf, band.startD, band.days, band.pxPerDay, timelineLeft, rowsY, rowsBottom);
    }

    // Outer frame + sidebar divider
    pdf.setDrawColor(...INK_200); pdf.setLineWidth(0.5);
    pdf.rect(chartLeft, headerY, sidebarW + timelineWidth, headerH + rowsH, 'S');
    pdf.line(timelineLeft, headerY, timelineLeft, rowsBottom);
  }

  /* Main export function — splits timeline into bands and packs them onto pages. */
  async function exportGanttPDF(project, scale = 'day') {
    const { jsPDF } = window.jspdf;
    const pdf = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4', compress: true });
    const pageW = pdf.internal.pageSize.getWidth();   // 842pt
    const pageH = pdf.internal.pageSize.getHeight();  // 595pt
    const MARGIN = 32;

    // Layout constants — keep proportions/fonts consistent with previous PDF.
    const PROJECT_HEADER_H = 76;
    const LEGEND_H = 22;
    const BAND_TITLE_H = 16;
    const TIMELINE_HEADER_H = 42;
    const ROW_H = 28;
    const BAND_GAP = 18;
    const FOOTER_RESERVE = 22;
    const SIDEBAR_W = 188;

    const chartLeft = MARGIN;
    const chartRight = pageW - MARGIN;
    const timelineLeft = chartLeft + SIDEBAR_W;
    const timelineWidth = chartRight - timelineLeft;

    const tasks = (project.tasks || []).slice();
    const { startD: extentStart, totalDays: extentDays } = computeExtentsPDF(tasks, scale);

    // Build time bands. Max days per band depends on scale so bars stay legible.
    const MAX_DAYS_PER_BAND = scale === 'day' ? 28 : scale === 'week' ? 42 : 90;
    const bands = [];
    let cursor = 0;
    while (cursor < extentDays) {
      let days = Math.min(MAX_DAYS_PER_BAND, extentDays - cursor);
      // Snap to weekly boundary for week scale to avoid mid-week splits
      if (scale === 'week' && (cursor + days) < extentDays) {
        days = Math.max(7, Math.floor(days / 7) * 7);
      }
      const bandStart = new Date(extentStart.getTime());
      bandStart.setUTCDate(bandStart.getUTCDate() + cursor);
      bands.push({
        startD: bandStart,
        days,
        pxPerDay: timelineWidth / days,
      });
      cursor += days;
    }
    if (!bands.length) {
      bands.push({ startD: extentStart, days: Math.max(1, extentDays), pxPerDay: timelineWidth / Math.max(1, extentDays) });
    }
    bands.forEach((b, i) => { b.idx = i + 1; b.total = bands.length; });

    // Layout calculations: how much room each kind of page has
    const pageBottom = pageH - MARGIN - FOOTER_RESERVE;
    const page1Top = MARGIN + PROJECT_HEADER_H + LEGEND_H + 8; // after big header + legend
    const pageNTop = MARGIN + 8;                                // small top margin only
    const availPageN = pageBottom - pageNTop;

    // If a full section (all rows) won't fit on a fresh page, paginate the rows too.
    const fullSectionH = BAND_TITLE_H + TIMELINE_HEADER_H + (tasks.length || 1) * ROW_H;
    let rowsPerSection = tasks.length || 1;
    if (fullSectionH > availPageN) {
      rowsPerSection = Math.max(1, Math.floor((availPageN - BAND_TITLE_H - TIMELINE_HEADER_H) / ROW_H));
    }

    // Build the flat list of sections to render
    const numRowChunks = Math.max(1, Math.ceil((tasks.length || 1) / rowsPerSection));
    const sections = [];
    for (let bi = 0; bi < bands.length; bi++) {
      for (let rc = 0; rc < numRowChunks; rc++) {
        const startRow = rc * rowsPerSection;
        const endRow = Math.min(tasks.length, startRow + rowsPerSection);
        sections.push({
          band: bands[bi],
          tasks: tasks.slice(startRow, endRow),
          rowChunkIdx: rc,
          rowChunkTotal: numRowChunks,
        });
      }
    }

    // Pack sections onto pages
    let cursorY = page1Top;
    let isFirstSection = true;

    for (const section of sections) {
      const sectionH = BAND_TITLE_H + TIMELINE_HEADER_H + section.tasks.length * ROW_H;

      if (isFirstSection) {
        // First page: draw the project header + legend, place first section after it
        drawHeader(pdf, project, pageW, MARGIN);
        drawLegend(pdf, MARGIN, PROJECT_HEADER_H + 14, pageW, MARGIN);
        cursorY = page1Top;
        isFirstSection = false;
      } else if (cursorY + sectionH > pageBottom) {
        // No room on current page — new page (no big header on subsequent pages)
        pdf.addPage();
        cursorY = pageNTop;
      }

      renderBandSection(pdf, project, scale, section, chartLeft, cursorY, SIDEBAR_W, timelineWidth, BAND_TITLE_H, TIMELINE_HEADER_H, ROW_H);
      cursorY += sectionH + BAND_GAP;
    }

    // Footers on every page
    const totalPages = pdf.internal.getNumberOfPages();
    for (let p = 1; p <= totalPages; p++) {
      pdf.setPage(p);
      drawFooter(pdf, p, totalPages, pageW, pageH, MARGIN);
    }

    const safeName = (project.name || 'projeto').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    pdf.save(`cronograma-${safeName}.pdf`);
  }

  window.exportGanttPDF = exportGanttPDF;
})();
