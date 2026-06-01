(function () {
  "use strict";

  const API_URL = "https://script.google.com/macros/s/AKfycbx7sixleHf2AaEO2B1kl3QdJJrXHDAJ7tWnXfSc5g4xVSn-YgBhlpOhy3ASUvbK7SQiTw/exec";
  const MONTHS = [
    "Janeiro",
    "Fevereiro",
    "Março",
    "Abril",
    "Maio",
    "Junho",
    "Julho",
    "Agosto",
    "Setembro",
    "Outubro",
    "Novembro",
    "Dezembro"
  ];
  const SHORT_MONTHS = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
  const CATEGORY_COLORS = ["#29d47a", "#3db7e7", "#f4b84a", "#9f8cff", "#ff5c6a", "#55d6be", "#d3e35d", "#f58f54"];
  const INITIAL_DATE = new Date();
  const INITIAL_MONTH = INITIAL_DATE.getMonth() + 1;
  const INITIAL_YEAR = INITIAL_DATE.getFullYear();

  const state = {
    month: INITIAL_MONTH,
    year: INITIAL_YEAR,
    data: createEmptyData(INITIAL_MONTH, INITIAL_YEAR),
    monthlySeries: [],
    charts: {},
    pixDetailsModal: null,
    loadId: 0,
    connection: "Aguardando API"
  };

  const dom = {};

  document.addEventListener("DOMContentLoaded", () => {
    try {
      init();
    } catch (error) {
      showBootError(error);
    }
  });

  function init() {
    cacheDom();
    state.pixDetailsModal = new PixDetailsModal({
      root: dom.pixDetailsModal,
      closeButton: dom.pixDetailsClose,
      title: dom.pixDetailsTitle,
      subtitle: dom.pixDetailsSubtitle,
      kind: dom.pixDetailsKind,
      amount: dom.pixDetailsAmount,
      notice: dom.pixDetailsNotice,
      content: dom.pixDetailsContent,
      icon: dom.pixDetailsIcon
    });
    populatePeriodControls();
    bindEvents();
    bindLibraryEvents();
    dom.apiEndpoint.textContent = API_URL;
    setStatus("Aguardando API", "neutral");
    renderApp();
    createIcons();
    loadFinancialData();
  }

  function cacheDom() {
    dom.loadingOverlay = document.getElementById("loadingOverlay");
    dom.loadingTitle = document.getElementById("loadingTitle");
    dom.loadingText = document.getElementById("loadingText");
    dom.toast = document.getElementById("toast");
    dom.pageTitle = document.getElementById("pageTitle");
    dom.periodLabel = document.getElementById("periodLabel");
    dom.currentPeriod = document.getElementById("currentPeriod");
    dom.lastUpdated = document.getElementById("lastUpdated");
    dom.monthSelect = document.getElementById("monthSelect");
    dom.yearInput = document.getElementById("yearInput");
    dom.historyMonth = document.getElementById("historyMonth");
    dom.historyYear = document.getElementById("historyYear");
    dom.refreshButton = document.getElementById("refreshButton");
    dom.navLinks = Array.from(document.querySelectorAll(".nav-link"));
    dom.views = Array.from(document.querySelectorAll(".view"));
    dom.metricGrid = document.getElementById("metricGrid");
    dom.receivedTotal = document.getElementById("receivedTotal");
    dom.receivedCount = document.getElementById("receivedCount");
    dom.sentTotal = document.getElementById("sentTotal");
    dom.sentCount = document.getElementById("sentCount");
    dom.dashboardRecentList = document.getElementById("dashboardRecentList");
    dom.recentTable = document.getElementById("recentTable");
    dom.receivedTable = document.getElementById("receivedTable");
    dom.sentTable = document.getElementById("sentTable");
    dom.historyTable = document.getElementById("historyTable");
    dom.nameSearch = document.getElementById("nameSearch");
    dom.categoryFilter = document.getElementById("categoryFilter");
    dom.typeFilter = document.getElementById("typeFilter");
    dom.historyCount = document.getElementById("historyCount");
    dom.receivedPill = document.getElementById("receivedPill");
    dom.sentPill = document.getElementById("sentPill");
    dom.categoryTotal = document.getElementById("categoryTotal");
    dom.categoryList = document.getElementById("categoryList");
    dom.sidebarBalance = document.getElementById("sidebarBalance");
    dom.statusDot = document.getElementById("statusDot");
    dom.apiStatus = document.getElementById("apiStatus");
    dom.connectionLabel = document.getElementById("connectionLabel");
    dom.connectionStatus = document.getElementById("connectionStatus");
    dom.settingsPeriod = document.getElementById("settingsPeriod");
    dom.settingsEntries = document.getElementById("settingsEntries");
    dom.settingsExits = document.getElementById("settingsExits");
    dom.settingsCategories = document.getElementById("settingsCategories");
    dom.apiEndpoint = document.getElementById("apiEndpoint");
    dom.monthlyStatus = document.getElementById("monthlyStatus");
    dom.cashflowChart = document.getElementById("cashflowChart");
    dom.categoryChart = document.getElementById("categoryChart");
    dom.monthlyChart = document.getElementById("monthlyChart");
    dom.shortcuts = Array.from(document.querySelectorAll("[data-section-shortcut]"));
    dom.pixDetailsModal = document.getElementById("pixDetailsModal");
    dom.pixDetailsClose = document.getElementById("pixDetailsClose");
    dom.pixDetailsTitle = document.getElementById("pixDetailsTitle");
    dom.pixDetailsSubtitle = document.getElementById("pixDetailsSubtitle");
    dom.pixDetailsKind = document.getElementById("pixDetailsKind");
    dom.pixDetailsAmount = document.getElementById("pixDetailsAmount");
    dom.pixDetailsNotice = document.getElementById("pixDetailsNotice");
    dom.pixDetailsContent = document.getElementById("pixDetailsContent");
    dom.pixDetailsIcon = document.getElementById("pixDetailsIcon");
  }

  function populatePeriodControls() {
    const options = MONTHS.map((month, index) => `<option value="${pad(index + 1)}">${month}</option>`).join("");
    dom.monthSelect.innerHTML = options;
    dom.historyMonth.innerHTML = options;
    dom.monthSelect.value = pad(state.month);
    dom.historyMonth.value = pad(state.month);
    dom.yearInput.value = state.year;
    dom.historyYear.value = state.year;
  }

  function bindEvents() {
    dom.navLinks.forEach((button) => {
      button.addEventListener("click", () => setActiveSection(button.dataset.section));
    });

    dom.shortcuts.forEach((button) => {
      button.addEventListener("click", () => setActiveSection(button.dataset.sectionShortcut));
    });

    dom.refreshButton.addEventListener("click", () => {
      syncPeriodFromHeader();
      loadFinancialData(true);
    });

    dom.monthSelect.addEventListener("change", () => {
      syncPeriodFromHeader();
      syncHistoryPeriod();
      loadFinancialData();
    });

    dom.yearInput.addEventListener("change", () => {
      syncPeriodFromHeader();
      syncHistoryPeriod();
      loadFinancialData();
    });

    dom.historyMonth.addEventListener("change", () => {
      syncPeriodFromHistory();
      syncHeaderPeriod();
      loadFinancialData();
    });

    dom.historyYear.addEventListener("change", () => {
      syncPeriodFromHistory();
      syncHeaderPeriod();
      loadFinancialData();
    });

    [dom.nameSearch, dom.categoryFilter, dom.typeFilter].forEach((control) => {
      control.addEventListener("input", renderHistoryTable);
      control.addEventListener("change", renderHistoryTable);
    });

    dom.receivedTable.addEventListener("click", (event) => handlePixTableClick(event, "entrada"));
    dom.sentTable.addEventListener("click", (event) => handlePixTableClick(event, "saida"));

    [dom.receivedTable, dom.sentTable].forEach((tableBody) => {
      tableBody.addEventListener("keydown", (event) => {
        if (event.key !== "Enter" && event.key !== " ") return;
        const row = event.target.closest("[data-pix-index]");
        if (!row) return;
        event.preventDefault();
        row.click();
      });
    });
  }

  function bindLibraryEvents() {
    const chartScript = document.getElementById("chartJsScript");
    const lucideScript = document.getElementById("lucideScript");

    if (chartScript) {
      chartScript.addEventListener("load", () => {
        renderCharts();
      }, { once: true });

      chartScript.addEventListener("error", () => {
        dom.monthlyStatus.textContent = "Gráficos indisponíveis";
        showToast("Não foi possível carregar o Chart.js. Verifique a internet e atualize.", "error");
      }, { once: true });
    }

    if (lucideScript) {
      lucideScript.addEventListener("load", createIcons, { once: true });
    }

    window.setTimeout(() => {
      createIcons();
      renderCharts();
    }, 900);
  }

  function handlePixTableClick(event, type) {
    const rowElement = event.target.closest("[data-pix-index]");
    if (!rowElement) return;

    const collection = type === "entrada" ? state.data.entradas : state.data.saidas;
    const transaction = collection[Number(rowElement.dataset.pixIndex)];
    if (!transaction) return;

    state.pixDetailsModal.open(transaction);
  }

  function syncPeriodFromHeader() {
    state.month = clampMonth(dom.monthSelect.value);
    state.year = clampYear(dom.yearInput.value);
  }

  function syncPeriodFromHistory() {
    state.month = clampMonth(dom.historyMonth.value);
    state.year = clampYear(dom.historyYear.value);
  }

  function syncHistoryPeriod() {
    dom.historyMonth.value = pad(state.month);
    dom.historyYear.value = state.year;
  }

  function syncHeaderPeriod() {
    dom.monthSelect.value = pad(state.month);
    dom.yearInput.value = state.year;
  }

  async function loadFinancialData(isManualRefresh) {
    const loadId = Date.now();
    state.loadId = loadId;
    setLoading(true, "Carregando dados", "Buscando informações do período selecionado");
    setStatus("Sincronizando API", "neutral");

    try {
      const payload = await requestPeriod(state.month, state.year, 28000);
      if (loadId !== state.loadId) return;

      state.data = normalizePayload(payload, state.month, state.year);
      state.month = state.data.month;
      state.year = state.data.year;
      state.monthlySeries = extractMonthlySeries(payload, state.data);

      syncHeaderPeriod();
      syncHistoryPeriod();
      setStatus("Conectado", "success");
      renderApp();
      showToast(isManualRefresh ? "Dados atualizados com sucesso." : "Dashboard sincronizado.");

      if (state.monthlySeries.length < 2) {
        hydrateMonthlySeries(loadId);
      }
    } catch (error) {
      if (loadId !== state.loadId) return;
      state.data = createEmptyData(state.month, state.year);
      state.monthlySeries = [];
      setStatus("Erro na API", "danger");
      renderApp();
      showToast(`Não foi possível carregar a API: ${error.message}`, "error");
    } finally {
      if (loadId === state.loadId) {
        setLoading(false);
      }
    }
  }

  async function requestPeriod(month, year, timeout) {
    const url = new URL(API_URL);
    url.searchParams.set("mes", pad(month));
    url.searchParams.set("ano", String(year));
    url.searchParams.set("_", String(Date.now()));

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeout);

    try {
      const response = await fetch(url.toString(), {
        cache: "no-store",
        signal: controller.signal
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      if (error.name === "AbortError") {
        throw new Error("tempo limite excedido");
      }
      throw error;
    } finally {
      clearTimeout(timer);
    }
  }

  async function requestPixDetails(transaction, timeout = 7000) {
    const url = new URL(API_URL);
    const identifier = getTransactionIdentifier(transaction);

    url.searchParams.set("action", "detalhesPix");
    url.searchParams.set("acao", "detalhesPix");
    url.searchParams.set("tipo", transaction.tipo);
    url.searchParams.set("mes", pad(state.month));
    url.searchParams.set("ano", String(state.year));
    url.searchParams.set("data", transaction.data);
    url.searchParams.set("valor", String(transaction.valor));
    url.searchParams.set("nome", transaction.nome || transaction.destino || "");
    url.searchParams.set("categoria", transaction.categoria || "");
    url.searchParams.set("indice", String(transaction.index ?? ""));
    url.searchParams.set("_", String(Date.now()));

    if (identifier) {
      url.searchParams.set("id", identifier);
      url.searchParams.set("idTransacao", identifier);
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeout);

    try {
      const response = await fetch(url.toString(), {
        cache: "no-store",
        signal: controller.signal
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      return extractPixDetailsPayload(await response.json());
    } catch (error) {
      if (error.name === "AbortError") {
        throw new Error("tempo limite excedido");
      }
      throw error;
    } finally {
      clearTimeout(timer);
    }
  }

  async function hydrateMonthlySeries(loadId) {
    const periods = getLastPeriods(state.month, state.year, 6);
    const activeKey = periodKey(state.month, state.year);
    dom.monthlyStatus.textContent = "Atualizando meses anteriores";

    const requests = periods.map(async (period) => {
      if (periodKey(period.month, period.year) === activeKey) {
        return dataToMonthlyPoint(state.data);
      }

      const payload = await requestPeriod(period.month, period.year, 18000);
      return dataToMonthlyPoint(normalizePayload(payload, period.month, period.year));
    });

    const results = await Promise.allSettled(requests);
    if (loadId !== state.loadId) return;

    const series = results
      .map((result) => (result.status === "fulfilled" ? result.value : null))
      .filter(Boolean)
      .sort((a, b) => a.year - b.year || a.month - b.month);

    if (series.length) {
      state.monthlySeries = series;
      renderMonthlyChart();
    }

    dom.monthlyStatus.textContent = series.length > 1 ? "Últimos 6 meses" : "Mês selecionado";
  }

  function normalizePayload(payload, fallbackMonth, fallbackYear) {
    const period = readPeriod(payload, fallbackMonth, fallbackYear);
    const rawDashboard = payload && (payload.dashboard || payload.Dashboard || payload.resumo || {});
    const entradas = getArray(payload, ["entradas", "Entradas", "pixRecebidos", "recebidos"]).map(normalizeEntrada);
    const saidas = getArray(payload, ["saidas", "Saídas", "pixRealizados", "realizados"]).map(normalizeSaida);
    const historico = entradas.concat(saidas).sort((a, b) => b.timestamp - a.timestamp);

    const recebido = hasValue(rawDashboard.recebido) ? parseCurrency(rawDashboard.recebido) : sumValues(entradas);
    const gasto = hasValue(rawDashboard.gasto) ? parseCurrency(rawDashboard.gasto) : sumValues(saidas);
    const saldo = hasValue(rawDashboard.saldo) ? parseCurrency(rawDashboard.saldo) : recebido - gasto;
    const qtdEntradas = hasValue(rawDashboard.qtdEntradas) ? Number(rawDashboard.qtdEntradas) : entradas.length;
    const qtdSaidas = hasValue(rawDashboard.qtdSaidas) ? Number(rawDashboard.qtdSaidas) : saidas.length;
    const ticketMedio = hasValue(rawDashboard.ticketMedio)
      ? parseCurrency(rawDashboard.ticketMedio)
      : (qtdEntradas + qtdSaidas ? (recebido + gasto) / (qtdEntradas + qtdSaidas) : 0);
    const maiorEntrada = hasValue(rawDashboard.maiorEntrada) ? parseCurrency(rawDashboard.maiorEntrada) : maxValue(entradas);
    const maiorGasto = hasValue(rawDashboard.maiorGasto) ? parseCurrency(rawDashboard.maiorGasto) : maxValue(saidas);

    return {
      periodo: period.label,
      month: period.month,
      year: period.year,
      dashboard: {
        recebido,
        gasto,
        saldo,
        ticketMedio,
        qtdEntradas: Number.isFinite(qtdEntradas) ? qtdEntradas : entradas.length,
        qtdSaidas: Number.isFinite(qtdSaidas) ? qtdSaidas : saidas.length,
        maiorEntrada,
        maiorGasto
      },
      entradas,
      saidas,
      historico,
      updatedAt: new Date()
    };
  }

  function normalizeEntrada(item, index) {
    const data = safeText(readField(item, ["data", "Data", "date"]), "--");
    const valor = parseCurrency(readField(item, ["valor", "Valor", "value"]));
    const nome = tidyName(readField(item, ["quemEnviou", "Quem enviou", "origem", "remetente", "nome"]), "Origem não informada");
    const descricao = tidyName(readField(item, ["descricao", "Descrição", "categoria", "Categoria"]), "Entrada");
    const transactionId = safeText(readField(item, ["id", "ID", "idTransacao", "id_transacao", "transactionId", "endToEndId", "e2eId", "codigoTransacao"]), "");

    return {
      id: transactionId || `entrada-${index}-${data}`,
      transactionId,
      index,
      tipo: "entrada",
      data,
      timestamp: parseDate(data).getTime() || 0,
      valor,
      nome,
      categoria: descricao,
      descricao,
      raw: clonePlainObject(item)
    };
  }

  function normalizeSaida(item, index) {
    const data = safeText(readField(item, ["data", "Data", "date"]), "--");
    const valor = parseCurrency(readField(item, ["valor", "Valor", "value"]));
    const destino = tidyName(readField(item, ["destino", "Destino", "quemRecebeu", "nome"]), "Destino não informado");
    const categoria = tidyName(readField(item, ["categoria", "Categoria", "descricao", "Descrição"]), "Sem categoria");
    const transactionId = safeText(readField(item, ["id", "ID", "idTransacao", "id_transacao", "transactionId", "endToEndId", "e2eId", "codigoTransacao"]), "");

    return {
      id: transactionId || `saida-${index}-${data}`,
      transactionId,
      index,
      tipo: "saida",
      data,
      timestamp: parseDate(data).getTime() || 0,
      valor,
      nome: destino,
      destino,
      categoria,
      descricao: categoria,
      raw: clonePlainObject(item)
    };
  }

  function renderApp() {
    renderPeriodLabels();
    renderMetrics();
    renderPixSummary();
    renderTables();
    renderCategoryFilters();
    renderCategories();
    renderSettings();
    renderCharts();
    createIcons();
  }

  function renderPeriodLabels() {
    const label = `${MONTHS[state.month - 1]} de ${state.year}`;
    dom.periodLabel.textContent = label;
    dom.currentPeriod.textContent = state.data.periodo || `${pad(state.month)}/${state.year}`;
    dom.settingsPeriod.textContent = state.data.periodo || `${pad(state.month)}/${state.year}`;
    dom.lastUpdated.textContent = `Última atualização: ${formatDateTime(state.data.updatedAt)}`;
    dom.sidebarBalance.textContent = formatCurrency(state.data.dashboard.saldo);
  }

  function renderMetrics() {
    const dashboard = state.data.dashboard;
    const metrics = [
      {
        label: "Total Recebido",
        value: formatCurrency(dashboard.recebido),
        detail: `${dashboard.qtdEntradas} entradas no período`,
        icon: "arrow-down-left",
        color: "#29d47a"
      },
      {
        label: "Total Gasto",
        value: formatCurrency(dashboard.gasto),
        detail: `${dashboard.qtdSaidas} saídas no período`,
        icon: "arrow-up-right",
        color: "#ff5c6a"
      },
      {
        label: "Saldo",
        value: formatCurrency(dashboard.saldo),
        detail: dashboard.saldo >= 0 ? "Saldo positivo" : "Saldo negativo",
        icon: "wallet",
        color: dashboard.saldo >= 0 ? "#3db7e7" : "#f4b84a"
      },
      {
        label: "Ticket Médio",
        value: formatCurrency(dashboard.ticketMedio),
        detail: "Média por movimentação",
        icon: "receipt",
        color: "#9f8cff"
      },
      {
        label: "Quantidade de Entradas",
        value: formatNumber(dashboard.qtdEntradas),
        detail: "Pix recebidos",
        icon: "download",
        color: "#55d6be"
      },
      {
        label: "Quantidade de Saídas",
        value: formatNumber(dashboard.qtdSaidas),
        detail: "Pix realizados",
        icon: "send",
        color: "#f58f54"
      },
      {
        label: "Maior Entrada",
        value: formatCurrency(dashboard.maiorEntrada),
        detail: "Maior recebimento",
        icon: "trending-up",
        color: "#d3e35d"
      },
      {
        label: "Maior Gasto",
        value: formatCurrency(dashboard.maiorGasto),
        detail: "Maior saída",
        icon: "badge-dollar-sign",
        color: "#ff5c6a"
      }
    ];

    dom.metricGrid.innerHTML = metrics
      .map((metric, index) => `
        <article class="metric-card" style="--tone: ${metric.color}; animation-delay: ${index * 25}ms">
          <div class="metric-top">
            <span>${escapeHtml(metric.label)}</span>
            <span class="metric-icon"><i data-lucide="${metric.icon}"></i></span>
          </div>
          <strong>${escapeHtml(metric.value)}</strong>
          <small>${escapeHtml(metric.detail)}</small>
        </article>
      `)
      .join("");
  }

  function renderPixSummary() {
    const dashboard = state.data.dashboard;
    dom.receivedTotal.textContent = formatCurrency(dashboard.recebido);
    dom.receivedCount.textContent = `${dashboard.qtdEntradas} entradas`;
    dom.sentTotal.textContent = formatCurrency(dashboard.gasto);
    dom.sentCount.textContent = `${dashboard.qtdSaidas} saídas`;
    dom.receivedPill.textContent = formatCurrency(dashboard.recebido);
    dom.sentPill.textContent = formatCurrency(dashboard.gasto);

    const recent = state.data.historico.slice(0, 5);
    dom.dashboardRecentList.innerHTML = recent.length
      ? recent.map(renderMiniItem).join("")
      : `<div class="mini-item"><span></span><strong>Sem movimentações</strong><span></span></div>`;
  }

  function renderMiniItem(row) {
    const isEntrada = row.tipo === "entrada";
    const icon = isEntrada ? "arrow-down-left" : "arrow-up-right";
    return `
      <div class="mini-item">
        <span class="mini-icon ${row.tipo}"><i data-lucide="${icon}"></i></span>
        <span>
          <strong>${escapeHtml(row.nome)}</strong>
          <span>${escapeHtml(row.data)}</span>
        </span>
        <span class="amount ${row.tipo}">${isEntrada ? "+" : "-"} ${escapeHtml(formatCurrency(row.valor))}</span>
      </div>
    `;
  }

  function renderTables() {
    renderReceivedTable();
    renderSentTable();
    renderRecentTable();
    renderHistoryTable();
  }

  function renderReceivedTable() {
    const rows = state.data.entradas;
    dom.receivedTable.innerHTML = rows.length
      ? rows.map((row, index) => `
        <tr class="clickable-row" data-pix-index="${index}" tabindex="0" role="button" aria-label="Ver detalhes do PIX recebido de ${escapeAttribute(row.nome)}">
          <td>${escapeHtml(row.data)}</td>
          <td class="align-right amount entrada">+ ${escapeHtml(formatCurrency(row.valor))}</td>
          <td class="name-cell"><button class="name-button" type="button">${escapeHtml(row.nome)}</button></td>
          <td><span class="tag">${escapeHtml(row.descricao)}</span></td>
        </tr>
      `).join("")
      : emptyRow(4);
  }

  function renderSentTable() {
    const rows = state.data.saidas;
    dom.sentTable.innerHTML = rows.length
      ? rows.map((row, index) => `
        <tr class="clickable-row" data-pix-index="${index}" tabindex="0" role="button" aria-label="Ver detalhes do PIX enviado para ${escapeAttribute(row.destino)}">
          <td>${escapeHtml(row.data)}</td>
          <td class="align-right amount saida">- ${escapeHtml(formatCurrency(row.valor))}</td>
          <td class="name-cell"><button class="name-button" type="button">${escapeHtml(row.destino)}</button></td>
          <td><span class="tag">${escapeHtml(row.categoria)}</span></td>
        </tr>
      `).join("")
      : emptyRow(4);
  }

  function renderRecentTable() {
    const rows = state.data.historico.slice(0, 8);
    dom.recentTable.innerHTML = rows.length
      ? rows.map(renderHistoryRow).join("")
      : emptyRow(5);
  }

  function renderHistoryTable() {
    const term = normalizeForSearch(dom.nameSearch.value);
    const selectedCategory = dom.categoryFilter.value;
    const selectedType = dom.typeFilter.value;

    const rows = state.data.historico.filter((row) => {
      const text = normalizeForSearch(`${row.nome} ${row.categoria} ${row.descricao}`);
      const matchesTerm = !term || text.includes(term);
      const matchesCategory = selectedCategory === "all" || row.categoria === selectedCategory;
      const matchesType = selectedType === "all" || row.tipo === selectedType;
      return matchesTerm && matchesCategory && matchesType;
    });

    dom.historyCount.textContent = `${rows.length} movimentações`;
    dom.historyTable.innerHTML = rows.length ? rows.map(renderHistoryRow).join("") : emptyRow(5);
    createIcons();
  }

  function renderHistoryRow(row) {
    const sign = row.tipo === "entrada" ? "+" : "-";
    return `
      <tr>
        <td><span class="tx-type ${row.tipo}">${row.tipo === "entrada" ? "Entrada" : "Saída"}</span></td>
        <td>${escapeHtml(row.data)}</td>
        <td class="name-cell">${escapeHtml(row.nome)}</td>
        <td><span class="tag">${escapeHtml(row.categoria)}</span></td>
        <td class="align-right amount ${row.tipo}">${sign} ${escapeHtml(formatCurrency(row.valor))}</td>
      </tr>
    `;
  }

  function renderCategoryFilters() {
    const categories = Array.from(new Set(state.data.historico.map((row) => row.categoria).filter(Boolean))).sort((a, b) => a.localeCompare(b, "pt-BR"));
    const selected = dom.categoryFilter.value || "all";
    dom.categoryFilter.innerHTML = `<option value="all">Todas categorias</option>` + categories.map((category) => `<option value="${escapeAttribute(category)}">${escapeHtml(category)}</option>`).join("");
    dom.categoryFilter.value = categories.includes(selected) ? selected : "all";
  }

  function renderCategories() {
    const categories = getCategoryTotals();
    const total = sumValues(state.data.saidas);
    dom.categoryTotal.textContent = formatCurrency(total);

    if (!categories.length) {
      dom.categoryList.innerHTML = `<article class="category-card"><h3>Sem gastos</h3><p>Nenhuma saída encontrada no período.</p></article>`;
      return;
    }

    dom.categoryList.innerHTML = categories.map((category, index) => {
      const percent = total ? Math.round((category.total / total) * 100) : 0;
      const color = CATEGORY_COLORS[index % CATEGORY_COLORS.length];
      return `
        <article class="category-card">
          <header>
            <div>
              <h3>${escapeHtml(category.name)}</h3>
              <p>${category.count} movimentações · ${percent}% do total</p>
            </div>
            <strong>${escapeHtml(formatCurrency(category.total))}</strong>
          </header>
          <div class="progress-track">
            <span style="width: ${percent}%; --bar-color: ${color};"></span>
          </div>
        </article>
      `;
    }).join("");
  }

  function renderSettings() {
    const categories = getCategoryTotals();
    dom.connectionLabel.textContent = state.connection;
    dom.connectionStatus.textContent = state.connection;
    dom.settingsEntries.textContent = formatNumber(state.data.entradas.length);
    dom.settingsExits.textContent = formatNumber(state.data.saidas.length);
    dom.settingsCategories.textContent = formatNumber(categories.length);
  }

  function renderCharts() {
    if (!window.Chart) {
      dom.monthlyStatus.textContent = "Aguardando Chart.js";
      return;
    }

    renderCashflowChart();
    renderCategoryChart();
    renderMonthlyChart();
  }

  function renderCashflowChart() {
    const grouped = groupByDay();
    const days = new Date(state.year, state.month, 0).getDate();
    const labels = Array.from({ length: days }, (_, index) => pad(index + 1));
    const receitas = labels.map((day) => grouped.receitas[day] || 0);
    const despesas = labels.map((day) => grouped.despesas[day] || 0);

    replaceChart("cashflow", dom.cashflowChart, {
      type: "line",
      data: {
        labels,
        datasets: [
          {
            label: "Receitas",
            data: receitas,
            borderColor: "#29d47a",
            backgroundColor: "rgba(41, 212, 122, 0.14)",
            fill: true,
            tension: 0.36,
            pointRadius: 2,
            pointHoverRadius: 5
          },
          {
            label: "Despesas",
            data: despesas,
            borderColor: "#ff5c6a",
            backgroundColor: "rgba(255, 92, 106, 0.12)",
            fill: true,
            tension: 0.36,
            pointRadius: 2,
            pointHoverRadius: 5
          }
        ]
      },
      options: chartOptions("R$")
    });
  }

  function renderCategoryChart() {
    const categories = getCategoryTotals();
    const labels = categories.length ? categories.map((category) => category.name) : ["Sem gastos"];
    const values = categories.length ? categories.map((category) => category.total) : [1];

    replaceChart("category", dom.categoryChart, {
      type: "doughnut",
      data: {
        labels,
        datasets: [
          {
            data: values,
            backgroundColor: CATEGORY_COLORS,
            borderColor: "#10171d",
            borderWidth: 4,
            hoverOffset: 8
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        cutout: "68%",
        plugins: {
          legend: {
            position: "bottom",
            labels: {
              color: "#b7c6c7",
              boxWidth: 10,
              usePointStyle: true,
              pointStyle: "circle"
            }
          },
          tooltip: {
            callbacks: {
              label: (context) => `${context.label}: ${formatCurrency(context.raw)}`
            }
          }
        }
      }
    });
  }

  function renderMonthlyChart() {
    if (!window.Chart) return;
    const series = state.monthlySeries.length ? state.monthlySeries : [dataToMonthlyPoint(state.data)];
    const labels = series.map((item) => `${SHORT_MONTHS[item.month - 1]}/${String(item.year).slice(-2)}`);

    replaceChart("monthly", dom.monthlyChart, {
      data: {
        labels,
        datasets: [
          {
            type: "bar",
            label: "Receitas",
            data: series.map((item) => item.recebido),
            backgroundColor: "rgba(41, 212, 122, 0.72)",
            borderRadius: 6,
            maxBarThickness: 34
          },
          {
            type: "bar",
            label: "Despesas",
            data: series.map((item) => item.gasto),
            backgroundColor: "rgba(255, 92, 106, 0.72)",
            borderRadius: 6,
            maxBarThickness: 34
          },
          {
            type: "line",
            label: "Saldo",
            data: series.map((item) => item.saldo),
            borderColor: "#f4b84a",
            backgroundColor: "rgba(244, 184, 74, 0.16)",
            pointRadius: 3,
            tension: 0.34,
            yAxisID: "y"
          }
        ]
      },
      options: chartOptions("R$")
    });

    dom.monthlyStatus.textContent = series.length > 1 ? "Últimos 6 meses" : "Mês selecionado";
  }

  function replaceChart(name, canvas, config) {
    if (state.charts[name]) {
      state.charts[name].destroy();
    }
    state.charts[name] = new Chart(canvas, config);
  }

  function chartOptions() {
    return {
      responsive: true,
      maintainAspectRatio: false,
      interaction: {
        intersect: false,
        mode: "index"
      },
      plugins: {
        legend: {
          labels: {
            color: "#b7c6c7",
            usePointStyle: true,
            pointStyle: "circle",
            boxWidth: 8
          }
        },
        tooltip: {
          backgroundColor: "#10171d",
          borderColor: "rgba(255,255,255,0.14)",
          borderWidth: 1,
          callbacks: {
            label: (context) => `${context.dataset.label}: ${formatCurrency(context.raw)}`
          }
        }
      },
      scales: {
        x: {
          grid: {
            color: "rgba(255,255,255,0.05)"
          },
          ticks: {
            color: "#8c9ea4",
            maxRotation: 0
          }
        },
        y: {
          beginAtZero: true,
          grid: {
            color: "rgba(255,255,255,0.06)"
          },
          ticks: {
            color: "#8c9ea4",
            callback: (value) => formatCompactCurrency(value)
          }
        }
      }
    };
  }

  function groupByDay() {
    const receitas = {};
    const despesas = {};

    state.data.entradas.forEach((row) => {
      const day = row.data.slice(0, 2);
      receitas[day] = (receitas[day] || 0) + row.valor;
    });

    state.data.saidas.forEach((row) => {
      const day = row.data.slice(0, 2);
      despesas[day] = (despesas[day] || 0) + row.valor;
    });

    return { receitas, despesas };
  }

  function getCategoryTotals() {
    const map = new Map();

    state.data.saidas.forEach((row) => {
      const current = map.get(row.categoria) || { name: row.categoria, total: 0, count: 0 };
      current.total += row.valor;
      current.count += 1;
      map.set(row.categoria, current);
    });

    return Array.from(map.values()).sort((a, b) => b.total - a.total);
  }

  function extractMonthlySeries(payload, currentData) {
    const raw = payload && (payload.dadosMensais || payload.dados_mensais || payload.mensal || payload.meses || payload.evolucaoMensal);
    if (!raw) {
      return [dataToMonthlyPoint(currentData)];
    }

    const rows = Array.isArray(raw)
      ? raw
      : Object.entries(raw).map(([periodo, values]) => ({ periodo, ...(typeof values === "object" ? values : { saldo: values }) }));

    const series = rows.map((row) => {
      const period = readPeriod(row, currentData.month, currentData.year);
      const recebido = parseCurrency(readField(row, ["recebido", "receitas", "entradas", "totalRecebido"]));
      const gasto = parseCurrency(readField(row, ["gasto", "despesas", "saidas", "totalGasto"]));
      const saldo = hasValue(readField(row, ["saldo"])) ? parseCurrency(readField(row, ["saldo"])) : recebido - gasto;
      return {
        month: period.month,
        year: period.year,
        recebido,
        gasto,
        saldo
      };
    }).filter((item) => item.month && item.year);

    return series.length ? series.sort((a, b) => a.year - b.year || a.month - b.month) : [dataToMonthlyPoint(currentData)];
  }

  function dataToMonthlyPoint(data) {
    return {
      month: data.month,
      year: data.year,
      recebido: data.dashboard.recebido,
      gasto: data.dashboard.gasto,
      saldo: data.dashboard.saldo
    };
  }

  function setActiveSection(section) {
    dom.navLinks.forEach((button) => button.classList.toggle("active", button.dataset.section === section));
    dom.views.forEach((view) => view.classList.toggle("active-view", view.id === section));
    dom.pageTitle.textContent = sectionTitle(section);
    window.scrollTo({ top: 0, behavior: "smooth" });
    createIcons();
  }

  function sectionTitle(section) {
    const titles = {
      dashboard: "Dashboard",
      recebidos: "Pix Recebidos",
      realizados: "Pix Realizados",
      historico: "Histórico",
      categorias: "Categorias",
      configuracoes: "Configurações"
    };
    return titles[section] || "Dashboard";
  }

  function setLoading(isLoading, title, text) {
    dom.loadingOverlay.hidden = !isLoading;
    dom.refreshButton.disabled = isLoading;
    if (title) dom.loadingTitle.textContent = title;
    if (text) dom.loadingText.textContent = text;
  }

  function setStatus(label, type) {
    state.connection = label;
    dom.apiStatus.textContent = label;
    dom.statusDot.classList.remove("success", "danger");
    if (type === "success") dom.statusDot.classList.add("success");
    if (type === "danger") dom.statusDot.classList.add("danger");
  }

  function showToast(message, type) {
    window.clearTimeout(showToast.timer);
    dom.toast.textContent = message;
    dom.toast.classList.toggle("error", type === "error");
    dom.toast.hidden = false;
    showToast.timer = window.setTimeout(() => {
      dom.toast.hidden = true;
    }, 3600);
  }

  class PixDetailsModal {
    constructor(elements) {
      this.root = elements.root;
      this.closeButton = elements.closeButton;
      this.title = elements.title;
      this.subtitle = elements.subtitle;
      this.kind = elements.kind;
      this.amount = elements.amount;
      this.notice = elements.notice;
      this.content = elements.content;
      this.icon = elements.icon;
      this.requestId = 0;
      this.closeTimer = null;
      this.handleEscape = this.handleEscape.bind(this);

      this.closeButton.addEventListener("click", () => this.close());
      this.root.addEventListener("click", (event) => {
        if (event.target === this.root) {
          this.close();
        }
      });
    }

    open(transaction) {
      this.requestId += 1;
      const requestId = this.requestId;

      window.clearTimeout(this.closeTimer);
      this.renderHeader(transaction);
      this.renderLoading();
      this.show();

      requestPixDetails(transaction)
        .then((details) => {
          if (requestId !== this.requestId) return;
          this.renderDetails(transaction, details, {
            hasRemoteDetails: Boolean(details)
          });
        })
        .catch((error) => {
          if (requestId !== this.requestId) return;
          this.renderDetails(transaction, null, {
            error: error.message || "não foi possível buscar detalhes agora"
          });
        });
    }

    show() {
      this.root.hidden = false;
      document.body.classList.add("modal-open");
      document.addEventListener("keydown", this.handleEscape);
      window.requestAnimationFrame(() => {
        this.root.classList.add("is-open");
      });
    }

    close() {
      this.requestId += 1;
      this.root.classList.remove("is-open");
      document.body.classList.remove("modal-open");
      document.removeEventListener("keydown", this.handleEscape);
      this.closeTimer = window.setTimeout(() => {
        this.root.hidden = true;
      }, 180);
    }

    handleEscape(event) {
      if (event.key === "Escape") {
        this.close();
      }
    }

    renderHeader(transaction) {
      const isEntrada = transaction.tipo === "entrada";
      const name = transaction.nome || transaction.destino || "Transação PIX";

      this.root.classList.toggle("is-entrada", isEntrada);
      this.root.classList.toggle("is-saida", !isEntrada);
      this.kind.textContent = isEntrada ? "PIX recebido" : "PIX realizado";
      this.title.textContent = name;
      this.subtitle.textContent = `${transaction.data} · ${transaction.categoria || transaction.descricao || "Sem categoria"}`;
      this.amount.textContent = `${isEntrada ? "+" : "-"} ${formatCurrency(transaction.valor)}`;
      this.amount.className = `pix-modal-amount ${transaction.tipo}`;
      this.icon.innerHTML = `<i data-lucide="${isEntrada ? "arrow-down-left" : "arrow-up-right"}"></i>`;
      createIcons();
    }

    renderLoading() {
      this.notice.hidden = true;
      this.notice.textContent = "";
      this.content.innerHTML = `
        <div class="pix-modal-loading">
          <span class="loader"></span>
          <div>
            <strong>Buscando detalhes completos</strong>
            <p>Consultando a API desta transação PIX.</p>
          </div>
        </div>
      `;
    }

    renderDetails(transaction, details, meta) {
      const model = buildPixDetailModel(transaction, details);
      const hasExtras = model.extraFields.length > 0;

      if (meta.error) {
        this.notice.hidden = false;
        this.notice.textContent = `Não foi possível buscar detalhes completos pela API (${meta.error}). Exibindo os dados disponíveis da listagem.`;
      } else if (!meta.hasRemoteDetails) {
        this.notice.hidden = false;
        this.notice.textContent = "A API ainda não retornou detalhes extras para esta transação. Exibindo os dados disponíveis da listagem.";
      } else {
        this.notice.hidden = true;
        this.notice.textContent = "";
      }

      this.content.innerHTML = `
        <section class="pix-detail-section">
          <div class="pix-section-title">
            <h3>Informações da transação</h3>
            <span>${transaction.tipo === "entrada" ? "Recebimento" : "Pagamento"}</span>
          </div>
          <div class="pix-detail-grid">
            ${model.standardFields.map(renderDetailField).join("")}
          </div>
        </section>

        <section class="pix-detail-section">
          <div class="pix-section-title">
            <h3>Outros campos da API</h3>
            <span>${hasExtras ? `${model.extraFields.length} campos` : "Sem campos adicionais"}</span>
          </div>
          ${hasExtras
            ? `<div class="pix-detail-grid compact">${model.extraFields.map(renderDetailField).join("")}</div>`
            : `<div class="pix-empty-details">Nenhum outro campo foi retornado para esta transação.</div>`}
        </section>
      `;
    }
  }

  function renderDetailField(field) {
    const isMissing = !hasDetailValue(field.value);
    return `
      <div class="pix-detail-card${isMissing ? " muted" : ""}">
        <span>${escapeHtml(field.label)}</span>
        <strong>${escapeHtml(isMissing ? "Não informado" : formatDetailValue(field.label, field.value))}</strong>
      </div>
    `;
  }

  function createEmptyData(month = new Date().getMonth() + 1, year = new Date().getFullYear()) {
    return {
      periodo: `${pad(month)}/${year}`,
      month,
      year,
      dashboard: {
        recebido: 0,
        gasto: 0,
        saldo: 0,
        ticketMedio: 0,
        qtdEntradas: 0,
        qtdSaidas: 0,
        maiorEntrada: 0,
        maiorGasto: 0
      },
      entradas: [],
      saidas: [],
      historico: [],
      updatedAt: new Date()
    };
  }

  function createIcons() {
    if (window.lucide) {
      window.lucide.createIcons({
        attrs: {
          "stroke-width": 1.9
        }
      });
    }
  }

  function buildPixDetailModel(transaction, details) {
    const dateTime = splitDateTime(transaction.data);
    const raw = clonePlainObject(transaction.raw || {});
    const source = {
      ...raw,
      ...(details || {}),
      tipo: transaction.tipo,
      nome: transaction.nome,
      valor: transaction.valor,
      data: transaction.data,
      dataPix: dateTime.date,
      hora: dateTime.time,
      descricao: transaction.descricao,
      categoria: transaction.categoria,
      origemPix: transaction.tipo === "entrada" ? transaction.nome : readField(raw, ["origem", "origemPix", "contaOrigem"]),
      destinoPix: transaction.tipo === "saida" ? transaction.destino : readField(raw, ["destino", "destinoPix", "contaDestino"]),
      idTransacao: transaction.transactionId || readField(raw, ["id", "ID", "idTransacao", "transactionId", "endToEndId", "e2eId"])
    };
    const flat = flattenDetailObject(source);
    const usedKeys = new Set();

    const standardFields = [
      createDetailField(flat, usedKeys, "Nome completo", ["nomeCompleto", "nome", "quemEnviou", "remetente", "pagador", "destino", "favorecido", "recebedor"], transaction.nome),
      createDetailField(flat, usedKeys, "CPF", ["cpf", "documento", "cpfCnpj", "cpf_cnpj", "cpfOrigem", "cpfDestino", "documentoPessoa"]),
      createDetailField(flat, usedKeys, "Banco", ["banco", "instituicao", "instituicaoFinanceira", "bancoOrigem", "bancoDestino", "ispb"]),
      createDetailField(flat, usedKeys, "Tipo da chave PIX", ["tipoChavePix", "tipoChave", "tipo_da_chave", "chaveTipo"]),
      createDetailField(flat, usedKeys, "Chave PIX", ["chavePix", "chave_pix", "pixKey", "chave"]),
      createDetailField(flat, usedKeys, "Valor", ["valor", "valorPix", "amount"], transaction.valor),
      createDetailField(flat, usedKeys, "Data", ["dataPix", "dataPagamento", "dataTransacao", "data"], dateTime.date),
      createDetailField(flat, usedKeys, "Hora", ["hora", "horario", "horaPagamento", "horaTransacao"], dateTime.time),
      createDetailField(flat, usedKeys, "ID da transação", ["idTransacao", "id_transacao", "transactionId", "endToEndId", "e2eId", "codigoTransacao"]),
      createDetailField(flat, usedKeys, "Status", ["status", "situacao", "estado"]),
      createDetailField(flat, usedKeys, "Descrição", ["descricao", "descrição", "description", "historico"], transaction.descricao),
      createDetailField(flat, usedKeys, "Categoria", ["categoria", "category"], transaction.categoria),
      createDetailField(flat, usedKeys, "Origem do PIX", ["origemPix", "origem", "quemEnviou", "remetente", "pagador", "contaOrigem"], transaction.tipo === "entrada" ? transaction.nome : ""),
      createDetailField(flat, usedKeys, "Destino do PIX", ["destinoPix", "destino", "quemRecebeu", "recebedor", "favorecido", "contaDestino"], transaction.tipo === "saida" ? transaction.destino : ""),
      createDetailField(flat, usedKeys, "Observações", ["observacoes", "observação", "observacao", "notas", "comentario", "comentário", "obs"])
    ];

    const extraFields = flat
      .filter((field) => !usedKeys.has(normalizeDetailKey(field.key)))
      .filter((field) => !isInternalDetailKey(field.key))
      .filter((field) => hasDetailValue(field.value))
      .map((field) => ({
        label: humanizeKey(field.key),
        value: field.value
      }));

    return {
      standardFields,
      extraFields
    };
  }

  function createDetailField(flat, usedKeys, label, keys, fallback = "") {
    const match = pickDetailField(flat, keys);
    keys.forEach((key) => usedKeys.add(normalizeDetailKey(key)));

    if (match) {
      usedKeys.add(normalizeDetailKey(match.key));
    }

    return {
      label,
      value: match ? match.value : fallback
    };
  }

  function pickDetailField(flat, keys) {
    const normalizedKeys = keys.map(normalizeDetailKey);

    for (const normalizedKey of normalizedKeys) {
      const match = flat.find((field) => {
        const normalizedFullKey = normalizeDetailKey(field.key);
        const normalizedLastKey = normalizeDetailKey(field.key.split(".").pop());
        return normalizedKey === normalizedFullKey || normalizedKey === normalizedLastKey;
      });

      if (match) return match;
    }

    return null;
  }

  function extractPixDetailsPayload(payload) {
    if (!payload) return null;

    if (Array.isArray(payload)) {
      return payload.find((item) => item && typeof item === "object") || null;
    }

    if (typeof payload !== "object") return null;

    const candidates = [
      payload.detalhes,
      payload.details,
      payload.detail,
      payload.transacao,
      payload.transação,
      payload.transaction,
      payload.pix,
      payload.resultado,
      payload.result,
      payload.data
    ];
    const directCandidate = candidates.find((candidate) => candidate && typeof candidate === "object" && !Array.isArray(candidate));

    if (directCandidate) {
      return directCandidate;
    }

    if ((payload.dashboard || payload.Dashboard) && (Array.isArray(payload.entradas) || Array.isArray(payload.saidas))) {
      return null;
    }

    return payload;
  }

  function getTransactionIdentifier(transaction) {
    return safeText(
      transaction.transactionId ||
      readField(transaction.raw, ["id", "ID", "idTransacao", "id_transacao", "transactionId", "endToEndId", "e2eId", "codigoTransacao"]) ||
      "",
      ""
    );
  }

  function flattenDetailObject(value, prefix = "", output = []) {
    if (!hasDetailValue(value)) return output;

    if (Array.isArray(value)) {
      if (prefix) {
        output.push({
          key: prefix,
          value: value.map(formatRawDetailValue).join(", ")
        });
      }
      return output;
    }

    if (typeof value === "object" && !(value instanceof Date)) {
      Object.entries(value).forEach(([key, nestedValue]) => {
        if (!hasDetailValue(nestedValue)) return;
        const nextPrefix = prefix ? `${prefix}.${key}` : key;
        flattenDetailObject(nestedValue, nextPrefix, output);
      });
      return output;
    }

    if (prefix) {
      output.push({
        key: prefix,
        value
      });
    }

    return output;
  }

  function clonePlainObject(value) {
    if (!value || typeof value !== "object") return {};

    try {
      return JSON.parse(JSON.stringify(value));
    } catch (error) {
      return { ...value };
    }
  }

  function splitDateTime(value) {
    const text = safeText(value, "");
    const [date = "", time = ""] = text.split(/\s+/);
    return {
      date,
      time
    };
  }

  function hasDetailValue(value) {
    if (value === undefined || value === null) return false;
    if (typeof value === "string") return value.trim() !== "";
    if (Array.isArray(value)) return value.length > 0;
    return true;
  }

  function formatDetailValue(label, value) {
    if (typeof value === "boolean") {
      return value ? "Sim" : "Não";
    }

    if (label.toLocaleLowerCase("pt-BR").includes("valor")) {
      return formatCurrency(parseCurrency(value));
    }

    return formatRawDetailValue(value);
  }

  function formatRawDetailValue(value) {
    if (value instanceof Date) {
      return formatDateTime(value);
    }

    if (typeof value === "number") {
      return Number.isFinite(value) ? String(value) : "";
    }

    if (typeof value === "object" && value !== null) {
      try {
        return JSON.stringify(value);
      } catch (error) {
        return String(value);
      }
    }

    return safeText(value, "");
  }

  function normalizeDetailKey(value) {
    return String(value || "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-zA-Z0-9]/g, "")
      .toLocaleLowerCase("pt-BR");
  }

  function humanizeKey(key) {
    const lastKey = String(key || "").split(".").pop();
    return lastKey
      .replace(/[_-]+/g, " ")
      .replace(/([a-z])([A-Z])/g, "$1 $2")
      .trim()
      .replace(/\b\w/g, (letter) => letter.toLocaleUpperCase("pt-BR"))
      .replace(/\bCpf\b/g, "CPF")
      .replace(/\bPix\b/g, "PIX")
      .replace(/\bId\b/g, "ID");
  }

  function isInternalDetailKey(key) {
    const normalized = normalizeDetailKey(key);
    return [
      "raw",
      "tipo",
      "timestamp",
      "index",
      "id",
      "nome",
      "valor",
      "data",
      "datapix",
      "hora",
      "categoria",
      "descricao",
      "destino",
      "origempix",
      "destinopix"
    ].includes(normalized);
  }

  function showBootError(error) {
    const message = error && error.message ? error.message : "erro desconhecido";
    const box = document.createElement("div");
    box.className = "boot-error";
    box.innerHTML = `
      <strong>Não foi possível iniciar o dashboard.</strong>
      <span>Atualize a página. Detalhe técnico: ${escapeHtml(message)}</span>
    `;
    document.body.prepend(box);
  }

  function readPeriod(source, fallbackMonth, fallbackYear) {
    const raw = source && (source.periodo || source.Periodo || source.mesAno || source.label);
    const text = String(raw || `${pad(fallbackMonth)}/${fallbackYear}`);
    const match = text.match(/(\d{1,2})\D+(\d{4})/);
    const sourceMonth = source && (source.mesNumero || source.month || source.mes);
    const sourceYear = source && (source.ano || source.year);
    const month = match ? clampMonth(match[1]) : clampMonth(sourceMonth || fallbackMonth);
    const year = match ? clampYear(match[2]) : clampYear(sourceYear || fallbackYear);

    return {
      month,
      year,
      label: `${pad(month)}/${year}`
    };
  }

  function readField(source, keys) {
    if (!source || typeof source !== "object") return undefined;
    for (const key of keys) {
      if (Object.prototype.hasOwnProperty.call(source, key)) {
        return source[key];
      }
    }
    return undefined;
  }

  function getArray(source, keys) {
    if (!source || typeof source !== "object") return [];
    for (const key of keys) {
      if (Array.isArray(source[key])) {
        return source[key];
      }
    }
    return [];
  }

  function parseCurrency(value) {
    if (typeof value === "number") return Number.isFinite(value) ? value : 0;
    if (!hasValue(value)) return 0;

    const normalized = String(value)
      .replace(/\s/g, "")
      .replace(/[^\d,.-]/g, "")
      .replace(/\./g, "")
      .replace(",", ".");

    const number = Number(normalized);
    return Number.isFinite(number) ? number : 0;
  }

  function parseDate(value) {
    const text = String(value || "");
    const match = text.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})(?:\s+(\d{1,2}):(\d{1,2}))?/);
    if (!match) return new Date(0);

    const day = Number(match[1]);
    const month = Number(match[2]) - 1;
    const year = Number(match[3]);
    const hour = Number(match[4] || 0);
    const minute = Number(match[5] || 0);
    return new Date(year, month, day, hour, minute);
  }

  function formatCurrency(value) {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL"
    }).format(Number(value) || 0);
  }

  function formatCompactCurrency(value) {
    const number = Number(value) || 0;
    if (Math.abs(number) >= 1000) {
      return `R$ ${(number / 1000).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} mil`;
    }
    return formatCurrency(number);
  }

  function formatNumber(value) {
    return new Intl.NumberFormat("pt-BR").format(Number(value) || 0);
  }

  function formatDateTime(date) {
    if (!(date instanceof Date) || Number.isNaN(date.getTime())) return "--";
    return new Intl.DateTimeFormat("pt-BR", {
      dateStyle: "short",
      timeStyle: "short"
    }).format(date);
  }

  function safeText(value, fallback = "") {
    if (!hasValue(value)) return fallback;
    const text = String(value).replace(/\s+/g, " ").trim();
    return text || fallback;
  }

  function tidyName(value, fallback) {
    const text = safeText(value, fallback).replace(/\.$/, "");
    if (!text || text === fallback) return fallback;

    return text
      .toLocaleLowerCase("pt-BR")
      .replace(/(^|\s|\/)([a-zà-ú])/g, (match, separator, letter) => `${separator}${letter.toLocaleUpperCase("pt-BR")}`)
      .replace(/\bPix\b/g, "PIX")
      .replace(/\bHs\b/g, "HS")
      .replace(/\bLatam\b/g, "LATAM");
  }

  function escapeHtml(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function escapeAttribute(value) {
    return escapeHtml(value).replace(/`/g, "&#096;");
  }

  function normalizeForSearch(value) {
    return String(value || "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLocaleLowerCase("pt-BR")
      .trim();
  }

  function emptyRow(columns) {
    return `<tr><td class="empty-row" colspan="${columns}">Nenhum registro encontrado</td></tr>`;
  }

  function sumValues(rows) {
    return rows.reduce((sum, row) => sum + (Number(row.valor) || 0), 0);
  }

  function maxValue(rows) {
    return rows.reduce((max, row) => Math.max(max, Number(row.valor) || 0), 0);
  }

  function hasValue(value) {
    return value !== undefined && value !== null && value !== "";
  }

  function pad(value) {
    return String(value).padStart(2, "0");
  }

  function clampMonth(value) {
    const number = Number(value);
    if (!Number.isFinite(number)) return new Date().getMonth() + 1;
    return Math.min(12, Math.max(1, Math.trunc(number)));
  }

  function clampYear(value) {
    const number = Number(value);
    if (!Number.isFinite(number)) return new Date().getFullYear();
    return Math.min(2100, Math.max(2020, Math.trunc(number)));
  }

  function periodKey(month, year) {
    return `${year}-${pad(month)}`;
  }

  function getLastPeriods(month, year, count) {
    const periods = [];
    const date = new Date(year, month - 1, 1);

    for (let index = count - 1; index >= 0; index -= 1) {
      const cursor = new Date(date.getFullYear(), date.getMonth() - index, 1);
      periods.push({
        month: cursor.getMonth() + 1,
        year: cursor.getFullYear()
      });
    }

    return periods;
  }
})();
