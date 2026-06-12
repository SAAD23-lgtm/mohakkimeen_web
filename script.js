const DATA = window.DASHBOARD_DATA;

const palette = ["#14b8a6", "#6366f1", "#f59e0b", "#ef4444", "#22c55e", "#06b6d4", "#a855f7", "#f97316"];
const ratingOrder = ["مناسب جدًا", "مناسب", "مناسب إلى حد ما", "غير مناسب", "غير محدد"];
const scoreMap = { "مناسب جدًا": 3, "مناسب": 2, "مناسب إلى حد ما": 1, "غير مناسب": 0 };
let currentSort = "desc";

const $ = (selector, scope = document) => scope.querySelector(selector);
const $$ = (selector, scope = document) => Array.from(scope.querySelectorAll(selector));

const els = {
  loader: $("#pageLoader"),
  sidebarResponses: $("#sidebarResponses"),
  dataSource: $("#dataSource"),
  generatedAt: $("#generatedAt"),
  excludedRows: $("#excludedRows"),
  heroRing: $("#heroRing"),
  heroScore: $("#heroScore"),
  topScoreMini: $("#topScoreMini"),
  lowScoreMini: $("#lowScoreMini"),
  kpiGrid: $("#kpiGrid"),
  questionSelect: $("#questionSelect"),
  experienceFilter: $("#experienceFilter"),
  searchInput: $("#searchInput"),
  resetFiltersBtn: $("#resetFiltersBtn"),
  mainCharts: $("#mainCharts"),
  questionBars: $("#questionBars"),
  questionCards: $("#questionCards"),
  serialTableBody: $("#serialTableBody"),
  filteredCount: $("#filteredCount"),
  commentsGrid: $("#commentsGrid"),
  exportCsvBtn: $("#exportCsvBtn"),
  printBtn: $("#printBtn"),
  scrollTopBtn: $("#scrollTopBtn"),
  sidebar: $("#dashboardSidebar"),
  mobileMenuBtn: $("#mobileMenuBtn"),
  mobileOverlay: $("#mobileOverlay"),
  sidebarCloseBtn: $("#sidebarCloseBtn"),
  mobilePrintBtn: $("#mobilePrintBtn")
};

function truncate(text = "", max = 94) {
  const value = String(text || "");
  return value.length > max ? `${value.slice(0, max)}...` : value;
}

function totalOfCounts(counts = {}) {
  return Object.values(counts).reduce((sum, value) => sum + Number(value || 0), 0);
}

function sortCounts(counts = {}, preferredOrder = null) {
  const entries = Object.entries(counts).filter(([, value]) => Number(value) > 0);
  if (!preferredOrder) return entries.sort((a, b) => b[1] - a[1]);
  return entries.sort((a, b) => {
    const ai = preferredOrder.includes(a[0]) ? preferredOrder.indexOf(a[0]) : 999;
    const bi = preferredOrder.includes(b[0]) ? preferredOrder.indexOf(b[0]) : 999;
    return ai === bi ? b[1] - a[1] : ai - bi;
  });
}

function countBy(records, getter) {
  return records.reduce((acc, record) => {
    const key = getter(record) || "غير محدد";
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});
}

function countsForQuestion(records, question) {
  return records.reduce((acc, record) => {
    const answer = record.ratings?.[question] || "غير محدد";
    acc[answer] = (acc[answer] || 0) + 1;
    return acc;
  }, {});
}

function averageForRecord(record) {
  const values = Object.values(record.ratings || {});
  if (!values.length) return 0;
  const sum = values.reduce((acc, value) => acc + (scoreMap[value] ?? 0), 0);
  return Math.round((sum / values.length) / 3 * 1000) / 10;
}

function overallPercent(records = DATA.records) {
  const values = [];
  records.forEach(record => Object.values(record.ratings || {}).forEach(answer => values.push(scoreMap[answer] ?? 0)));
  if (!values.length) return 0;
  const avg = values.reduce((sum, value) => sum + value, 0) / values.length;
  return Math.round((avg / 3) * 1000) / 10;
}

function filteredRecords() {
  const exp = els.experienceFilter.value;
  const search = (els.searchInput.value || "").trim().toLowerCase();
  return DATA.records.filter(record => {
    const expOk = exp === "all" || record.experience === exp;
    const text = `${record.comment || ""} ${record.general || ""} ${record.experience || ""}`.toLowerCase();
    const searchOk = !search || text.includes(search);
    return expOk && searchOk;
  });
}

