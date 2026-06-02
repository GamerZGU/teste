(function () {
  "use strict";

  const FINANCEIRO_LOG_PREFIX = "[Financeiro Automático]";
  const API_URL = "https://script.google.com/macros/s/AKfycbx7sixleHf2AaEO2B1kl3QdJJrXHDAJ7tWnXfSc5g4xVSn-YgBhlpOhy3ASUvbK7SQiTw/exec";
  const FIREBASE_CONFIG = window.FIREBASE_CONFIG || {
    apiKey: "AIzaSyBCtEfGlMLaT7TyX0L0jN7oh-ezBzYEO1Q",
    authDomain: "financeiro-automatico.firebaseapp.com",
    projectId: "financeiro-automatico",
    storageBucket: "financeiro-automatico.firebasestorage.app",
    messagingSenderId: "17111161751",
    appId: "1:17111161751:web:0ff4f00ca6f27a795442d2"
  };
  const DEFAULT_USERS = [
    {
      email: "gustavoladislau26@gmail.com",
      password: "123456",
      name: "Gustavo Ladislau",
      role: "admin",
      createdAt: "2026-05-29T02:02:00.000Z"
    }
  ];
  const SYSTEM_SESSION_KEY = "financeiroAutomaticoUser";
  const USERS_STORAGE_KEY = "financeiroAutomaticoUsers";
  const GMAIL_SESSION_PREFIX = "financeiroAutomaticoGmail:";
  const GMAIL_CONNECTION_PREFIX = "financeiroAutomaticoGmailConnection:";
  const DATA_SOURCE_PREFIX = "financeiroAutomaticoDataSource:";
  const INVITES_STORAGE_KEY = "financeiroAutomaticoInvites";
  const SALES_STORAGE_PREFIX = "financeiroAutomaticoSales:";
  const SETTINGS_STORAGE_PREFIX = "financeiroAutomaticoSettings:";
  const USERS = loadUsers();
  const INVITES = loadInvites();
  const GMAIL_READONLY_SCOPE = "https://www.googleapis.com/auth/gmail.readonly";
  const GMAIL_PIX_QUERIES = [
    "subject:Pix",
    "\"Pix recebido\"",
    "\"Pix enviado\"",
    "\"pagamento realizado\"",
    "\"transferência realizada\""
  ];
  const GMAIL_MAX_MESSAGES = 20;
  const GMAIL_REQUEST_DELAY_MS = 300;
  const GMAIL_MAX_RETRIES = 4;
  const FIREBASE_PLACEHOLDER = "COLE_";
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
    firebaseAuth: null,
    googleProvider: null,
    firestoreDb: null,
    firestoreReady: false,
    firestoreSyncing: false,
    firestoreError: "",
    firestoreHydratedFor: "",
    inviteLookupInProgress: false,
    authReady: false,
    authUser: null,
    systemUser: getStoredSystemUser(),
    accessGranted: false,
    dataLoaded: false,
    dataSource: "api",
    gmailPixTransactions: [],
    gmailAccessToken: "",
    gmailConnected: false,
    gmailEmail: "",
    gmailConnectedAt: "",
    gmailSessionExpired: false,
    gmailFetchInProgress: false,
    lastGmailRequestAt: 0,
    manualSales: [],
    allSales: [],
    appSettings: null,
    userSettings: {},
    growthDataLoadedFor: "",
    adminUserFilter: "all",
    editingSaleId: "",
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
    ensureStylesheetLoaded();
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
    renderInviteGate();
    renderAuthPanel();
    dom.apiEndpoint.textContent = API_URL;
    setStatus("Aguardando login", "neutral");
    renderApp();
    updateAccessControl();
    createIcons();
    initGrowthFeatures();
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
    dom.apiModeButton = document.getElementById("apiModeButton");
    dom.gmailModeButton = document.getElementById("gmailModeButton");
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
    dom.authPanel = document.getElementById("authPanel");
    dom.authUser = document.getElementById("authUser");
    dom.authPhoto = document.getElementById("authPhoto");
    dom.authName = document.getElementById("authName");
    dom.authEmail = document.getElementById("authEmail");
    dom.authStatus = document.getElementById("authStatus");
    dom.googleSignInButton = document.getElementById("googleSignInButton");
    dom.signOutButton = document.getElementById("signOutButton");
    dom.connectGmailButton = document.getElementById("connectGmailButton");
    dom.appShell = document.getElementById("appShell");
    dom.accessGate = document.getElementById("accessGate");
    dom.accessMessage = document.getElementById("accessMessage");
    dom.accessHint = document.getElementById("accessHint");
    dom.systemLoginForm = document.getElementById("systemLoginForm");
    dom.systemLoginEmail = document.getElementById("systemLoginEmail");
    dom.systemLoginPassword = document.getElementById("systemLoginPassword");
    dom.systemLoginError = document.getElementById("systemLoginError");
    dom.inviteSignupForm = document.getElementById("inviteSignupForm");
    dom.inviteSignupName = document.getElementById("inviteSignupName");
    dom.inviteSignupEmail = document.getElementById("inviteSignupEmail");
    dom.inviteSignupPassword = document.getElementById("inviteSignupPassword");
    dom.inviteSignupError = document.getElementById("inviteSignupError");
    dom.systemSession = document.getElementById("systemSession");
    dom.systemUserName = document.getElementById("systemUserName");
    dom.systemUserRole = document.getElementById("systemUserRole");
    dom.systemLogoutButton = document.getElementById("systemLogoutButton");
    dom.adminNavButton = document.querySelector("[data-section='admin']");
    dom.adminTotalUsers = document.getElementById("adminTotalUsers");
    dom.adminUsersTable = document.getElementById("adminUsersTable");
    dom.adminInvitesTable = document.getElementById("adminInvitesTable");
    dom.adminUserForm = document.getElementById("adminUserForm");
    dom.adminEmail = document.getElementById("adminEmail");
    dom.adminRole = document.getElementById("adminRole");
    dom.adminInviteLink = document.getElementById("adminInviteLink");
    dom.adminMessage = document.getElementById("adminMessage");
  }

  function ensureStylesheetLoaded() {
    const link = document.getElementById("mainStylesheet");

    const injectFallback = () => {
      if (document.getElementById("styleFallback")) return;

      const style = document.createElement("style");
      style.id = "styleFallback";
      style.textContent = `
        body{margin:0;min-height:100vh;background:#050909;color:#f4fbf8;font-family:Inter,system-ui,sans-serif}
        .app-shell{display:grid;grid-template-columns:286px 1fr;min-height:100vh}.app-shell.access-locked{display:none}
        .sidebar,.panel,.access-card{background:#10181d;border:1px solid #25323b;border-radius:16px}
        .sidebar{padding:24px}.main-content{padding:30px}.access-gate{position:fixed;inset:0;display:grid;place-items:center;background:#040808}
        .google-button,.primary-button{background:#25d982;color:#06100d;border:0;border-radius:10px;padding:12px 16px;font-weight:800}
      `;
      document.head.appendChild(style);
    };

    const hasUsableStylesheet = () => {
      if (!link || !link.sheet) return false;

      try {
        return link.sheet.cssRules.length > 0;
      } catch (error) {
        return true;
      }
    };

    if (link) {
      link.addEventListener("error", injectFallback, { once: true });
    }

    window.setTimeout(() => {
      if (!hasUsableStylesheet()) {
        injectFallback();
      }
    }, 900);
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
      refreshCurrentSource(true);
    });

    dom.monthSelect.addEventListener("change", () => {
      syncPeriodFromHeader();
      syncHistoryPeriod();
      refreshCurrentSource();
    });

    dom.yearInput.addEventListener("change", () => {
      syncPeriodFromHeader();
      syncHistoryPeriod();
      refreshCurrentSource();
    });

    dom.historyMonth.addEventListener("change", () => {
      syncPeriodFromHistory();
      syncHeaderPeriod();
      refreshCurrentSource();
    });

    dom.historyYear.addEventListener("change", () => {
      syncPeriodFromHistory();
      syncHeaderPeriod();
      refreshCurrentSource();
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

    dom.googleSignInButton.addEventListener("click", signInWithGoogle);
    dom.signOutButton.addEventListener("click", signOutGoogle);
    dom.connectGmailButton.addEventListener("click", connectGmailAndSearchPix);
    dom.apiModeButton.addEventListener("click", () => setDataSource("api"));
    dom.gmailModeButton.addEventListener("click", () => setDataSource("gmail"));
    dom.systemLoginForm.addEventListener("submit", handleSystemLogin);
    dom.inviteSignupForm.addEventListener("submit", handleInviteSignup);
    dom.systemLogoutButton.addEventListener("click", logoutSystem);
    dom.adminUserForm.addEventListener("submit", handleAdminUserSubmit);
  }

  function bindLibraryEvents() {
    const chartScript = document.getElementById("chartJsScript");
    const lucideScript = document.getElementById("lucideScript");
    const firebaseAppScript = document.getElementById("firebaseAppScript");
    const firebaseAuthScript = document.getElementById("firebaseAuthScript");
    const firebaseFirestoreScript = document.getElementById("firebaseFirestoreScript");

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

    [firebaseAppScript, firebaseAuthScript, firebaseFirestoreScript].forEach((script) => {
      if (!script) return;
      script.addEventListener("load", initFirebaseServices);
      script.addEventListener("error", () => {
        dom.authStatus.textContent = "Não foi possível carregar o Firebase.";
        dom.googleSignInButton.disabled = true;
      }, { once: true });
    });

    window.setTimeout(() => {
      createIcons();
      renderCharts();
      initFirebaseServices();
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

  function setDataSource(source) {
    if (source === "api" && !isAdminUser()) {
      state.dataSource = "gmail";
      renderSourceMode();
      showToast("Modo API disponível apenas para admin.", "error");
      showGmailEmptyState();
      return;
    }

    state.dataSource = source;
    saveDataSourcePreference(source);
    renderSourceMode();

    if (source === "api") {
      loadFinancialData(true);
      return;
    }

    if (state.gmailPixTransactions.length || loadGmailSessionData()) {
      applyGmailPixToDashboard();
      return;
    }

    if (!state.gmailConnected) {
      showToast("Conecte o Gmail para usar esta fonte de dados.", "error");
      connectGmailAndSearchPix();
      return;
    }

    if (!state.gmailAccessToken) {
      showGmailExpired();
      return;
    }

    searchPixInConnectedGmail(true);
  }

  async function refreshCurrentSource(isManualRefresh) {
    if (state.dataSource === "api" && !isAdminUser()) {
      state.dataSource = "gmail";
      saveDataSourcePreference("gmail");
      showGmailEmptyState();
      return;
    }

    if (state.dataSource === "gmail") {
      if (!state.gmailConnected) {
        showToast("Conecte o Gmail para atualizar esta fonte.", "error");
        renderAuthPanel();
        return;
      }

      if (!state.gmailAccessToken) {
        showGmailExpired();
        return;
      }

      searchPixInConnectedGmail(isManualRefresh);
      return;
    }

    loadFinancialData(isManualRefresh);
  }

  function renderSourceMode() {
    dom.apiModeButton.hidden = !isAdminUser();
    dom.apiModeButton.parentElement.classList.toggle("api-hidden", !isAdminUser());
    if (!isAdminUser() && state.dataSource !== "gmail") {
      state.dataSource = "gmail";
    }
    dom.apiModeButton.classList.toggle("active", state.dataSource === "api");
    dom.gmailModeButton.classList.toggle("active", state.dataSource === "gmail");
  }

  function handleSystemLogin(event) {
    event.preventDefault();

    const email = normalizeEmail(dom.systemLoginEmail.value);
    const password = dom.systemLoginPassword.value;
    const user = USERS.find((item) => normalizeEmail(item.email) === email && item.password === password);

    if (!user) {
      dom.systemLoginError.hidden = false;
      dom.systemLoginPassword.value = "";
      dom.systemLoginPassword.focus();
      return;
    }

    if (state.systemUser && normalizeEmail(state.systemUser.email) !== email) {
      clearGmailConnection({ clearData: true });
      state.data = createEmptyData(state.month, state.year);
      state.monthlySeries = [];
      state.dataLoaded = false;
      state.dataSource = "api";
      state.manualSales = [];
      state.allSales = [];
      state.appSettings = null;
      state.growthDataLoadedFor = "";
    }

    state.systemUser = {
      email: user.email,
      name: user.name,
      role: user.role
    };
    saveSystemSession(state.systemUser);
    saveCurrentUserToFirestore();
    dom.systemLoginError.hidden = true;
    dom.systemLoginForm.reset();
    updateAccessControl();
    addSystemLog("login realizado", `${state.systemUser.email} entrou no sistema`);
    showToast(`Bem-vindo, ${state.systemUser.name}.`);
  }

  function logoutSystem() {
    clearGmailConnection({ clearData: true });
    clearSystemSession();
    state.systemUser = null;
    state.accessGranted = false;
    state.dataLoaded = false;
    state.dataSource = "api";
    state.data = createEmptyData(state.month, state.year);
    state.monthlySeries = [];
    state.manualSales = [];
    state.allSales = [];
    state.appSettings = null;
    state.growthDataLoadedFor = "";
    updateAccessControl();
    renderSourceMode();
    showToast("Você saiu do sistema.");
  }

  function loadUsers() {
    const usersByEmail = new Map(DEFAULT_USERS.map((user) => [normalizeEmail(user.email), normalizeUser(user)]));

    try {
      const stored = JSON.parse(window.localStorage.getItem(USERS_STORAGE_KEY) || "[]");

      if (Array.isArray(stored)) {
        stored.forEach((user) => {
          const normalized = normalizeUser(user);
          if (normalized.email && normalized.password) {
            usersByEmail.set(normalizeEmail(normalized.email), normalized);
          }
        });
      }
    } catch (error) {
      console.warn(`${FINANCEIRO_LOG_PREFIX} Não foi possível carregar usuários locais.`, error);
    }

    return Array.from(usersByEmail.values());
  }

  function saveUsers() {
    try {
      window.localStorage.setItem(USERS_STORAGE_KEY, JSON.stringify(USERS));
      return true;
    } catch (error) {
      console.warn(`${FINANCEIRO_LOG_PREFIX} Não foi possível salvar usuários locais.`, error);
      return false;
    }
  }

  function normalizeUser(user) {
    return {
      email: safeText(user && user.email, ""),
      password: safeText(user && user.password, ""),
      name: safeText(user && user.name, safeText(user && user.email, "Usuário")),
      role: safeText(user && user.role, "user").toLocaleLowerCase("pt-BR") === "admin" ? "admin" : "user",
      blocked: Boolean(user && user.blocked),
      createdAt: safeText(user && user.createdAt, new Date().toISOString())
    };
  }

  function handleAdminUserSubmit(event) {
    event.preventDefault();

    if (!isAdminUser()) {
      showToast("Apenas admin pode adicionar usuários.", "error");
      return;
    }

    const invite = normalizeInvite({
      email: dom.adminEmail.value,
      role: dom.adminRole.value
    });

    if (!invite.email) {
      showAdminMessage("Informe o e-mail autorizado.", "error");
      return;
    }

    const existingUnused = INVITES.find((item) => normalizeEmail(item.email) === normalizeEmail(invite.email) && !item.usedAt && item.status !== "canceled");
    const finalInvite = existingUnused || invite;

    if (!existingUnused) {
      INVITES.push(finalInvite);
      saveInvites();
    }
    saveInviteToFirestore(finalInvite);
    addSystemLog("convite criado", `${finalInvite.email} (${finalInvite.role})`);

    const link = buildInviteLink(finalInvite.token);
    dom.adminInviteLink.value = link;
    dom.adminUserForm.reset();
    dom.adminRole.value = "user";
    dom.adminInviteLink.value = link;
    renderAdmin();
    showAdminMessage(existingUnused ? "Convite existente reutilizado." : "Convite gerado com sucesso.", "success");
    showToast("Link de convite pronto.");
  }

  function showAdminMessage(message, type = "success") {
    dom.adminMessage.textContent = message;
    dom.adminMessage.classList.toggle("error", type === "error");
    dom.adminMessage.hidden = false;
  }

  function saveSystemSession(user) {
    const payload = JSON.stringify({
      email: user.email,
      name: user.name,
      role: user.role,
      loggedAt: new Date().toISOString()
    });

    window.localStorage.setItem(SYSTEM_SESSION_KEY, payload);
    window.sessionStorage.setItem(SYSTEM_SESSION_KEY, payload);
  }

  function clearSystemSession() {
    window.localStorage.removeItem(SYSTEM_SESSION_KEY);
    window.sessionStorage.removeItem(SYSTEM_SESSION_KEY);
  }

  function loadInvites() {
    try {
      const stored = JSON.parse(window.localStorage.getItem(INVITES_STORAGE_KEY) || "[]");
      return Array.isArray(stored) ? stored.map(normalizeInvite).filter((invite) => invite.token && invite.email) : [];
    } catch (error) {
      console.warn(`${FINANCEIRO_LOG_PREFIX} Não foi possível carregar convites locais.`, error);
      return [];
    }
  }

  function saveInvites() {
    try {
      window.localStorage.setItem(INVITES_STORAGE_KEY, JSON.stringify(INVITES));
      return true;
    } catch (error) {
      console.warn(`${FINANCEIRO_LOG_PREFIX} Não foi possível salvar convites locais.`, error);
      return false;
    }
  }

  function normalizeInvite(invite) {
    const usedAt = safeText(invite && invite.usedAt, "");
    return {
      token: safeText(invite && invite.token, createInviteToken()),
      email: normalizeEmail(invite && invite.email),
      role: safeText(invite && invite.role, "user").toLocaleLowerCase("pt-BR") === "admin" ? "admin" : "user",
      createdAt: safeText(invite && invite.createdAt, new Date().toISOString()),
      usedAt,
      status: safeText(invite && invite.status, usedAt ? "used" : "active")
    };
  }

  function createInviteToken() {
    const bytes = new Uint8Array(18);

    if (window.crypto && window.crypto.getRandomValues) {
      window.crypto.getRandomValues(bytes);
      return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
    }

    return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 14)}`;
  }

  function getInviteTokenFromUrl() {
    return safeText(new URLSearchParams(window.location.search).get("invite"), "");
  }

  function getActiveInvite() {
    const token = getInviteTokenFromUrl();
    if (!token) return null;

    return INVITES.find((invite) => invite.token === token && !invite.usedAt && invite.status === "active") || null;
  }

  function renderInviteGate() {
    const token = getInviteTokenFromUrl();
    const invite = getActiveInvite();

    if (!token) {
      dom.systemLoginForm.hidden = false;
      dom.inviteSignupForm.hidden = true;
      return;
    }

    dom.systemLoginForm.hidden = Boolean(invite);
    dom.inviteSignupForm.hidden = !invite;

    if (!invite) {
      if (canUseFirestore() && !state.inviteLookupInProgress) {
        dom.accessMessage.textContent = "Carregando convite.";
        dom.accessHint.textContent = "Validando token no Firestore.";
        dom.systemLoginForm.hidden = true;
        hydrateInviteFromFirestoreToken(token);
        return;
      }

      dom.accessMessage.textContent = "Convite inválido ou já utilizado.";
      dom.accessHint.textContent = "Peça um novo convite ao administrador.";
      dom.systemLoginForm.hidden = false;
      dom.inviteSignupError.hidden = false;
      return;
    }

    dom.accessMessage.textContent = "Complete seu cadastro para acessar o Financeiro Automático.";
    dom.accessHint.textContent = "Este convite só permite cadastrar o e-mail autorizado.";
    dom.inviteSignupEmail.value = invite.email;
  }

  function handleInviteSignup(event) {
    event.preventDefault();

    const invite = getActiveInvite();
    const email = normalizeEmail(dom.inviteSignupEmail.value);

    if (!invite || email !== normalizeEmail(invite.email)) {
      dom.inviteSignupError.textContent = "Convite inválido ou já utilizado.";
      dom.inviteSignupError.hidden = false;
      return;
    }

    const user = normalizeUser({
      name: dom.inviteSignupName.value,
      email,
      password: dom.inviteSignupPassword.value,
      role: invite.role
    });

    if (!user.name || !user.email || !user.password) {
      dom.inviteSignupError.textContent = "Preencha nome e senha para concluir.";
      dom.inviteSignupError.hidden = false;
      return;
    }

    const existingIndex = USERS.findIndex((item) => normalizeEmail(item.email) === normalizeEmail(user.email));

    if (existingIndex >= 0) {
      USERS[existingIndex] = user;
    } else {
      USERS.push(user);
    }

    invite.usedAt = new Date().toISOString();
    invite.status = "used";
    saveUsers();
    saveInvites();

    state.systemUser = {
      email: user.email,
      name: user.name,
      role: user.role
    };
    saveSystemSession(state.systemUser);
    saveCurrentUserToFirestore();
    saveInviteToFirestore(invite);
    addSystemLog("usuário cadastrado", `${user.email} concluiu o convite (${user.role})`);
    dom.inviteSignupForm.reset();
    updateAccessControl();
    showToast("Cadastro concluído. Bem-vindo!");
  }

  function buildInviteLink(token) {
    const url = new URL(window.location.href);
    url.searchParams.set("invite", token);
    return url.toString();
  }

  function getStoredSystemUser() {
    try {
      const raw = window.localStorage.getItem(SYSTEM_SESSION_KEY) || window.sessionStorage.getItem(SYSTEM_SESSION_KEY);
      const stored = JSON.parse(raw || "null");

      if (!stored || !isSystemUserAllowed(stored.email)) {
        clearSystemSession();
        return null;
      }

      return stored;
    } catch (error) {
      return null;
    }
  }

  function isSystemUserAllowed(email) {
    return USERS.some((user) => normalizeEmail(user.email) === normalizeEmail(email) && !user.blocked);
  }

  function initFirebaseServices() {
    initFirebaseAuth();
    initFirestore();
  }

  function initFirebaseAuth() {
    if (state.authReady || state.firebaseAuth) return;

    if (!isFirebaseConfigured()) {
      dom.authStatus.textContent = "Configure o Firebase para ativar o login.";
      dom.googleSignInButton.disabled = true;
      updateAccessControl();
      return;
    }

    if (!window.firebase || !window.firebase.auth) {
      dom.authStatus.textContent = "Carregando Firebase Authentication.";
      return;
    }

    try {
      if (!window.firebase.apps.length) {
        window.firebase.initializeApp(FIREBASE_CONFIG);
      }

      state.firebaseAuth = window.firebase.auth();
      state.googleProvider = new window.firebase.auth.GoogleAuthProvider();
      state.googleProvider.setCustomParameters({
        prompt: "select_account"
      });

      state.firebaseAuth.setPersistence(window.firebase.auth.Auth.Persistence.LOCAL).catch(() => {});
      state.firebaseAuth.onAuthStateChanged((user) => {
        const previousEmail = normalizeEmail(state.authUser && state.authUser.email);
        const nextEmail = normalizeEmail(user && user.email);

        if ((previousEmail && previousEmail !== nextEmail) || (state.gmailEmail && nextEmail && normalizeEmail(state.gmailEmail) !== nextEmail)) {
          clearGmailConnection({ clearData: true });
        }
        state.authReady = true;
        state.authUser = user;
        if (state.accessGranted && !state.gmailConnected) {
          restoreGmailConnectionState();
        }
        renderAuthPanel();
        updateAccessControl();
      });

      dom.authStatus.textContent = "Login Google pronto.";
      dom.googleSignInButton.disabled = false;
    } catch (error) {
      dom.authStatus.textContent = "Erro ao iniciar Firebase Authentication.";
      dom.googleSignInButton.disabled = true;
      showToast(`Firebase Auth: ${error.message}`, "error");
    }
  }

  function initFirestore() {
    if (state.firestoreReady || state.firestoreDb) return Boolean(state.firestoreDb);

    if (!isFirebaseConfigured()) {
      state.firestoreError = "Firebase não configurado.";
      return false;
    }

    if (!window.firebase || !window.firebase.firestore) {
      state.firestoreError = "Firestore ainda não carregado.";
      return false;
    }

    try {
      if (!window.firebase.apps.length) {
        window.firebase.initializeApp(FIREBASE_CONFIG);
      }

      state.firestoreDb = window.firebase.firestore();
      state.firestoreReady = true;
      state.firestoreError = "";
      hydrateInviteFromFirestoreToken();
      syncLocalDataToFirestore();
      hydrateFirestoreData();
      return true;
    } catch (error) {
      state.firestoreDb = null;
      state.firestoreReady = false;
      state.firestoreError = error.message || "Erro ao iniciar Firestore.";
      console.warn(`${FINANCEIRO_LOG_PREFIX} Firestore indisponível. Usando fallback localStorage.`, error);
      return false;
    }
  }

  function canUseFirestore() {
    return Boolean(state.firestoreDb && state.firestoreReady);
  }

  function syncFirestoreForCurrentUser() {
    if (!state.systemUser) return;

    initFirestore();

    if (!canUseFirestore()) return;

    const hydrateKey = `${getCurrentUserId()}:${isAdminUser() ? "admin" : "user"}`;
    syncLocalDataToFirestore();

    if (state.firestoreHydratedFor === hydrateKey) return;

    state.firestoreHydratedFor = hydrateKey;
    hydrateFirestoreData();
  }

  async function syncLocalDataToFirestore() {
    if (!canUseFirestore() || state.firestoreSyncing) return;

    state.firestoreSyncing = true;

    try {
      if (state.systemUser) {
        await saveCurrentUserToFirestore();
      }

      if (isAdminUser()) {
        for (const user of USERS) {
          await saveUserToFirestore(user);
        }

        for (const invite of INVITES) {
          await saveInviteToFirestore(invite);
        }
      }

      if (state.gmailPixTransactions.length) {
        await saveTransactionsToFirestore(state.gmailPixTransactions);
      }
      if (state.manualSales.length) {
        for (const sale of state.manualSales) {
          await saveSaleToFirestore(sale);
        }
      }
      if (state.appSettings) {
        await saveSettingsToFirestore(state.appSettings);
      }
    } catch (error) {
      state.firestoreError = error.message || "Falha ao sincronizar Firestore.";
      console.warn(`${FINANCEIRO_LOG_PREFIX} Firestore falhou. Mantendo fallback localStorage.`, error);
    } finally {
      state.firestoreSyncing = false;
    }
  }

  async function hydrateFirestoreData() {
    if (!canUseFirestore() || !state.systemUser) return;

    try {
      if (isAdminUser()) {
        await hydrateUsersFromFirestore();
        await hydrateInvitesFromFirestore();
      }

      await hydrateTransactionsFromFirestore();
      renderAdmin();
    } catch (error) {
      state.firestoreError = error.message || "Falha ao carregar Firestore.";
      console.warn(`${FINANCEIRO_LOG_PREFIX} Firestore indisponível. Usando fallback localStorage.`, error);
    }
  }

  async function hydrateUsersFromFirestore() {
    const snapshot = await state.firestoreDb.collection("users").get();
    const byEmail = new Map(USERS.map((user) => [normalizeEmail(user.email), user]));

    snapshot.forEach((doc) => {
      const data = doc.data();
      const localUser = byEmail.get(normalizeEmail(data.email || doc.id));
      const remote = normalizeUser({
        ...data,
        email: data.email || doc.id,
        password: data.password || (localUser && localUser.password) || "",
        blocked: Boolean(data.blocked),
        createdAt: data.createdAt || ""
      });

      if (remote.email) {
        byEmail.set(normalizeEmail(remote.email), remote);
      }
    });

    USERS.splice(0, USERS.length, ...Array.from(byEmail.values()));
    saveUsers();
  }

  async function hydrateInvitesFromFirestore() {
    const snapshot = await state.firestoreDb.collection("invites").get();
    const byToken = new Map(INVITES.map((invite) => [invite.token, invite]));

    snapshot.forEach((doc) => {
      const remote = normalizeInvite({
        token: doc.id,
        ...doc.data()
      });

      if (remote.token) {
        byToken.set(remote.token, remote);
      }
    });

    INVITES.splice(0, INVITES.length, ...Array.from(byToken.values()));
    saveInvites();
  }

  async function hydrateInviteFromFirestoreToken(token = getInviteTokenFromUrl()) {
    if (!canUseFirestore() || !token || state.inviteLookupInProgress) return false;

    state.inviteLookupInProgress = true;

    try {
      const doc = await state.firestoreDb.collection("invites").doc(token).get();

      if (!doc.exists) return false;

      const invite = normalizeInvite({
        token: doc.id,
        ...doc.data()
      });

      const index = INVITES.findIndex((item) => item.token === invite.token);
      if (index >= 0) {
        INVITES[index] = invite;
      } else {
        INVITES.push(invite);
      }

      saveInvites();
      renderInviteGate();
      return true;
    } catch (error) {
      state.firestoreError = error.message || "Falha ao buscar convite.";
      console.warn(`${FINANCEIRO_LOG_PREFIX} Convite não carregou no Firestore. Usando fallback localStorage.`, error);
      return false;
    } finally {
      state.inviteLookupInProgress = false;
    }
  }

  async function hydrateTransactionsFromFirestore() {
    const userId = getCurrentUserId();
    if (!userId) return false;

    const snapshot = await state.firestoreDb
      .collection("transactions")
      .doc(userId)
      .collection("items")
      .get();

    const transactions = [];
    snapshot.forEach((doc) => {
      const transaction = normalizeFirestoreTransaction(doc.id, doc.data());
      if (transaction) transactions.push(transaction);
    });

    if (!transactions.length) return false;

    state.gmailPixTransactions = transactions.sort((a, b) => (parseDate(b.data).getTime() || 0) - (parseDate(a.data).getTime() || 0));
    saveGmailSessionData(state.gmailPixTransactions);

    if (state.dataSource === "gmail") {
      applyGmailPixToDashboard({ silent: true });
    }

    return true;
  }

  async function saveCurrentUserToFirestore() {
    if (!state.systemUser) return false;
    return saveUserToFirestore(state.systemUser);
  }

  async function saveUserToFirestore(user) {
    if (!canUseFirestore()) return false;

    const normalized = normalizeUser(user);
    if (!normalized.email) return false;
    const localUser = USERS.find((item) => normalizeEmail(item.email) === normalizeEmail(normalized.email));
    const password = normalized.password || (localUser && localUser.password) || "";
    const payload = {
      name: normalized.name,
      email: normalizeEmail(normalized.email),
      role: normalized.role,
      blocked: Boolean(normalized.blocked),
      createdAt: normalized.createdAt || new Date().toISOString()
    };

    if (password) {
      payload.password = password;
    }

    try {
      await state.firestoreDb.collection("users").doc(getUserIdFromEmail(normalized.email)).set(payload, { merge: true });
      return true;
    } catch (error) {
      state.firestoreError = error.message || "Falha ao salvar usuário.";
      console.warn(`${FINANCEIRO_LOG_PREFIX} Usuário mantido no fallback localStorage.`, error);
      return false;
    }
  }

  async function saveInviteToFirestore(invite) {
    if (!canUseFirestore()) return false;

    const normalized = normalizeInvite(invite);
    if (!normalized.token || !normalized.email) return false;

    try {
      await state.firestoreDb.collection("invites").doc(normalized.token).set({
        email: normalizeEmail(normalized.email),
        role: normalized.role,
        status: normalized.status === "canceled" ? "canceled" : normalized.usedAt ? "used" : normalized.status || "active",
        createdAt: normalized.createdAt || new Date().toISOString(),
        usedAt: normalized.usedAt || ""
      }, { merge: true });
      return true;
    } catch (error) {
      state.firestoreError = error.message || "Falha ao salvar convite.";
      console.warn(`${FINANCEIRO_LOG_PREFIX} Convite mantido no fallback localStorage.`, error);
      return false;
    }
  }

  async function saveTransactionsToFirestore(transactions) {
    if (!canUseFirestore() || !state.systemUser || !Array.isArray(transactions) || !transactions.length) return false;

    const userId = getCurrentUserId();
    if (!userId) return false;

    try {
      const batch = state.firestoreDb.batch();
      const collection = state.firestoreDb.collection("transactions").doc(userId).collection("items");

      transactions.forEach((transaction, index) => {
        const id = getTransactionFirestoreId(transaction, index);
        batch.set(collection.doc(id), toFirestoreTransaction(transaction), { merge: true });
      });

      await batch.commit();
      return true;
    } catch (error) {
      state.firestoreError = error.message || "Falha ao salvar transações.";
      console.warn(`${FINANCEIRO_LOG_PREFIX} Transações mantidas no fallback localStorage.`, error);
      return false;
    }
  }

  function toFirestoreTransaction(transaction) {
    const gmailMessageId = transaction.gmailMessageId || transaction.emailId || transaction.id || "";

    return {
      id: transaction.id || gmailMessageId || transaction.hash || "",
      tipo: transaction.tipo,
      nome: transaction.nome || transaction.destino || "",
      valor: Number(transaction.valor) || 0,
      data: transaction.data || "",
      categoria: transaction.categoria || "Gmail / Pix",
      banco: transaction.banco || transaction.origemPix || transaction.origem || "",
      origem: "gmail",
      gmailMessageId,
      hash: transaction.hash || createPixHash(`${transaction.tipo}|${transaction.nome}|${transaction.valor}|${transaction.data}`),
      rawSnippet: transaction.rawSnippet || transaction.snippet || "",
      createdAt: new Date().toISOString()
    };
  }

  function normalizeFirestoreTransaction(id, data) {
    if (!data || typeof data !== "object") return null;

    return {
      id,
      emailId: safeText(data.gmailMessageId, id),
      gmailMessageId: safeText(data.gmailMessageId, id),
      tipo: data.tipo === "enviado" || data.tipo === "saida" ? "enviado" : "recebido",
      nome: safeText(data.nome, "Transação Pix"),
      valor: Number(data.valor) || 0,
      data: safeText(data.data, ""),
      categoria: safeText(data.categoria, "Gmail / Pix"),
      banco: safeText(data.banco, ""),
      origem: safeText(data.origem, "gmail"),
      hash: safeText(data.hash, ""),
      rawSnippet: safeText(data.rawSnippet, ""),
      descricao: `Pix identificado no ${safeText(data.origem, "gmail")}`,
      raw: clonePlainObject(data)
    };
  }

  function getTransactionFirestoreId(transaction, index) {
    const base = transaction.gmailMessageId || transaction.emailId || transaction.hash || transaction.id || transaction.transactionId || `${transaction.tipo}-${transaction.data}-${transaction.nome}-${transaction.valor}-${index}`;
    return encodeURIComponent(String(base).replace(/\//g, "-")).slice(0, 420);
  }

  function getCurrentUserId() {
    return getUserIdFromEmail(state.systemUser && state.systemUser.email);
  }

  function getUserIdFromEmail(email) {
    const normalized = normalizeEmail(email);
    return normalized ? normalized.replace(/\//g, "_") : "";
  }

  async function signInWithGoogle() {
    initFirebaseServices();

    if (!state.firebaseAuth || !state.googleProvider) {
      const message = isFirebaseConfigured()
        ? "Firebase Authentication ainda está carregando. Tente novamente em alguns segundos."
        : "Preencha o firebaseConfig para ativar o login Google.";
      showToast(message, "error");
      return;
    }

    try {
      dom.googleSignInButton.disabled = true;
      dom.authStatus.textContent = "Abrindo login do Google.";
      await state.firebaseAuth.signInWithPopup(state.googleProvider);
    } catch (error) {
      dom.googleSignInButton.disabled = false;
      dom.authStatus.textContent = "Não foi possível entrar com Google.";
      showToast(`Login Google: ${friendlyAuthError(error)}`, "error");
    }
  }

  async function signOutGoogle() {
    if (!state.firebaseAuth) return;

    try {
      clearGmailConnection({ clearData: true, clearStored: true });
      await state.firebaseAuth.signOut();
      showToast("Você saiu da conta Google.");
    } catch (error) {
      showToast(`Erro ao sair: ${friendlyAuthError(error)}`, "error");
    }
  }

  async function connectGmailAndSearchPix() {
    if (state.gmailFetchInProgress) {
      showToast("Busca no Gmail já está em andamento.");
      return;
    }

    if (!state.accessGranted) {
      showToast("Entre no sistema antes de conectar o Gmail.", "error");
      return;
    }

    initFirebaseServices();

    if (!state.firebaseAuth) {
      showToast("Firebase Authentication ainda não está pronto.", "error");
      return;
    }

    state.gmailFetchInProgress = true;
    dom.connectGmailButton.disabled = true;
    dom.authStatus.textContent = "Pedindo permissão do Gmail.";

    try {
      const provider = createGmailProvider();
      const result = state.authUser
        ? await state.authUser.reauthenticateWithPopup(provider)
        : await state.firebaseAuth.signInWithPopup(provider);
      const credential = window.firebase.auth.GoogleAuthProvider.credentialFromResult(result) || result.credential;
      const accessToken = credential && credential.accessToken;

      if (!accessToken) {
        throw new Error("token do Gmail não retornado pelo Google");
      }

      state.gmailAccessToken = accessToken;
      state.gmailConnected = true;
      state.authUser = result.user || state.authUser;
      state.gmailEmail = (state.authUser && state.authUser.email) || "";
      state.gmailConnectedAt = new Date().toISOString();
      state.gmailSessionExpired = false;
      saveGmailConnectionMetadata();
      addSystemLog("Gmail conectado", state.gmailEmail || "Conta Google autorizada");
      await searchPixInConnectedGmail(true);
    } catch (error) {
      if (isGmailAuthExpiredError(error)) {
        showGmailExpired();
      } else {
        if (state.gmailEmail || loadGmailConnectionMetadata()) {
          state.gmailAccessToken = "";
          state.gmailSessionExpired = true;
        } else {
          clearGmailConnection();
        }
        dom.authStatus.textContent = "Gmail não conectado.";
        showToast(`Gmail API: ${friendlyAuthError(error)}`, "error");
      }
    } finally {
      state.gmailFetchInProgress = false;
      renderAuthPanel();
    }
  }

  function createGmailProvider() {
    const provider = new window.firebase.auth.GoogleAuthProvider();
    provider.addScope(GMAIL_READONLY_SCOPE);
    provider.setCustomParameters({
      prompt: "select_account",
      login_hint: (state.authUser && state.authUser.email) || ""
    });
    return provider;
  }

  async function searchPixInConnectedGmail(isManualRefresh) {
    if (!state.gmailAccessToken) {
      showToast("Conecte o Gmail antes de buscar e-mails Pix.", "error");
      return;
    }

    state.gmailFetchInProgress = true;
    dom.connectGmailButton.disabled = true;
    dom.authStatus.textContent = "Lendo e-mails Pix no Gmail.";

    try {
      const emails = await fetchPixEmailsFromGmail(state.gmailAccessToken);
      const pixTransactions = extractPixTransactionsFromEmails(emails);

      state.gmailPixTransactions = pixTransactions;
      state.dataSource = "gmail";
      saveDataSourcePreference("gmail");
      saveGmailSessionData(pixTransactions);
      saveTransactionsToFirestore(pixTransactions);
      logGmailPixEmails(emails, pixTransactions);
      applyGmailPixToDashboard();

      dom.authStatus.textContent = `${pixTransactions.length} Pix identificados via Gmail.`;
      addSystemLog("sync realizado", `${pixTransactions.length} Pix identificados via Gmail`);
      showToast(`${pixTransactions.length} Pix identificados via Gmail.`);
    } catch (error) {
      if (isGmailAuthExpiredError(error)) {
        showGmailExpired();
      } else {
        dom.authStatus.textContent = "Não foi possível ler os e-mails Pix.";
        showToast(`Gmail API: ${friendlyAuthError(error)}`, "error");
      }
      if (!isManualRefresh) {
        state.dataSource = "api";
        renderSourceMode();
      }
    } finally {
      state.gmailFetchInProgress = false;
      renderAuthPanel();
    }
  }

  async function fetchPixEmailsFromGmail(accessToken) {
    const byId = new Map();

    for (const query of GMAIL_PIX_QUERIES) {
      if (byId.size >= GMAIL_MAX_MESSAGES) break;

      const messages = await listGmailMessages(accessToken, query);
      messages.forEach((message) => {
        if (byId.size >= GMAIL_MAX_MESSAGES && !byId.has(message.id)) return;

        if (!byId.has(message.id)) {
          byId.set(message.id, {
            id: message.id,
            threadId: message.threadId,
            matchedQueries: []
          });
        }
        byId.get(message.id).matchedQueries.push(query);
      });
    }

    const uniqueMessages = Array.from(byId.values()).slice(0, GMAIL_MAX_MESSAGES);
    const details = [];

    for (const message of uniqueMessages) {
      const metadata = await getGmailMessageMetadata(accessToken, message);

      if (metadata) {
        details.push(metadata);
      }

      console.log(`Gmail API: ${details.length}/${uniqueMessages.length} mensagens processadas.`);
    }

    return details.filter(Boolean);
  }

  async function listGmailMessages(accessToken, query) {
    const url = new URL("https://gmail.googleapis.com/gmail/v1/users/me/messages");
    url.searchParams.set("q", query);
    url.searchParams.set("maxResults", String(GMAIL_MAX_MESSAGES));

    const data = await gmailFetchJson(url, accessToken);
    return Array.isArray(data.messages) ? data.messages : [];
  }

  async function getGmailMessageMetadata(accessToken, message) {
    const url = new URL(`https://gmail.googleapis.com/gmail/v1/users/me/messages/${message.id}`);
    url.searchParams.set("format", "full");

    const data = await gmailFetchJson(url, accessToken);
    const headers = (data.payload && data.payload.headers) || [];
    const bodyText = extractGmailText(data.payload);

    return {
      id: data.id,
      threadId: data.threadId,
      matchedQueries: message.matchedQueries,
      subject: getHeader(headers, "Subject"),
      from: getHeader(headers, "From"),
      to: getHeader(headers, "To"),
      date: getHeader(headers, "Date"),
      snippet: data.snippet || "",
      bodyText,
      labelIds: data.labelIds || []
    };
  }

  function extractPixTransactionsFromEmails(emails) {
    const transactions = [];
    const seen = new Set();

    emails.forEach((email) => {
      const parsed = parsePixEmail(email);

      if (!parsed) return;

      const keys = [
        parsed.gmailMessageId,
        parsed.hash,
        `${parsed.data}|${parsed.valor}|${normalizeForSearch(parsed.nome)}`
      ].filter(Boolean);
      const duplicated = keys.some((key) => seen.has(key));

      if (duplicated) {
      console.warn(`${FINANCEIRO_LOG_PREFIX} Pix duplicado ignorado`, {
          gmailMessageId: parsed.gmailMessageId,
          nome: parsed.nome,
          valor: parsed.valor
        });
        return;
      }

      keys.forEach((key) => seen.add(key));
      transactions.push(parsed);
    });

    console.log(`Pix identificados com sucesso: ${transactions.length}/${emails.length}`);
    return transactions;
  }

  function parsePixEmail(email) {
    const sourceText = normalizeEmailText(`${email.subject}\n${email.snippet}\n${email.bodyText}`);
    const type = detectPixType(sourceText, email.matchedQueries);
    const value = extractPixValue(sourceText);
    const name = extractPixName(sourceText, type, email);
    const date = extractPixDate(sourceText) || formatGmailHeaderDate(email.date);
    const category = extractPixCategory(sourceText, type, name);
    const bank = extractPixBankName(sourceText);
    const gmailMessageId = email.id || "";
    const rawSnippet = safeText(email.snippet || sourceText.slice(0, 240), "");
    const hash = createPixHash(`${type}|${name}|${value}|${date}|${bank}|${rawSnippet.slice(0, 80)}`);

    if (!type || !value || !name || !date) {
      console.warn(`${FINANCEIRO_LOG_PREFIX} E-mail Pix ignorado por dados incompletos`, {
        gmailMessageId,
        hasType: Boolean(type),
        hasValue: Boolean(value),
        hasName: Boolean(name),
        hasDate: Boolean(date),
        subject: email.subject || ""
      });
      return null;
    }

    return {
      id: gmailMessageId || hash,
      tipo: type,
      nome: name,
      valor: value,
      data: date,
      categoria: category,
      origem: "gmail",
      banco: bank,
      gmailMessageId,
      hash,
      rawSnippet,
      descricao: type === "recebido" ? "Pix recebido via Gmail" : "Pix enviado via Gmail",
      emailId: email.id,
      subject: email.subject,
      raw: email
    };
  }

  function createPixHash(value) {
    const text = String(value || "");
    let hash = 0;

    for (let index = 0; index < text.length; index += 1) {
      hash = ((hash << 5) - hash) + text.charCodeAt(index);
      hash |= 0;
    }

    return `pix_${Math.abs(hash).toString(36)}`;
  }

  function detectPixType(text, matchedQueries) {
    const queryText = Array.isArray(matchedQueries) ? matchedQueries.join(" ") : "";
    const haystack = `${text} ${queryText}`.toLocaleLowerCase("pt-BR");

    if (/pix recebido|recebeu um pix|pix recebido de|valor recebido|cr[eé]dito recebido|voc[eê] recebeu|pix creditado|entrada pix|transfer[eê]ncia recebida/.test(haystack)) {
      return "recebido";
    }

    if (/pix enviado|pix realizado|pagamento realizado|transfer[eê]ncia realizada|comprovante de pagamento|voc[eê] pagou|valor enviado|d[eé]bito realizado|pix pago|voc[eê] fez um pix|enviou um pix/.test(haystack)) {
      return "enviado";
    }

    return "";
  }

  function extractPixValue(text) {
    const priorityPatterns = [
      /(?:valor|valor do pix|valor da transa[cç][aã]o|valor enviado|valor recebido|total)\s*:?\s*(?:R\$|BRL)\s*([0-9]{1,3}(?:\.[0-9]{3})*,[0-9]{2}|[0-9]+,[0-9]{2})/i,
      /(?:pix|pagamento|transfer[eê]ncia)[^\n\r]{0,80}(?:R\$|BRL)\s*([0-9]{1,3}(?:\.[0-9]{3})*,[0-9]{2}|[0-9]+,[0-9]{2})/i
    ];

    for (const pattern of priorityPatterns) {
      const match = text.match(pattern);
      const value = match ? parseCurrency(`R$ ${match[1]}`) : 0;
      if (value > 0) return value;
    }

    const matches = Array.from(text.matchAll(/(?:R\$|BRL)\s*([0-9]{1,3}(?:\.[0-9]{3})*,[0-9]{2}|[0-9]+,[0-9]{2})/gi));

    if (!matches.length) return 0;

    const values = matches
      .map((match) => parseCurrency(`R$ ${match[1]}`))
      .filter((value) => value > 0);

    return values.length ? values[0] : 0;
  }

  function extractPixName(text, type, email) {
    const patterns = type === "recebido"
      ? [
          /(?:quem enviou|enviado por|pagador|remetente)\s*:?\s*([^\n\r]{3,100})/i,
          /pix recebido de\s+([^\n\r.]{3,90})/i,
          /(?:origem|conta de origem)\s*:?\s*([^\n\r]{3,100})/i,
          /(?:de)\s*:?\s*([A-ZÀ-Ú0-9][^\n\r]{3,90})/i
        ]
      : [
          /(?:destinat[áa]rio|favorecido|recebedor|benefici[áa]rio|destino)\s*:?\s*([^\n\r]{3,100})/i,
          /pix (?:enviado|realizado) para\s+([^\n\r.]{3,90})/i,
          /(?:para)\s*:?\s*([A-ZÀ-Ú0-9][^\n\r]{3,90})/i
        ];

    for (const pattern of patterns) {
      const match = text.match(pattern);
      const name = match && cleanPixName(match[1]);

      if (name && !isOwnOrInvalidPixName(name)) {
        return name;
      }
    }

    const bankName = extractPixBankName(text);
    if (bankName && !isOwnOrInvalidPixName(bankName)) {
      return bankName;
    }

    const headerName = extractNameFromEmailHeader(type === "recebido" ? email.from : email.to);
    return isOwnOrInvalidPixName(headerName) ? "" : headerName;
  }

  function cleanPixName(value) {
    const text = safeText(value, "")
      .replace(/\s{2,}/g, " ")
      .replace(/\b(CPF|CNPJ|Banco|Institui[cç][aã]o|Valor|Data|Hora|Chave|Ag[eê]ncia|Conta|Descri[cç][aã]o|Identificador|Autentica[cç][aã]o)\b.*$/i, "")
      .replace(/[|•].*$/g, "")
      .replace(/<[^>]+>/g, "")
      .replace(/[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/gi, "")
      .replace(/[:;,-]+$/g, "")
      .trim();

    if (!text || text.length < 3) return "";
    return tidyName(text.slice(0, 90), "");
  }

  function extractPixBankName(text) {
    const patterns = [
      /(?:banco|institui[cç][aã]o|institui[cç][aã]o financeira)\s*:?\s*([^\n\r]{3,80})/i,
      /(?:via|pelo|no)\s+(Banco\s+[A-ZÀ-Úa-zà-ú0-9 .&-]{3,70})/i
    ];

    for (const pattern of patterns) {
      const match = text.match(pattern);
      const name = match && cleanPixName(match[1]);
      if (name) return name;
    }

    return "";
  }

  function extractPixCategory(text, type, name) {
    if (type === "recebido") return "Recebimentos";

    const haystack = normalizeForSearch(`${text} ${name}`);
    const rules = [
      { category: "Alimentação", pattern: /ifood|restaurante|lanchonete|mercado|supermercado|padaria|acai|pizza|burger/ },
      { category: "Transporte", pattern: /uber|99|taxi|combustivel|posto|estacionamento|metro|passagem/ },
      { category: "Saúde", pattern: /farmacia|drogaria|clinica|medico|hospital|laboratorio/ },
      { category: "Moradia", pattern: /aluguel|condominio|energia|luz|agua|internet|telefone|gas/ },
      { category: "Lazer", pattern: /cinema|show|netflix|spotify|prime|ingresso|viagem|hotel/ },
      { category: "Serviços", pattern: /servico|assinatura|software|curso|manutencao|freela|freelancer/ },
      { category: "Transferências", pattern: /transferencia|pix enviado|pix realizado|favorecido|destinatario/ }
    ];

    const found = rules.find((rule) => rule.pattern.test(haystack));
    return found ? found.category : "Gmail / Pix";
  }

  function isOwnOrInvalidPixName(value) {
    const name = safeText(value, "");
    const normalized = normalizeEmail(name);
    const searchable = normalizeForSearch(name);
    const knownEmails = [state.systemUser && state.systemUser.email, state.authUser && state.authUser.email]
      .filter(Boolean)
      .map(normalizeEmail);
    const knownNames = [state.systemUser && state.systemUser.name, state.authUser && state.authUser.displayName]
      .filter(Boolean)
      .map(normalizeForSearch);

    return (
      !name ||
      /@/.test(name) ||
      knownEmails.includes(normalized) ||
      knownNames.includes(searchable) ||
      /^(voce|você|sua conta|minha conta|conta google|gmail|pix)$/i.test(searchable) ||
      searchable.length < 3
    );
  }

  function extractPixDate(text) {
    const match = text.match(/(\d{1,2}\/\d{1,2}\/\d{4})(?:\s*(?:às|as|-)?\s*(\d{1,2}:\d{2}))?/i);

    if (!match) return "";

    return `${pad(match[1].split("/")[0])}/${pad(match[1].split("/")[1])}/${match[1].split("/")[2]}${match[2] ? ` ${match[2]}` : ""}`;
  }

  function formatGmailHeaderDate(value) {
    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
      return "";
    }

    return new Intl.DateTimeFormat("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit"
    }).format(date).replace(",", "");
  }

  function extractNameFromEmailHeader(value) {
    const text = safeText(value, "");
    const match = text.match(/^"?([^"<]+)"?\s*</);
    return tidyName(match ? match[1] : text.replace(/<[^>]+>/g, ""), "");
  }

  function normalizeEmailText(value) {
    return stripHtml(safeText(value, ""))
      .replace(/&nbsp;/gi, " ")
      .replace(/&amp;/gi, "&")
      .replace(/\s+\n/g, "\n")
      .replace(/\n\s+/g, "\n")
      .replace(/[ \t]{2,}/g, " ")
      .trim();
  }

  function extractGmailText(payload) {
    const chunks = [];
    collectGmailTextParts(payload, chunks);
    return chunks.join("\n").trim();
  }

  function collectGmailTextParts(part, chunks) {
    if (!part) return;

    const mimeType = part.mimeType || "";

    if (part.body && part.body.data && (/text\/plain|text\/html/.test(mimeType) || !part.parts)) {
      const decoded = decodeGmailBase64(part.body.data);
      chunks.push(mimeType === "text/html" ? stripHtml(decoded) : decoded);
    }

    if (Array.isArray(part.parts)) {
      part.parts.forEach((child) => collectGmailTextParts(child, chunks));
    }
  }

  function decodeGmailBase64(value) {
    try {
      const normalized = String(value || "").replace(/-/g, "+").replace(/_/g, "/");
      const binary = window.atob(normalized);
      const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
      return new TextDecoder("utf-8").decode(bytes);
    } catch (error) {
      return "";
    }
  }

  function stripHtml(value) {
    return String(value || "")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<\/p>/gi, "\n")
      .replace(/<[^>]+>/g, " ");
  }

  async function gmailFetchJson(url, accessToken) {
    for (let attempt = 0; attempt <= GMAIL_MAX_RETRIES; attempt += 1) {
      await waitForGmailSlot();

      const response = await fetch(url.toString(), {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          Accept: "application/json"
        }
      });

      if (response.ok) {
        return response.json();
      }

      const errorText = await response.text();

      if (response.status === 429 && attempt < GMAIL_MAX_RETRIES) {
        const retryDelay = getGmailRetryDelay(response, attempt);
        console.warn(`${FINANCEIRO_LOG_PREFIX} Gmail API 429. Tentando novamente em ${retryDelay}ms (${attempt + 1}/${GMAIL_MAX_RETRIES}).`);
        await delay(retryDelay);
        continue;
      }

      const error = new Error(`Gmail HTTP ${response.status}: ${errorText.slice(0, 180)}`);
      error.status = response.status;
      throw error;
    }

    throw new Error("Gmail API não respondeu após novas tentativas.");
  }

  async function waitForGmailSlot() {
    const elapsed = Date.now() - state.lastGmailRequestAt;

    if (elapsed < GMAIL_REQUEST_DELAY_MS) {
      await delay(GMAIL_REQUEST_DELAY_MS - elapsed);
    }

    state.lastGmailRequestAt = Date.now();
  }

  function getGmailRetryDelay(response, attempt) {
    const retryAfter = Number(response.headers.get("Retry-After"));

    if (Number.isFinite(retryAfter) && retryAfter > 0) {
      return retryAfter * 1000;
    }

    return GMAIL_REQUEST_DELAY_MS + ((attempt + 1) * 1200);
  }

  function delay(ms) {
    return new Promise((resolve) => window.setTimeout(resolve, ms));
  }

  function getHeader(headers, name) {
    const header = headers.find((item) => item.name && item.name.toLocaleLowerCase("pt-BR") === name.toLocaleLowerCase("pt-BR"));
    return header ? header.value : "";
  }

  function logGmailPixEmails(emails, pixTransactions) {
    console.group("Gmail API - e-mails relacionados a Pix");
    console.log("Usuário:", state.authUser.email);
    console.log("Escopo:", GMAIL_READONLY_SCOPE);
    console.log("Consultas:", GMAIL_PIX_QUERIES);
    console.log(`Mensagens processadas: ${emails.length}`);
    console.log(`Pix identificados com sucesso: ${pixTransactions.length}`);
    console.table(pixTransactions.map((pix) => ({
      tipo: pix.tipo,
      nome: pix.nome,
      valor: pix.valor,
      data: pix.data,
      emailId: pix.emailId
    })));
    console.table(emails.map((email) => ({
      id: email.id,
      data: email.date,
      assunto: email.subject,
      remetente: email.from,
      consultas: email.matchedQueries.join(", "),
      resumo: email.snippet
    })));
    console.log("Pix convertidos:", pixTransactions);
    console.log("E-mails completos:", emails);
    console.groupEnd();
  }

  function applyGmailPixToDashboard(options = {}) {
    state.data = buildGmailFinancialData(state.gmailPixTransactions);
    state.monthlySeries = [dataToMonthlyPoint(state.data)];
    state.dataLoaded = true;
    renderSourceMode();
    setStatus("Gmail conectado", "success");
    renderApp();
  }

  function buildGmailFinancialData(transactions) {
    const entradas = transactions
      .filter((pix) => pix.tipo === "recebido")
      .map(gmailPixToEntrada);
    const saidas = transactions
      .filter((pix) => pix.tipo === "enviado")
      .map(gmailPixToSaida);
    const historico = entradas.concat(saidas).sort((a, b) => b.timestamp - a.timestamp);
    const recebido = sumValues(entradas);
    const gasto = sumValues(saidas);
    const qtdEntradas = entradas.length;
    const qtdSaidas = saidas.length;
    const totalMovements = qtdEntradas + qtdSaidas;

    return {
      periodo: `Gmail ${pad(state.month)}/${state.year}`,
      month: state.month,
      year: state.year,
      dashboard: {
        recebido,
        gasto,
        saldo: recebido - gasto,
        ticketMedio: totalMovements ? (recebido + gasto) / totalMovements : 0,
        qtdEntradas,
        qtdSaidas,
        maiorEntrada: maxValue(entradas),
        maiorGasto: maxValue(saidas)
      },
      entradas,
      saidas,
      historico,
      updatedAt: new Date()
    };
  }

  function gmailPixToEntrada(pix, index) {
    return {
      id: pix.gmailMessageId || pix.emailId || pix.id || `gmail-entrada-${index}`,
      transactionId: pix.gmailMessageId || pix.emailId || "",
      index,
      tipo: "entrada",
      data: pix.data,
      timestamp: parseDate(pix.data).getTime() || 0,
      valor: pix.valor,
      nome: pix.nome,
      categoria: pix.categoria || "Recebimentos",
      descricao: pix.descricao || "Pix identificado no Gmail",
      origem: "gmail",
      banco: pix.banco || "",
      gmailMessageId: pix.gmailMessageId || pix.emailId || "",
      hash: pix.hash || "",
      rawSnippet: pix.rawSnippet || pix.snippet || "",
      raw: pix.raw || pix
    };
  }

  function gmailPixToSaida(pix, index) {
    return {
      id: pix.gmailMessageId || pix.emailId || pix.id || `gmail-saida-${index}`,
      transactionId: pix.gmailMessageId || pix.emailId || "",
      index,
      tipo: "saida",
      data: pix.data,
      timestamp: parseDate(pix.data).getTime() || 0,
      valor: pix.valor,
      nome: pix.nome,
      destino: pix.nome,
      categoria: pix.categoria || "Gmail / Pix",
      descricao: pix.descricao || "Pix identificado no Gmail",
      origem: "gmail",
      banco: pix.banco || "",
      gmailMessageId: pix.gmailMessageId || pix.emailId || "",
      hash: pix.hash || "",
      rawSnippet: pix.rawSnippet || pix.snippet || "",
      raw: pix.raw || pix
    };
  }

  function getGmailConnectionKey() {
    const systemEmail = normalizeEmail(state.systemUser && state.systemUser.email);
    return systemEmail ? `${GMAIL_CONNECTION_PREFIX}${systemEmail}` : "";
  }

  function saveGmailConnectionMetadata() {
    const key = getGmailConnectionKey();
    if (!key || !state.gmailEmail) return false;

    try {
      window.localStorage.setItem(key, JSON.stringify({
        gmailConnected: true,
        gmailEmail: state.gmailEmail,
        gmailConnectedAt: state.gmailConnectedAt || new Date().toISOString()
      }));
      if (state.systemUser) {
        state.appSettings = normalizeAppSettings({
          ...(state.appSettings || {}),
          email: state.systemUser.email,
          name: state.systemUser.name,
          gmailConnected: true,
          gmailEmail: state.gmailEmail,
          gmailConnectedAt: state.gmailConnectedAt || new Date().toISOString(),
          updatedAt: new Date().toISOString()
        });
        saveSettingsToLocal(state.appSettings);
        saveSettingsToFirestore(state.appSettings);
      }
      return true;
    } catch (error) {
      console.warn(`${FINANCEIRO_LOG_PREFIX} Não foi possível salvar conexão Gmail.`, error);
      return false;
    }
  }

  function loadGmailConnectionMetadata() {
    const key = getGmailConnectionKey();
    if (!key) return null;

    try {
      const stored = JSON.parse(window.localStorage.getItem(key) || "null");

      if (!stored || stored.gmailConnected !== true || !stored.gmailEmail) {
        return null;
      }

      return {
        gmailConnected: true,
        gmailEmail: safeText(stored.gmailEmail, ""),
        gmailConnectedAt: safeText(stored.gmailConnectedAt, "")
      };
    } catch (error) {
      console.warn(`${FINANCEIRO_LOG_PREFIX} Não foi possível restaurar conexão Gmail.`, error);
      return null;
    }
  }

  function restoreGmailConnectionState() {
    const metadata = loadGmailConnectionMetadata();

    if (!metadata) return false;

    state.gmailConnected = true;
    state.gmailEmail = metadata.gmailEmail;
    state.gmailConnectedAt = metadata.gmailConnectedAt;
    state.gmailSessionExpired = false;
    loadGmailSessionData();
    return true;
  }

  function clearGmailConnectionMetadata() {
    const key = getGmailConnectionKey();

    if (key) {
      window.localStorage.removeItem(key);
      return;
    }

    Object.keys(window.localStorage)
      .filter((keyName) => keyName.startsWith(GMAIL_CONNECTION_PREFIX))
      .forEach((keyName) => window.localStorage.removeItem(keyName));
  }

  function getGmailSessionKey() {
    const systemEmail = normalizeEmail(state.systemUser && state.systemUser.email);
    const gmailEmail = normalizeEmail((state.authUser && state.authUser.email) || state.gmailEmail);

    if (!systemEmail || !gmailEmail) {
      return "";
    }

    return `${GMAIL_SESSION_PREFIX}${systemEmail}:${gmailEmail}`;
  }

  function saveGmailSessionData(transactions) {
    const key = getGmailSessionKey();
    if (!key) return false;

    try {
      const payload = JSON.stringify({
        systemEmail: state.systemUser.email,
        gmailEmail: (state.authUser && state.authUser.email) || state.gmailEmail,
        updatedAt: new Date().toISOString(),
        transactions
      });
      window.sessionStorage.setItem(key, payload);
      window.localStorage.setItem(key, payload);
      return true;
    } catch (error) {
      console.warn(`${FINANCEIRO_LOG_PREFIX} Não foi possível salvar dados Gmail da sessão.`, error);
      return false;
    }
  }

  function loadGmailSessionData() {
    const key = getGmailSessionKey();
    if (!key) return false;

    try {
      const raw = window.sessionStorage.getItem(key) || window.localStorage.getItem(key);
      const stored = JSON.parse(raw || "null");
      const transactions = stored && Array.isArray(stored.transactions) ? stored.transactions : [];

      if (!transactions.length) {
        return false;
      }

      state.gmailPixTransactions = transactions;
      return true;
    } catch (error) {
      console.warn(`${FINANCEIRO_LOG_PREFIX} Não foi possível carregar dados Gmail da sessão.`, error);
      return false;
    }
  }

  function clearStoredGmailSession() {
    const key = getGmailSessionKey();

    if (key) {
      window.sessionStorage.removeItem(key);
      window.localStorage.removeItem(key);
      return;
    }

    Object.keys(window.sessionStorage)
      .filter((keyName) => keyName.startsWith(GMAIL_SESSION_PREFIX))
      .forEach((keyName) => window.sessionStorage.removeItem(keyName));
    Object.keys(window.localStorage)
      .filter((keyName) => keyName.startsWith(GMAIL_SESSION_PREFIX))
      .forEach((keyName) => window.localStorage.removeItem(keyName));
  }

  function clearGmailConnection(options = {}) {
    const { clearData = false, clearStored = false } = options;

    if (clearStored) {
      clearStoredGmailSession();
      clearGmailConnectionMetadata();
    }

    state.gmailAccessToken = "";
    state.gmailConnected = false;
    state.gmailEmail = "";
    state.gmailConnectedAt = "";
    state.gmailSessionExpired = false;
    state.gmailFetchInProgress = false;
    state.lastGmailRequestAt = 0;

    if (clearData) {
      state.gmailPixTransactions = [];
    }
  }

  function isGmailAuthExpiredError(error) {
    const status = Number(error && error.status);
    const message = String((error && error.message) || "");
    return status === 401 || status === 403 || /Gmail HTTP (401|403)/.test(message);
  }

  function showGmailExpired() {
    state.gmailAccessToken = "";
    state.gmailSessionExpired = true;
    dom.authStatus.textContent = "Sessão do Gmail expirada. Conecte novamente.";
    showToast("Sessão do Gmail expirada. Conecte novamente.", "error");
    renderAuthPanel();
  }

  function renderAuthPanel() {
    const user = state.authUser;
    const gmailLabel = state.gmailEmail || (user && user.email) || "";
    const connectedAt = state.gmailConnectedAt ? formatDateTime(new Date(state.gmailConnectedAt)) : "";

    dom.authUser.hidden = !user;
    dom.signOutButton.hidden = !user;
    dom.googleSignInButton.hidden = Boolean(user);
    dom.connectGmailButton.hidden = !state.accessGranted || (state.gmailConnected && !state.gmailSessionExpired);
    dom.googleSignInButton.disabled = !isFirebaseConfigured();
    dom.connectGmailButton.disabled = state.gmailFetchInProgress;
    dom.connectGmailButton.querySelector("span").textContent = state.gmailSessionExpired ? "Reconectar Gmail" : "Conectar Gmail";

    if (user) {
      dom.authPhoto.hidden = false;
      dom.authPhoto.src = user.photoURL || "";
      dom.authPhoto.alt = `Foto de ${user.displayName || "usuário"}`;
      dom.authName.textContent = user.displayName || "Usuário Google";
      dom.authEmail.textContent = user.email || "E-mail não informado";
      dom.authStatus.textContent = state.gmailSessionExpired
        ? "Sessão do Gmail expirada. Conecte novamente."
        : state.gmailConnected
          ? `Gmail conectado${gmailLabel ? `: ${gmailLabel}` : ""}${connectedAt ? ` desde ${connectedAt}` : ""}.`
          : "Conta Google conectada.";
      dom.authPanel.classList.add("is-authenticated");
    } else if (state.gmailConnected) {
      dom.authPhoto.src = "";
      dom.authPhoto.hidden = true;
      dom.authName.textContent = "Gmail conectado";
      dom.authEmail.textContent = gmailLabel || "Conta autorizada";
      dom.authUser.hidden = false;
      dom.authPanel.classList.add("is-authenticated");
      dom.authStatus.textContent = state.gmailSessionExpired
        ? "Sessão do Gmail expirada. Conecte novamente."
        : `Gmail conectado${connectedAt ? ` desde ${connectedAt}` : ""}.`;
    } else {
      dom.authPhoto.src = "";
      dom.authPhoto.hidden = false;
      dom.authName.textContent = "Usuário";
      dom.authEmail.textContent = "";
      dom.authPanel.classList.remove("is-authenticated");
      dom.authStatus.textContent = isFirebaseConfigured() ? "Conecte o Gmail quando quiser ler Pix." : "Configure o Firebase para ativar o Gmail.";
    }

    createIcons();
  }

  function updateAccessControl() {
    const user = state.systemUser;
    const allowed = Boolean(user && isSystemUserAllowed(user.email));

    state.accessGranted = allowed;
    dom.appShell.classList.toggle("access-locked", !allowed);
    dom.accessGate.hidden = allowed;
    if (allowed && !state.gmailConnected) {
      restoreGmailConnectionState();
    }
    renderSystemSession();
    renderAuthPanel();
    renderAdmin();

    if (allowed) {
      dom.accessMessage.textContent = "Acesso liberado. Carregando dashboard financeiro.";
      dom.accessHint.textContent = user.email;
      syncFirestoreForCurrentUser();
      if (!state.dataLoaded) {
        bootUserDashboard();
      }
      return;
    }

    dom.accessMessage.textContent = "Entre com seu usuário autorizado para acessar o dashboard.";
    dom.accessHint.textContent = "A conexão Google/Gmail fica disponível após entrar no sistema.";
    renderInviteGate();
    setStatus("Aguardando login", "neutral");
  }

  function renderSystemSession() {
    const user = state.systemUser;

    dom.systemSession.hidden = !user;
    if (!user) return;

    dom.systemUserName.textContent = user.name || user.email;
    dom.systemUserRole.textContent = user.role || "usuário";
  }

  function bootUserDashboard() {
    restoreGmailConnectionState();

    if (!isAdminUser()) {
      state.dataSource = "gmail";
      saveDataSourcePreference("gmail");

      if (state.gmailPixTransactions.length || loadGmailSessionData()) {
        applyGmailPixToDashboard({ silent: true });
      } else {
        showGmailEmptyState();
      }
      return;
    }

    state.dataSource = loadDataSourcePreference() || "api";

    if (state.dataSource === "gmail") {
      if (state.gmailPixTransactions.length || loadGmailSessionData()) {
        applyGmailPixToDashboard({ silent: true });
      } else if (state.gmailConnected) {
        showGmailEmptyState();
      } else {
        state.dataSource = "api";
        saveDataSourcePreference("api");
        loadFinancialData();
      }
      return;
    }

    loadFinancialData();
  }

  function getDataSourcePreferenceKey() {
    const email = normalizeEmail(state.systemUser && state.systemUser.email);
    return email ? `${DATA_SOURCE_PREFIX}${email}` : "";
  }

  function saveDataSourcePreference(source) {
    const key = getDataSourcePreferenceKey();
    if (!key) return;

    try {
      window.localStorage.setItem(key, source === "gmail" ? "gmail" : "api");
    } catch (error) {
      console.warn(`${FINANCEIRO_LOG_PREFIX} Não foi possível salvar preferência de fonte.`, error);
    }
  }

  function loadDataSourcePreference() {
    const key = getDataSourcePreferenceKey();
    if (!key) return "";

    try {
      const source = window.localStorage.getItem(key);
      return source === "gmail" || source === "api" ? source : "";
    } catch (error) {
      return "";
    }
  }

  function showGmailEmptyState() {
    state.dataSource = "gmail";
    state.data = createEmptyData(state.month, state.year);
    state.monthlySeries = [dataToMonthlyPoint(state.data)];
    state.dataLoaded = true;
    state.connection = "Conecte seu Gmail para carregar seus dados.";
    renderApp();
    renderAuthPanel();
    setStatus("Conecte seu Gmail", "neutral");
    dom.lastUpdated.textContent = "Conecte seu Gmail para carregar seus dados.";
    dom.authStatus.textContent = state.gmailConnected
      ? "Gmail conectado. Reconecte para atualizar os e-mails."
      : "Conecte seu Gmail para carregar seus dados.";
  }

  function renderAdmin() {
    const isAdmin = isAdminUser();

    dom.adminNavButton.hidden = !isAdmin;

    if (!dom.adminUsersTable) return;

    dom.adminTotalUsers.textContent = `${USERS.length} ${USERS.length === 1 ? "usuário" : "usuários"}`;

    if (!isAdmin) {
      dom.adminUsersTable.innerHTML = emptyRow(5);
      dom.adminInvitesTable.innerHTML = emptyRow(4);
      return;
    }

    dom.adminUsersTable.innerHTML = USERS.map((user) => `
      <tr data-admin-user-email="${escapeAttribute(user.email)}">
        <td data-label="Nome" class="name-cell">${escapeHtml(user.name)}</td>
        <td data-label="E-mail">${escapeHtml(user.email)}</td>
        <td data-label="Role">
          <select class="table-select" data-admin-role aria-label="Editar role de ${escapeAttribute(user.email)}">
            <option value="user" ${user.role === "user" ? "selected" : ""}>user</option>
            <option value="admin" ${user.role === "admin" ? "selected" : ""}>admin</option>
          </select>
        </td>
        <td data-label="Status">
          <span class="tx-type ${user.blocked ? "saida" : "entrada"}">${user.blocked ? "Bloqueado" : "Ativo"}</span>
          <small class="admin-gmail-status">${(state.userSettings && state.userSettings[normalizeEmail(user.email)] && state.userSettings[normalizeEmail(user.email)].gmailConnected) ? "Gmail conectado" : "Gmail desconectado"}</small>
        </td>
        <td data-label="Ações">
          <button class="mini-action" type="button" data-admin-user-action="toggle-block">
            <i data-lucide="${user.blocked ? "unlock" : "lock"}"></i>
          </button>
        </td>
      </tr>
    `).join("");

    dom.adminInvitesTable.innerHTML = INVITES.length
      ? INVITES.slice().reverse().map((invite) => `
        <tr data-admin-invite-token="${escapeAttribute(invite.token)}">
          <td data-label="E-mail" class="name-cell">${escapeHtml(invite.email)}</td>
          <td data-label="Role"><span class="tag">${escapeHtml(invite.role)}</span></td>
          <td data-label="Status"><span class="tx-type ${invite.status === "canceled" ? "saida" : invite.usedAt ? "neutral" : "entrada"}">${invite.status === "canceled" ? "Cancelado" : invite.usedAt ? "Usado" : "Disponível"}</span></td>
          <td data-label="Ações">
            <div class="row-actions">
              <button class="mini-action" type="button" data-admin-invite-action="copy" title="Copiar convite"><i data-lucide="copy"></i></button>
              <button class="mini-action danger-action" type="button" data-admin-invite-action="cancel" title="Cancelar convite" ${invite.usedAt || invite.status === "canceled" ? "disabled" : ""}><i data-lucide="ban"></i></button>
            </div>
          </td>
        </tr>
      `).join("")
      : emptyRow(4);

    createIcons();
  }

  function isAdminUser(user = state.systemUser) {
    return normalizeUser(user).role === "admin";
  }

  function normalizeEmail(email) {
    return String(email || "").trim().toLocaleLowerCase("pt-BR");
  }

  function isFirebaseConfigured() {
    return Boolean(
      FIREBASE_CONFIG &&
      FIREBASE_CONFIG.apiKey &&
      FIREBASE_CONFIG.authDomain &&
      FIREBASE_CONFIG.projectId &&
      FIREBASE_CONFIG.appId &&
      !Object.values(FIREBASE_CONFIG).some((value) => String(value || "").startsWith(FIREBASE_PLACEHOLDER))
    );
  }

  function friendlyAuthError(error) {
    const code = error && error.code ? error.code : "";
    if (code === "auth/unauthorized-domain") {
      console.warn(`${FINANCEIRO_LOG_PREFIX} Firebase Auth domínio não autorizado`, {
        domain: window.location.hostname,
        expectedDomain: "teste-three-topaz.vercel.app"
      });
    }
    const messages = {
      "auth/popup-closed-by-user": "janela de login fechada antes de concluir.",
      "auth/cancelled-popup-request": "já existe uma janela de login aberta.",
      "auth/popup-blocked": "o navegador bloqueou o popup de login.",
      "auth/unauthorized-domain": "Domínio não autorizado no Firebase. Adicione o domínio da Vercel em Authentication > Settings > Authorized domains.",
      "auth/user-mismatch": "a conta escolhida é diferente da conta logada no sistema.",
      "auth/network-request-failed": "falha de rede ao falar com o Firebase."
    };

    return messages[code] || (error && error.message) || "erro desconhecido.";
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
    if (!state.accessGranted) {
      setStatus("Aguardando login", "neutral");
      if (isManualRefresh) {
        showToast("Entre com um e-mail autorizado para carregar o dashboard.", "error");
      }
      return;
    }

    if (!isAdminUser()) {
      state.dataSource = "gmail";
      saveDataSourcePreference("gmail");
      showGmailEmptyState();
      return;
    }

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
      state.dataLoaded = true;

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
      state.dataLoaded = false;
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
      origem: "api",
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
      origem: "api",
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
    renderAdmin();
    renderCharts();
    renderSourceMode();
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
          <td data-label="Data">${escapeHtml(row.data)}</td>
          <td data-label="Valor" class="align-right amount entrada">+ ${escapeHtml(formatCurrency(row.valor))}</td>
          <td data-label="Quem enviou" class="name-cell"><button class="name-button" type="button">${escapeHtml(row.nome)}</button></td>
          <td data-label="Descrição"><span class="tag">${escapeHtml(row.descricao)}</span></td>
        </tr>
      `).join("")
      : emptyRow(4);
  }

  function renderSentTable() {
    const rows = state.data.saidas;
    dom.sentTable.innerHTML = rows.length
      ? rows.map((row, index) => `
        <tr class="clickable-row" data-pix-index="${index}" tabindex="0" role="button" aria-label="Ver detalhes do PIX enviado para ${escapeAttribute(row.destino)}">
          <td data-label="Data">${escapeHtml(row.data)}</td>
          <td data-label="Valor" class="align-right amount saida">- ${escapeHtml(formatCurrency(row.valor))}</td>
          <td data-label="Destino" class="name-cell"><button class="name-button" type="button">${escapeHtml(row.destino)}</button></td>
          <td data-label="Categoria"><span class="tag">${escapeHtml(row.categoria)}</span></td>
        </tr>
      `).join("")
      : emptyRow(4);
  }

  function renderRecentTable() {
    const rows = state.data.historico.slice(0, 8);
    state.recentHistoryRows = rows;
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
    state.visibleHistoryRows = rows;
    dom.historyTable.innerHTML = rows.length ? rows.map(renderHistoryRow).join("") : emptyRow(5);
    createIcons();
  }

  function renderHistoryRow(row, index) {
    const sign = row.tipo === "entrada" ? "+" : "-";
    return `
      <tr class="clickable-row" data-history-index="${index}" tabindex="0" role="button">
        <td data-label="Tipo"><span class="tx-type ${row.tipo}">${row.tipo === "entrada" ? "Entrada" : "Saída"}</span></td>
        <td data-label="Data">${escapeHtml(row.data)}</td>
        <td data-label="Nome" class="name-cell">${escapeHtml(row.nome)}</td>
        <td data-label="Categoria"><span class="tag">${escapeHtml(row.categoria)}</span></td>
        <td data-label="Valor" class="align-right amount ${row.tipo}">${sign} ${escapeHtml(formatCurrency(row.valor))}</td>
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
    if (section === "admin" && !isAdminUser()) {
      showToast("Admin disponível apenas para usuários admin.", "error");
      section = "dashboard";
    }

    dom.navLinks.forEach((button) => button.classList.toggle("active", button.dataset.section === section));
    document.querySelectorAll("[data-mobile-section]").forEach((button) => button.classList.toggle("active", button.dataset.mobileSection === section));
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
      vendas: "Vendas",
      analise: "Assistente Financeiro",
      relatorios: "Relatórios",
      metas: "Metas",
      onboarding: "Primeiros passos",
      planos: "Planos",
      configuracoes: "Configurações",
      admin: "Admin"
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
      this.content.addEventListener("click", (event) => {
        const action = event.target.closest("[data-detail-action]")?.dataset.detailAction;
        if (!action || !this.currentTransaction) return;
        if (action === "edit-category") editTransactionCategory(this.currentTransaction);
        if (action === "delete-sale") {
          const sale = findSaleById(this.currentTransaction.id, this.currentTransaction.ownerEmail);
          if (sale) {
            this.close();
            deleteSale(sale);
          }
        }
      });
    }

    open(transaction) {
      this.requestId += 1;
      const requestId = this.requestId;
      this.currentTransaction = transaction;

      window.clearTimeout(this.closeTimer);
      this.renderHeader(transaction);
      this.renderLoading();
      this.show();

      if (transaction.origem === "venda_manual" || transaction.origem === "gmail") {
        this.renderDetails(transaction, null, {
          hasRemoteDetails: false,
          localOnly: true
        });
        return;
      }

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

      if (meta.localOnly) {
        this.notice.hidden = true;
        this.notice.textContent = "";
      } else if (meta.error) {
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
          <div class="modal-actions">
            <button class="ghost-button" type="button" data-detail-action="edit-category">
              <i data-lucide="tags"></i>
              <span>Editar categoria</span>
            </button>
            ${transaction.origem === "venda_manual" ? `
              <button class="ghost-button danger-action" type="button" data-detail-action="delete-sale">
                <i data-lucide="trash-2"></i>
                <span>Excluir venda</span>
              </button>
            ` : ""}
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
      origem: transaction.origem || readField(raw, ["origem"]),
      banco: transaction.banco || readField(raw, ["banco", "instituicao"]),
      gmailMessageId: transaction.gmailMessageId || transaction.emailId || readField(raw, ["gmailMessageId", "emailId"]),
      observacoes: transaction.observacao || readField(raw, ["observacoes", "observacao", "obs"]),
      origemPix: transaction.tipo === "entrada" ? transaction.nome : readField(raw, ["origem", "origemPix", "contaOrigem"]),
      destinoPix: transaction.tipo === "saida" ? transaction.destino : readField(raw, ["destino", "destinoPix", "contaDestino"]),
      idTransacao: transaction.transactionId || readField(raw, ["id", "ID", "idTransacao", "transactionId", "endToEndId", "e2eId"])
    };
    const flat = flattenDetailObject(source);
    const usedKeys = new Set();

    const standardFields = [
      createDetailField(flat, usedKeys, "Nome completo", ["nomeCompleto", "nome", "quemEnviou", "remetente", "pagador", "destino", "favorecido", "recebedor"], transaction.nome),
      createDetailField(flat, usedKeys, "Origem", ["origem"], transaction.origem || "api"),
      createDetailField(flat, usedKeys, "CPF", ["cpf", "documento", "cpfCnpj", "cpf_cnpj", "cpfOrigem", "cpfDestino", "documentoPessoa"]),
      createDetailField(flat, usedKeys, "Banco", ["banco", "instituicao", "instituicaoFinanceira", "bancoOrigem", "bancoDestino", "ispb"]),
      createDetailField(flat, usedKeys, "Tipo da chave PIX", ["tipoChavePix", "tipoChave", "tipo_da_chave", "chaveTipo"]),
      createDetailField(flat, usedKeys, "Chave PIX", ["chavePix", "chave_pix", "pixKey", "chave"]),
      createDetailField(flat, usedKeys, "Valor", ["valor", "valorPix", "amount"], transaction.valor),
      createDetailField(flat, usedKeys, "Data", ["dataPix", "dataPagamento", "dataTransacao", "data"], dateTime.date),
      createDetailField(flat, usedKeys, "Hora", ["hora", "horario", "horaPagamento", "horaTransacao"], dateTime.time),
      createDetailField(flat, usedKeys, "ID da transação", ["idTransacao", "id_transacao", "transactionId", "endToEndId", "e2eId", "codigoTransacao"]),
      createDetailField(flat, usedKeys, "ID Gmail", ["gmailMessageId", "emailId"]),
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

  function editTransactionCategory(transaction) {
    const nextCategory = window.prompt("Nova categoria da transação:", transaction.categoria || "");
    if (!nextCategory) return;

    transaction.categoria = nextCategory;

    if (transaction.origem === "venda_manual") {
      const sale = findSaleById(transaction.id, transaction.ownerEmail);
      if (sale) {
        sale.categoria = nextCategory;
        sale.updatedAt = new Date().toISOString();
        upsertSaleInState(sale);
        saveSalesToLocal(sale.ownerEmail, state.allSales.filter((item) => normalizeEmail(item.ownerEmail) === normalizeEmail(sale.ownerEmail)));
        saveSaleToFirestore(sale);
      }
    } else if (transaction.origem === "gmail" || transaction.gmailMessageId) {
      state.gmailPixTransactions = state.gmailPixTransactions.map((item) => {
        const same = (item.gmailMessageId || item.emailId || item.id) === (transaction.gmailMessageId || transaction.emailId || transaction.id);
        return same ? { ...item, categoria: nextCategory } : item;
      });
      saveGmailSessionData(state.gmailPixTransactions);
      saveTransactionsToFirestore(state.gmailPixTransactions);
      if (state.dataSource === "gmail") applyGmailPixToDashboard({ silent: true });
    }

    const updateCategory = (item) => {
      if ((transaction.id && item.id === transaction.id) || (transaction.gmailMessageId && (item.gmailMessageId === transaction.gmailMessageId || item.emailId === transaction.gmailMessageId))) {
        item.categoria = nextCategory;
      }
    };
    state.data.entradas.forEach(updateCategory);
    state.data.saidas.forEach(updateCategory);
    state.data.historico.forEach(updateCategory);
    mergeManualSalesIntoDashboard();
    renderApp();
    state.pixDetailsModal.open(transaction);
    showToast("Categoria atualizada.");
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
  const GROWTH_CATEGORIES = [
    "Alimentação",
    "Transporte",
    "Lazer",
    "Compras",
    "Saúde",
    "Outros"
  ];
  const GOALS_STORAGE_PREFIX = "financeiroAutomaticoGoals";
  const BUDGET_STORAGE_PREFIX = "financeiroAutomaticoBudgets";
  const SYSTEM_LOGS_STORAGE_KEY = "financeiroAutomaticoSystemLogs";
  const SALE_CATEGORIES = ["Serviços", "Produtos", "Consultoria", "Assinatura", "Outros"];

  function initGrowthFeatures() {
    if (state.growthFeaturesInitialized) return;

    state.growthFeaturesInitialized = true;
    state.deferredInstallPrompt = null;
    state.manualSales = loadSalesFromLocal();
    state.allSales = state.manualSales.slice();
    state.appSettings = loadSettingsFromLocal();
    applyAppSettings();
    wrapGrowthRenderers();
    registerPwa();
    populateGrowthMonthControls();
    bindGrowthControls();
    resetSaleForm();
    syncAccessLanding();
    outlookAuth("init");
    hydrateGrowthDataForCurrentUser();
    renderGrowthFeatures();
  }

  function wrapGrowthRenderers() {
    if (state.growthRenderersWrapped) return;

    state.growthRenderersWrapped = true;
    const baseRenderApp = renderApp;
    const baseRenderAdmin = renderAdmin;
    const baseUpdateAccessControl = updateAccessControl;
    const baseShowToast = showToast;

    renderApp = function wrappedRenderApp() {
      mergeManualSalesIntoDashboard();
      const result = baseRenderApp.apply(this, arguments);
      renderGrowthFeatures();
      return result;
    };

    renderAdmin = function wrappedRenderAdmin() {
      const result = baseRenderAdmin.apply(this, arguments);
      renderAdminLogs();
      return result;
    };

    updateAccessControl = function wrappedUpdateAccessControl() {
      const result = baseUpdateAccessControl.apply(this, arguments);
      syncAccessLanding();
      maybeOpenOnboarding();
      hydrateGrowthDataForCurrentUser();
      applyAppSettings();
      renderGrowthFeatures();
      return result;
    };

    showToast = function wrappedShowToast(message, type) {
      if (type === "error") {
        addSystemLog("erro ocorrido", message || "Erro sem detalhes", "error");
      }

      return baseShowToast.apply(this, arguments);
    };
  }

  function registerPwa() {
    if ("serviceWorker" in navigator && window.location.protocol !== "file:") {
      navigator.serviceWorker.register("./sw.js").catch((error) => {
        addSystemLog("erro ocorrido", `Service worker: ${error.message}`, "error");
      });
    }

    window.addEventListener("beforeinstallprompt", (event) => {
      event.preventDefault();
      state.deferredInstallPrompt = event;
      const button = document.getElementById("installPwaButton");
      if (button) button.hidden = false;
    });
  }

  function bindGrowthControls() {
    const landingLoginButton = document.getElementById("landingLoginButton");
    const landingInviteButton = document.getElementById("landingInviteButton");
    const reportMonth = document.getElementById("reportMonth");
    const reportYear = document.getElementById("reportYear");
    const exportReportCsvButton = document.getElementById("exportReportCsvButton");
    const goalsForm = document.getElementById("goalsForm");
    const saveBudgetsButton = document.getElementById("saveBudgetsButton");
    const exportAllCsvButton = document.getElementById("exportAllCsvButton");
    const exportBackupJsonButton = document.getElementById("exportBackupJsonButton");
    const importBackupJsonInput = document.getElementById("importBackupJsonInput");
    const onboardingConnectGmailButton = document.getElementById("onboardingConnectGmailButton");
    const installPwaButton = document.getElementById("installPwaButton");
    const saleForm = document.getElementById("saleForm");
    const saleCancelEditButton = document.getElementById("saleCancelEditButton");
    const salesTable = document.getElementById("salesTable");
    const salesUserFilter = document.getElementById("salesUserFilter");
    const adminUserFilter = document.getElementById("adminUserFilter");
    const adminUsersTable = document.getElementById("adminUsersTable");
    const adminInvitesTable = document.getElementById("adminInvitesTable");
    const profileSettingsForm = document.getElementById("profileSettingsForm");
    const settingsConnectGmailButton = document.getElementById("settingsConnectGmailButton");
    const disconnectGmailButton = document.getElementById("disconnectGmailButton");
    const clearLocalDataButton = document.getElementById("clearLocalDataButton");
    const connectOutlookButton = document.getElementById("connectOutlookButton");
    const settingsOutlookButton = document.getElementById("settingsOutlookButton");
    const recentTable = document.getElementById("recentTable");
    const historyTable = document.getElementById("historyTable");

    if (landingLoginButton) landingLoginButton.addEventListener("click", openAccessLogin);
    if (landingInviteButton) landingInviteButton.addEventListener("click", openAccessLogin);
    if (reportMonth) reportMonth.addEventListener("change", renderGrowthFeatures);
    if (reportYear) reportYear.addEventListener("input", renderGrowthFeatures);
    if (exportReportCsvButton) exportReportCsvButton.addEventListener("click", exportReportCsv);
    if (goalsForm) goalsForm.addEventListener("submit", saveMonthlyGoals);
    if (saveBudgetsButton) saveBudgetsButton.addEventListener("click", saveCategoryBudgets);
    if (exportAllCsvButton) exportAllCsvButton.addEventListener("click", exportAllCsv);
    if (exportBackupJsonButton) exportBackupJsonButton.addEventListener("click", exportBackupJson);
    if (importBackupJsonInput) importBackupJsonInput.addEventListener("change", importBackupJson);
    if (onboardingConnectGmailButton) onboardingConnectGmailButton.addEventListener("click", connectGmailAndSearchPix);
    if (installPwaButton) installPwaButton.addEventListener("click", promptPwaInstall);
    if (saleForm) saleForm.addEventListener("submit", handleSaleSubmit);
    if (saleCancelEditButton) saleCancelEditButton.addEventListener("click", resetSaleForm);
    if (salesTable) salesTable.addEventListener("click", handleSalesTableClick);
    if (salesUserFilter) salesUserFilter.addEventListener("change", () => {
      state.adminUserFilter = salesUserFilter.value || "all";
      renderGrowthFeatures();
      renderApp();
    });
    if (adminUserFilter) adminUserFilter.addEventListener("change", () => {
      state.adminUserFilter = adminUserFilter.value || "all";
      renderGrowthFeatures();
    });
    if (adminUsersTable) {
      adminUsersTable.addEventListener("click", handleAdminUserAction);
      adminUsersTable.addEventListener("change", handleAdminUserAction);
    }
    if (adminInvitesTable) adminInvitesTable.addEventListener("click", handleAdminInviteAction);
    if (profileSettingsForm) profileSettingsForm.addEventListener("submit", handleProfileSettingsSubmit);
    if (settingsConnectGmailButton) settingsConnectGmailButton.addEventListener("click", connectGmailAndSearchPix);
    if (disconnectGmailButton) disconnectGmailButton.addEventListener("click", disconnectGmailFromSettings);
    if (clearLocalDataButton) clearLocalDataButton.addEventListener("click", clearLocalDataFromSettings);
    if (connectOutlookButton) connectOutlookButton.addEventListener("click", () => outlookAuth("sidebar"));
    if (settingsOutlookButton) settingsOutlookButton.addEventListener("click", () => outlookAuth("settings"));
    if (recentTable) recentTable.addEventListener("click", (event) => handleHistoryDetailsClick(event, "recent"));
    if (historyTable) historyTable.addEventListener("click", (event) => handleHistoryDetailsClick(event, "history"));

    document.querySelectorAll("[data-mobile-section]").forEach((button) => {
      button.addEventListener("click", () => setActiveSection(button.dataset.mobileSection));
    });
  }

  function populateGrowthMonthControls() {
    ["reportMonth"].forEach((id) => {
      const select = document.getElementById(id);
      if (!select || select.options.length) return;

      MONTHS.forEach((month, index) => {
        const option = document.createElement("option");
        option.value = String(index + 1).padStart(2, "0");
        option.textContent = month;
        select.appendChild(option);
      });

      select.value = String(state.month).padStart(2, "0");
    });

    const reportYear = document.getElementById("reportYear");
    if (reportYear) reportYear.value = state.year;
  }

  function openAccessLogin() {
    const gate = document.getElementById("accessGate");
    if (!gate) return;

    gate.dataset.loginOpen = "true";
    gate.classList.add("login-mode");
    window.setTimeout(() => {
      const email = document.getElementById("systemLoginEmail");
      if (email && !email.readOnly) email.focus();
    }, 60);
  }

  function syncAccessLanding() {
    const gate = document.getElementById("accessGate");
    if (!gate || state.accessGranted) return;

    const hasInvite = typeof getInviteTokenFromUrl === "function" && Boolean(getInviteTokenFromUrl());
    if (hasInvite || gate.dataset.loginOpen === "true") {
      gate.classList.add("login-mode");
    } else {
      gate.classList.remove("login-mode");
    }
  }

  function maybeOpenOnboarding() {
    if (!state.accessGranted || state.onboardingChecked || isAdminUser()) return;

    const hasGmailData = state.gmailConnected || state.gmailPixTransactions.length || loadGmailSessionData();
    state.onboardingChecked = true;

    if (!hasGmailData) {
      activateGrowthSection("onboarding");
    }
  }

  function activateGrowthSection(sectionId) {
    document.querySelectorAll(".view").forEach((view) => {
      view.classList.toggle("active-view", view.id === sectionId);
    });

    document.querySelectorAll(".nav-link[data-section]").forEach((link) => {
      link.classList.toggle("active", link.dataset.section === sectionId);
    });

    const sectionTitle = document.querySelector(`#${sectionId} h2`);
    if (dom.pageTitle && sectionTitle) {
      dom.pageTitle.textContent = sectionTitle.textContent;
    }

    createIcons();
  }

  async function promptPwaInstall() {
    if (!state.deferredInstallPrompt) {
      showToast("Instalação disponível quando o navegador liberar o app.", "error");
      return;
    }

    state.deferredInstallPrompt.prompt();
    await state.deferredInstallPrompt.userChoice.catch(() => null);
    state.deferredInstallPrompt = null;

    const button = document.getElementById("installPwaButton");
    if (button) button.hidden = true;
  }

  function renderGrowthFeatures() {
    renderSales();
    renderAiAnalysis();
    renderReports();
    renderGoals();
    renderBudgetSettings();
    renderBudgetAlerts();
    renderOnboarding();
    renderSettingsExtras();
    renderAdminSummary();
    renderProductionChecklist();
    renderAdminLogs();
    renderMobileTabbar();
    renderOutlookState();
    createIcons();
  }

  function getReportPeriod() {
    const month = Number(document.getElementById("reportMonth")?.value || state.month);
    const year = Number(document.getElementById("reportYear")?.value || state.year);

    return {
      month: Number.isFinite(month) && month > 0 ? month : state.month,
      year: Number.isFinite(year) && year > 0 ? year : state.year
    };
  }

  function hydrateGrowthDataForCurrentUser() {
    if (!state.systemUser || !state.accessGranted) return;

    const key = `${normalizeEmail(state.systemUser.email)}:${canUseFirestore() ? "firestore" : "local"}`;
    if (state.growthHydrating || state.growthDataLoadedFor === key) return;

    state.growthDataLoadedFor = key;
    state.manualSales = loadSalesFromLocal(state.systemUser.email);
    state.allSales = isAdminUser() ? loadAllSalesFromLocal() : state.manualSales.slice();
    state.appSettings = loadSettingsFromLocal(state.systemUser.email);
    state.userSettings = isAdminUser() ? loadAllSettingsFromLocal() : { [normalizeEmail(state.systemUser.email)]: state.appSettings };
    applyAppSettings();

    if (!canUseFirestore()) {
      console.warn(`${FINANCEIRO_LOG_PREFIX} Firestore indisponível. Usando fallback local para vendas/configurações.`);
      renderApp();
      return;
    }

    state.growthHydrating = true;
    Promise.all([
      hydrateSettingsFromFirestore(),
      isAdminUser() ? hydrateAllSettingsFromFirestore() : Promise.resolve(false),
      hydrateSalesFromFirestore()
    ]).catch((error) => {
      console.warn(`${FINANCEIRO_LOG_PREFIX} Falha ao carregar vendas/configurações do Firestore. Fallback local mantido.`, error);
    }).finally(() => {
      state.growthHydrating = false;
      mergeManualSalesIntoDashboard();
      renderApp();
    });
  }

  function getSalesStorageKey(email = state.systemUser && state.systemUser.email) {
    const normalized = normalizeEmail(email);
    return normalized ? `${SALES_STORAGE_PREFIX}${normalized}` : "";
  }

  function getSettingsStorageKey(email = state.systemUser && state.systemUser.email) {
    const normalized = normalizeEmail(email);
    return normalized ? `${SETTINGS_STORAGE_PREFIX}${normalized}` : "";
  }

  function loadSalesFromLocal(email = state.systemUser && state.systemUser.email) {
    const key = getSalesStorageKey(email);
    if (!key) return [];

    try {
      const sales = JSON.parse(window.localStorage.getItem(key) || "[]");
      return Array.isArray(sales) ? sales.map((sale) => normalizeSale(sale, email)).filter((sale) => sale.id) : [];
    } catch (error) {
      console.warn(`${FINANCEIRO_LOG_PREFIX} Não foi possível carregar vendas locais.`, error);
      return [];
    }
  }

  function loadAllSalesFromLocal() {
    const sales = [];

    try {
      Object.keys(window.localStorage)
        .filter((key) => key.startsWith(SALES_STORAGE_PREFIX))
        .forEach((key) => {
          const email = key.slice(SALES_STORAGE_PREFIX.length);
          sales.push(...loadSalesFromLocal(email));
        });
    } catch (error) {
      console.warn(`${FINANCEIRO_LOG_PREFIX} Não foi possível carregar todas as vendas locais.`, error);
    }

    return dedupeSales(sales);
  }

  function saveSalesToLocal(email, sales) {
    const key = getSalesStorageKey(email);
    if (!key) return false;

    try {
      window.localStorage.setItem(key, JSON.stringify(dedupeSales(sales)));
      return true;
    } catch (error) {
      console.warn(`${FINANCEIRO_LOG_PREFIX} Não foi possível salvar vendas locais.`, error);
      return false;
    }
  }

  function loadSettingsFromLocal(email = state.systemUser && state.systemUser.email) {
    const key = getSettingsStorageKey(email);
    const fallback = normalizeAppSettings({ email });
    if (!key) return fallback;

    try {
      return normalizeAppSettings(JSON.parse(window.localStorage.getItem(key) || "null") || fallback);
    } catch (error) {
      console.warn(`${FINANCEIRO_LOG_PREFIX} Não foi possível carregar configurações locais.`, error);
      return fallback;
    }
  }

  function loadAllSettingsFromLocal() {
    const settings = {};

    try {
      Object.keys(window.localStorage)
        .filter((key) => key.startsWith(SETTINGS_STORAGE_PREFIX))
        .forEach((key) => {
          const email = key.slice(SETTINGS_STORAGE_PREFIX.length);
          settings[normalizeEmail(email)] = loadSettingsFromLocal(email);
        });
    } catch (error) {
      console.warn(`${FINANCEIRO_LOG_PREFIX} Não foi possível carregar settings locais de usuários.`, error);
    }

    return settings;
  }

  function saveSettingsToLocal(settings = state.appSettings) {
    const normalized = normalizeAppSettings(settings);
    const key = getSettingsStorageKey(normalized.email);
    if (!key) return false;

    try {
      window.localStorage.setItem(key, JSON.stringify(normalized));
      state.userSettings = {
        ...(state.userSettings || {}),
        [normalizeEmail(normalized.email)]: normalized
      };
      return true;
    } catch (error) {
      console.warn(`${FINANCEIRO_LOG_PREFIX} Não foi possível salvar configurações locais.`, error);
      return false;
    }
  }

  async function hydrateSalesFromFirestore() {
    if (!canUseFirestore() || !state.systemUser) return false;

    const emails = isAdminUser()
      ? Array.from(new Set(USERS.map((user) => normalizeEmail(user.email)).filter(Boolean)))
      : [normalizeEmail(state.systemUser.email)];
    const allSales = [];

    for (const email of emails) {
      try {
        const snapshot = await state.firestoreDb.collection("sales").doc(email).collection("items").get();
        const sales = [];
        snapshot.forEach((doc) => {
          sales.push(normalizeSale({ id: doc.id, ...doc.data() }, email));
        });
        if (sales.length) saveSalesToLocal(email, sales);
        allSales.push(...sales);
      } catch (error) {
        console.warn(`${FINANCEIRO_LOG_PREFIX} Falha ao carregar vendas de ${email}.`, error);
        allSales.push(...loadSalesFromLocal(email));
      }
    }

    state.allSales = dedupeSales(allSales);
    state.manualSales = state.allSales.filter((sale) => normalizeEmail(sale.ownerEmail) === normalizeEmail(state.systemUser.email));
    return true;
  }

  async function saveSaleToFirestore(sale) {
    if (!canUseFirestore()) return false;

    try {
      const normalized = normalizeSale(sale);
      await state.firestoreDb
        .collection("sales")
        .doc(normalizeEmail(normalized.ownerEmail))
        .collection("items")
        .doc(normalized.id)
        .set(normalized, { merge: true });
      return true;
    } catch (error) {
      console.warn(`${FINANCEIRO_LOG_PREFIX} Firestore falhou ao salvar venda. Fallback local mantido.`, error);
      return false;
    }
  }

  async function deleteSaleFromFirestore(sale) {
    if (!canUseFirestore()) return false;

    try {
      await state.firestoreDb
        .collection("sales")
        .doc(normalizeEmail(sale.ownerEmail))
        .collection("items")
        .doc(sale.id)
        .delete();
      return true;
    } catch (error) {
      console.warn(`${FINANCEIRO_LOG_PREFIX} Firestore falhou ao excluir venda. Fallback local atualizado.`, error);
      return false;
    }
  }

  async function hydrateSettingsFromFirestore() {
    if (!canUseFirestore() || !state.systemUser) return false;

    try {
      const doc = await state.firestoreDb.collection("settings").doc(normalizeEmail(state.systemUser.email)).get();
      if (doc.exists) {
        state.appSettings = normalizeAppSettings({ ...doc.data(), email: state.systemUser.email });
        saveSettingsToLocal(state.appSettings);
        applyAppSettings();
      } else {
        await saveSettingsToFirestore(state.appSettings || normalizeAppSettings({ email: state.systemUser.email }));
      }
      return true;
    } catch (error) {
      console.warn(`${FINANCEIRO_LOG_PREFIX} Firestore falhou ao carregar configurações. Fallback local mantido.`, error);
      return false;
    }
  }

  async function hydrateAllSettingsFromFirestore() {
    if (!canUseFirestore() || !isAdminUser()) return false;

    const settings = { ...state.userSettings };

    for (const user of USERS) {
      const email = normalizeEmail(user.email);
      if (!email) continue;
      try {
        const doc = await state.firestoreDb.collection("settings").doc(email).get();
        if (doc.exists) {
          settings[email] = normalizeAppSettings({ ...doc.data(), email });
          saveSettingsToLocal(settings[email]);
        }
      } catch (error) {
        console.warn(`${FINANCEIRO_LOG_PREFIX} Falha ao carregar settings de ${email}.`, error);
      }
    }

    state.userSettings = settings;
    return true;
  }

  async function saveSettingsToFirestore(settings = state.appSettings) {
    if (!canUseFirestore()) return false;

    try {
      const normalized = normalizeAppSettings(settings);
      const email = normalizeEmail(normalized.email);
      if (!email) return false;
      await state.firestoreDb.collection("settings").doc(email).set(normalized, { merge: true });
      return true;
    } catch (error) {
      console.warn(`${FINANCEIRO_LOG_PREFIX} Firestore falhou ao salvar configurações. Fallback local mantido.`, error);
      return false;
    }
  }

  function normalizeSale(sale, fallbackEmail = state.systemUser && state.systemUser.email) {
    const ownerEmail = normalizeEmail(sale && (sale.ownerEmail || sale.email || fallbackEmail));
    const id = safeGrowthText(sale && sale.id, `sale_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`);
    const createdAt = safeGrowthText(sale && sale.createdAt, new Date().toISOString());

    return {
      id,
      ownerEmail,
      cliente: safeGrowthText(sale && sale.cliente, ""),
      produtoServico: safeGrowthText(sale && (sale.produtoServico || sale.produto || sale.servico), ""),
      valor: Math.max(0, Number(sale && sale.valor) || 0),
      formaPagamento: safeGrowthText(sale && sale.formaPagamento, "Pix"),
      data: safeGrowthText(sale && sale.data, new Date().toISOString().slice(0, 10)),
      categoria: safeGrowthText(sale && sale.categoria, "Serviços"),
      observacao: safeGrowthText(sale && (sale.observacao || sale.observação), ""),
      origem: "venda_manual",
      createdAt,
      updatedAt: safeGrowthText(sale && sale.updatedAt, createdAt)
    };
  }

  function dedupeSales(sales) {
    const map = new Map();
    (Array.isArray(sales) ? sales : []).forEach((sale) => {
      const normalized = normalizeSale(sale);
      if (normalized.id && normalized.ownerEmail) {
        map.set(`${normalized.ownerEmail}:${normalized.id}`, normalized);
      }
    });
    return Array.from(map.values()).sort((a, b) => (parseGrowthDate(b.data)?.getTime() || 0) - (parseGrowthDate(a.data)?.getTime() || 0));
  }

  function getVisibleSales() {
    const currentEmail = normalizeEmail(state.systemUser && state.systemUser.email);
    const filter = isAdminUser() ? state.adminUserFilter || "all" : currentEmail;
    const source = isAdminUser() ? state.allSales : state.manualSales;

    return dedupeSales(source).filter((sale) => {
      if (!isAdminUser()) return normalizeEmail(sale.ownerEmail) === currentEmail;
      return filter === "all" || normalizeEmail(sale.ownerEmail) === normalizeEmail(filter);
    });
  }

  function getSalesForCurrentPeriod() {
    return getVisibleSales().filter((sale) => {
      const date = parseGrowthDate(sale.data);
      return date && date.getMonth() + 1 === state.month && date.getFullYear() === state.year;
    });
  }

  function saleToEntrada(sale) {
    return {
      id: sale.id,
      tipo: "entrada",
      nome: sale.cliente,
      remetente: sale.cliente,
      valor: sale.valor,
      data: sale.data,
      categoria: sale.categoria,
      descricao: sale.produtoServico,
      origem: "venda_manual",
      observacao: sale.observacao,
      ownerEmail: sale.ownerEmail,
      raw: clonePlainObject(sale)
    };
  }

  function saleToHistory(sale) {
    return {
      id: sale.id,
      tipo: "entrada",
      nome: sale.cliente,
      valor: sale.valor,
      data: sale.data,
      categoria: sale.categoria,
      descricao: sale.produtoServico,
      origem: "venda_manual",
      observacao: sale.observacao,
      ownerEmail: sale.ownerEmail,
      raw: clonePlainObject(sale)
    };
  }

  function mergeManualSalesIntoDashboard() {
    if (!state.data) return;

    const sales = getSalesForCurrentPeriod();
    const salesEntradas = sales.map(saleToEntrada);
    const salesHistorico = sales.map(saleToHistory);

    state.data.entradas = [
      ...(Array.isArray(state.data.entradas) ? state.data.entradas : []).filter((item) => item.origem !== "venda_manual"),
      ...salesEntradas
    ].sort(sortTransactionByDateDesc);

    state.data.historico = [
      ...(Array.isArray(state.data.historico) ? state.data.historico : []).filter((item) => item.origem !== "venda_manual"),
      ...salesHistorico
    ].sort(sortTransactionByDateDesc);

    const recebido = sumValues(state.data.entradas);
    const gasto = sumValues(state.data.saidas);
    const qtdEntradas = state.data.entradas.length;
    const qtdSaidas = state.data.saidas.length;
    const totalMovements = qtdEntradas + qtdSaidas;

    state.data.dashboard.recebido = recebido;
    state.data.dashboard.gasto = gasto;
    state.data.dashboard.saldo = recebido - gasto;
    state.data.dashboard.qtdEntradas = qtdEntradas;
    state.data.dashboard.qtdSaidas = qtdSaidas;
    state.data.dashboard.ticketMedio = totalMovements ? (recebido + gasto) / totalMovements : 0;
    state.data.dashboard.maiorEntrada = Math.max(0, ...state.data.entradas.map((item) => Number(item.valor) || 0));
    state.data.dashboard.maiorGasto = Math.max(0, ...state.data.saidas.map((item) => Number(item.valor) || 0));
  }

  function sortTransactionByDateDesc(a, b) {
    return (parseGrowthDate(b.data)?.getTime() || 0) - (parseGrowthDate(a.data)?.getTime() || 0);
  }

  function getActiveTransactions() {
    const data = state.data || {};
    const entradas = Array.isArray(data.entradas) ? data.entradas : [];
    const saidas = Array.isArray(data.saidas) ? data.saidas : [];

    return [
      ...entradas.map((item) => normalizeGrowthTransaction(item, "recebido")),
      ...saidas.map((item) => normalizeGrowthTransaction(item, "enviado"))
    ].filter((item) => item.valor > 0);
  }

  function normalizeGrowthTransaction(item, type) {
    const raw = item || {};
    const nome = raw.nome || raw.remetente || raw.quemEnviou || raw.destino || raw.descricao || "Transação Pix";

    return {
      id: raw.id || raw.gmailMessageId || raw.emailId || raw.hash || "",
      tipo: type,
      data: raw.data || raw.date || "",
      nome: safeGrowthText(nome, "Transação Pix"),
      categoria: safeGrowthText(raw.categoria || raw.category, type === "recebido" ? "Receita" : "Outros"),
      valor: Math.abs(Number(raw.valor || raw.value || 0)),
      descricao: safeGrowthText(raw.descricao || raw.description, ""),
      origem: safeGrowthText(raw.origem, type === "recebido" ? "api" : "api"),
      banco: safeGrowthText(raw.banco, ""),
      gmailMessageId: safeGrowthText(raw.gmailMessageId || raw.emailId, ""),
      hash: safeGrowthText(raw.hash, ""),
      observacao: safeGrowthText(raw.observacao || raw.observação, ""),
      ownerEmail: safeGrowthText(raw.ownerEmail, ""),
      raw
    };
  }

  function getFilteredTransactions(month, year) {
    return getActiveTransactions().filter((transaction) => {
      const date = parseGrowthDate(transaction.data);
      return date && date.getMonth() + 1 === month && date.getFullYear() === year;
    });
  }

  function calculateReport(month, year) {
    const transactions = getFilteredTransactions(month, year);
    const received = transactions.filter((item) => item.tipo === "recebido");
    const sent = transactions.filter((item) => item.tipo === "enviado");
    const income = sumGrowthValues(received);
    const expense = sumGrowthValues(sent);
    const categoryMap = new Map();

    sent.forEach((item) => {
      const key = normalizeGrowthCategory(item.categoria);
      const current = categoryMap.get(key) || { count: 0, total: 0 };
      current.count += 1;
      current.total += item.valor;
      categoryMap.set(key, current);
    });

    const topCategory = Array.from(categoryMap.entries()).sort((a, b) => {
      if (b[1].count !== a[1].count) return b[1].count - a[1].count;
      return b[1].total - a[1].total;
    })[0];

    const biggestExpense = sent.slice().sort((a, b) => b.valor - a.valor)[0] || null;

    return {
      month,
      year,
      transactions,
      received,
      sent,
      income,
      expense,
      balance: income - expense,
      biggestExpense,
      topCategory,
      categoryMap
    };
  }

  function renderSales() {
    const table = document.getElementById("salesTable");
    if (!table) return;

    populateUserFilters();
    const sales = getVisibleSales();
    const currentPeriodSales = getSalesForCurrentPeriod();
    const total = sumGrowthValues(currentPeriodSales.map((sale) => ({ valor: sale.valor })));

    setText("salesTotalPill", formatGrowthCurrency(total));
    setText("salesCountLabel", `${sales.length} ${sales.length === 1 ? "venda registrada" : "vendas registradas"}`);

    if (!sales.length) {
      table.innerHTML = `<tr><td colspan="6">Nenhuma venda registrada ainda.</td></tr>`;
      return;
    }

    table.innerHTML = sales.map((sale) => `
      <tr class="clickable-row" data-sale-id="${escapeGrowthHtml(sale.id)}" data-sale-owner="${escapeGrowthHtml(sale.ownerEmail)}">
        <td data-label="Data">${escapeGrowthHtml(formatSaleDate(sale.data))}</td>
        <td data-label="Cliente" class="name-cell"><button class="name-button" type="button" data-sale-action="details">${escapeGrowthHtml(sale.cliente)}</button></td>
        <td data-label="Produto/Serviço">${escapeGrowthHtml(sale.produtoServico)}</td>
        <td data-label="Categoria"><span class="tag">${escapeGrowthHtml(sale.categoria)}</span></td>
        <td data-label="Valor" class="align-right amount entrada">+ ${formatGrowthCurrency(sale.valor)}</td>
        <td data-label="Ações">
          <div class="row-actions">
            <button class="mini-action" type="button" data-sale-action="edit" title="Editar venda"><i data-lucide="pencil"></i></button>
            <button class="mini-action danger-action" type="button" data-sale-action="delete" title="Excluir venda"><i data-lucide="trash-2"></i></button>
          </div>
        </td>
      </tr>
    `).join("");
  }

  function handleHistoryDetailsClick(event, source) {
    const row = event.target.closest("[data-history-index]");
    if (!row) return;

    const collection = source === "recent" ? state.recentHistoryRows : state.visibleHistoryRows;
    const transaction = Array.isArray(collection) ? collection[Number(row.dataset.historyIndex)] : null;
    if (!transaction) return;

    state.pixDetailsModal.open(transaction);
  }

  function handleSaleSubmit(event) {
    event.preventDefault();

    if (!state.systemUser) {
      showToast("Entre no sistema antes de lançar uma venda.", "error");
      return;
    }

    const id = safeGrowthText(document.getElementById("saleIdInput")?.value, "");
    const ownerEmail = id
      ? (findSaleById(id)?.ownerEmail || state.systemUser.email)
      : state.systemUser.email;
    const sale = normalizeSale({
      id: id || `sale_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`,
      ownerEmail,
      cliente: document.getElementById("saleClientInput")?.value,
      produtoServico: document.getElementById("saleProductInput")?.value,
      valor: document.getElementById("saleValueInput")?.value,
      formaPagamento: document.getElementById("salePaymentInput")?.value,
      data: document.getElementById("saleDateInput")?.value,
      categoria: document.getElementById("saleCategoryInput")?.value,
      observacao: document.getElementById("saleObservationInput")?.value,
      createdAt: findSaleById(id)?.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });

    if (!sale.cliente || !sale.produtoServico || !sale.valor || !sale.data) {
      showToast("Preencha cliente, produto, valor e data da venda.", "error");
      return;
    }

    upsertSaleInState(sale);
    saveSalesToLocal(sale.ownerEmail, state.allSales.filter((item) => normalizeEmail(item.ownerEmail) === normalizeEmail(sale.ownerEmail)));
    saveSaleToFirestore(sale);
    mergeManualSalesIntoDashboard();
    resetSaleForm();
    renderApp();
    addSystemLog(id ? "venda editada" : "venda criada", `${sale.cliente} - ${formatGrowthCurrency(sale.valor)}`);
    showToast(id ? "Venda atualizada." : "Venda lançada como receita.");
  }

  function handleSalesTableClick(event) {
    const row = event.target.closest("[data-sale-id]");
    if (!row) return;

    const action = event.target.closest("[data-sale-action]")?.dataset.saleAction || "details";
    const sale = findSaleById(row.dataset.saleId, row.dataset.saleOwner);
    if (!sale) return;

    if (action === "edit") {
      fillSaleForm(sale);
      return;
    }

    if (action === "delete") {
      deleteSale(sale);
      return;
    }

    state.pixDetailsModal.open(saleToHistory(sale));
  }

  function fillSaleForm(sale) {
    document.getElementById("saleIdInput").value = sale.id;
    document.getElementById("saleClientInput").value = sale.cliente;
    document.getElementById("saleProductInput").value = sale.produtoServico;
    document.getElementById("saleValueInput").value = sale.valor;
    document.getElementById("salePaymentInput").value = sale.formaPagamento;
    document.getElementById("saleDateInput").value = sale.data;
    document.getElementById("saleCategoryInput").value = sale.categoria;
    document.getElementById("saleObservationInput").value = sale.observacao;
    setText("saleFormTitle", "Editar venda");
    setText("saleSubmitLabel", "Atualizar venda");
    const cancel = document.getElementById("saleCancelEditButton");
    if (cancel) cancel.hidden = false;
    setActiveSection("vendas");
  }

  function resetSaleForm() {
    const form = document.getElementById("saleForm");
    if (form) form.reset();
    const today = new Date().toISOString().slice(0, 10);
    const dateInput = document.getElementById("saleDateInput");
    if (dateInput) dateInput.value = today;
    document.getElementById("saleIdInput").value = "";
    setText("saleFormTitle", "Lançar venda");
    setText("saleSubmitLabel", "Salvar venda");
    const cancel = document.getElementById("saleCancelEditButton");
    if (cancel) cancel.hidden = true;
  }

  function upsertSaleInState(sale) {
    state.allSales = dedupeSales([
      ...state.allSales.filter((item) => !(item.id === sale.id && normalizeEmail(item.ownerEmail) === normalizeEmail(sale.ownerEmail))),
      sale
    ]);
    state.manualSales = state.allSales.filter((item) => normalizeEmail(item.ownerEmail) === normalizeEmail(state.systemUser && state.systemUser.email));
  }

  function findSaleById(id, ownerEmail = "") {
    const normalizedOwner = normalizeEmail(ownerEmail);
    return state.allSales.find((sale) => sale.id === id && (!normalizedOwner || normalizeEmail(sale.ownerEmail) === normalizedOwner))
      || state.manualSales.find((sale) => sale.id === id);
  }

  function deleteSale(sale) {
    const confirmed = window.confirm(`Excluir a venda de ${sale.cliente}?`);
    if (!confirmed) return;

    state.allSales = state.allSales.filter((item) => !(item.id === sale.id && normalizeEmail(item.ownerEmail) === normalizeEmail(sale.ownerEmail)));
    state.manualSales = state.manualSales.filter((item) => item.id !== sale.id);
    saveSalesToLocal(sale.ownerEmail, state.allSales.filter((item) => normalizeEmail(item.ownerEmail) === normalizeEmail(sale.ownerEmail)));
    deleteSaleFromFirestore(sale);
    mergeManualSalesIntoDashboard();
    renderApp();
    addSystemLog("venda excluída", `${sale.cliente} - ${formatGrowthCurrency(sale.valor)}`);
    showToast("Venda excluída.");
  }

  function formatSaleDate(value) {
    const date = parseGrowthDate(value);
    if (!date) return safeGrowthText(value, "--");
    return new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" }).format(date);
  }

  function populateUserFilters() {
    const selects = [
      document.getElementById("salesUserFilter"),
      document.getElementById("adminUserFilter")
    ].filter(Boolean);
    const options = [`<option value="all">Todos usuários</option>`]
      .concat(USERS.map((user) => `<option value="${escapeGrowthHtml(normalizeEmail(user.email))}">${escapeGrowthHtml(user.name || user.email)}</option>`));

    selects.forEach((select) => {
      const current = select.value || state.adminUserFilter || "all";
      select.hidden = !isAdminUser();
      if (select.parentElement) select.parentElement.hidden = !isAdminUser();
      select.innerHTML = options.join("");
      select.value = Array.from(select.options).some((option) => option.value === current) ? current : "all";
    });
  }

  function renderAdminSummary() {
    const grid = document.getElementById("adminSummaryGrid");
    if (!grid) return;

    if (!isAdminUser()) {
      grid.innerHTML = "";
      return;
    }

    const pendingInvites = INVITES.filter((invite) => invite.status === "active" && !invite.usedAt).length;
    const usedInvites = INVITES.filter((invite) => invite.usedAt || invite.status === "used").length;
    const totalTransactions = (state.data.entradas.length || 0) + (state.data.saidas.length || 0);
    const totalSales = state.allSales.length;

    grid.innerHTML = [
      ["Usuários", USERS.length, "users"],
      ["Convites pendentes", pendingInvites, "ticket"],
      ["Convites usados", usedInvites, "ticket-check"],
      ["Transações", totalTransactions, "receipt-text"],
      ["Vendas", totalSales, "shopping-bag"]
    ].map(([label, value, icon]) => `
      <article class="admin-summary-card">
        <i data-lucide="${icon}"></i>
        <span>${label}</span>
        <strong>${formatNumber(value)}</strong>
      </article>
    `).join("");
  }

  function handleAdminUserAction(event) {
    const row = event.target.closest("[data-admin-user-email]");
    if (!row || !isAdminUser()) return;

    const email = normalizeEmail(row.dataset.adminUserEmail);
    const user = USERS.find((item) => normalizeEmail(item.email) === email);
    if (!user) return;

    const roleSelect = event.target.closest("[data-admin-role]");
    if (roleSelect) {
      user.role = roleSelect.value === "admin" ? "admin" : "user";
      saveUsers();
      saveUserToFirestore(user);
      renderAdmin();
      addSystemLog("role editada", `${user.email} agora é ${user.role}`);
      return;
    }

    const action = event.target.closest("[data-admin-user-action]")?.dataset.adminUserAction;
    if (action === "toggle-block") {
      user.blocked = !user.blocked;
      saveUsers();
      saveUserToFirestore(user);
      renderAdmin();
      addSystemLog(user.blocked ? "usuário bloqueado" : "usuário desbloqueado", user.email);
      showToast(user.blocked ? "Usuário bloqueado." : "Usuário desbloqueado.");
    }
  }

  function handleAdminInviteAction(event) {
    const row = event.target.closest("[data-admin-invite-token]");
    if (!row || !isAdminUser()) return;

    const invite = INVITES.find((item) => item.token === row.dataset.adminInviteToken);
    if (!invite) return;

    const action = event.target.closest("[data-admin-invite-action]")?.dataset.adminInviteAction;
    if (action === "copy") {
      const link = buildInviteLink(invite.token);
      navigator.clipboard?.writeText(link).then(() => showToast("Convite copiado.")).catch(() => {
        dom.adminInviteLink.value = link;
        showToast("Link colocado no campo de convite para copiar.");
      });
      return;
    }

    if (action === "cancel") {
      invite.status = "canceled";
      saveInvites();
      saveInviteToFirestore(invite);
      renderAdmin();
      addSystemLog("convite cancelado", invite.email);
      showToast("Convite cancelado.");
    }
  }

  function normalizeAppSettings(settings) {
    const email = normalizeEmail(settings && (settings.email || state.systemUser && state.systemUser.email));

    return {
      email,
      name: safeGrowthText(settings && settings.name, state.systemUser && state.systemUser.name || ""),
      theme: safeGrowthText(settings && settings.theme, "dark") === "light" ? "light" : "dark",
      gmailConnected: Boolean(settings && settings.gmailConnected),
      gmailEmail: safeGrowthText(settings && settings.gmailEmail, state.gmailEmail || ""),
      gmailConnectedAt: safeGrowthText(settings && settings.gmailConnectedAt, state.gmailConnectedAt || ""),
      blocked: Boolean(settings && settings.blocked),
      updatedAt: safeGrowthText(settings && settings.updatedAt, new Date().toISOString())
    };
  }

  function applyAppSettings() {
    const settings = state.appSettings || normalizeAppSettings({});
    document.documentElement.dataset.theme = settings.theme || "dark";
    document.body.dataset.theme = settings.theme || "dark";

    const profileName = document.getElementById("profileNameInput");
    const themeSelect = document.getElementById("themeSelect");
    if (profileName && document.activeElement !== profileName) profileName.value = settings.name || state.systemUser?.name || "";
    if (themeSelect) themeSelect.value = settings.theme || "dark";
  }

  async function handleProfileSettingsSubmit(event) {
    event.preventDefault();
    if (!state.systemUser) return;

    const name = safeGrowthText(document.getElementById("profileNameInput")?.value, state.systemUser.name);
    const password = safeGrowthText(document.getElementById("profilePasswordInput")?.value, "");
    const theme = document.getElementById("themeSelect")?.value === "light" ? "light" : "dark";
    const user = USERS.find((item) => normalizeEmail(item.email) === normalizeEmail(state.systemUser.email));

    if (user) {
      user.name = name;
      if (password) user.password = password;
      saveUsers();
      saveUserToFirestore(user);
    }

    state.systemUser.name = name;
    saveSystemSession(state.systemUser);
    state.appSettings = normalizeAppSettings({
      ...(state.appSettings || {}),
      email: state.systemUser.email,
      name,
      theme,
      gmailConnected: state.gmailConnected,
      gmailEmail: state.gmailEmail,
      gmailConnectedAt: state.gmailConnectedAt,
      updatedAt: new Date().toISOString()
    });
    saveSettingsToLocal(state.appSettings);
    saveSettingsToFirestore(state.appSettings);
    applyAppSettings();
    renderSystemSession();
    renderSettingsExtras();
    addSystemLog("configurações atualizadas", state.systemUser.email);
    showToast("Configurações salvas.");
    const passwordInput = document.getElementById("profilePasswordInput");
    if (passwordInput) passwordInput.value = "";
  }

  function renderSettingsExtras() {
    const status = document.getElementById("settingsGmailStatus");
    const email = document.getElementById("settingsGmailEmail");
    if (status) status.textContent = state.gmailConnected ? "Conectado" : "Desconectado";
    if (email) email.textContent = state.gmailEmail || "--";
    applyAppSettings();
  }

  function disconnectGmailFromSettings() {
    clearGmailConnection({ clearData: false, clearStored: true });
    state.gmailAccessToken = "";
    state.gmailConnected = false;
    state.gmailSessionExpired = false;
    state.appSettings = normalizeAppSettings({
      ...(state.appSettings || {}),
      gmailConnected: false,
      gmailEmail: "",
      gmailConnectedAt: "",
      updatedAt: new Date().toISOString()
    });
    saveSettingsToLocal(state.appSettings);
    saveSettingsToFirestore(state.appSettings);
    renderAuthPanel();
    renderSettingsExtras();
    addSystemLog("Gmail desconectado", state.systemUser && state.systemUser.email || "");
    showToast("Gmail desconectado deste navegador.");
  }

  function clearLocalDataFromSettings() {
    const confirmed = window.confirm("Limpar dados locais deste navegador? Firestore e API não serão apagados.");
    if (!confirmed) return;

    const keepSession = window.localStorage.getItem(SYSTEM_SESSION_KEY);
    Object.keys(window.localStorage)
      .filter((key) => key.startsWith("financeiroAutomatico"))
      .forEach((key) => window.localStorage.removeItem(key));
    if (keepSession) window.localStorage.setItem(SYSTEM_SESSION_KEY, keepSession);
    state.manualSales = [];
    state.allSales = [];
    addSystemLog("dados locais limpos", state.systemUser && state.systemUser.email || "");
    showToast("Dados locais limpos.");
    renderApp();
  }

  function renderAiAnalysis() {
    const grid = document.getElementById("aiInsightsGrid");
    if (!grid) return;

    const report = calculateReport(state.month, state.year);
    const insights = buildAiInsights(report);
    setText("aiSummaryPill", `${insights.length} insights`);

    grid.innerHTML = insights.length
      ? insights.map((insight) => `
        <article class="ai-card ${escapeGrowthHtml(insight.kind)}">
          <div class="ai-card-icon"><i data-lucide="${escapeGrowthHtml(insight.icon)}"></i></div>
          <span>${escapeGrowthHtml(insight.label)}</span>
          <h3>${escapeGrowthHtml(insight.title)}</h3>
          <p>${escapeGrowthHtml(insight.text)}</p>
        </article>
      `).join("")
      : `<article class="panel empty-state-card"><h3>Sem dados suficientes</h3><p>Conecte o Gmail ou lance vendas para gerar análises.</p></article>`;
  }

  function buildAiInsights(report) {
    const insights = [];
    const expense = report.expense;
    const income = report.income;
    const sentCount = report.sent.length;
    const avgTicket = sentCount ? expense / sentCount : 0;
    const smallOutflows = report.sent.filter((item) => item.valor > 0 && item.valor <= 35).length;

    insights.push({
      kind: "summary",
      icon: "sparkles",
      label: "Resumo do mês",
      title: `${MONTHS[state.month - 1]} de ${state.year}`,
      text: `Você recebeu ${formatGrowthCurrency(income)} e gastou ${formatGrowthCurrency(expense)}. Saldo: ${formatGrowthCurrency(report.balance)}.`
    });

    if (report.balance < 0) {
      insights.push({
        kind: "alert",
        icon: "triangle-alert",
        label: "Alerta",
        title: "Você gastou mais do que recebeu",
        text: "Seu saldo ficou negativo neste período. Revise as maiores despesas antes de assumir novos compromissos."
      });
    }

    if (report.topCategory) {
      const [category, data] = report.topCategory;
      const percent = expense ? Math.round((data.total / expense) * 100) : 0;
      insights.push({
        kind: percent >= 35 ? "alert" : "suggestion",
        icon: "tags",
        label: percent >= 35 ? "Alerta" : "Sugestão",
        title: `Categoria ${category} representa ${percent}% dos gastos`,
        text: `Seu maior grupo de saída foi ${category}, com ${formatGrowthCurrency(data.total)}.`
      });
    }

    const biggest = report.sent.slice().sort((a, b) => b.valor - a.valor)[0];
    if (biggest) {
      insights.push({
        kind: "opportunity",
        icon: "search",
        label: "Oportunidade",
        title: `Maior gasto: ${biggest.nome}`,
        text: `A maior despesa foi ${formatGrowthCurrency(biggest.valor)} em ${biggest.categoria}. Vale conferir se ela é recorrente.`
      });
    }

    if (sentCount >= 20) {
      insights.push({
        kind: "alert",
        icon: "send",
        label: "Alerta",
        title: "Muitos Pix enviados no período",
        text: `Foram ${sentCount} saídas. Agrupar compras e revisar recorrências pode reduzir gastos invisíveis.`
      });
    }

    if (smallOutflows >= 8) {
      insights.push({
        kind: "suggestion",
        icon: "coins",
        label: "Sugestão",
        title: "Muitas saídas pequenas",
        text: `${smallOutflows} despesas foram pequenas. Revise compras impulsivas e assinaturas de baixo valor.`
      });
    }

    if (avgTicket > 250) {
      insights.push({
        kind: "suggestion",
        icon: "receipt",
        label: "Sugestão",
        title: "Ticket médio alto",
        text: `Seu ticket médio de saída ficou em ${formatGrowthCurrency(avgTicket)}. Compare com meses anteriores antes de aumentar gastos fixos.`
      });
    }

    if (Array.isArray(state.monthlySeries) && state.monthlySeries.length > 1) {
      const current = state.monthlySeries[state.monthlySeries.length - 1];
      const previous = state.monthlySeries[state.monthlySeries.length - 2];
      if (current && previous && current.gasto > previous.gasto) {
        const diff = current.gasto - previous.gasto;
        insights.push({
          kind: "opportunity",
          icon: "trending-up",
          label: "Comparação",
          title: "Gastos subiram em relação ao mês anterior",
          text: `Você gastou ${formatGrowthCurrency(diff)} a mais do que no mês anterior salvo.`
        });
      }
    }

    return insights.slice(0, 8);
  }

  function renderOutlookState() {
    const buttons = [
      document.getElementById("connectOutlookButton"),
      document.getElementById("settingsOutlookButton")
    ].filter(Boolean);

    buttons.forEach((button) => {
      button.hidden = !state.accessGranted && button.id === "connectOutlookButton";
      button.classList.add("is-disabled");
      const label = button.querySelector("span");
      if (label) label.textContent = "Outlook/Hotmail Beta";
      button.title = "Em breve: integração via Microsoft Graph API.";
    });
  }

  function renderMobileTabbar() {
    const tabbar = document.querySelector(".mobile-tabbar");
    if (!tabbar) return;

    const hasAccess = Boolean(state.accessGranted);
    tabbar.hidden = !hasAccess;
    document.body.classList.toggle("has-mobile-tabbar", hasAccess);

    if (!hasAccess) return;

    const activeSection = document.querySelector(".view.active-view")?.id || "dashboard";
    tabbar.querySelectorAll("[data-mobile-section]").forEach((button) => {
      const section = button.dataset.mobileSection || "dashboard";
      button.classList.toggle("active", section === activeSection);
      button.disabled = section === "admin" && !isAdminUser();
    });
  }

  // Futuro: implementar OAuth Microsoft com Microsoft Graph API para ler e-mails Outlook/Hotmail.
  function outlookAuth(source = "manual") {
    if (source !== "init") {
      console.warn(`${FINANCEIRO_LOG_PREFIX} Outlook/Hotmail ainda não implementado. Futuramente usar Microsoft Graph API.`, { source });
      showToast("Outlook/Hotmail está em beta. Integração futura via Microsoft Graph API.");
    }
    return {
      status: "beta",
      provider: "microsoft-graph"
    };
  }

  async function syncOutlookEmails() {
    console.warn(`${FINANCEIRO_LOG_PREFIX} syncOutlookEmails é um stub. Microsoft Graph API será necessária no futuro.`);
    return [];
  }

  function parseOutlookPixEmail(email) {
    console.warn(`${FINANCEIRO_LOG_PREFIX} parseOutlookPixEmail é um stub beta.`, { subject: email && email.subject });
    return null;
  }

  function renderReports() {
    const root = document.getElementById("relatorios");
    if (!root) return;

    const period = getReportPeriod();
    const report = calculateReport(period.month, period.year);

    setText("reportIncome", formatGrowthCurrency(report.income));
    setText("reportExpense", formatGrowthCurrency(report.expense));
    setText("reportBalance", formatGrowthCurrency(report.balance));
    setText("reportBiggestExpense", report.biggestExpense ? formatGrowthCurrency(report.biggestExpense.valor) : "R$ 0,00");
    setText("reportSummaryLabel", `${MONTHS[period.month - 1]} de ${period.year}`);

    const summary = document.getElementById("reportSummaryList");
    if (summary) {
      summary.innerHTML = [
        ["Entradas", `${report.received.length} transações`],
        ["Saídas", `${report.sent.length} transações`],
        ["Receitas x despesas", `${formatGrowthCurrency(report.income)} / ${formatGrowthCurrency(report.expense)}`],
        ["Maior gasto", report.biggestExpense ? `${escapeGrowthHtml(report.biggestExpense.nome)} - ${formatGrowthCurrency(report.biggestExpense.valor)}` : "Nenhum gasto no período"]
      ].map(([label, value]) => `<div class="summary-kpi"><span>${label}</span><strong>${value}</strong></div>`).join("");
    }

    const top = document.getElementById("reportTopCategory");
    if (top) {
      top.innerHTML = report.topCategory
        ? `<div>${escapeGrowthHtml(report.topCategory[0])}<br><small>${report.topCategory[1].count} usos - ${formatGrowthCurrency(report.topCategory[1].total)}</small></div>`
        : "<div>Sem despesas no período</div>";
    }
  }

  function renderGoals() {
    const form = document.getElementById("goalsForm");
    if (!form) return;

    const period = getReportPeriod();
    const report = calculateReport(period.month, period.year);
    const goals = loadMonthlyGoals(period.month, period.year);
    const savingsInput = document.getElementById("savingsGoalInput");
    const limitInput = document.getElementById("monthlyLimitInput");

    if (document.activeElement !== savingsInput && savingsInput) {
      savingsInput.value = goals.savingsGoal || "";
    }

    if (document.activeElement !== limitInput && limitInput) {
      limitInput.value = goals.monthlyLimit || "";
    }

    const savingsPercent = goals.savingsGoal ? Math.max(0, (report.balance / goals.savingsGoal) * 100) : 0;
    const spendingPercent = goals.monthlyLimit ? (report.expense / goals.monthlyLimit) * 100 : 0;
    const overLimit = goals.monthlyLimit > 0 && report.expense > goals.monthlyLimit;

    setText("goalsStatusPill", overLimit ? "Limite excedido" : goals.savingsGoal || goals.monthlyLimit ? "Em acompanhamento" : "Sem meta");
    setText("goalsProgressLabel", overLimit ? "Atenção: gasto mensal acima do limite" : "Progresso calculado com os dados atuais");

    const list = document.getElementById("goalsProgressList");
    if (list) {
      list.innerHTML = [
        progressItem("Economia do mês", report.balance, goals.savingsGoal, savingsPercent, false),
        progressItem("Limite de gasto", report.expense, goals.monthlyLimit, spendingPercent, overLimit)
      ].join("");
    }
  }

  function renderBudgetSettings() {
    const grid = document.getElementById("budgetCategoryGrid");
    if (!grid || grid.dataset.editing === "true") return;

    const period = getReportPeriod();
    const report = calculateReport(period.month, period.year);
    const budgets = loadCategoryBudgets(period.month, period.year);
    const spent = getSpentByCategory(report);

    grid.innerHTML = GROWTH_CATEGORIES.map((category) => {
      const key = normalizeGrowthCategory(category);
      const limit = Number(budgets[key] || 0);
      const value = Number(spent[key] || 0);
      const percent = limit ? (value / limit) * 100 : 0;
      const over = limit > 0 && value > limit;

      return `
        <div class="budget-item${over ? " over-limit" : ""}">
          <span>${escapeGrowthHtml(category)}</span>
          <input data-budget-category="${escapeGrowthHtml(key)}" type="number" min="0" step="0.01" value="${limit || ""}" placeholder="Limite mensal">
          <strong>${formatGrowthCurrency(value)}${limit ? ` / ${formatGrowthCurrency(limit)}` : ""}</strong>
          <div class="progress-track${over ? " danger" : ""}" style="--progress:${Math.min(100, percent).toFixed(0)}%"><i></i></div>
        </div>
      `;
    }).join("");

    grid.querySelectorAll("input").forEach((input) => {
      input.addEventListener("focus", () => { grid.dataset.editing = "true"; });
      input.addEventListener("blur", () => { grid.dataset.editing = "false"; });
    });
  }

  function renderBudgetAlerts() {
    const panel = document.getElementById("budgetAlertPanel");
    if (!panel) return;

    const period = {
      month: state.month,
      year: state.year
    };
    const report = calculateReport(period.month, period.year);
    const goals = loadMonthlyGoals(period.month, period.year);
    const budgets = loadCategoryBudgets(period.month, period.year);
    const spent = getSpentByCategory(report);
    const alerts = Object.keys(budgets)
      .filter((category) => Number(budgets[category]) > 0 && Number(spent[category] || 0) > Number(budgets[category]))
      .map((category) => `${category}: ${formatGrowthCurrency(spent[category])} de ${formatGrowthCurrency(budgets[category])}`);

    if (goals.monthlyLimit > 0 && report.expense > goals.monthlyLimit) {
      alerts.unshift(`Limite mensal: ${formatGrowthCurrency(report.expense)} de ${formatGrowthCurrency(goals.monthlyLimit)}`);
    }

    if (!Object.keys(budgets).length && !goals.monthlyLimit) {
      panel.hidden = true;
      return;
    }

    panel.hidden = false;
    panel.classList.toggle("success", alerts.length === 0);
    panel.textContent = alerts.length
      ? `Alerta de orçamento: ${alerts.join(" | ")}`
      : "Metas e orçamentos dentro do limite neste período.";
  }

  function renderOnboarding() {
    const button = document.getElementById("onboardingConnectGmailButton");
    if (!button) return;

    const label = button.querySelector("span");
    if (label) {
      label.textContent = state.gmailConnected ? "Atualizar Gmail" : "Conectar Gmail";
    }
  }

  function renderProductionChecklist() {
    const list = document.getElementById("productionChecklist");
    if (!list) return;

    const items = [
      "functions/.env fora do projeto e do git",
      "Usuário comum não vê modo API",
      "Layout responsivo mobile conferido",
      "Console sem erros críticos",
      "Compatível com Vercel/hosting estático",
      "Checklist de Gmail, convites e backup testado"
    ];

    list.innerHTML = items.map((item) => `
      <span><i data-lucide="check-circle"></i>${escapeGrowthHtml(item)}</span>
    `).join("");
  }

  function saveMonthlyGoals(event) {
    event.preventDefault();

    const period = getReportPeriod();
    const goals = {
      savingsGoal: Number(document.getElementById("savingsGoalInput")?.value || 0),
      monthlyLimit: Number(document.getElementById("monthlyLimitInput")?.value || 0),
      updatedAt: new Date().toISOString()
    };

    saveScopedJson(GOALS_STORAGE_PREFIX, goals, period.month, period.year);
    addSystemLog("metas atualizadas", `${MONTHS[period.month - 1]} de ${period.year}`);
    showToast("Metas financeiras salvas.");
    renderGrowthFeatures();
  }

  function saveCategoryBudgets() {
    const period = getReportPeriod();
    const grid = document.getElementById("budgetCategoryGrid");
    const budgets = {};

    if (!grid) return;

    grid.querySelectorAll("[data-budget-category]").forEach((input) => {
      const value = Number(input.value || 0);
      if (value > 0) budgets[input.dataset.budgetCategory] = value;
    });

    saveScopedJson(BUDGET_STORAGE_PREFIX, budgets, period.month, period.year);
    grid.dataset.editing = "false";
    addSystemLog("orçamento atualizado", `${Object.keys(budgets).length} categorias com limite`);
    showToast("Orçamentos por categoria salvos.");
    renderGrowthFeatures();
  }

  function loadMonthlyGoals(month, year) {
    return loadScopedJson(GOALS_STORAGE_PREFIX, month, year, {
      savingsGoal: 0,
      monthlyLimit: 0
    });
  }

  function loadCategoryBudgets(month, year) {
    return loadScopedJson(BUDGET_STORAGE_PREFIX, month, year, {});
  }

  function saveScopedJson(prefix, data, month, year) {
    const key = getScopedPeriodKey(prefix, month, year);
    if (!key) return false;

    try {
      window.localStorage.setItem(key, JSON.stringify(data));
      return true;
    } catch (error) {
      console.warn(`${FINANCEIRO_LOG_PREFIX} Não foi possível salvar dados locais do MVP.`, error);
      return false;
    }
  }

  function loadScopedJson(prefix, month, year, fallback) {
    const key = getScopedPeriodKey(prefix, month, year);
    if (!key) return fallback;

    try {
      return JSON.parse(window.localStorage.getItem(key) || "null") || fallback;
    } catch (error) {
      console.warn(`${FINANCEIRO_LOG_PREFIX} Não foi possível carregar dados locais do MVP.`, error);
      return fallback;
    }
  }

  function getScopedPeriodKey(prefix, month, year) {
    const email = normalizeEmail(state.systemUser && state.systemUser.email);
    return email ? `${prefix}:${email}:${year}-${String(month).padStart(2, "0")}` : "";
  }

  function getSpentByCategory(report) {
    return report.sent.reduce((acc, item) => {
      const category = normalizeGrowthCategory(item.categoria);
      acc[category] = (acc[category] || 0) + item.valor;
      return acc;
    }, {});
  }

  function progressItem(label, current, target, percent, danger) {
    const safePercent = Number.isFinite(percent) ? Math.max(0, Math.min(100, percent)) : 0;
    const targetLabel = target ? formatGrowthCurrency(target) : "sem valor definido";

    return `
      <div class="goal-progress-item">
        <span>${escapeGrowthHtml(label)}</span>
        <strong>${formatGrowthCurrency(current)} / ${targetLabel}</strong>
        <div class="progress-track${danger ? " danger" : ""}" style="--progress:${safePercent.toFixed(0)}%"><i></i></div>
        <small>${target ? `${percent.toFixed(0)}%` : "Defina uma meta para acompanhar"}</small>
      </div>
    `;
  }

  function exportReportCsv() {
    const period = getReportPeriod();
    const report = calculateReport(period.month, period.year);
    const csv = transactionsToCsv(report.transactions);

    downloadTextFile(`relatorio-${period.year}-${String(period.month).padStart(2, "0")}.csv`, csv, "text/csv;charset=utf-8");
    addSystemLog("relatório exportado", `${report.transactions.length} linhas em CSV`);
  }

  function exportAllCsv() {
    const transactions = getActiveTransactions();
    downloadTextFile("financeiro-transacoes.csv", transactionsToCsv(transactions), "text/csv;charset=utf-8");
    addSystemLog("exportação CSV", `${transactions.length} transações exportadas`);
  }

  function exportBackupJson() {
    const period = getReportPeriod();
    const backup = {
      version: 1,
      app: "Financeiro Automático",
      exportedAt: new Date().toISOString(),
      user: state.systemUser ? {
        email: state.systemUser.email,
        name: state.systemUser.name,
        role: state.systemUser.role
      } : null,
      period,
      goals: loadMonthlyGoals(period.month, period.year),
      budgets: loadCategoryBudgets(period.month, period.year),
      settings: state.appSettings || loadSettingsFromLocal(),
      sales: getVisibleSales(),
      gmailTransactions: state.gmailPixTransactions || [],
      currentTransactions: getActiveTransactions(),
      logs: loadSystemLogs()
    };

    downloadTextFile("financeiro-backup.json", JSON.stringify(backup, null, 2), "application/json;charset=utf-8");
    addSystemLog("backup exportado", "Backup JSON gerado");
  }

  function importBackupJson(event) {
    const file = event.target.files && event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      try {
        const backup = JSON.parse(reader.result || "{}");
        const period = backup.period || getReportPeriod();

        if (backup.goals) saveScopedJson(GOALS_STORAGE_PREFIX, backup.goals, period.month, period.year);
        if (backup.budgets) saveScopedJson(BUDGET_STORAGE_PREFIX, backup.budgets, period.month, period.year);
        if (backup.settings) {
          state.appSettings = normalizeAppSettings(backup.settings);
          saveSettingsToLocal(state.appSettings);
          saveSettingsToFirestore(state.appSettings);
          applyAppSettings();
        }
        if (Array.isArray(backup.sales)) {
          backup.sales.map((sale) => normalizeSale(sale)).forEach(upsertSaleInState);
          const grouped = new Map();
          state.allSales.forEach((sale) => {
            const email = normalizeEmail(sale.ownerEmail);
            grouped.set(email, [...(grouped.get(email) || []), sale]);
          });
          grouped.forEach((sales, email) => saveSalesToLocal(email, sales));
          backup.sales.forEach((sale) => saveSaleToFirestore(normalizeSale(sale)));
        }
        if (Array.isArray(backup.logs)) saveSystemLogs(backup.logs);

        if (Array.isArray(backup.gmailTransactions) && backup.gmailTransactions.length) {
          state.gmailPixTransactions = backup.gmailTransactions;
          state.dataSource = "gmail";
          saveGmailSessionData(state.gmailPixTransactions);
          saveTransactionsToFirestore(state.gmailPixTransactions);
          applyGmailPixToDashboard({ silent: true });
        }

        addSystemLog("backup importado", file.name);
        showToast("Backup JSON importado.");
        renderGrowthFeatures();
      } catch (error) {
        showToast(`Backup inválido: ${error.message}`, "error");
      } finally {
        event.target.value = "";
      }
    };

    reader.readAsText(file);
  }

  function transactionsToCsv(transactions) {
    const rows = [
      ["tipo", "data", "nome", "categoria", "valor", "origem", "banco", "descricao"],
      ...transactions.map((item) => [
        item.tipo,
        item.data,
        item.nome,
        item.categoria,
        item.valor.toFixed(2).replace(".", ","),
        item.origem || "",
        item.banco || "",
        item.descricao || ""
      ])
    ];

    return rows.map((row) => row.map(csvCell).join(";")).join("\n");
  }

  function csvCell(value) {
    const text = String(value ?? "");
    return `"${text.replace(/"/g, '""')}"`;
  }

  function downloadTextFile(filename, content, type) {
    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");

    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }

  function addSystemLog(event, details, level = "info") {
    const logs = loadSystemLogs();

    logs.unshift({
      id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
      at: new Date().toISOString(),
      event,
      details: safeGrowthText(details, ""),
      level,
      user: state.systemUser ? state.systemUser.email : ""
    });

    saveSystemLogs(logs.slice(0, 200));
    renderAdminLogs();
  }

  function loadSystemLogs() {
    try {
      return JSON.parse(window.localStorage.getItem(SYSTEM_LOGS_STORAGE_KEY) || "[]");
    } catch (error) {
      return [];
    }
  }

  function saveSystemLogs(logs) {
    try {
      window.localStorage.setItem(SYSTEM_LOGS_STORAGE_KEY, JSON.stringify(logs));
    } catch (error) {
      console.warn(`${FINANCEIRO_LOG_PREFIX} Não foi possível salvar logs locais.`, error);
    }
  }

  function renderAdminLogs() {
    const table = document.getElementById("adminLogsTable");
    if (!table) return;

    if (!isAdminUser()) {
      table.innerHTML = "";
      return;
    }

    const logs = loadSystemLogs().slice(0, 80);
    table.innerHTML = logs.length
      ? logs.map((log) => `
          <tr>
            <td>${formatGrowthDateTime(log.at)}</td>
            <td>${escapeGrowthHtml(log.event)}</td>
            <td>${escapeGrowthHtml(log.details || log.user || "--")}</td>
          </tr>
        `).join("")
      : `<tr><td colspan="3">Nenhum log registrado ainda.</td></tr>`;
  }

  function sumGrowthValues(items) {
    return items.reduce((sum, item) => sum + (Number(item.valor) || 0), 0);
  }

  function parseGrowthDate(value) {
    if (!value) return null;

    const text = String(value).trim();
    const isoDate = text.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
    if (isoDate) {
      const date = new Date(Number(isoDate[1]), Number(isoDate[2]) - 1, Number(isoDate[3]));
      return Number.isNaN(date.getTime()) ? null : date;
    }

    if (typeof parseDate === "function") {
      const parsed = parseDate(value);
      if (parsed && !Number.isNaN(parsed.getTime()) && parsed.getTime() !== 0) return parsed;
    }

    const brazilian = text.match(/(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{2,4})/);
    if (brazilian) {
      const year = Number(brazilian[3].length === 2 ? `20${brazilian[3]}` : brazilian[3]);
      const date = new Date(year, Number(brazilian[2]) - 1, Number(brazilian[1]));
      return Number.isNaN(date.getTime()) ? null : date;
    }

    const date = new Date(text);
    return Number.isNaN(date.getTime()) ? null : date;
  }

  function formatGrowthCurrency(value) {
    if (typeof formatCurrency === "function") return formatCurrency(value);

    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL"
    }).format(Number(value) || 0);
  }

  function formatGrowthDateTime(value) {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "--";

    return new Intl.DateTimeFormat("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit"
    }).format(date);
  }

  function normalizeGrowthCategory(category) {
    const text = safeGrowthText(category, "Outros").toLocaleLowerCase("pt-BR");
    if (text.includes("aliment")) return "Alimentação";
    if (text.includes("transp") || text.includes("uber") || text.includes("combust")) return "Transporte";
    if (text.includes("lazer") || text.includes("restaurante") || text.includes("stream")) return "Lazer";
    if (text.includes("compra") || text.includes("mercado") || text.includes("loja")) return "Compras";
    if (text.includes("saúde") || text.includes("saude") || text.includes("farm")) return "Saúde";
    return GROWTH_CATEGORIES.includes(category) ? category : "Outros";
  }

  function safeGrowthText(value, fallback = "") {
    if (typeof safeText === "function") return safeText(value, fallback);
    return String(value ?? fallback).trim() || fallback;
  }

  function escapeGrowthHtml(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function setText(id, value) {
    const element = document.getElementById(id);
    if (element) element.textContent = value;
  }
})();