function animateNumber(element, to, suffix = "", decimals = 0) {
  const start = 0;
  const duration = 900;
  const t0 = performance.now();
  function frame(now) {
    const p = Math.min((now - t0) / duration, 1);
    const eased = 1 - Math.pow(1 - p, 3);
    const value = start + (to - start) * eased;
    element.textContent = `${value.toFixed(decimals)}${suffix}`;
    if (p < 1) requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}

function donutChart(counts, options = {}) {
  const entries = sortCounts(counts, options.order);
  const total = totalOfCounts(counts);
  const size = options.size || 180;
  const stroke = options.stroke || 22;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  let offset = 0;

  const segments = entries.map(([label, value], index) => {
    const ratio = total ? value / total : 0;
    const dash = ratio * circumference;
    const color = palette[index % palette.length];
    const segment = `
      <circle class="donut-segment" cx="${size / 2}" cy="${size / 2}" r="${radius}" fill="none"
        stroke="${color}" stroke-width="${stroke}" stroke-linecap="round"
        stroke-dasharray="${dash} ${circumference - dash}" stroke-dashoffset="${-offset}"
        data-label="${label}" data-value="${value}"></circle>`;
    offset += dash;
    return segment;
  }).join("");

  const centerTitle = options.center || total;
  const centerSub = options.sub || "إجمالي";
  return `
    <svg class="donut-svg" viewBox="0 0 ${size} ${size}" role="img" aria-label="${options.title || "Pie Chart"}">
      <circle class="donut-track" cx="${size / 2}" cy="${size / 2}" r="${radius}" fill="none" stroke-width="${stroke}"></circle>
      ${segments}
      <text class="donut-center-title" x="50%" y="46%" text-anchor="middle">${centerTitle}</text>
      <text class="donut-center-sub" x="50%" y="61%" text-anchor="middle">${centerSub}</text>
    </svg>`;
}

function legend(counts, preferredOrder = null) {
  const entries = sortCounts(counts, preferredOrder);
  const total = totalOfCounts(counts);
  if (!entries.length) return `<div class="empty-state">لا توجد بيانات</div>`;
  return `<div class="legend">${entries.map(([label, value], index) => {
    const percent = total ? ((value / total) * 100).toFixed(1) : 0;
    return `
      <div class="legend-row">
        <span class="legend-name"><i class="legend-dot" style="background:${palette[index % palette.length]}"></i>${label}</span>
        <span class="legend-value">${value} · ${percent}%</span>
      </div>`;
  }).join("")}</div>`;
}

function chartCard({ title, badge, counts, order, featured = false, center, sub }) {
  return `
    <article class="chart-card ${featured ? "featured" : ""}">
      <div class="chart-head">
        <h4>${title}</h4>
        <span>${badge}</span>
      </div>
      <div class="donut-layout">
        ${donutChart(counts, { order, size: featured ? 224 : 172, stroke: featured ? 25 : 22, center, sub, title })}
        ${legend(counts, order)}
      </div>
    </article>`;
}

function initMeta() {
  const overall = overallPercent();
  els.sidebarResponses.textContent = DATA.meta.totalResponses;
  els.dataSource.textContent = DATA.meta.source || "—";
  els.generatedAt.textContent = DATA.meta.generatedAt || "—";
  els.excludedRows.textContent = DATA.meta.excludedRows;
  els.topScoreMini.textContent = `${DATA.stats.topQuestion?.percent || 0}%`;
  els.lowScoreMini.textContent = `${DATA.stats.lowestQuestion?.percent || 0}%`;
  els.heroRing.style.setProperty("--score", `${overall}%`);
  animateNumber(els.heroScore, overall, "%", 1);
}

function renderKpis() {
  const overall = overallPercent();
  const cards = [
    { label: "إجمالي الردود", value: DATA.meta.totalResponses, suffix: "", hint: `تم استبعاد ${DATA.meta.excludedRows} صف غير مكتمل`, color: "#14b8a6" },
    { label: "متوسط الملاءمة", value: overall, suffix: "%", hint: "متوسط كل تقييمات الأسئلة", color: "#6366f1", decimals: 1 },
    { label: "أكثر خبرة متكررة", text: DATA.stats.topExperience || "—", hint: "أعلى فئة خبرة في الردود", color: "#f59e0b" },
    { label: "الرأي العام", text: DATA.stats.mainGeneral || "—", hint: "الرأي المتكرر بين المحكمين", color: "#22c55e" },
    { label: "أعلى سؤال", value: DATA.stats.topQuestion?.percent || 0, suffix: "%", hint: truncate(DATA.stats.topQuestion?.question, 78), color: "#06b6d4", decimals: 1 },
    { label: "أقل سؤال", value: DATA.stats.lowestQuestion?.percent || 0, suffix: "%", hint: truncate(DATA.stats.lowestQuestion?.question, 78), color: "#ef4444", decimals: 1 },
    { label: "عدد أسئلة التقييم", value: DATA.ratingQuestions.length, suffix: "", hint: "أسئلة تم تحليلها في الداشبورد", color: "#a855f7" },
    { label: "إجمالي التقييمات", value: totalOfCounts(DATA.stats.allRatingCounts), suffix: "", hint: "عدد الإجابات داخل أسئلة التقييم", color: "#f97316" }
  ];

  els.kpiGrid.innerHTML = cards.map((card, index) => `
    <article class="kpi-card" style="--card-color:${card.color}">
      <span>${card.label}</span>
      <strong class="kpi-value" data-index="${index}">${card.text ?? "0"}</strong>
      <small>${card.hint}</small>
    </article>
  `).join("");

  cards.forEach((card, index) => {
    if (card.text) return;
    const el = $(`.kpi-value[data-index="${index}"]`);
    animateNumber(el, card.value, card.suffix, card.decimals || 0);
  });
}

function initFilters() {
  els.questionSelect.innerHTML = DATA.ratingQuestions.map((q, index) => `<option value="${q}">سؤال ${index + 1}: ${truncate(q, 75)}</option>`).join("");
  const experienceOptions = Object.keys(DATA.stats.experienceCounts || {}).map(exp => `<option value="${exp}">${exp}</option>`).join("");
  els.experienceFilter.innerHTML = `<option value="all">كل سنوات الخبرة</option>${experienceOptions}`;
}

function renderMainCharts() {
  const records = filteredRecords();
  const selectedQuestion = els.questionSelect.value || DATA.ratingQuestions[0];
  const allRatingCounts = {};
  records.forEach(record => Object.values(record.ratings || {}).forEach(answer => {
    allRatingCounts[answer] = (allRatingCounts[answer] || 0) + 1;
  }));
  const experienceCounts = countBy(records, r => r.experience);
  const generalCounts = countBy(records, r => r.general);
  const selectedCounts = countsForQuestion(records, selectedQuestion);
  const selectedStat = DATA.stats.questionStats.find(item => item.question === selectedQuestion);

  els.mainCharts.innerHTML = [
    chartCard({ title: "توزيع جميع التقييمات", badge: `${totalOfCounts(allRatingCounts)} تقييم`, counts: allRatingCounts, order: ratingOrder }),
    chartCard({ title: "سنوات الخبرة", badge: `${totalOfCounts(experienceCounts)} محكم`, counts: experienceCounts }),
    chartCard({ title: "الرأي العام", badge: `${totalOfCounts(generalCounts)} رأي`, counts: generalCounts }),
    chartCard({ title: `السؤال المختار: ${selectedQuestion}`, badge: `${selectedStat?.percent || 0}%`, counts: selectedCounts, order: ratingOrder, featured: true, center: `${selectedStat?.percent || 0}%`, sub: "ملاءمة" })
  ].join("");
}

function renderSeries() {
  let stats = [...DATA.stats.questionStats];
  if (currentSort === "desc") stats.sort((a, b) => b.percent - a.percent);
  if (currentSort === "asc") stats.sort((a, b) => a.percent - b.percent);

  els.questionBars.innerHTML = stats.map((item) => {
    const originalIndex = DATA.ratingQuestions.indexOf(item.question) + 1;
    return `
      <div class="bar-row">
        <div class="bar-label"><span class="question-index">${originalIndex}</span>${item.question}</div>
        <div class="bar-track"><div class="bar-fill" data-width="${item.percent}"></div></div>
        <div class="bar-value">${item.percent}%</div>
      </div>`;
  }).join("");

  requestAnimationFrame(() => {
    $$(".bar-fill", els.questionBars).forEach(bar => {
      bar.style.width = `${bar.dataset.width}%`;
    });
  });
}

function renderQuestionCards() {
  els.questionCards.innerHTML = DATA.stats.questionStats.map((item, index) => `
    <article class="chart-card question-card">
      <div class="chart-head">
        <h4><span class="question-index">${index + 1}</span>${item.question}</h4>
        <span>${item.percent}%</span>
      </div>
      <div class="donut-layout">
        ${donutChart(item.counts, { order: ratingOrder, size: 138, stroke: 18, center: `${item.percent}%`, sub: "ملاءمة", title: `سؤال ${index + 1}` })}
        ${legend(item.counts, ratingOrder)}
      </div>
    </article>
  `).join("");
}

function renderTable() {
  const records = filteredRecords();
  els.filteredCount.textContent = `${records.length} رد ظاهر`;
  if (!records.length) {
    els.serialTableBody.innerHTML = `<tr><td colspan="6"><div class="empty-state">لا توجد نتائج مطابقة للفلاتر الحالية.</div></td></tr>`;
    return;
  }
  els.serialTableBody.innerHTML = records.map(record => `
    <tr>
      <td data-label="Serial"><span class="serial-pill">${record.serial}</span></td>
      <td data-label="التاريخ">${record.timestamp || "—"}</td>
      <td data-label="سنوات الخبرة">${record.experience || "—"}</td>
      <td data-label="متوسط التقييم"><span class="score-chip">${averageForRecord(record)}%</span></td>
      <td data-label="الرأي العام"><span class="general-chip">${record.general || "—"}</span></td>
      <td data-label="التعليق">${record.comment || "—"}</td>
    </tr>
  `).join("");
}

function renderComments() {
  const ignored = new Set(["لايوجد", "لا يوجد", "لايوجد.", "لا يوجد.", "-"]);
  const records = filteredRecords().filter(record => record.comment && !ignored.has(record.comment.trim()));
  if (!records.length) {
    els.commentsGrid.innerHTML = `<div class="empty-state">لا توجد تعليقات مقترحة بعد الفلترة الحالية.</div>`;
    return;
  }
  els.commentsGrid.innerHTML = records.map(record => `
    <article class="comment-card">
      <header><strong>#${record.serial}</strong><span>${record.experience || "—"}</span></header>
      <p>${record.comment}</p>
    </article>
  `).join("");
}

function renderFilteredSections() {
  renderMainCharts();
  renderTable();
  renderComments();
}

function exportCsv() {
  const records = filteredRecords();
  const rows = [
    ["Serial", "Timestamp", "Experience", "Average Score", "General Opinion", "Comment"],
    ...records.map(record => [record.serial, record.timestamp, record.experience, averageForRecord(record), record.general, record.comment])
  ];
  const csv = rows.map(row => row.map(cell => `"${String(cell ?? "").replace(/"/g, '""')}"`).join(",")).join("\n");
  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "mohakkimeen-dashboard-filtered.csv";
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function openMobileMenu() {
  document.body.classList.add("menu-open");
  els.mobileMenuBtn?.setAttribute("aria-expanded", "true");
}

function closeMobileMenu() {
  document.body.classList.remove("menu-open");
  els.mobileMenuBtn?.setAttribute("aria-expanded", "false");
}

function setupInteractions() {
  els.questionSelect.addEventListener("change", renderFilteredSections);
  els.experienceFilter.addEventListener("change", renderFilteredSections);
  els.searchInput.addEventListener("input", renderFilteredSections);
  els.resetFiltersBtn.addEventListener("click", () => {
    els.questionSelect.selectedIndex = 0;
    els.experienceFilter.value = "all";
    els.searchInput.value = "";
    renderFilteredSections();
  });
  els.exportCsvBtn.addEventListener("click", exportCsv);
  els.printBtn.addEventListener("click", () => window.print());
  els.mobilePrintBtn?.addEventListener("click", () => window.print());
  els.mobileMenuBtn?.addEventListener("click", openMobileMenu);
  els.sidebarCloseBtn?.addEventListener("click", closeMobileMenu);
  els.mobileOverlay?.addEventListener("click", closeMobileMenu);
  $$(".nav-link").forEach(link => link.addEventListener("click", closeMobileMenu));
  window.addEventListener("keydown", (event) => {
    if (event.key === "Escape") closeMobileMenu();
  });
  window.addEventListener("resize", () => {
    if (window.innerWidth > 900) closeMobileMenu();
  }, { passive: true });

  $$(".chip-button").forEach(button => {
    button.addEventListener("click", () => {
      $$(".chip-button").forEach(btn => btn.classList.remove("active"));
      button.classList.add("active");
      currentSort = button.dataset.sort;
      renderSeries();
    });
  });

  els.scrollTopBtn.addEventListener("click", () => window.scrollTo({ top: 0, behavior: "smooth" }));
  window.addEventListener("scroll", () => {
    els.scrollTopBtn.classList.toggle("show", window.scrollY > 520);
  });
}

function setupRevealAnimations() {
  const observer = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add("in-view");
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.12 });
  $$(".reveal").forEach(section => observer.observe(section));
}

function setupActiveNav() {
  const links = $$(".nav-link");
  const sections = links.map(link => $(link.getAttribute("href"))).filter(Boolean);
  window.addEventListener("scroll", () => {
    const y = window.scrollY + 180;
    sections.forEach(section => {
      if (y >= section.offsetTop && y < section.offsetTop + section.offsetHeight) {
        links.forEach(link => link.classList.remove("active"));
        const active = links.find(link => link.getAttribute("href") === `#${section.id}`);
        active?.classList.add("active");
      }
    });
  }, { passive: true });
}

function boot() {
  initMeta();
  renderKpis();
  initFilters();
  renderMainCharts();
  renderSeries();
  renderQuestionCards();
  renderTable();
  renderComments();
  setupInteractions();
  setupRevealAnimations();
  setupActiveNav();
  setTimeout(() => els.loader.classList.add("is-hidden"), 450);
}

document.addEventListener("DOMContentLoaded", boot);
