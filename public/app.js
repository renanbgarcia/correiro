const appRoot = document.querySelector("#app");
const modalRoot = document.querySelector("#modal-root");
const toastRegion = document.querySelector("#toast-region");

const state = {
  user: null,
  workspaces: [],
  workspace: null,
  channels: [],
  unread: 0,
  route: "dashboard",
  mobileOpen: false,
  calendar: {
    cursor: new Date(),
    view: "month",
    platform: "",
    status: ""
  },
  posts: {
    page: 1,
    status: "",
    platform: "",
    search: ""
  },
  composer: null,
  mediaCache: null,
  notificationPoll: null
};

const ICONS = {
  dashboard:
    '<path d="M4 13h6V4H4v9Zm0 7h6v-4H4v4Zm10 0h6v-9h-6v9Zm0-16v4h6V4h-6Z"/>',
  calendar:
    '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4M8 3v4M3 10h18"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  posts:
    '<path d="M6 3h12a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2Z"/><path d="M8 8h8M8 12h8M8 16h5"/>',
  media:
    '<rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="8.5" cy="9" r="1.5"/><path d="m21 15-5-5L5 20"/>',
  analytics:
    '<path d="M4 19V9M10 19V5M16 19v-7M22 19V3"/><path d="M2 19h22"/>',
  channels:
    '<path d="M10 13a5 5 0 0 0 7.5.5l2-2a5 5 0 0 0-7.1-7.1l-1.1 1.1"/><path d="M14 11a5 5 0 0 0-7.5-.5l-2 2a5 5 0 0 0 7.1 7.1l1.1-1.1"/>',
  bell:
    '<path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9ZM10 21h4"/>',
  settings:
    '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .34 1.88l.06.06-2.83 2.83-.06-.06A1.7 1.7 0 0 0 15 19.4a1.7 1.7 0 0 0-1 .6 1.7 1.7 0 0 0-.4 1.1V21h-4v-.09A1.7 1.7 0 0 0 8.6 19.4a1.7 1.7 0 0 0-1.88.34l-.06.06-2.83-2.83.06-.06A1.7 1.7 0 0 0 4.6 15a1.7 1.7 0 0 0-.6-1 1.7 1.7 0 0 0-1.1-.4H3v-4h.09A1.7 1.7 0 0 0 4.6 8.6a1.7 1.7 0 0 0-.34-1.88l-.06-.06 2.83-2.83.06.06A1.7 1.7 0 0 0 9 4.6a1.7 1.7 0 0 0 1-.6 1.7 1.7 0 0 0 .4-1.1V3h4v.09A1.7 1.7 0 0 0 15.4 4.6a1.7 1.7 0 0 0 1.88-.34l.06-.06 2.83 2.83-.06.06A1.7 1.7 0 0 0 19.4 9c.22.37.57.7 1 .9.34.17.72.25 1.1.25H21v4h-.09A1.7 1.7 0 0 0 19.4 15Z"/>',
  admin:
    '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z"/><path d="m9 12 2 2 4-4"/>',
  search:
    '<circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/>',
  chevronDown: '<path d="m6 9 6 6 6-6"/>',
  chevronLeft: '<path d="m15 18-6-6 6-6"/>',
  chevronRight: '<path d="m9 18 6-6-6-6"/>',
  menu: '<path d="M4 7h16M4 12h16M4 17h16"/>',
  x: '<path d="m6 6 12 12M18 6 6 18"/>',
  check: '<path d="m5 12 4 4L19 6"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  draft:
    '<path d="M4 20h4l11-11a2.8 2.8 0 0 0-4-4L4 16v4Z"/><path d="m13.5 6.5 4 4"/>',
  send: '<path d="m22 2-7 20-4-9-9-4 20-7Z"/><path d="M22 2 11 13"/>',
  image:
    '<rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="8.5" cy="9" r="1.5"/><path d="m21 15-5-5L5 20"/>',
  video:
    '<rect x="3" y="5" width="14" height="14" rx="2"/><path d="m17 10 4-3v10l-4-3"/>',
  smile:
    '<circle cx="12" cy="12" r="9"/><path d="M8 14s1.5 2 4 2 4-2 4-2M9 9h.01M15 9h.01"/>',
  hash: '<path d="M10 3 8 21M16 3l-2 18M4 9h16M3 15h16"/>',
  link:
    '<path d="M10 13a5 5 0 0 0 7.5.5l2-2a5 5 0 0 0-7.1-7.1l-1.1 1.1"/><path d="M14 11a5 5 0 0 0-7.5-.5l-2 2a5 5 0 0 0 7.1 7.1l1.1-1.1"/>',
  upload: '<path d="M12 16V3M7 8l5-5 5 5"/><path d="M4 15v5h16v-5"/>',
  more: '<circle cx="5" cy="12" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/>',
  edit:
    '<path d="M4 20h4l11-11a2.8 2.8 0 0 0-4-4L4 16v4Z"/><path d="m13.5 6.5 4 4"/>',
  copy:
    '<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h3"/>',
  trash:
    '<path d="M4 7h16M9 7V4h6v3M6 7l1 14h10l1-14M10 11v6M14 11v6"/>',
  refresh:
    '<path d="M20 11a8 8 0 1 0-2.3 5.7"/><path d="M20 4v7h-7"/>',
  external: '<path d="M14 4h6v6M20 4l-9 9"/><path d="M18 13v7H4V6h7"/>',
  alert:
    '<path d="M10.3 3.7 2.5 18a2 2 0 0 0 1.8 3h15.4a2 2 0 0 0 1.8-3L13.7 3.7a2 2 0 0 0-3.4 0Z"/><path d="M12 9v4M12 17h.01"/>',
  success:
    '<circle cx="12" cy="12" r="9"/><path d="m8 12 2.5 2.5L16.5 8"/>',
  info:
    '<circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8h.01"/>',
  eye:
    '<path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6S2 12 2 12Z"/><circle cx="12" cy="12" r="2.5"/>',
  heart:
    '<path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8l1.1 1.1L12 21l7.8-7.5 1.1-1.1a5.5 5.5 0 0 0-.1-7.8Z"/>',
  message: '<path d="M21 14a4 4 0 0 1-4 4H8l-5 3V7a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4v7Z"/>',
  bookmark: '<path d="M6 3h12v18l-6-4-6 4V3Z"/>',
  users:
    '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.9M16 3.1a4 4 0 0 1 0 7.8"/>',
  logout: '<path d="M10 17l5-5-5-5M15 12H3"/><path d="M14 3h7v18h-7"/>',
  pause: '<path d="M8 5v14M16 5v14"/>',
  play: '<path d="m7 4 13 8-13 8V4Z"/>',
  download: '<path d="M12 3v13M7 11l5 5 5-5"/><path d="M4 21h16"/>',
  lock:
    '<rect x="4" y="10" width="16" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/>',
  user: '<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',
  globe:
    '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18"/>',
  trend:
    '<path d="m3 17 6-6 4 4 8-9"/><path d="M15 6h6v6"/>',
  queue: '<path d="M5 6h14M5 12h14M5 18h9"/><circle cx="3" cy="6" r=".5"/><circle cx="3" cy="12" r=".5"/><circle cx="3" cy="18" r=".5"/>'
};

function icon(name, className = "") {
  return `<svg class="icon ${className}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${
    ICONS[name] || ICONS.info
  }</svg>`;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function escapeAttribute(value) {
  return escapeHtml(value).replaceAll("`", "&#096;");
}

function getCookie(name) {
  const prefix = `${encodeURIComponent(name)}=`;
  const cookie = document.cookie
    .split(";")
    .map((value) => value.trim())
    .find((value) => value.startsWith(prefix));
  return cookie ? decodeURIComponent(cookie.slice(prefix.length)) : "";
}

async function api(path, options = {}) {
  const method = options.method || "GET";
  const headers = { Accept: "application/json", ...(options.headers || {}) };
  const requestOptions = {
    method,
    credentials: "same-origin",
    headers
  };
  if (options.form) {
    requestOptions.body = options.form;
  } else if (options.body !== undefined) {
    headers["Content-Type"] = "application/json";
    requestOptions.body = JSON.stringify(options.body);
  }
  if (!["GET", "HEAD", "OPTIONS"].includes(method)) {
    const csrf = getCookie("correiro_csrf");
    if (csrf) headers["X-CSRF-Token"] = csrf;
  }
  const response = await fetch(`/api${path}`, requestOptions);
  const payload = await response.json().catch(() => ({
    ok: false,
    error: { message: "Resposta inesperada do servidor." }
  }));
  if (!response.ok || !payload.ok) {
    const error = new Error(
      payload.error?.message || "Não foi possível concluir a operação."
    );
    error.code = payload.error?.code;
    error.status = response.status;
    error.details = payload.error?.details;
    throw error;
  }
  return payload;
}

function initials(name) {
  return String(name || "U")
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
}

function avatar(entity, size = "") {
  const image = entity?.avatarUrl || entity?.imageUrl;
  return `<span class="avatar ${size ? `avatar-${size}` : ""}">${
    image
      ? `<img src="${escapeAttribute(image)}" alt="" />`
      : escapeHtml(initials(entity?.name))
  }</span>`;
}

function platformBadge(platform) {
  return `<span class="platform platform-${platform}" title="${
    platform === "facebook" ? "Facebook" : "Instagram"
  }">${platform === "facebook" ? "f" : "◎"}</span>`;
}

const statusLabels = {
  draft: "Rascunho",
  scheduled: "Agendada",
  queued: "Na fila",
  processing: "Processando",
  published: "Publicada",
  partially_published: "Parcial",
  failed: "Falhou",
  cancelled: "Cancelada",
  connected: "Conectada",
  expiring: "Expirando",
  expired: "Expirada",
  insufficient_permission: "Sem permissão",
  disconnected: "Desconectada",
  error: "Com erro",
  review: "Em configuração",
  waiting: "Aguardando",
  retry: "Nova tentativa",
  locked: "Em execução",
  completed: "Concluído"
};

function statusBadge(status) {
  const statusIcon =
    status === "published" || status === "connected"
      ? "success"
      : status === "failed" ||
          status === "expired" ||
          status === "insufficient_permission"
        ? "alert"
        : status === "processing" || status === "scheduled"
          ? "clock"
          : status === "draft"
            ? "draft"
            : "info";
  return `<span class="status-badge status-${escapeAttribute(status)}">${icon(
    statusIcon,
    "icon-sm"
  )}${escapeHtml(statusLabels[status] || status)}</span>`;
}

function formatDate(value, options = {}) {
  if (!value) return "—";
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "—";
  const {
    short = false,
    year: includeYear = true,
    ...intlOptions
  } = options;
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: state.workspace?.timeZone || "America/Sao_Paulo",
    day: "2-digit",
    month: short ? "short" : "2-digit",
    year: includeYear === false ? undefined : "numeric",
    ...intlOptions
  }).format(date);
}

function formatDateTime(value, options = {}) {
  if (!value) return "—";
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "—";
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: state.workspace?.timeZone || "America/Sao_Paulo",
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    ...options
  }).format(date);
}

function formatTime(value) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: state.workspace?.timeZone || "America/Sao_Paulo",
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date(value));
}

function relativeTime(value) {
  const date = new Date(value);
  const diff = date.getTime() - Date.now();
  const abs = Math.abs(diff);
  const formatter = new Intl.RelativeTimeFormat("pt-BR", { numeric: "auto" });
  if (abs < 60 * 60 * 1000)
    return formatter.format(Math.round(diff / 60000), "minute");
  if (abs < 24 * 60 * 60 * 1000)
    return formatter.format(Math.round(diff / 3600000), "hour");
  return formatter.format(Math.round(diff / 86400000), "day");
}

function compactNumber(value) {
  return new Intl.NumberFormat("pt-BR", {
    notation: Number(value) >= 10_000 ? "compact" : "standard",
    maximumFractionDigits: 1
  }).format(Number(value || 0));
}

function bytesLabel(bytes) {
  const value = Number(bytes || 0);
  if (value < 1024 * 1024) return `${Math.max(1, Math.round(value / 1024))} KB`;
  return `${(value / 1024 / 1024).toFixed(1).replace(".", ",")} MB`;
}

function postThumbnail(post) {
  const media = post.targets?.flatMap((target) => target.media || [])[0];
  return `<div class="post-thumb">${
    media
      ? `<img src="${escapeAttribute(media.thumbnailUrl)}" alt="" loading="lazy" />`
      : `<span class="post-thumb-placeholder">${icon("posts")}</span>`
  }</div>`;
}

function postPlatforms(post) {
  return `<span class="post-platforms">${[
    ...new Set((post.targets || []).map((target) => target.platform))
  ]
    .map(platformBadge)
    .join("")}</span>`;
}

function toast(message, type = "success", title) {
  const element = document.createElement("div");
  element.className = `toast ${type}`;
  element.innerHTML = `
    <span class="toast-icon">${icon(
      type === "error" ? "alert" : type === "warning" ? "info" : "success",
      "icon-sm"
    )}</span>
    <span class="toast-copy">
      <strong>${escapeHtml(
        title ||
          (type === "error"
            ? "Algo precisa de atenção"
            : type === "warning"
              ? "Atenção"
              : "Tudo certo")
      )}</strong>
      <span>${escapeHtml(message)}</span>
    </span>
    <button class="toast-close" aria-label="Fechar">${icon("x", "icon-sm")}</button>
  `;
  toastRegion.append(element);
  const dismiss = () => {
    element.style.opacity = "0";
    element.style.transform = "translateX(14px)";
    window.setTimeout(() => element.remove(), 180);
  };
  element.querySelector(".toast-close").addEventListener("click", dismiss);
  window.setTimeout(dismiss, 5200);
}

function setButtonLoading(button, loading, label) {
  if (!button) return;
  if (loading) {
    button.dataset.originalHtml = button.innerHTML;
    button.disabled = true;
    button.innerHTML = `<span class="spinner"></span>${escapeHtml(
      label || "Aguarde…"
    )}`;
  } else {
    button.disabled = false;
    if (button.dataset.originalHtml) {
      button.innerHTML = button.dataset.originalHtml;
      delete button.dataset.originalHtml;
    }
  }
}

function showModal(content, className = "") {
  modalRoot.innerHTML = `
    <div class="modal-backdrop" data-modal-backdrop>
      <section class="modal ${className}" role="dialog" aria-modal="true">
        ${content}
      </section>
    </div>
  `;
  const backdrop = modalRoot.querySelector("[data-modal-backdrop]");
  backdrop.addEventListener("click", (event) => {
    if (event.target === backdrop) closeModal();
  });
  modalRoot.querySelectorAll("[data-close-modal]").forEach((button) => {
    button.addEventListener("click", closeModal);
  });
  document.addEventListener("keydown", handleModalEscape);
}

function handleModalEscape(event) {
  if (event.key === "Escape") closeModal();
}

function closeModal() {
  modalRoot.innerHTML = "";
  document.removeEventListener("keydown", handleModalEscape);
}

function confirmAction({
  title,
  message,
  confirmLabel = "Confirmar",
  danger = false,
  iconName = "alert"
}) {
  return new Promise((resolve) => {
    showModal(`
      <div class="modal-header">
        <div>
          <h2>${escapeHtml(title)}</h2>
          <p>Revise antes de continuar</p>
        </div>
        <button class="btn btn-ghost btn-icon btn-sm" data-close-modal aria-label="Fechar">${icon(
          "x",
          "icon-sm"
        )}</button>
      </div>
      <div class="modal-body">
        <div class="confirm-copy">
          <span class="empty-state-icon" style="margin-bottom:14px">${icon(
            iconName
          )}</span>
          ${message}
        </div>
      </div>
      <div class="modal-footer">
        <button class="btn btn-secondary" data-cancel>Cancelar</button>
        <button class="btn ${danger ? "btn-danger" : "btn-primary"}" data-confirm>${escapeHtml(
          confirmLabel
        )}</button>
      </div>
    `);
    const finish = (value) => {
      closeModal();
      resolve(value);
    };
    modalRoot
      .querySelector("[data-confirm]")
      .addEventListener("click", () => finish(true));
    modalRoot
      .querySelector("[data-cancel]")
      .addEventListener("click", () => finish(false));
    modalRoot
      .querySelector("[data-close-modal]")
      .addEventListener("click", () => resolve(false), { once: true });
  });
}

function parseLocation() {
  const params = new URLSearchParams(window.location.search);
  return {
    route: params.get("route") || "dashboard",
    postId: params.get("postId"),
    date: params.get("date"),
    verify: params.get("verify"),
    reset: params.get("reset")
  };
}

function setLocation(route, extras = {}, replace = false) {
  const params = new URLSearchParams();
  params.set("route", route);
  for (const [key, value] of Object.entries(extras)) {
    if (value !== null && value !== undefined && value !== "") {
      params.set(key, value);
    }
  }
  window.history[replace ? "replaceState" : "pushState"](
    {},
    "",
    `/?${params.toString()}`
  );
}

const navItems = [
  { route: "dashboard", label: "Visão geral", icon: "dashboard" },
  { route: "calendar", label: "Calendário", icon: "calendar" },
  { route: "posts", label: "Publicações", icon: "posts" },
  { route: "media", label: "Biblioteca de mídia", icon: "media" },
  { route: "analytics", label: "Analytics", icon: "analytics" },
  { route: "channels", label: "Canais conectados", icon: "channels" }
];

function renderAuth(mode = "login", message = null) {
  clearInterval(state.notificationPoll);
  state.notificationPoll = null;
  const content = {
    login: {
      eyebrow: "Bem-vindo de volta",
      title: "Seu conteúdo, no tempo certo.",
      lead:
        "Entre para planejar, agendar e acompanhar suas publicações em um só lugar."
    },
    register: {
      eyebrow: "Comece em poucos minutos",
      title: "Organize sua presença social.",
      lead:
        "Crie sua conta e transforme ideias em um calendário consistente."
    },
    forgot: {
      eyebrow: "Recuperar acesso",
      title: "Vamos redefinir sua senha.",
      lead:
        "Informe seu e-mail. Se houver uma conta, enviaremos um link seguro."
    },
    reset: {
      eyebrow: "Nova senha",
      title: "Escolha uma senha segura.",
      lead: "Use pelo menos 8 caracteres e evite senhas de outros serviços."
    }
  }[mode];

  let fields = "";
  if (mode === "login") {
    fields = `
      <div class="field">
        <label for="auth-email">E-mail</label>
        <div class="input-wrap">${icon("user", "icon-sm")}<input class="input" id="auth-email" name="email" type="email" autocomplete="email" placeholder="voce@empresa.com" required /></div>
      </div>
      <div class="field">
        <label for="auth-password">Senha</label>
        <div class="input-wrap">${icon("lock", "icon-sm")}<input class="input" id="auth-password" name="password" type="password" autocomplete="current-password" placeholder="Sua senha" required /></div>
      </div>
      <div class="auth-meta">
        <label class="checkbox-row"><input type="checkbox" checked /> Manter conectado</label>
        <button class="text-link" type="button" data-auth-mode="forgot">Esqueci minha senha</button>
      </div>
      <button class="btn btn-primary" type="submit">${icon("send", "icon-sm")} Entrar no Correiro</button>
    `;
  } else if (mode === "register") {
    fields = `
      <div class="field">
        <label for="auth-name">Nome</label>
        <input class="input" id="auth-name" name="name" autocomplete="name" placeholder="Como podemos chamar você?" required />
      </div>
      <div class="field">
        <label for="auth-email">E-mail</label>
        <input class="input" id="auth-email" name="email" type="email" autocomplete="email" placeholder="voce@empresa.com" required />
      </div>
      <div class="field">
        <label for="auth-password">Senha</label>
        <input class="input" id="auth-password" name="password" type="password" autocomplete="new-password" minlength="8" placeholder="No mínimo 8 caracteres" required />
      </div>
      <label class="checkbox-row">
        <input name="accept" type="checkbox" required />
        <span>Li e aceito os <button class="text-link" type="button">Termos de Uso</button> e a <button class="text-link" type="button">Política de Privacidade</button>.</span>
      </label>
      <button class="btn btn-primary" type="submit">${icon("plus", "icon-sm")} Criar minha conta</button>
    `;
  } else if (mode === "forgot") {
    fields = `
      <div class="field">
        <label for="auth-email">E-mail</label>
        <input class="input" id="auth-email" name="email" type="email" autocomplete="email" placeholder="voce@empresa.com" required />
      </div>
      <button class="btn btn-primary" type="submit">${icon("send", "icon-sm")} Enviar instruções</button>
    `;
  } else {
    fields = `
      <div class="field">
        <label for="auth-password">Nova senha</label>
        <input class="input" id="auth-password" name="password" type="password" autocomplete="new-password" minlength="8" placeholder="No mínimo 8 caracteres" required />
      </div>
      <button class="btn btn-primary" type="submit">${icon("lock", "icon-sm")} Redefinir senha</button>
    `;
  }

  appRoot.innerHTML = `
    <main class="auth-shell">
      <section class="auth-panel">
        <a class="auth-brand" href="/">
          <img src="/assets/logo-mark.svg" alt="" />
          <span>Correiro</span>
        </a>
        <div class="auth-form-wrap">
          <p class="eyebrow">${content.eyebrow}</p>
          <h1>${content.title}</h1>
          <p class="auth-lead">${content.lead}</p>
          ${message ? `<div class="auth-message">${message}</div>` : ""}
          <form class="auth-form" data-auth-form="${mode}" ${message ? 'style="margin-top:18px"' : ""}>
            ${fields}
          </form>
          ${
            mode === "login"
              ? `
                <div class="demo-login">
                  <span><strong>Quer explorar primeiro?</strong>Use a conta de demonstração pronta.</span>
                  <button class="btn btn-secondary btn-sm" type="button" data-demo-login>Ver demo</button>
                </div>
                <p class="auth-switch">Ainda não tem conta? <button class="text-link" data-auth-mode="register">Criar conta grátis</button></p>
              `
              : `<p class="auth-switch">Já possui uma conta? <button class="text-link" data-auth-mode="login">Voltar para o login</button></p>`
          }
        </div>
      </section>
      <aside class="auth-visual" aria-hidden="true">
        <div class="auth-visual-content">
          <p class="auth-quote">Transforme ideias em uma presença <span>consistente.</span></p>
          <div class="auth-demo-card">
            <div class="auth-demo-toolbar">
              <span class="auth-demo-brand"><img src="/assets/logo-mark.svg" width="24" alt="" /> Calendário editorial</span>
              <span class="status-badge status-scheduled">${icon("clock", "icon-sm")} 4 agendadas</span>
            </div>
            <div class="auth-demo-calendar">
              ${["Seg", "Ter", "Qua", "Qui", "Sex"]
                .map(
                  (day, index) => `
                    <div class="auth-demo-day">
                      ${day} · ${12 + index}
                      ${
                        [0, 2, 4].includes(index)
                          ? `<span class="auth-demo-post">${index === 2 ? "18:30" : "09:00"}<span>${index === 4 ? "Brunch de domingo" : "Nova campanha"}</span></span>`
                          : ""
                      }
                    </div>
                  `
                )
                .join("")}
            </div>
          </div>
          <div class="auth-proof">
            <span class="proof-faces"><span class="proof-face">MC</span><span class="proof-face">RL</span><span class="proof-face">AB</span></span>
            <span>Planejamento mais claro. Menos correria na hora de publicar.</span>
          </div>
        </div>
      </aside>
    </main>
  `;

  appRoot.querySelectorAll("[data-auth-mode]").forEach((button) => {
    button.addEventListener("click", () =>
      renderAuth(button.dataset.authMode)
    );
  });
  const form = appRoot.querySelector("[data-auth-form]");
  form?.addEventListener("submit", handleAuthSubmit);
  appRoot.querySelector("[data-demo-login]")?.addEventListener("click", () => {
    appRoot.querySelector("#auth-email").value = "demo@correiro.local";
    appRoot.querySelector("#auth-password").value = "Demo@123";
    form.requestSubmit();
  });
}

async function handleAuthSubmit(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const mode = form.dataset.authForm;
  const button = form.querySelector('button[type="submit"]');
  const values = Object.fromEntries(new FormData(form));
  setButtonLoading(button, true);
  try {
    if (mode === "login") {
      await api("/auth/login", {
        method: "POST",
        body: { email: values.email, password: values.password }
      });
      await loadSession();
      renderShell();
      navigate("dashboard", {}, true);
      toast("Você entrou no seu workspace.");
    } else if (mode === "register") {
      const result = await api("/auth/register", {
        method: "POST",
        body: {
          name: values.name,
          email: values.email,
          password: values.password,
          acceptTerms: true,
          acceptPrivacy: true
        }
      });
      const link = result.data.developmentVerificationUrl;
      renderAuth(
        "login",
        `<strong>Conta criada.</strong> Confirme seu e-mail para entrar.${
          link
            ? `<button class="btn btn-secondary btn-sm" type="button" data-dev-verify>Confirmar e-mail de teste</button>`
            : ""
        }`
      );
      if (link) {
        appRoot.querySelector("[data-dev-verify]")?.addEventListener("click", async () => {
          const token = new URL(link).searchParams.get("verify");
          await api("/auth/verify-email", {
            method: "POST",
            body: { token }
          });
          toast("E-mail confirmado. Agora você pode entrar.");
          renderAuth("login");
        });
      }
    } else if (mode === "forgot") {
      const result = await api("/auth/forgot-password", {
        method: "POST",
        body: { email: values.email }
      });
      const resetUrl = result.data.developmentResetUrl;
      renderAuth(
        "login",
        `${escapeHtml(result.data.message)}${
          resetUrl
            ? `<button class="btn btn-secondary btn-sm" type="button" data-dev-reset>Usar link de teste</button>`
            : ""
        }`
      );
      if (resetUrl) {
        appRoot.querySelector("[data-dev-reset]")?.addEventListener("click", () => {
          const token = new URL(resetUrl).searchParams.get("reset");
          window.history.replaceState({}, "", `/?reset=${encodeURIComponent(token)}`);
          renderAuth("reset");
        });
      }
    } else if (mode === "reset") {
      const token = new URLSearchParams(window.location.search).get("reset");
      await api("/auth/reset-password", {
        method: "POST",
        body: { token, password: values.password }
      });
      window.history.replaceState({}, "", "/");
      renderAuth("login", "<strong>Senha alterada.</strong> Entre com sua nova senha.");
    }
  } catch (error) {
    toast(error.message, "error");
  } finally {
    setButtonLoading(button, false);
  }
}

async function loadSession() {
  const result = await api("/auth/me");
  state.user = result.data.user;
  state.workspaces = result.data.workspaces;
  state.workspace =
    result.data.workspaces.find(
      (workspace) => workspace.id === state.user.currentWorkspaceId
    ) || result.data.workspaces[0];
  const [notificationResult, channelResult] = await Promise.all([
    api("/notifications").catch(() => ({ data: [], meta: { unread: 0 } })),
    api("/channels").catch(() => ({ data: [] }))
  ]);
  state.unread = notificationResult.meta?.unread || 0;
  state.channels = channelResult.data || [];
}

function renderShell() {
  const admin = state.user?.role === "admin";
  appRoot.innerHTML = `
    <div class="app-shell">
      <aside class="sidebar" data-sidebar>
        <a class="sidebar-brand" href="#" data-route="dashboard">
          <img src="/assets/logo-mark.svg" alt="" />
          <span>Correiro</span>
        </a>
        <button class="workspace-switcher" type="button" data-route="settings">
          ${avatar(state.workspace, "sm")}
          <span class="workspace-copy">
            <strong>${escapeHtml(state.workspace?.name || "Workspace")}</strong>
            <span>${escapeHtml(state.workspace?.timeZone || "")}</span>
          </span>
          ${icon("chevronDown", "icon-sm")}
        </button>
        <nav class="sidebar-nav" aria-label="Navegação principal">
          <p class="nav-section-label">Planejamento</p>
          ${navItems
            .slice(0, 4)
            .map(navItem)
            .join("")}
          <p class="nav-section-label">Resultados e conta</p>
          ${navItems
            .slice(4)
            .map(navItem)
            .join("")}
          <a class="nav-link" href="#" data-route="notifications">
            ${icon("bell")}
            <span>Notificações</span>
            ${state.unread ? `<span class="nav-count" data-nav-unread>${state.unread}</span>` : ""}
          </a>
          <a class="nav-link" href="#" data-route="settings">
            ${icon("settings")}
            <span>Configurações</span>
          </a>
          ${
            admin
              ? `<a class="nav-link" href="#" data-route="admin">${icon(
                  "admin"
                )}<span>Administração</span></a>`
              : ""
          }
        </nav>
        <div class="sidebar-footer">
          <div class="upgrade-card">
            <strong>Fila operacional</strong>
            <p>${
              state.workspace?.publishingPaused
                ? "Os agendamentos estão pausados."
                : "Publicações automáticas ativas."
            }</p>
            <button class="btn btn-secondary btn-sm" data-route="settings">${
              state.workspace?.publishingPaused ? "Retomar fila" : "Gerenciar"
            }</button>
          </div>
          <button class="sidebar-user" type="button" data-route="settings">
            ${avatar(state.user, "sm")}
            <span class="sidebar-user-copy">
              <strong>${escapeHtml(state.user?.name)}</strong>
              <span>${escapeHtml(state.user?.email)}</span>
            </span>
            ${icon("more", "icon-sm")}
          </button>
        </div>
      </aside>
      <button class="mobile-backdrop" data-mobile-backdrop aria-label="Fechar menu"></button>
      <div class="main-wrap">
        <header class="topbar">
          <div class="mobile-topbar">
            <button class="btn btn-ghost btn-icon" data-mobile-menu aria-label="Abrir menu">${icon(
              "menu"
            )}</button>
            <img src="/assets/logo-mark.svg" alt="" />
            <strong>Correiro</strong>
          </div>
          <div class="input-wrap global-search">
            ${icon("search", "icon-sm")}
            <input class="input" data-global-search placeholder="Buscar publicações…" />
          </div>
          <div class="topbar-actions">
            <button class="btn btn-ghost btn-icon notification-button" data-route="notifications" aria-label="Notificações">
              ${icon("bell")}
              ${state.unread ? '<span class="notification-dot" data-notification-dot></span>' : ""}
            </button>
            <button class="btn btn-primary" data-route="composer">
              ${icon("plus", "icon-sm")} Criar publicação
            </button>
          </div>
        </header>
        <main class="content" id="page-content"></main>
      </div>
    </div>
  `;
  bindShell();
  startNotificationPolling();
}

function navItem(item) {
  return `<a class="nav-link" href="#" data-route="${item.route}">
    ${icon(item.icon)}
    <span>${item.label}</span>
  </a>`;
}

function bindShell() {
  appRoot.querySelectorAll("[data-route]").forEach((element) => {
    element.addEventListener("click", (event) => {
      event.preventDefault();
      navigate(element.dataset.route);
      closeMobileMenu();
    });
  });
  appRoot.querySelector("[data-mobile-menu]")?.addEventListener("click", () => {
    state.mobileOpen = true;
    appRoot.querySelector("[data-sidebar]")?.classList.add("mobile-open");
    appRoot.querySelector("[data-mobile-backdrop]")?.classList.add("open");
  });
  appRoot
    .querySelector("[data-mobile-backdrop]")
    ?.addEventListener("click", closeMobileMenu);
  const search = appRoot.querySelector("[data-global-search]");
  search?.addEventListener("keydown", (event) => {
    if (event.key === "Enter" && search.value.trim()) {
      state.posts.search = search.value.trim();
      navigate("posts");
    }
  });
}

function closeMobileMenu() {
  state.mobileOpen = false;
  appRoot.querySelector("[data-sidebar]")?.classList.remove("mobile-open");
  appRoot.querySelector("[data-mobile-backdrop]")?.classList.remove("open");
}

function updateActiveNav() {
  appRoot.querySelectorAll(".nav-link").forEach((link) => {
    link.classList.toggle("active", link.dataset.route === state.route);
  });
}

function startNotificationPolling() {
  if (state.notificationPoll) clearInterval(state.notificationPoll);
  state.notificationPoll = setInterval(async () => {
    if (!state.user) return;
    try {
      const result = await api("/notifications");
      const previous = state.unread;
      state.unread = result.meta?.unread || 0;
      updateUnreadUi();
      if (state.unread > previous) {
        toast("Você recebeu uma nova atualização.", "success", "Nova notificação");
      }
    } catch {
      // A sessão pode ter sido encerrada em outra aba; a próxima ação tratará.
    }
  }, 30_000);
}

function updateUnreadUi() {
  const link = appRoot.querySelector('[data-route="notifications"].nav-link');
  let count = link?.querySelector("[data-nav-unread]");
  if (state.unread && link && !count) {
    link.insertAdjacentHTML(
      "beforeend",
      `<span class="nav-count" data-nav-unread>${state.unread}</span>`
    );
  } else if (count) {
    if (state.unread) count.textContent = state.unread;
    else count.remove();
  }
  const button = appRoot.querySelector(".notification-button");
  const dot = button?.querySelector("[data-notification-dot]");
  if (state.unread && button && !dot) {
    button.insertAdjacentHTML(
      "beforeend",
      '<span class="notification-dot" data-notification-dot></span>'
    );
  } else if (!state.unread && dot) dot.remove();
}

const pageLoaders = {
  dashboard: renderDashboard,
  calendar: renderCalendar,
  composer: renderComposer,
  posts: renderPostsPage,
  media: renderMediaPage,
  analytics: renderAnalyticsPage,
  channels: renderChannelsPage,
  notifications: renderNotificationsPage,
  settings: renderSettingsPage,
  admin: renderAdminPage
};

async function navigate(route, extras = {}, replace = false) {
  if (!pageLoaders[route]) route = "dashboard";
  state.route = route;
  updateActiveNav();
  if (!replace) setLocation(route, extras);
  else setLocation(route, extras, true);
  const content = document.querySelector("#page-content");
  if (!content) return;
  content.innerHTML = pageLoading();
  try {
    await pageLoaders[route](extras);
  } catch (error) {
    if (error.status === 401) {
      state.user = null;
      renderAuth("login", "Sua sessão expirou. Entre novamente.");
      return;
    }
    content.innerHTML = errorState(error);
    content.querySelector("[data-retry-page]")?.addEventListener("click", () =>
      navigate(route, extras, true)
    );
  }
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function pageLoading() {
  return `
    <div class="page-header">
      <div><div class="skeleton" style="width:130px;height:12px;margin-bottom:12px"></div><div class="skeleton" style="width:280px;height:32px"></div></div>
    </div>
    <div class="stats-grid">
      ${Array.from({ length: 4 }, () => '<div class="card skeleton" style="height:130px"></div>').join("")}
    </div>
    <div class="card skeleton" style="height:360px"></div>
  `;
}

function errorState(error) {
  return `
    <div class="card empty-state">
      <span class="empty-state-icon" style="color:var(--red);background:var(--red-soft)">${icon(
        "alert"
      )}</span>
      <h3>Não conseguimos carregar esta área</h3>
      <p>${escapeHtml(error.message)}</p>
      <button class="btn btn-secondary" data-retry-page>${icon(
        "refresh",
        "icon-sm"
      )} Tentar novamente</button>
    </div>
  `;
}

function pageHeader({ eyebrow, title, description, actions = "" }) {
  return `
    <header class="page-header">
      <div>
        ${eyebrow ? `<p class="eyebrow">${escapeHtml(eyebrow)}</p>` : ""}
        <h1 class="page-title">${escapeHtml(title)}</h1>
        ${description ? `<p class="page-description">${escapeHtml(description)}</p>` : ""}
      </div>
      ${actions ? `<div class="page-actions">${actions}</div>` : ""}
    </header>
  `;
}

async function renderDashboard() {
  const [dashboardResult, channelResult] = await Promise.all([
    api("/posts/dashboard"),
    api("/channels")
  ]);
  state.channels = channelResult.data;
  const data = dashboardResult.data;
  const firstName = state.user.name.split(" ")[0];
  const content = document.querySelector("#page-content");
  const connected = state.channels.filter(
    (channel) => channel.status === "connected"
  );
  const needsAttention = state.channels.filter(
    (channel) => channel.status !== "connected"
  );
  const hasPosts = data.summary.total > 0;

  content.innerHTML = `
    <div class="welcome-row">
      <div>
        <p class="eyebrow">Visão geral</p>
        <h1>Olá, ${escapeHtml(firstName)}! <span aria-hidden="true">👋</span></h1>
        <p>${dashboardGreeting(data)}</p>
      </div>
      <button class="btn btn-primary" data-dashboard-compose>${icon(
        "plus",
        "icon-sm"
      )} Criar publicação</button>
    </div>
    ${
      !connected.length || !hasPosts
        ? onboardingCard(connected.length > 0, hasPosts)
        : ""
    }
    <section class="stats-grid" aria-label="Resumo dos últimos 30 dias">
      ${statCard("calendar", data.summary.scheduled, "Próximas publicações", "var(--blue)", "var(--blue-soft)")}
      ${statCard("success", data.summary.published, "Publicadas com sucesso", "var(--green)", "var(--green-soft)")}
      ${statCard("alert", data.summary.failed + data.summary.partial, "Precisam de atenção", "var(--red)", "var(--red-soft)")}
      ${statCard("channels", connected.length, "Canais conectados", "var(--primary)", "var(--primary-soft)")}
    </section>
    <section class="dashboard-grid">
      <article class="card">
        <div class="card-header">
          <div><h2 class="card-title">Próximas publicações</h2><p class="card-description">Seu conteúdo agendado, em ordem de envio.</p></div>
          <button class="btn btn-ghost btn-sm" data-dashboard-calendar>Ver calendário ${icon(
            "chevronRight",
            "icon-sm"
          )}</button>
        </div>
        ${
          data.upcoming.length
            ? `<div class="post-list">${data.upcoming.map(dashboardPostRow).join("")}</div>`
            : `<div class="empty-state" style="min-height:260px"><img src="/assets/empty-state.svg" alt="" /><h3>Nenhuma publicação agendada</h3><p>Escolha uma data no calendário e mantenha sua presença consistente.</p><button class="btn btn-primary btn-sm" data-dashboard-compose>${icon(
                "plus",
                "icon-sm"
              )} Criar agora</button></div>`
        }
      </article>
      <aside class="card">
        <div class="card-header">
          <div><h2 class="card-title">Saúde dos canais</h2><p class="card-description">Conexões e permissões da Meta.</p></div>
          <button class="btn btn-ghost btn-icon btn-sm" data-dashboard-channels aria-label="Gerenciar canais">${icon(
            "settings",
            "icon-sm"
          )}</button>
        </div>
        <div class="health-list">
          ${
            state.channels.length
              ? state.channels.map(channelHealthItem).join("")
              : `<div class="empty-state" style="min-height:180px;padding:15px"><span class="empty-state-icon">${icon(
                  "channels"
                )}</span><h3>Conecte seus canais</h3><p>Facebook e Instagram serão gerenciados no mesmo fluxo.</p><button class="btn btn-secondary btn-sm" data-dashboard-channels>Conectar</button></div>`
          }
        </div>
        ${
          needsAttention.length
            ? `<div style="padding:0 20px 20px"><div class="error-box">${icon(
                "alert",
                "icon-sm"
              )}<span>${needsAttention.length} conexão(ões) precisam de atenção antes do próximo envio.</span></div></div>`
            : ""
        }
      </aside>
      ${
        data.failures.length
          ? `
            <article class="card" style="grid-column:1/-1">
              <div class="card-header">
                <div><h2 class="card-title">Atenção necessária</h2><p class="card-description">Falhas recentes e publicações concluídas parcialmente.</p></div>
                <button class="btn btn-ghost btn-sm" data-failed-posts>Ver todas</button>
              </div>
              <div class="post-list">${data.failures.map(dashboardPostRow).join("")}</div>
            </article>
          `
          : ""
      }
    </section>
  `;

  content.querySelectorAll("[data-dashboard-compose]").forEach((button) =>
    button.addEventListener("click", () => navigate("composer"))
  );
  content
    .querySelector("[data-dashboard-calendar]")
    ?.addEventListener("click", () => navigate("calendar"));
  content
    .querySelector("[data-dashboard-channels]")
    ?.addEventListener("click", () => navigate("channels"));
  content
    .querySelector("[data-onboarding-action]")
    ?.addEventListener("click", () =>
      navigate(connected.length ? "composer" : "channels")
    );
  content.querySelector("[data-failed-posts]")?.addEventListener("click", () => {
    state.posts.status = "failed";
    navigate("posts");
  });
  bindPostOpeners(content);
}

function dashboardGreeting(data) {
  if (data.summary.scheduled > 0) {
    return `Você tem ${data.summary.scheduled} ${
      data.summary.scheduled === 1 ? "publicação" : "publicações"
    } a caminho.`;
  }
  return "Seu calendário está livre para a próxima grande ideia.";
}

function statCard(iconName, value, label, color, soft) {
  return `
    <article class="card stat-card" style="--stat-color:${color};--stat-soft:${soft}">
      <div class="stat-top"><span class="stat-icon">${icon(iconName, "icon-sm")}</span><span class="stat-change">Últimos 30 dias</span></div>
      <strong class="stat-value">${compactNumber(value)}</strong>
      <span class="stat-label">${escapeHtml(label)}</span>
    </article>
  `;
}

function onboardingCard(hasChannels, hasPosts) {
  return `
    <article class="card onboarding-card">
      <div>
        <h2>${hasChannels ? "Sua primeira publicação está quase pronta" : "Prepare seu workspace para publicar"}</h2>
        <p>${hasChannels ? "Os canais já estão conectados. Agora crie uma legenda, escolha a mídia e agende." : "Conecte as contas profissionais da Meta e veja o fluxo completo funcionando."}</p>
        <div class="onboarding-steps">
          <span class="onboarding-step done"><span class="onboarding-number">${icon(
            "check",
            "icon-sm"
          )}</span> Workspace criado</span>
          <span class="onboarding-step ${hasChannels ? "done" : ""}"><span class="onboarding-number">${
            hasChannels ? icon("check", "icon-sm") : "2"
          }</span> Conectar canais</span>
          <span class="onboarding-step ${hasPosts ? "done" : ""}"><span class="onboarding-number">${
            hasPosts ? icon("check", "icon-sm") : "3"
          }</span> Criar publicação</span>
        </div>
        <button class="btn btn-secondary btn-sm" style="margin-top:15px" data-onboarding-action>${hasChannels ? "Criar publicação" : "Conectar Facebook e Instagram"} ${icon(
          "chevronRight",
          "icon-sm"
        )}</button>
      </div>
      <div class="onboarding-art">${icon(hasChannels ? "send" : "channels")}</div>
    </article>
  `;
}

function dashboardPostRow(post) {
  return `
    <article class="post-row" data-open-post="${post.id}">
      ${postThumbnail(post)}
      <div class="post-copy">
        <p class="post-caption">${escapeHtml(post.baseCaption || "Publicação sem legenda")}</p>
        <div class="post-meta">${postPlatforms(post)} ${statusBadge(post.status)}</div>
      </div>
      <div class="post-time">
        <strong>${formatTime(post.scheduledAt || post.publishedAt)}</strong>
        <span>${formatDate(post.scheduledAt || post.publishedAt, {
          short: true,
          year: false
        })}</span>
      </div>
    </article>
  `;
}

function channelHealthItem(channel) {
  return `
    <div class="health-item">
      ${platformBadge(channel.platform)}
      <div class="health-copy">
        <strong>${escapeHtml(channel.name)}</strong>
        <span>${
          channel.status === "connected"
            ? `Sincronizado ${relativeTime(channel.lastSyncedAt)}`
            : escapeHtml(channel.statusMessage || statusLabels[channel.status])
        }</span>
      </div>
      ${statusBadge(channel.status)}
    </div>
  `;
}

function bindPostOpeners(root = document) {
  root.querySelectorAll("[data-open-post]").forEach((element) => {
    element.addEventListener("click", (event) => {
      if (event.target.closest("button, a")) return;
      openPostDetail(element.dataset.openPost);
    });
  });
}

function datePartsInWorkspace(value) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: state.workspace?.timeZone || "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23"
  }).formatToParts(new Date(value));
  return Object.fromEntries(
    parts
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, part.value])
  );
}

function dateKey(value) {
  const parts = datePartsInWorkspace(value);
  return `${parts.year}-${parts.month}-${parts.day}`;
}

function dateToKey(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function addDays(date, amount) {
  const result = new Date(date);
  result.setDate(result.getDate() + amount);
  return result;
}

function startOfWeek(date) {
  const result = new Date(date);
  const day = result.getDay();
  const offset = day === 0 ? -6 : 1 - day;
  result.setDate(result.getDate() + offset);
  result.setHours(0, 0, 0, 0);
  return result;
}

async function renderCalendar() {
  const cursor = state.calendar.cursor;
  let rangeStart;
  let rangeEnd;
  if (state.calendar.view === "month") {
    const monthStart = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
    rangeStart = addDays(monthStart, -monthStart.getDay());
    rangeEnd = addDays(rangeStart, 42);
  } else {
    rangeStart = startOfWeek(cursor);
    rangeEnd = addDays(rangeStart, 7);
  }

  const query = new URLSearchParams({
    from: rangeStart.toISOString(),
    to: rangeEnd.toISOString(),
    limit: "100"
  });
  if (state.calendar.platform)
    query.set("platform", state.calendar.platform);
  if (state.calendar.status) query.set("status", state.calendar.status);
  const [postResult, draftResult] = await Promise.all([
    api(`/posts?${query}`),
    state.calendar.status && state.calendar.status !== "draft"
      ? Promise.resolve({ data: [] })
      : api("/posts?status=draft&limit=30")
  ]);
  const posts = postResult.data;
  const drafts = draftResult.data.filter((post) => !post.scheduledAt);
  const content = document.querySelector("#page-content");
  content.innerHTML = `
    ${pageHeader({
      eyebrow: "Planejamento editorial",
      title: "Calendário",
      description: `Todos os horários são exibidos em ${state.workspace.timeZone}.`,
      actions: `<button class="btn btn-primary" data-calendar-compose>${icon(
        "plus",
        "icon-sm"
      )} Criar publicação</button>`
    })}
    ${
      drafts.length
        ? `<div class="card" style="margin-bottom:14px;padding:12px 14px;display:flex;align-items:center;gap:10px;overflow-x:auto">
            <span class="chip">${icon("draft", "icon-sm")} ${drafts.length} rascunho${drafts.length === 1 ? "" : "s"} sem data</span>
            ${drafts
              .slice(0, 5)
              .map(
                (post) =>
                  `<button class="btn btn-ghost btn-sm" data-open-post="${post.id}">${escapeHtml(
                    (post.baseCaption || "Sem legenda").slice(0, 38)
                  )}</button>`
              )
              .join("")}
          </div>`
        : ""
    }
    <section class="card calendar-card">
      <div class="calendar-toolbar">
        <div class="calendar-nav">
          <button class="btn btn-secondary btn-sm" data-calendar-today>Hoje</button>
          <button class="btn btn-ghost btn-icon btn-sm" data-calendar-prev aria-label="Período anterior">${icon(
            "chevronLeft",
            "icon-sm"
          )}</button>
          <button class="btn btn-ghost btn-icon btn-sm" data-calendar-next aria-label="Próximo período">${icon(
            "chevronRight",
            "icon-sm"
          )}</button>
          <h2 class="calendar-period">${calendarPeriodLabel()}</h2>
        </div>
        <div class="calendar-filters">
          <select class="select" data-calendar-platform aria-label="Filtrar por canal">
            <option value="">Todos os canais</option>
            <option value="facebook" ${state.calendar.platform === "facebook" ? "selected" : ""}>Facebook</option>
            <option value="instagram" ${state.calendar.platform === "instagram" ? "selected" : ""}>Instagram</option>
          </select>
          <select class="select" data-calendar-status aria-label="Filtrar por status">
            <option value="">Todos os status</option>
            ${["draft", "scheduled", "published", "failed", "partially_published"]
              .map(
                (status) =>
                  `<option value="${status}" ${state.calendar.status === status ? "selected" : ""}>${statusLabels[status]}</option>`
              )
              .join("")}
          </select>
          <div class="segmented" aria-label="Visualização">
            <button class="${state.calendar.view === "week" ? "active" : ""}" data-calendar-view="week">Semana</button>
            <button class="${state.calendar.view === "month" ? "active" : ""}" data-calendar-view="month">Mês</button>
          </div>
        </div>
      </div>
      ${
        state.calendar.view === "month"
          ? renderMonthCalendar(posts, rangeStart)
          : renderWeekCalendar(posts, rangeStart)
      }
    </section>
  `;
  bindCalendar(content, posts);
  bindPostOpeners(content);
}

function calendarPeriodLabel() {
  if (state.calendar.view === "month") {
    return new Intl.DateTimeFormat("pt-BR", {
      month: "long",
      year: "numeric"
    }).format(state.calendar.cursor);
  }
  const start = startOfWeek(state.calendar.cursor);
  const end = addDays(start, 6);
  return `${formatPlainDate(start, { day: "2-digit", month: "short" })} – ${formatPlainDate(
    end,
    { day: "2-digit", month: "short", year: "numeric" }
  )}`;
}

function formatPlainDate(date, options) {
  return new Intl.DateTimeFormat("pt-BR", options).format(date);
}

function groupBy(items, keyForItem) {
  const groups = new Map();
  for (const item of items) {
    const key = keyForItem(item);
    const group = groups.get(key);
    if (group) {
      group.push(item);
    } else {
      groups.set(key, [item]);
    }
  }
  return groups;
}

function renderMonthCalendar(posts, rangeStart) {
  const grouped = groupBy(
    posts.filter((post) => post.scheduledAt),
    (post) => dateKey(post.scheduledAt)
  );
  const weekdays = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
  const currentMonth = state.calendar.cursor.getMonth();
  const todayKey = dateToKey(new Date());
  return `
    <div class="calendar-grid" role="grid">
      ${weekdays
        .map((day) => `<div class="calendar-weekday">${day}</div>`)
        .join("")}
      ${Array.from({ length: 42 }, (_, index) => {
        const date = addDays(rangeStart, index);
        const key = dateToKey(date);
        const dayPosts = grouped.get(key) || [];
        return `
          <div class="calendar-day ${
            date.getMonth() !== currentMonth ? "other-month" : ""
          } ${key === todayKey ? "today" : ""}" data-calendar-day="${key}">
            <div class="calendar-date-row">
              <span class="calendar-date">${date.getDate()}</span>
              <button class="day-add" data-compose-date="${key}" aria-label="Criar em ${key}">${icon(
                "plus",
                "icon-sm"
              )}</button>
            </div>
            <div class="calendar-posts">
              ${dayPosts
                .slice(0, 3)
                .map((post) => calendarPost(post))
                .join("")}
              ${
                dayPosts.length > 3
                  ? `<span class="calendar-more">+ ${dayPosts.length - 3} outras</span>`
                  : ""
              }
            </div>
          </div>
        `;
      }).join("")}
    </div>
  `;
}

function calendarPost(post) {
  const draggable = ["scheduled", "draft", "failed", "cancelled"].includes(
    post.status
  );
  return `
    <article class="calendar-post status-${post.status}" data-open-post="${
      post.id
    }" data-calendar-post="${post.id}" draggable="${draggable}">
      <div class="calendar-post-time">
        <span>${formatTime(post.scheduledAt)}</span>
        <span class="calendar-post-platforms">${postPlatforms(post)}</span>
      </div>
      <span class="calendar-post-caption">${escapeHtml(
        post.baseCaption || "Sem legenda"
      )}</span>
    </article>
  `;
}

function renderWeekCalendar(posts, rangeStart) {
  const hours = Array.from({ length: 15 }, (_, index) => index + 7);
  const postsByCell = groupBy(
    posts.filter((post) => post.scheduledAt),
    (post) => {
      const parts = datePartsInWorkspace(post.scheduledAt);
      return `${parts.year}-${parts.month}-${parts.day}:${Number(parts.hour)}`;
    }
  );
  const days = Array.from({ length: 7 }, (_, index) =>
    addDays(rangeStart, index)
  );
  return `
    <div class="week-calendar">
      <div class="week-grid">
        <div class="week-header"></div>
        ${days
          .map(
            (day) => `<div class="week-header"><span>${formatPlainDate(day, {
              weekday: "short"
            })}</span><strong>${day.getDate()}</strong></div>`
          )
          .join("")}
        ${hours
          .map(
            (hour) => `
              <div class="week-time">${String(hour).padStart(2, "0")}:00</div>
              ${days
                .map((day) => {
                  const key = `${dateToKey(day)}:${hour}`;
                  return `<div class="week-cell" data-calendar-day="${dateToKey(
                    day
                  )}">${(postsByCell.get(key) || [])
                    .map(calendarPost)
                    .join("")}</div>`;
                })
                .join("")}
            `
          )
          .join("")}
      </div>
    </div>
  `;
}

function bindCalendar(content, posts) {
  content
    .querySelector("[data-calendar-compose]")
    ?.addEventListener("click", () => navigate("composer"));
  content.querySelector("[data-calendar-today]")?.addEventListener("click", () => {
    state.calendar.cursor = new Date();
    navigate("calendar", {}, true);
  });
  content.querySelector("[data-calendar-prev]")?.addEventListener("click", () => {
    const cursor = new Date(state.calendar.cursor);
    if (state.calendar.view === "month") cursor.setMonth(cursor.getMonth() - 1);
    else cursor.setDate(cursor.getDate() - 7);
    state.calendar.cursor = cursor;
    navigate("calendar", {}, true);
  });
  content.querySelector("[data-calendar-next]")?.addEventListener("click", () => {
    const cursor = new Date(state.calendar.cursor);
    if (state.calendar.view === "month") cursor.setMonth(cursor.getMonth() + 1);
    else cursor.setDate(cursor.getDate() + 7);
    state.calendar.cursor = cursor;
    navigate("calendar", {}, true);
  });
  content.querySelectorAll("[data-calendar-view]").forEach((button) => {
    button.addEventListener("click", () => {
      state.calendar.view = button.dataset.calendarView;
      navigate("calendar", {}, true);
    });
  });
  content
    .querySelector("[data-calendar-platform]")
    ?.addEventListener("change", (event) => {
      state.calendar.platform = event.target.value;
      navigate("calendar", {}, true);
    });
  content
    .querySelector("[data-calendar-status]")
    ?.addEventListener("change", (event) => {
      state.calendar.status = event.target.value;
      navigate("calendar", {}, true);
    });
  content.querySelectorAll("[data-compose-date]").forEach((button) => {
    button.addEventListener("click", (event) => {
      event.stopPropagation();
      navigate("composer", { date: button.dataset.composeDate });
    });
  });

  content.querySelectorAll("[data-calendar-post]").forEach((element) => {
    element.addEventListener("dragstart", (event) => {
      if (element.getAttribute("draggable") !== "true") {
        event.preventDefault();
        return;
      }
      event.dataTransfer.effectAllowed = "move";
      event.dataTransfer.setData("text/plain", element.dataset.calendarPost);
    });
  });
  content.querySelectorAll("[data-calendar-day]").forEach((day) => {
    day.addEventListener("dragover", (event) => {
      event.preventDefault();
      day.classList.add("drag-over");
    });
    day.addEventListener("dragleave", () => day.classList.remove("drag-over"));
    day.addEventListener("drop", async (event) => {
      event.preventDefault();
      day.classList.remove("drag-over");
      const postId = event.dataTransfer.getData("text/plain");
      const post = posts.find((item) => item.id === postId);
      if (!post || !post.scheduledAt) return;
      const parts = datePartsInWorkspace(post.scheduledAt);
      const scheduledLocal = `${day.dataset.calendarDay}T${parts.hour}:${parts.minute}`;
      if (
        !(await confirmAction({
          title: "Reagendar publicação?",
          message: `Mover para <strong>${formatPlainDate(
            new Date(`${day.dataset.calendarDay}T12:00:00`),
            { day: "2-digit", month: "long" }
          )}, às ${parts.hour}:${parts.minute}</strong>?`,
          confirmLabel: "Confirmar alteração",
          iconName: "calendar"
        }))
      )
        return;
      try {
        await api(`/posts/${post.id}/reschedule`, {
          method: "PATCH",
          body: {
            scheduledLocal,
            timeZone: state.workspace.timeZone
          }
        });
        toast("Publicação reagendada.");
        await renderCalendar();
      } catch (error) {
        toast(error.message, "error");
      }
    });
  });
}

function localInputValue(value) {
  const parts = datePartsInWorkspace(value);
  return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}`;
}

function defaultSchedule(dateKeyValue = null) {
  const date = new Date(Date.now() + 60 * 60 * 1000);
  date.setMinutes(Math.ceil(date.getMinutes() / 15) * 15, 0, 0);
  if (dateKeyValue) {
    const time = datePartsInWorkspace(date);
    return `${dateKeyValue}T${time.hour}:${time.minute}`;
  }
  return localInputValue(date);
}

function newComposerModel(date = null) {
  const connectedChannels = state.channels.filter(
    (channel) => channel.status === "connected"
  );
  return {
    id: null,
    originalStatus: "draft",
    baseCaption: "",
    selectedChannelIds: connectedChannels.map((channel) => channel.id),
    customEnabled: {},
    customCaptions: {},
    customMediaEnabled: {},
    customMedia: {},
    sharedMedia: [],
    scheduledLocal: defaultSchedule(date),
    timeZone: state.workspace.timeZone,
    previewChannelId: connectedChannels[0]?.id || null,
    autoSaveTimer: null,
    savingPromise: null,
    dirty: false,
    savedAt: null
  };
}

async function renderComposer(extras = {}) {
  const location = parseLocation();
  const postId = extras.postId || location.postId;
  const date = extras.date || location.date;
  const [channelResult, mediaResult] = await Promise.all([
    api("/channels"),
    api("/media?limit=60")
  ]);
  state.channels = channelResult.data;
  state.mediaCache = mediaResult.data;

  if (postId) {
    const postResult = await api(`/posts/${postId}`);
    const post = postResult.data;
    state.composer = {
      id: post.id,
      originalStatus: post.status,
      baseCaption: post.baseCaption,
      selectedChannelIds: post.targets.map((target) => target.channelId),
      customEnabled: Object.fromEntries(
        post.targets.map((target) => [
          target.channelId,
          target.caption !== post.baseCaption
        ])
      ),
      customCaptions: Object.fromEntries(
        post.targets.map((target) => [target.channelId, target.caption])
      ),
      customMediaEnabled: {},
      customMedia: Object.fromEntries(
        post.targets.map((target) => [target.channelId, target.media])
      ),
      sharedMedia: sharedMediaFromTargets(post.targets),
      scheduledLocal: post.scheduledAt
        ? localInputValue(post.scheduledAt)
        : defaultSchedule(date),
      timeZone: post.scheduledTimeZone || state.workspace.timeZone,
      previewChannelId: post.targets[0]?.channelId || null,
      autoSaveTimer: null,
      savingPromise: null,
      dirty: false,
      savedAt: new Date(post.updatedAt)
    };
    for (const target of post.targets) {
      const sharedIds = state.composer.sharedMedia.map((media) => media.id);
      const targetIds = target.media.map((media) => media.id);
      state.composer.customMediaEnabled[target.channelId] =
        sharedIds.join(",") !== targetIds.join(",");
    }
  } else if (!state.composer || state.composer.id) {
    state.composer = newComposerModel(date);
    const localDraft = localStorage.getItem(
      `correiro:composer:${state.workspace.id}`
    );
    if (localDraft && !date) {
      try {
        const saved = JSON.parse(localDraft);
        if (saved.baseCaption || saved.selectedChannelIds?.length) {
          Object.assign(state.composer, {
            ...saved,
            sharedMedia: (saved.sharedMedia || [])
              .map((id) =>
                state.mediaCache.find((media) => media.id === id)
              )
              .filter(Boolean),
            customMedia: Object.fromEntries(
              Object.entries(saved.customMedia || {}).map(([channelId, ids]) => [
                channelId,
                ids
                  .map((id) =>
                    state.mediaCache.find((media) => media.id === id)
                  )
                  .filter(Boolean)
              ])
            ),
            autoSaveTimer: null,
            savingPromise: null
          });
        }
      } catch {
        localStorage.removeItem(`correiro:composer:${state.workspace.id}`);
      }
    }
  } else if (date) {
    state.composer.scheduledLocal = defaultSchedule(date);
  }
  paintComposer();
}

function sharedMediaFromTargets(targets) {
  if (!targets.length) return [];
  const first = targets[0].media || [];
  const firstIds = first.map((media) => media.id).join(",");
  return targets.every(
    (target) => (target.media || []).map((media) => media.id).join(",") === firstIds
  )
    ? first
    : [];
}

function selectedChannels() {
  const ids = new Set(state.composer.selectedChannelIds);
  return state.channels.filter((channel) => ids.has(channel.id));
}

function mediaForChannel(channelId) {
  return state.composer.customMediaEnabled[channelId]
    ? state.composer.customMedia[channelId] || []
    : state.composer.sharedMedia;
}

function captionForChannel(channelId) {
  return state.composer.customEnabled[channelId]
    ? state.composer.customCaptions[channelId] || ""
    : state.composer.baseCaption;
}

function paintComposer() {
  const model = state.composer;
  const content = document.querySelector("#page-content");
  const channels = selectedChannels();
  const previewChannel =
    channels.find((channel) => channel.id === model.previewChannelId) ||
    channels[0] ||
    state.channels[0];
  if (previewChannel) model.previewChannelId = previewChannel.id;

  content.innerHTML = `
    ${pageHeader({
      eyebrow: model.id ? "Editar conteúdo" : "Novo conteúdo",
      title: model.id ? "Editar publicação" : "Criar publicação",
      description:
        "Crie uma vez, personalize por canal e escolha quando publicar.",
      actions: `<button class="btn btn-secondary" data-composer-back>${icon(
        "chevronLeft",
        "icon-sm"
      )} Voltar</button>`
    })}
    <div class="composer-layout">
      <section class="card composer-form">
        <div class="composer-section">
          <div class="section-heading">
            <div><h2>1. Escolha os canais</h2><p>Somente conexões ativas podem ser agendadas.</p></div>
            <button class="btn btn-ghost btn-sm" data-route-channels>${icon(
              "settings",
              "icon-sm"
            )} Gerenciar</button>
          </div>
          ${
            state.channels.length
              ? `<div class="channel-selector">${state.channels
                  .map(composerChannelOption)
                  .join("")}</div>`
              : `<div class="empty-state" style="min-height:180px"><span class="empty-state-icon">${icon(
                  "channels"
                )}</span><h3>Nenhum canal conectado</h3><p>Conecte uma Página do Facebook ou conta profissional do Instagram.</p><button class="btn btn-primary btn-sm" data-route-channels>Conectar canais</button></div>`
          }
        </div>
        <div class="composer-section">
          <div class="section-heading">
            <div><h2>2. Escreva a legenda</h2><p>Use um texto compartilhado ou personalize cada destino.</p></div>
            <span class="chip">${icon("posts", "icon-sm")} Compartilhada</span>
          </div>
          <div class="caption-wrap">
            <textarea class="textarea" data-base-caption maxlength="63206" placeholder="Conte a história por trás desta publicação…">${escapeHtml(
              model.baseCaption
            )}</textarea>
            <div class="caption-tools">
              <div class="caption-tool-buttons">
                <button class="caption-tool" data-insert-emoji title="Adicionar emoji">${icon(
                  "smile",
                  "icon-sm"
                )}</button>
                <button class="caption-tool" data-insert-hashtags title="Adicionar hashtags">${icon(
                  "hash",
                  "icon-sm"
                )}</button>
                <button class="caption-tool" data-insert-link title="Adicionar link">${icon(
                  "link",
                  "icon-sm"
                )}</button>
              </div>
              <span class="char-count" data-char-count>${model.baseCaption.length.toLocaleString(
                "pt-BR"
              )} caracteres</span>
            </div>
          </div>
          <div class="channel-customizations">
            ${channels.map(composerCustomization).join("")}
          </div>
        </div>
        <div class="composer-section">
          <div class="section-heading">
            <div><h2>3. Adicione a mídia</h2><p>JPG, PNG, WEBP ou MP4. O Instagram exige mídia.</p></div>
            <span class="chip">${icon("image", "icon-sm")} <span data-media-count>${
              model.sharedMedia.length
            }</span> selecionada(s)</span>
          </div>
          <button class="media-drop" type="button" data-open-media-picker="shared">
            <span class="empty-state-icon">${icon("upload")}</span>
            <strong>Arraste arquivos ou escolha na biblioteca</strong>
            <span>Imagem até 20 MB · vídeo até 100 MB</span>
          </button>
          ${selectedMediaMarkup(model.sharedMedia, "shared")}
          ${
            channels.length
              ? `<div class="channel-customizations" style="margin-top:14px">${channels
                  .map(composerMediaCustomization)
                  .join("")}</div>`
              : ""
          }
          <input class="sr-only" type="file" data-composer-upload accept="image/jpeg,image/png,image/webp,image/gif,video/mp4" />
        </div>
        <div class="composer-section">
          <div class="section-heading">
            <div><h2>4. Quando publicar?</h2><p>O horário será salvo em UTC e exibido no fuso do workspace.</p></div>
            <span class="chip">${icon("globe", "icon-sm")} ${escapeHtml(
              model.timeZone
            )}</span>
          </div>
          <div class="schedule-row">
            <div class="field">
              <label for="scheduled-at">Data e horário</label>
              <input class="input" id="scheduled-at" type="datetime-local" data-scheduled-local value="${escapeAttribute(
                model.scheduledLocal
              )}" />
            </div>
            <div class="field">
              <label for="scheduled-timezone">Fuso horário</label>
              <select class="select" id="scheduled-timezone" data-scheduled-timezone>
                ${timeZoneOptions(model.timeZone)}
              </select>
            </div>
          </div>
        </div>
        <footer class="composer-actions">
          <span class="autosave-status" data-autosave-status>
            ${icon(model.dirty ? "clock" : "success", "icon-sm")}
            ${composerSaveStatus()}
          </span>
          <div class="composer-action-buttons">
            <button class="btn btn-secondary" data-composer-save="draft">${icon(
              "draft",
              "icon-sm"
            )} Salvar rascunho</button>
            <button class="btn btn-secondary" data-composer-save="now">${icon(
              "send",
              "icon-sm"
            )} Publicar agora</button>
            <button class="btn btn-primary" data-composer-save="schedule">${icon(
              "calendar",
              "icon-sm"
            )} Agendar publicação</button>
          </div>
        </footer>
      </section>
      <aside class="preview-column">
        <div class="card preview-card-shell">
          <div class="preview-tabs">
            ${
              channels.length
                ? channels
                    .map(
                      (channel) => `
                        <button class="preview-tab ${
                          channel.id === previewChannel?.id ? "active" : ""
                        }" data-preview-channel="${channel.id}">
                          ${platformBadge(channel.platform)}
                          ${channel.platform === "facebook" ? "Facebook" : "Instagram"}
                        </button>
                      `
                    )
                    .join("")
                : `
                  <button class="preview-tab active">${platformBadge(
                    "facebook"
                  )} Facebook</button>
                  <button class="preview-tab">${platformBadge(
                    "instagram"
                  )} Instagram</button>
                `
            }
          </div>
          <div data-preview-content>${socialPreview(previewChannel)}</div>
          <p class="preview-disclaimer">${icon(
            "info",
            "icon-sm"
          )}<span>A prévia é aproximada. A aparência final pode variar de acordo com a rede.</span></p>
        </div>
      </aside>
    </div>
  `;
  bindComposer();
}

function composerChannelOption(channel) {
  const selected = state.composer.selectedChannelIds.includes(channel.id);
  const enabled = channel.status === "connected";
  return `
    <button class="channel-option ${selected ? "selected" : ""}" type="button" data-toggle-channel="${
      channel.id
    }" ${enabled ? "" : "disabled"}>
      ${avatar(channel, "sm")}
      ${platformBadge(channel.platform)}
      <span class="channel-option-copy">
        <strong>${escapeHtml(channel.name)}</strong>
        <span>${
          channel.platform === "instagram" && channel.username
            ? `@${escapeHtml(channel.username)}`
            : "Página do Facebook"
        } · ${escapeHtml(statusLabels[channel.status])}</span>
      </span>
      <span class="channel-check">${icon("check", "icon-sm")}</span>
    </button>
  `;
}

function composerCustomization(channel) {
  const enabled = Boolean(state.composer.customEnabled[channel.id]);
  return `
    <div class="custom-caption">
      <div class="custom-caption-header">
        <span class="custom-caption-title">${platformBadge(channel.platform)} Legenda para ${escapeHtml(
          channel.name
        )}</span>
        <label class="toggle">
          <input type="checkbox" data-custom-caption-toggle="${channel.id}" ${
            enabled ? "checked" : ""
          } />
          <span class="toggle-switch"></span>
          Personalizar
        </label>
      </div>
      ${
        enabled
          ? `<textarea class="textarea" data-custom-caption="${channel.id}" maxlength="${
              channel.platform === "instagram" ? 2200 : 63206
            }" placeholder="Versão específica para este canal…">${escapeHtml(
              state.composer.customCaptions[channel.id] ||
                state.composer.baseCaption
            )}</textarea>`
          : ""
      }
    </div>
  `;
}

function composerMediaCustomization(channel) {
  const enabled = Boolean(state.composer.customMediaEnabled[channel.id]);
  const media = state.composer.customMedia[channel.id] || [];
  return `
    <div class="custom-caption">
      <div class="custom-caption-header">
        <span class="custom-caption-title">${platformBadge(
          channel.platform
        )} Mídia para ${escapeHtml(channel.name)}</span>
        <label class="toggle">
          <input type="checkbox" data-custom-media-toggle="${channel.id}" ${
            enabled ? "checked" : ""
          } />
          <span class="toggle-switch"></span>
          Personalizar
        </label>
      </div>
      ${
        enabled
          ? `<div style="padding:12px"><button class="btn btn-secondary btn-sm" data-open-media-picker="${channel.id}">${icon(
              "image",
              "icon-sm"
            )} Escolher mídia</button>${selectedMediaMarkup(
              media,
              channel.id
            )}</div>`
          : ""
      }
    </div>
  `;
}

function selectedMediaMarkup(media, scope) {
  if (!media.length) return "";
  return `
    <div class="selected-media">
      ${media
        .map(
          (item, index) => `
            <div class="selected-media-item">
              <img src="${escapeAttribute(item.thumbnailUrl)}" alt="${escapeAttribute(
                item.originalName
              )}" />
              <span class="selected-media-order">${index + 1}</span>
              <button class="selected-media-remove" data-remove-media="${item.id}" data-media-scope="${scope}" aria-label="Remover">${icon(
                "x",
                "icon-sm"
              )}</button>
            </div>
          `
        )
        .join("")}
    </div>
  `;
}

function timeZoneOptions(selected) {
  const zones = [
    "America/Sao_Paulo",
    "America/Manaus",
    "America/Recife",
    "America/Fortaleza",
    "America/Cuiaba",
    "America/Rio_Branco",
    "Europe/Lisbon",
    "UTC"
  ];
  if (!zones.includes(selected)) zones.unshift(selected);
  return zones
    .map(
      (zone) =>
        `<option value="${escapeAttribute(zone)}" ${
          zone === selected ? "selected" : ""
        }>${escapeHtml(zone.replaceAll("_", " "))}</option>`
    )
    .join("");
}

function composerSaveStatus() {
  const model = state.composer;
  if (model.savingPromise) return "Salvando alterações…";
  if (model.dirty) return "Alterações ainda não salvas";
  if (model.savedAt) return `Salvo ${relativeTime(model.savedAt)}`;
  return "Rascunho local pronto";
}

function socialPreview(channel) {
  const model = state.composer;
  const media = channel ? mediaForChannel(channel.id) : model.sharedMedia;
  const caption = channel
    ? captionForChannel(channel.id)
    : model.baseCaption;
  const isInstagram = channel?.platform === "instagram";
  return `
    <article class="social-preview">
      <header class="social-preview-header">
        ${avatar(channel || state.workspace, "sm")}
        <span class="social-preview-user">
          <strong>${escapeHtml(channel?.name || state.workspace.name)}</strong>
          <span>${
            isInstagram
              ? `@${escapeHtml(channel?.username || "suaempresa")}`
              : "Agora · 🌐"
          }</span>
        </span>
        ${icon("more", "icon-sm")}
      </header>
      ${
        !isInstagram || caption
          ? `<div class="social-preview-caption ${
              caption ? "" : "empty"
            }">${escapeHtml(
              caption || "Sua legenda aparecerá aqui…"
            )}</div>`
          : ""
      }
      <div class="social-preview-media">
        ${
          media[0]
            ? `<img src="${escapeAttribute(media[0].fileUrl)}" alt="" />`
            : `<div class="empty-state" style="min-height:100%;padding:20px"><span class="empty-state-icon">${icon(
                isInstagram ? "image" : "posts"
              )}</span><p>${
                isInstagram
                  ? "Adicione uma imagem ou vídeo"
                  : "Texto ou mídia aparecerão aqui"
              }</p></div>`
        }
      </div>
      ${
        isInstagram && caption
          ? `<div class="social-preview-caption">${escapeHtml(caption)}</div>`
          : ""
      }
      <footer class="social-preview-actions">
        <span class="social-preview-action-group">${icon(
          "heart",
          "icon-sm"
        )}${icon("message", "icon-sm")}${icon("send", "icon-sm")}</span>
        ${icon("bookmark", "icon-sm")}
      </footer>
    </article>
  `;
}

function bindComposer() {
  const content = document.querySelector("#page-content");
  content
    .querySelector("[data-composer-back]")
    ?.addEventListener("click", () => navigate("posts"));
  content.querySelectorAll("[data-route-channels]").forEach((button) =>
    button.addEventListener("click", () => navigate("channels"))
  );
  content.querySelectorAll("[data-toggle-channel]").forEach((button) => {
    button.addEventListener("click", () => {
      const id = button.dataset.toggleChannel;
      const index = state.composer.selectedChannelIds.indexOf(id);
      if (index === -1) state.composer.selectedChannelIds.push(id);
      else state.composer.selectedChannelIds.splice(index, 1);
      if (!state.composer.previewChannelId) state.composer.previewChannelId = id;
      markComposerDirty();
      paintComposer();
    });
  });
  const baseCaption = content.querySelector("[data-base-caption]");
  baseCaption?.addEventListener("input", () => {
    state.composer.baseCaption = baseCaption.value;
    content.querySelector("[data-char-count]").textContent = `${
      baseCaption.value.length
    } caracteres`;
    markComposerDirty();
    updateComposerPreview();
  });
  content.querySelectorAll("[data-custom-caption-toggle]").forEach((input) => {
    input.addEventListener("change", () => {
      const id = input.dataset.customCaptionToggle;
      state.composer.customEnabled[id] = input.checked;
      if (
        input.checked &&
        state.composer.customCaptions[id] === undefined
      ) {
        state.composer.customCaptions[id] = state.composer.baseCaption;
      }
      markComposerDirty();
      paintComposer();
    });
  });
  content.querySelectorAll("[data-custom-caption]").forEach((textarea) => {
    textarea.addEventListener("input", () => {
      state.composer.customCaptions[textarea.dataset.customCaption] =
        textarea.value;
      markComposerDirty();
      updateComposerPreview();
    });
  });
  content.querySelectorAll("[data-custom-media-toggle]").forEach((input) => {
    input.addEventListener("change", () => {
      const id = input.dataset.customMediaToggle;
      state.composer.customMediaEnabled[id] = input.checked;
      if (input.checked && !state.composer.customMedia[id]) {
        state.composer.customMedia[id] = [...state.composer.sharedMedia];
      }
      markComposerDirty();
      paintComposer();
    });
  });
  content.querySelectorAll("[data-open-media-picker]").forEach((button) => {
    button.addEventListener("click", () =>
      openMediaPicker(button.dataset.openMediaPicker)
    );
  });
  content.querySelectorAll("[data-remove-media]").forEach((button) => {
    button.addEventListener("click", () => {
      const scope = button.dataset.mediaScope;
      const list =
        scope === "shared"
          ? state.composer.sharedMedia
          : state.composer.customMedia[scope] || [];
      const index = list.findIndex(
        (media) => media.id === button.dataset.removeMedia
      );
      if (index !== -1) list.splice(index, 1);
      markComposerDirty();
      paintComposer();
    });
  });
  content.querySelectorAll("[data-preview-channel]").forEach((button) => {
    button.addEventListener("click", () => {
      state.composer.previewChannelId = button.dataset.previewChannel;
      paintComposer();
    });
  });
  content
    .querySelector("[data-scheduled-local]")
    ?.addEventListener("change", (event) => {
      state.composer.scheduledLocal = event.target.value;
      markComposerDirty();
    });
  content
    .querySelector("[data-scheduled-timezone]")
    ?.addEventListener("change", (event) => {
      state.composer.timeZone = event.target.value;
      markComposerDirty();
    });
  content.querySelector("[data-insert-emoji]")?.addEventListener("click", () => {
    insertAtCursor(baseCaption, " ✨");
  });
  content
    .querySelector("[data-insert-hashtags]")
    ?.addEventListener("click", () => {
      insertAtCursor(baseCaption, "\n\n#SuaMarca #Conteudo");
    });
  content.querySelector("[data-insert-link]")?.addEventListener("click", () => {
    insertAtCursor(baseCaption, " https://");
  });
  content.querySelectorAll("[data-composer-save]").forEach((button) => {
    button.addEventListener("click", () =>
      handleComposerSave(button.dataset.composerSave, button)
    );
  });
  const uploadInput = content.querySelector("[data-composer-upload]");
  const drop = content.querySelector('[data-open-media-picker="shared"]');
  drop?.addEventListener("dragover", (event) => {
    event.preventDefault();
    drop.classList.add("drag-over");
  });
  drop?.addEventListener("dragleave", () => drop.classList.remove("drag-over"));
  drop?.addEventListener("drop", async (event) => {
    event.preventDefault();
    drop.classList.remove("drag-over");
    const file = event.dataTransfer.files[0];
    if (file) await uploadComposerFile(file);
  });
  uploadInput?.addEventListener("change", async () => {
    if (uploadInput.files[0]) await uploadComposerFile(uploadInput.files[0]);
  });
}

function insertAtCursor(textarea, text) {
  if (!textarea) return;
  const start = textarea.selectionStart;
  const end = textarea.selectionEnd;
  textarea.value =
    textarea.value.slice(0, start) + text + textarea.value.slice(end);
  textarea.selectionStart = textarea.selectionEnd = start + text.length;
  textarea.dispatchEvent(new Event("input", { bubbles: true }));
  textarea.focus();
}

function updateComposerPreview() {
  const channel = state.channels.find(
    (item) => item.id === state.composer.previewChannelId
  );
  const target = document.querySelector("[data-preview-content]");
  if (target) target.innerHTML = socialPreview(channel);
}

function markComposerDirty() {
  state.composer.dirty = true;
  persistComposerLocally();
  const status = document.querySelector("[data-autosave-status]");
  if (status) {
    status.innerHTML = `${icon("clock", "icon-sm")} Salvando automaticamente…`;
  }
  clearTimeout(state.composer.autoSaveTimer);
  if (
    state.composer.originalStatus === "draft" &&
    (state.composer.baseCaption.trim() ||
      state.composer.selectedChannelIds.length ||
      state.composer.sharedMedia.length)
  ) {
    state.composer.autoSaveTimer = setTimeout(() => {
      saveComposer("draft", true).catch((error) => {
        const element = document.querySelector("[data-autosave-status]");
        if (element)
          element.innerHTML = `${icon(
            "alert",
            "icon-sm"
          )} Não foi possível salvar: ${escapeHtml(error.message)}`;
      });
    }, 1400);
  }
}

function persistComposerLocally() {
  const model = state.composer;
  localStorage.setItem(
    `correiro:composer:${state.workspace.id}`,
    JSON.stringify({
      baseCaption: model.baseCaption,
      selectedChannelIds: model.selectedChannelIds,
      customEnabled: model.customEnabled,
      customCaptions: model.customCaptions,
      customMediaEnabled: model.customMediaEnabled,
      customMedia: Object.fromEntries(
        Object.entries(model.customMedia).map(([id, media]) => [
          id,
          media.map((item) => item.id)
        ])
      ),
      sharedMedia: model.sharedMedia.map((item) => item.id),
      scheduledLocal: model.scheduledLocal,
      timeZone: model.timeZone,
      previewChannelId: model.previewChannelId
    })
  );
}

async function uploadComposerFile(file) {
  const form = new FormData();
  form.append("file", file);
  toast(`Enviando ${file.name}…`, "warning", "Upload em andamento");
  try {
    const result = await api("/media/upload", { method: "POST", form });
    state.mediaCache = [result.data, ...(state.mediaCache || [])];
    state.composer.sharedMedia.push(result.data);
    markComposerDirty();
    paintComposer();
    toast("Mídia adicionada à publicação.");
  } catch (error) {
    toast(error.message, "error");
  }
}

function openMediaPicker(scope) {
  const current =
    scope === "shared"
      ? state.composer.sharedMedia
      : state.composer.customMedia[scope] || [];
  const selected = new Set(current.map((media) => media.id));
  const max =
    scope === "shared"
      ? 10
      : state.channels.find((channel) => channel.id === scope)?.platform ===
          "facebook"
        ? 1
        : 10;
  const renderGrid = () => {
    const grid = modalRoot.querySelector("[data-media-picker-grid]");
    if (!grid) return;
    grid.innerHTML = state.mediaCache.length
      ? state.mediaCache
          .map(
            (media) => `
              <button class="media-picker-item ${
                selected.has(media.id) ? "selected" : ""
              }" data-picker-media="${media.id}" title="${escapeAttribute(
                media.originalName
              )}">
                <img src="${escapeAttribute(media.thumbnailUrl)}" alt="${escapeAttribute(
                  media.originalName
                )}" />
                <span class="media-picker-check">${icon("check", "icon-sm")}</span>
              </button>
            `
          )
          .join("")
      : `<div class="empty-state"><p>Sua biblioteca ainda está vazia.</p></div>`;
    grid.querySelectorAll("[data-picker-media]").forEach((button) => {
      button.addEventListener("click", () => {
        const id = button.dataset.pickerMedia;
        if (selected.has(id)) selected.delete(id);
        else if (selected.size >= max) {
          toast(
            max === 1
              ? "O Facebook aceita uma mídia por destino neste MVP."
              : `Selecione no máximo ${max} mídias.`,
            "warning"
          );
          return;
        } else selected.add(id);
        renderGrid();
        const count = modalRoot.querySelector("[data-picker-count]");
        if (count) count.textContent = `${selected.size} selecionada(s)`;
      });
    });
  };
  showModal(
    `
      <div class="modal-header">
        <div><h2>Escolher mídia</h2><p data-picker-count>${selected.size} selecionada(s)</p></div>
        <button class="btn btn-ghost btn-icon btn-sm" data-close-modal>${icon(
          "x",
          "icon-sm"
        )}</button>
      </div>
      <div class="modal-body">
        <div class="media-picker-grid" data-media-picker-grid></div>
      </div>
      <div class="modal-footer">
        <button class="btn btn-secondary" data-picker-upload>${icon(
          "upload",
          "icon-sm"
        )} Enviar novo arquivo</button>
        <button class="btn btn-primary" data-picker-confirm>Usar selecionadas</button>
      </div>
    `,
    "modal-lg"
  );
  renderGrid();
  modalRoot
    .querySelector("[data-picker-confirm]")
    .addEventListener("click", () => {
      const media = [...selected]
        .map((id) => state.mediaCache.find((item) => item.id === id))
        .filter(Boolean);
      if (scope === "shared") state.composer.sharedMedia = media;
      else state.composer.customMedia[scope] = media;
      closeModal();
      markComposerDirty();
      paintComposer();
    });
  modalRoot
    .querySelector("[data-picker-upload]")
    .addEventListener("click", () => {
      closeModal();
      document.querySelector("[data-composer-upload]")?.click();
    });
}

function composerPayload(mode) {
  const channels = selectedChannels();
  return {
    mode,
    baseCaption: state.composer.baseCaption,
    scheduledLocal: state.composer.scheduledLocal,
    timeZone: state.composer.timeZone,
    targets: channels.map((channel) => {
      const media = mediaForChannel(channel.id);
      return {
        channelId: channel.id,
        caption: captionForChannel(channel.id),
        contentType:
          channel.platform === "instagram" &&
          media.length === 1 &&
          media[0].mediaType === "video"
            ? "reel"
            : undefined,
        mediaIds: media.map((item) => item.id)
      };
    })
  };
}

async function saveComposer(mode, quiet = false) {
  if (state.composer.savingPromise) await state.composer.savingPromise;
  const model = state.composer;
  const method = model.id ? "PUT" : "POST";
  const path = model.id ? `/posts/${model.id}` : "/posts";
  const promise = api(path, {
    method,
    body: composerPayload(mode)
  });
  model.savingPromise = promise;
  try {
    const result = await promise;
    const post = result.data;
    model.id = post.id;
    model.originalStatus = post.status;
    model.dirty = false;
    model.savedAt = new Date();
    if (mode === "draft") {
      setLocation("composer", { postId: post.id }, true);
      localStorage.removeItem(`correiro:composer:${state.workspace.id}`);
      if (!quiet) toast("Rascunho salvo.");
      const status = document.querySelector("[data-autosave-status]");
      if (status)
        status.innerHTML = `${icon(
          "success",
          "icon-sm"
        )} Salvo automaticamente agora`;
    }
    return post;
  } finally {
    model.savingPromise = null;
  }
}

async function handleComposerSave(mode, button) {
  clearTimeout(state.composer.autoSaveTimer);
  if (state.composer.savingPromise) {
    try {
      await state.composer.savingPromise;
    } catch {
      // A ação explícita abaixo exibirá o erro atualizado.
    }
  }
  if (mode !== "draft") {
    const channels = selectedChannels();
    if (!channels.length) {
      toast("Selecione pelo menos um canal.", "error");
      return;
    }
    const mediaError = channels.find(
      (channel) =>
        channel.platform === "instagram" &&
        mediaForChannel(channel.id).length === 0
    );
    if (mediaError) {
      toast("O Instagram exige uma imagem ou vídeo.", "error");
      return;
    }
    const confirmed = await confirmAction({
      title:
        mode === "now" ? "Publicar agora?" : "Confirmar agendamento?",
      message:
        mode === "now"
          ? `O conteúdo será enviado imediatamente para <strong>${channels.length} canal(is)</strong>. O resultado será acompanhado separadamente.`
          : `Agendar para <strong>${escapeHtml(
              new Intl.DateTimeFormat("pt-BR", {
                dateStyle: "long",
                timeStyle: "short"
              }).format(new Date(state.composer.scheduledLocal))
            )}</strong>, no fuso ${escapeHtml(state.composer.timeZone)}?`,
      confirmLabel: mode === "now" ? "Publicar agora" : "Confirmar agendamento",
      iconName: mode === "now" ? "send" : "calendar"
    });
    if (!confirmed) return;
  }
  setButtonLoading(
    button,
    true,
    mode === "draft"
      ? "Salvando…"
      : mode === "now"
        ? "Enviando…"
        : "Agendando…"
  );
  try {
    const post = await saveComposer(mode, false);
    if (mode !== "draft") {
      localStorage.removeItem(`correiro:composer:${state.workspace.id}`);
      state.composer = null;
      toast(
        mode === "now"
          ? "Publicação enviada para processamento."
          : "Publicação agendada com sucesso."
      );
      navigate("posts", {}, true);
      window.setTimeout(() => openPostDetail(post.id), 250);
    }
  } catch (error) {
    toast(error.message, "error");
  } finally {
    setButtonLoading(button, false);
  }
}

async function renderPostsPage() {
  const query = new URLSearchParams({
    page: String(state.posts.page),
    limit: "25"
  });
  if (state.posts.status) query.set("status", state.posts.status);
  if (state.posts.platform) query.set("platform", state.posts.platform);
  if (state.posts.search) query.set("search", state.posts.search);
  const result = await api(`/posts?${query}`);
  const posts = result.data;
  const meta = result.meta;
  const content = document.querySelector("#page-content");
  content.innerHTML = `
    ${pageHeader({
      eyebrow: "Conteúdo",
      title: "Publicações",
      description:
        "Acompanhe rascunhos, agendamentos, resultados e falhas por canal.",
      actions: `<button class="btn btn-primary" data-posts-compose>${icon(
        "plus",
        "icon-sm"
      )} Criar publicação</button>`
    })}
    <div class="card filter-bar">
      <div class="input-wrap filter-search">
        ${icon("search", "icon-sm")}
        <input class="input" data-post-search value="${escapeAttribute(
          state.posts.search
        )}" placeholder="Buscar por legenda…" />
      </div>
      <select class="select" data-post-platform>
        <option value="">Todos os canais</option>
        <option value="facebook" ${state.posts.platform === "facebook" ? "selected" : ""}>Facebook</option>
        <option value="instagram" ${state.posts.platform === "instagram" ? "selected" : ""}>Instagram</option>
      </select>
      <select class="select" data-post-status>
        <option value="">Todos os status</option>
        ${[
          "draft",
          "scheduled",
          "processing",
          "published",
          "partially_published",
          "failed",
          "cancelled"
        ]
          .map(
            (status) =>
              `<option value="${status}" ${
                state.posts.status === status ? "selected" : ""
              }>${statusLabels[status]}</option>`
          )
          .join("")}
      </select>
      ${
        state.posts.status || state.posts.platform || state.posts.search
          ? `<button class="btn btn-ghost btn-sm" data-clear-post-filters>${icon(
              "x",
              "icon-sm"
            )} Limpar</button>`
          : ""
      }
    </div>
    <section class="card table-card">
      ${
        posts.length
          ? `
            <div class="table-wrap">
              <table class="data-table">
                <thead><tr>
                  <th>Publicação</th>
                  <th>Canais</th>
                  <th>Criador</th>
                  <th>Programada</th>
                  <th>Status</th>
                  <th style="text-align:right">Ações</th>
                </tr></thead>
                <tbody>${posts.map(postTableRow).join("")}</tbody>
              </table>
            </div>
            <div class="pagination">
              <span>${meta.total} publicação${meta.total === 1 ? "" : "ões"} · página ${meta.page} de ${Math.max(
                meta.pages,
                1
              )}</span>
              <div class="pagination-actions">
                <button class="btn btn-secondary btn-sm" data-post-page="${
                  meta.page - 1
                }" ${meta.page <= 1 ? "disabled" : ""}>${icon(
                  "chevronLeft",
                  "icon-sm"
                )} Anterior</button>
                <button class="btn btn-secondary btn-sm" data-post-page="${
                  meta.page + 1
                }" ${meta.page >= meta.pages ? "disabled" : ""}>Próxima ${icon(
                  "chevronRight",
                  "icon-sm"
                )}</button>
              </div>
            </div>
          `
          : `<div class="empty-state"><img src="/assets/empty-state.svg" alt="" /><h3>Nenhuma publicação encontrada</h3><p>${
              state.posts.status || state.posts.platform || state.posts.search
                ? "Ajuste os filtros para ver outros conteúdos."
                : "Crie seu primeiro conteúdo e comece a preencher o calendário."
            }</p><button class="btn btn-primary btn-sm" data-posts-compose>${icon(
              "plus",
              "icon-sm"
            )} Criar publicação</button></div>`
      }
    </section>
  `;
  content.querySelectorAll("[data-posts-compose]").forEach((button) =>
    button.addEventListener("click", () => navigate("composer"))
  );
  const searchInput = content.querySelector("[data-post-search]");
  searchInput?.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      state.posts.search = searchInput.value.trim();
      state.posts.page = 1;
      renderPostsPage();
    }
  });
  content
    .querySelector("[data-post-platform]")
    ?.addEventListener("change", (event) => {
      state.posts.platform = event.target.value;
      state.posts.page = 1;
      renderPostsPage();
    });
  content
    .querySelector("[data-post-status]")
    ?.addEventListener("change", (event) => {
      state.posts.status = event.target.value;
      state.posts.page = 1;
      renderPostsPage();
    });
  content
    .querySelector("[data-clear-post-filters]")
    ?.addEventListener("click", () => {
      Object.assign(state.posts, {
        page: 1,
        status: "",
        platform: "",
        search: ""
      });
      renderPostsPage();
    });
  content.querySelectorAll("[data-post-page]").forEach((button) => {
    button.addEventListener("click", () => {
      state.posts.page = Number(button.dataset.postPage);
      renderPostsPage();
    });
  });
  bindPostOpeners(content);
  bindPostActions(content);
}

function postTableRow(post) {
  return `
    <tr>
      <td>
        <div class="table-post" data-open-post="${post.id}">
          ${postThumbnail(post)}
          <div>
            <div class="table-caption">${escapeHtml(
              post.baseCaption || "Publicação sem legenda"
            )}</div>
            <div class="table-subline">Editada ${relativeTime(
              post.updatedAt
            )}</div>
          </div>
        </div>
      </td>
      <td>${postPlatforms(post)}</td>
      <td>${escapeHtml(post.author.name)}</td>
      <td>
        <strong>${formatDateTime(post.scheduledAt)}</strong>
        <div class="table-subline">${escapeHtml(
          post.scheduledTimeZone || state.workspace.timeZone
        )}</div>
      </td>
      <td>${statusBadge(post.status)}</td>
      <td>
        <div class="table-actions">
          ${
            ["draft", "scheduled", "failed", "cancelled"].includes(post.status)
              ? `<button class="btn btn-ghost btn-icon btn-sm" data-post-action="edit" data-post-id="${post.id}" title="Editar">${icon(
                  "edit",
                  "icon-sm"
                )}</button>`
              : ""
          }
          <button class="btn btn-ghost btn-icon btn-sm" data-post-action="duplicate" data-post-id="${
            post.id
          }" title="Duplicar">${icon("copy", "icon-sm")}</button>
          <button class="btn btn-ghost btn-icon btn-sm" data-open-post="${
            post.id
          }" title="Ver detalhes">${icon("eye", "icon-sm")}</button>
        </div>
      </td>
    </tr>
  `;
}

function bindPostActions(root) {
  root.querySelectorAll("[data-post-action]").forEach((button) => {
    button.addEventListener("click", async (event) => {
      event.stopPropagation();
      const action = button.dataset.postAction;
      const postId = button.dataset.postId;
      if (action === "edit") {
        state.composer = null;
        navigate("composer", { postId });
        return;
      }
      if (action === "duplicate") {
        setButtonLoading(button, true);
        try {
          const result = await api(`/posts/${postId}/duplicate`, {
            method: "POST"
          });
          toast("Publicação duplicada como rascunho.");
          state.composer = null;
          navigate("composer", { postId: result.data.id });
        } catch (error) {
          toast(error.message, "error");
        } finally {
          setButtonLoading(button, false);
        }
      }
    });
  });
}

async function openPostDetail(postId) {
  showModal(
    `<div class="modal-body"><div class="boot-screen" style="min-height:300px">${icon(
      "posts",
      "icon-lg"
    )}<div class="boot-spinner"></div><p>Carregando detalhes…</p></div></div>`,
    "modal-lg"
  );
  try {
    const result = await api(`/posts/${postId}`);
    paintPostDetail(result.data);
  } catch (error) {
    closeModal();
    toast(error.message, "error");
  }
}

function paintPostDetail(post) {
  const firstMedia = post.targets.flatMap((target) => target.media || [])[0];
  const editable = ["draft", "scheduled", "failed", "cancelled"].includes(
    post.status
  );
  modalRoot.querySelector(".modal").innerHTML = `
    <div class="modal-header">
      <div>
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:6px">${statusBadge(
          post.status
        )}${postPlatforms(post)}</div>
        <h2>Detalhes da publicação</h2>
        <p>ID ${escapeHtml(post.id)}</p>
      </div>
      <button class="btn btn-ghost btn-icon btn-sm" data-close-modal aria-label="Fechar">${icon(
        "x",
        "icon-sm"
      )}</button>
    </div>
    <div class="modal-body">
      <div class="post-detail-grid">
        <div class="post-detail-media">${
          firstMedia
            ? `<img src="${escapeAttribute(firstMedia.fileUrl)}" alt="" />`
            : `<div class="empty-state" style="min-height:100%"><span class="empty-state-icon">${icon(
                "posts"
              )}</span></div>`
        }</div>
        <div>
          <p class="eyebrow">Conteúdo base</p>
          <div class="post-detail-caption">${escapeHtml(
            post.baseCaption || "Sem legenda"
          )}</div>
          <div class="field-row">
            <div class="field"><span class="field-label">Programada</span><span class="subtle" style="font-size:11px">${formatDateTime(
              post.scheduledAt
            )}</span></div>
            <div class="field"><span class="field-label">Publicada</span><span class="subtle" style="font-size:11px">${formatDateTime(
              post.publishedAt
            )}</span></div>
          </div>
        </div>
      </div>
      <div class="separator" style="margin:20px 0"></div>
      <h3 class="card-title">Resultado por canal</h3>
      <div class="target-results">
        ${post.targets.map((target) => targetResultMarkup(post, target)).join("")}
      </div>
      ${
        post.attempts?.length
          ? `
            <details style="margin-top:18px">
              <summary class="text-link" style="cursor:pointer">${post.attempts.length} tentativa(s) registrada(s)</summary>
              <div class="target-results" style="margin-top:10px">${post.attempts
                .slice(0, 8)
                .map(
                  (attempt) => `
                    <div class="target-result">
                      <span class="empty-state-icon" style="width:34px;height:34px;border-radius:10px">${icon(
                        attempt.result === "success" ? "success" : "alert",
                        "icon-sm"
                      )}</span>
                      <span class="target-result-copy"><strong>Tentativa ${
                        attempt.attemptNumber
                      } · ${escapeHtml(
                        attempt.result === "success" ? "Sucesso" : "Falha"
                      )}</strong><span>${formatDateTime(
                        attempt.startedAt
                      )}${
                        attempt.friendlyError
                          ? ` · ${escapeHtml(attempt.friendlyError)}`
                          : ""
                      }</span></span>
                    </div>
                  `
                )
                .join("")}</div>
            </details>
          `
          : ""
      }
    </div>
    <div class="modal-footer">
      ${
        editable
          ? `<button class="btn btn-secondary" data-detail-edit>${icon(
              "edit",
              "icon-sm"
            )} Editar</button>`
          : ""
      }
      <button class="btn btn-secondary" data-detail-duplicate>${icon(
        "copy",
        "icon-sm"
      )} Duplicar</button>
      ${
        ["draft", "scheduled", "failed", "cancelled"].includes(post.status)
          ? `<button class="btn btn-secondary" data-detail-publish>${icon(
              "send",
              "icon-sm"
            )} Publicar agora</button>`
          : ""
      }
      ${
        ["draft", "scheduled", "failed"].includes(post.status)
          ? `<button class="btn btn-danger" data-detail-cancel>${icon(
              "x",
              "icon-sm"
            )} Cancelar</button>`
          : ""
      }
    </div>
  `;
  modalRoot
    .querySelector("[data-close-modal]")
    ?.addEventListener("click", closeModal);
  modalRoot.querySelector("[data-detail-edit]")?.addEventListener("click", () => {
    closeModal();
    state.composer = null;
    navigate("composer", { postId: post.id });
  });
  modalRoot
    .querySelector("[data-detail-duplicate]")
    ?.addEventListener("click", async (event) => {
      const button = event.currentTarget;
      setButtonLoading(button, true);
      try {
        const result = await api(`/posts/${post.id}/duplicate`, {
          method: "POST"
        });
        closeModal();
        toast("Publicação duplicada como rascunho.");
        state.composer = null;
        navigate("composer", { postId: result.data.id });
      } catch (error) {
        toast(error.message, "error");
        setButtonLoading(button, false);
      }
    });
  modalRoot
    .querySelector("[data-detail-publish]")
    ?.addEventListener("click", async () => {
      const confirmed = await confirmAction({
        title: "Publicar agora?",
        message:
          "O agendamento atual será substituído e cada canal será enviado imediatamente.",
        confirmLabel: "Publicar agora",
        iconName: "send"
      });
      if (!confirmed) return;
      try {
        await api(`/posts/${post.id}/publish-now`, { method: "POST" });
        closeModal();
        toast("Publicação enviada para processamento.");
        if (state.route === "posts") renderPostsPage();
      } catch (error) {
        toast(error.message, "error");
      }
    });
  modalRoot
    .querySelector("[data-detail-cancel]")
    ?.addEventListener("click", async () => {
      const confirmed = await confirmAction({
        title: "Cancelar publicação?",
        message:
          "Os jobs pendentes serão removidos da fila. O conteúdo continuará disponível no histórico.",
        confirmLabel: "Cancelar publicação",
        danger: true
      });
      if (!confirmed) return;
      try {
        await api(`/posts/${post.id}/cancel`, { method: "POST" });
        closeModal();
        toast("Agendamento cancelado.");
        if (state.route === "posts") renderPostsPage();
        if (state.route === "calendar") renderCalendar();
      } catch (error) {
        toast(error.message, "error");
      }
    });
  modalRoot.querySelectorAll("[data-retry-target]").forEach((button) => {
    button.addEventListener("click", async () => {
      setButtonLoading(button, true, "Reenviando…");
      try {
        await api(`/posts/${post.id}/retry/${button.dataset.retryTarget}`, {
          method: "POST"
        });
        toast("Canal reenviado para a fila.");
        const updated = await api(`/posts/${post.id}`);
        paintPostDetail(updated.data);
      } catch (error) {
        toast(error.message, "error");
        setButtonLoading(button, false);
      }
    });
  });
}

function targetResultMarkup(post, target) {
  return `
    <div class="target-result">
      ${platformBadge(target.platform)}
      <span class="target-result-copy">
        <strong>${escapeHtml(target.channelName)}</strong>
        <span>${statusLabels[target.status] || target.status} · ${
          target.attemptCount
        } tentativa(s)${
          target.publishedAt ? ` · ${formatDateTime(target.publishedAt)}` : ""
        }</span>
        ${
          target.friendlyError
            ? `<span class="error-box">${icon(
                "alert",
                "icon-sm"
              )}<span>${escapeHtml(target.friendlyError)}</span></span>`
            : ""
        }
      </span>
      <span style="display:flex;gap:5px">
        ${
          target.status === "failed"
            ? `<button class="btn btn-secondary btn-sm" data-retry-target="${target.id}">${icon(
                "refresh",
                "icon-sm"
              )} Repetir</button>`
            : ""
        }
        ${
          target.externalUrl
            ? `<a class="btn btn-ghost btn-icon btn-sm" href="${escapeAttribute(
                target.externalUrl
              )}" target="_blank" rel="noopener noreferrer" title="Abrir na rede">${icon(
                "external",
                "icon-sm"
              )}</a>`
            : ""
        }
      </span>
    </div>
  `;
}

async function renderMediaPage() {
  const result = await api("/media?limit=60");
  state.mediaCache = result.data;
  const content = document.querySelector("#page-content");
  content.innerHTML = `
    ${pageHeader({
      eyebrow: "Arquivos reutilizáveis",
      title: "Biblioteca de mídia",
      description:
        "Organize imagens e vídeos e reutilize-os em novas publicações.",
      actions: `<button class="btn btn-primary" data-media-upload-button>${icon(
        "upload",
        "icon-sm"
      )} Enviar arquivo</button>`
    })}
    <div class="media-layout">
      <section>
        <div class="card filter-bar">
          <div class="input-wrap filter-search">${icon(
            "search",
            "icon-sm"
          )}<input class="input" data-media-search placeholder="Buscar pelo nome do arquivo…" /></div>
          <select class="select" data-media-type>
            <option value="">Todos os tipos</option>
            <option value="image">Imagens</option>
            <option value="video">Vídeos</option>
          </select>
        </div>
        <div data-media-results>
          ${mediaGridMarkup(state.mediaCache)}
        </div>
      </section>
      <aside class="card upload-panel">
        <span class="empty-state-icon">${icon("upload")}</span>
        <h3 style="margin-top:12px">Adicionar à biblioteca</h3>
        <p>Arraste um arquivo abaixo. Validamos o formato real, tamanho e dimensões antes de disponibilizá-lo.</p>
        <label class="media-drop" data-library-drop>
          ${icon("image", "icon-lg")}
          <strong>Solte o arquivo aqui</strong>
          <span>ou clique para escolher</span>
          <input class="sr-only" type="file" data-library-upload accept="image/jpeg,image/png,image/webp,image/gif,video/mp4" />
        </label>
        <div class="upload-progress" data-upload-progress hidden>
          <span class="field-hint" data-upload-label>Preparando upload…</span>
          <div class="progress-track"><div class="progress-bar" data-upload-bar style="width:0"></div></div>
        </div>
        <div class="analytics-notice">${icon(
          "info",
          "icon-sm"
        )}<span>Formatos: JPG, PNG, WEBP, GIF e MP4. O arquivo original fica protegido por sessão.</span></div>
      </aside>
    </div>
  `;
  bindMediaPage(content);
}

function mediaGridMarkup(media) {
  if (!media.length) {
    return `<div class="card empty-state"><span class="empty-state-icon">${icon(
      "media"
    )}</span><h3>Biblioteca vazia</h3><p>Envie a primeira imagem ou vídeo para começar.</p></div>`;
  }
  return `
    <div class="media-grid">
      ${media
        .map(
          (item) => `
            <article class="media-card" data-open-media="${item.id}">
              <div class="media-card-visual">
                <img src="${escapeAttribute(item.thumbnailUrl)}" alt="${escapeAttribute(
                  item.originalName
                )}" loading="lazy" />
                <span class="media-card-type">${icon(
                  item.mediaType === "video" ? "video" : "image",
                  "icon-sm"
                )} ${item.mediaType === "video" ? "VÍDEO" : "IMAGEM"}</span>
              </div>
              <div class="media-card-copy">
                <div class="media-card-name">${escapeHtml(
                  item.originalName
                )}</div>
                <div class="media-card-meta">${bytesLabel(item.sizeBytes)} · ${formatDate(
                  item.createdAt,
                  { short: true }
                )}</div>
              </div>
            </article>
          `
        )
        .join("")}
    </div>
  `;
}

function bindMediaPage(content) {
  const fileInput = content.querySelector("[data-library-upload]");
  const drop = content.querySelector("[data-library-drop]");
  content
    .querySelector("[data-media-upload-button]")
    ?.addEventListener("click", () => fileInput.click());
  fileInput?.addEventListener("change", () => {
    if (fileInput.files[0]) uploadLibraryFile(fileInput.files[0]);
  });
  drop?.addEventListener("dragover", (event) => {
    event.preventDefault();
    drop.classList.add("drag-over");
  });
  drop?.addEventListener("dragleave", () => drop.classList.remove("drag-over"));
  drop?.addEventListener("drop", (event) => {
    event.preventDefault();
    drop.classList.remove("drag-over");
    if (event.dataTransfer.files[0])
      uploadLibraryFile(event.dataTransfer.files[0]);
  });
  let searchTimer;
  const filter = () => {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(async () => {
      const search = content.querySelector("[data-media-search]").value.trim();
      const type = content.querySelector("[data-media-type]").value;
      const params = new URLSearchParams({ limit: "60" });
      if (search) params.set("search", search);
      if (type) params.set("type", type);
      try {
        const result = await api(`/media?${params}`);
        state.mediaCache = result.data;
        content.querySelector("[data-media-results]").innerHTML =
          mediaGridMarkup(result.data);
        bindMediaOpeners(content);
      } catch (error) {
        toast(error.message, "error");
      }
    }, 280);
  };
  content.querySelector("[data-media-search]")?.addEventListener("input", filter);
  content.querySelector("[data-media-type]")?.addEventListener("change", filter);
  bindMediaOpeners(content);
}

function bindMediaOpeners(root) {
  root.querySelectorAll("[data-open-media]").forEach((card) => {
    card.addEventListener("click", () => {
      const media = state.mediaCache.find(
        (item) => item.id === card.dataset.openMedia
      );
      if (media) openMediaDetail(media);
    });
  });
}

function uploadFileWithProgress(file, onProgress) {
  return new Promise((resolve, reject) => {
    const form = new FormData();
    form.append("file", file);
    const request = new XMLHttpRequest();
    request.open("POST", "/api/media/upload");
    request.responseType = "json";
    request.setRequestHeader("Accept", "application/json");
    const csrf = getCookie("correiro_csrf");
    if (csrf) request.setRequestHeader("X-CSRF-Token", csrf);
    request.upload.addEventListener("progress", (event) => {
      if (event.lengthComputable) {
        onProgress(Math.round((event.loaded / event.total) * 100));
      }
    });
    request.addEventListener("load", () => {
      const payload = request.response;
      if (request.status >= 200 && request.status < 300 && payload?.ok) {
        resolve(payload);
      } else {
        reject(
          new Error(
            payload?.error?.message || "Não foi possível enviar o arquivo."
          )
        );
      }
    });
    request.addEventListener("error", () =>
      reject(new Error("A conexão foi interrompida durante o upload."))
    );
    request.send(form);
  });
}

async function uploadLibraryFile(file) {
  const progress = document.querySelector("[data-upload-progress]");
  const label = document.querySelector("[data-upload-label]");
  const bar = document.querySelector("[data-upload-bar]");
  if (progress) progress.hidden = false;
  if (label) label.textContent = `Enviando ${file.name}…`;
  try {
    const result = await uploadFileWithProgress(file, (percent) => {
      if (bar) bar.style.width = `${percent}%`;
      if (label) label.textContent = `Enviando ${file.name} · ${percent}%`;
    });
    if (label) label.textContent = "Processando miniatura…";
    state.mediaCache = [result.data, ...(state.mediaCache || [])];
    document.querySelector("[data-media-results]").innerHTML =
      mediaGridMarkup(state.mediaCache);
    bindMediaOpeners(document);
    if (bar) bar.style.width = "100%";
    toast("Arquivo disponível na biblioteca.");
    window.setTimeout(() => {
      if (progress) progress.hidden = true;
      if (bar) bar.style.width = "0";
    }, 1200);
  } catch (error) {
    if (progress) progress.hidden = true;
    toast(error.message, "error");
  }
}

function openMediaDetail(media) {
  showModal(`
    <div class="modal-header">
      <div><h2>${escapeHtml(media.originalName)}</h2><p>${bytesLabel(
        media.sizeBytes
      )} · ${media.width || "—"} × ${media.height || "—"}</p></div>
      <button class="btn btn-ghost btn-icon btn-sm" data-close-modal>${icon(
        "x",
        "icon-sm"
      )}</button>
    </div>
    <div class="modal-body">
      <div style="display:grid;place-items:center;min-height:300px;background:#f2f1f7;border-radius:14px;overflow:hidden">
        ${
          media.mediaType === "video"
            ? `<video src="${escapeAttribute(
                media.fileUrl
              )}" controls style="width:100%;max-height:520px"></video>`
            : `<img src="${escapeAttribute(
                media.fileUrl
              )}" alt="${escapeAttribute(
                media.originalName
              )}" style="width:100%;max-height:520px;object-fit:contain" />`
        }
      </div>
      <div class="field-row" style="margin-top:16px">
        <div class="field"><span class="field-label">Tipo</span><span class="subtle" style="font-size:11px">${escapeHtml(
          media.mimeType
        )}</span></div>
        <div class="field"><span class="field-label">Enviado em</span><span class="subtle" style="font-size:11px">${formatDateTime(
          media.createdAt
        )}</span></div>
      </div>
    </div>
    <div class="modal-footer">
      <button class="btn btn-danger" data-delete-media>${icon(
        "trash",
        "icon-sm"
      )} Excluir</button>
      <button class="btn btn-primary" data-use-media>${icon(
        "plus",
        "icon-sm"
      )} Criar publicação</button>
    </div>
  `);
  modalRoot.querySelector("[data-use-media]").addEventListener("click", () => {
    closeModal();
    state.composer = newComposerModel();
    state.composer.sharedMedia = [media];
    navigate("composer");
  });
  modalRoot.querySelector("[data-delete-media]").addEventListener("click", async () => {
    const confirmed = await confirmAction({
      title: "Excluir esta mídia?",
      message:
        "O arquivo será removido da biblioteca. Mídias em uso não podem ser excluídas.",
      confirmLabel: "Excluir mídia",
      danger: true,
      iconName: "trash"
    });
    if (!confirmed) return;
    try {
      await api(`/media/${media.id}`, { method: "DELETE" });
      toast("Mídia excluída.");
      if (state.route === "media") renderMediaPage();
    } catch (error) {
      toast(error.message, "error");
    }
  });
}

async function renderAnalyticsPage() {
  const selectedPeriod =
    document.querySelector("[data-analytics-period]")?.value || "30d";
  const result = await api(`/analytics/summary?period=${selectedPeriod}`);
  const data = result.data;
  const content = document.querySelector("#page-content");
  const maxReach = Math.max(
    1,
    ...data.byPlatform.map((item) => item.reach)
  );
  const maxEngagement = Math.max(
    1,
    ...data.byPlatform.map((item) => item.engagement)
  );
  content.innerHTML = `
    ${pageHeader({
      eyebrow: "Desempenho",
      title: "Analytics",
      description:
        "Métricas essenciais devolvidas pelas APIs oficiais da Meta.",
      actions: `<select class="select" data-analytics-period><option value="7d" ${
        selectedPeriod === "7d" ? "selected" : ""
      }>Últimos 7 dias</option><option value="30d" ${
        selectedPeriod === "30d" ? "selected" : ""
      }>Últimos 30 dias</option></select>`
    })}
    <section class="analytics-hero">
      ${metricCard("eye", "Alcance total", data.totals.reach, `${data.totals.impressions.toLocaleString(
        "pt-BR"
      )} impressões`)}
      ${metricCard("heart", "Engajamentos", data.totals.engagement, `${data.totals.likes.toLocaleString(
        "pt-BR"
      )} curtidas · ${data.totals.comments.toLocaleString("pt-BR")} comentários`)}
      ${metricCard("success", "Publicações concluídas", data.totals.published, `${data.totals.failed} falha(s) · ${data.totals.partial} parcial(is)`)}
    </section>
    <section class="analytics-grid">
      <article class="card">
        <div class="card-header">
          <div><h2 class="card-title">Comparação por plataforma</h2><p class="card-description">Alcance e engajamento acumulados no período.</p></div>
        </div>
        <div class="card-body platform-comparison">
          ${
            data.byPlatform.length
              ? `
                <p class="eyebrow" style="margin-bottom:0">Alcance</p>
                ${data.byPlatform
                  .map((item) =>
                    platformBar(item, item.reach, maxReach)
                  )
                  .join("")}
                <div class="separator"></div>
                <p class="eyebrow" style="margin-bottom:0">Engajamento</p>
                ${data.byPlatform
                  .map((item) =>
                    platformBar(item, item.engagement, maxEngagement)
                  )
                  .join("")}
              `
              : `<div class="empty-state"><span class="empty-state-icon">${icon(
                  "analytics"
                )}</span><h3>Ainda não há métricas</h3><p>Elas aparecerão depois que as primeiras publicações forem concluídas.</p></div>`
          }
        </div>
      </article>
      <article class="card">
        <div class="card-header">
          <div><h2 class="card-title">Melhores publicações</h2><p class="card-description">Ordenadas por engajamento.</p></div>
        </div>
        ${
          data.topPosts.length
            ? `<div class="top-post-list">${data.topPosts
                .map(
                  (post, index) => `
                    <div class="top-post-item" data-open-post="${post.id}">
                      <span class="top-post-rank">${index + 1}</span>
                      <span class="top-post-copy"><strong>${escapeHtml(
                        post.caption || "Sem legenda"
                      )}</strong><span>${platformBadge(
                        post.platform
                      )} ${escapeHtml(post.channelName)}</span></span>
                      <span class="top-post-result"><strong>${compactNumber(
                        post.engagement
                      )}</strong><span>interações</span></span>
                    </div>
                  `
                )
                .join("")}</div>`
            : `<div class="empty-state" style="min-height:260px"><span class="empty-state-icon">${icon(
                "trend"
              )}</span><p>Publique conteúdo para comparar resultados.</p></div>`
        }
      </article>
    </section>
    <div class="analytics-notice">${icon(
      "info",
      "icon-sm"
    )}<span>${escapeHtml(data.notice)} Última sincronização: ${formatDateTime(
      data.lastSyncedAt
    )}.</span></div>
  `;
  content
    .querySelector("[data-analytics-period]")
    ?.addEventListener("change", renderAnalyticsPage);
  bindPostOpeners(content);
}

function metricCard(iconName, label, value, foot) {
  return `
    <article class="card metric-card">
      <div class="metric-label"><span>${escapeHtml(label)}</span><span class="stat-icon">${icon(
        iconName,
        "icon-sm"
      )}</span></div>
      <strong class="metric-value">${compactNumber(value)}</strong>
      <span class="metric-foot">${escapeHtml(foot)}</span>
    </article>
  `;
}

function platformBar(item, value, max) {
  return `
    <div class="platform-bar-row">
      <span class="platform-bar-label">${platformBadge(
        item.platform
      )} ${item.platform === "facebook" ? "Facebook" : "Instagram"}</span>
      <span class="bar-track"><span class="bar-fill ${
        item.platform
      }" style="width:${Math.max(2, (value / max) * 100)}%"></span></span>
      <span class="platform-bar-value">${compactNumber(value)}</span>
    </div>
  `;
}

async function renderChannelsPage() {
  const [result, providerResult] = await Promise.all([
    api("/channels"),
    api("/channels/providers")
  ]);
  state.channels = result.data;
  const providers = providerResult.data;
  const content = document.querySelector("#page-content");
  const query = new URLSearchParams(window.location.search);
  const metaStatus = query.get("meta");
  const composioStatus = query.get("composio");
  if (metaStatus === "connected") {
    toast(`${query.get("count") || 0} canal(is) conectado(s) pela Meta.`);
  } else if (metaStatus === "error") {
    toast(query.get("message") || "A conexão com a Meta não foi concluída.", "error");
  }
  if (composioStatus === "connected") {
    const platform =
      query.get("platform") === "instagram" ? "Instagram" : "Facebook";
    toast(
      `${query.get("count") || 0} canal(is) do ${platform} conectado(s) pelo Composio.`
    );
  } else if (composioStatus === "error") {
    toast(
      query.get("message") ||
        "A conexão pelo Composio não foi concluída.",
      "error"
    );
  }
  if (metaStatus || composioStatus) {
    window.history.replaceState({}, "", "/?route=channels");
  }
  content.innerHTML = `
    ${pageHeader({
      eyebrow: "Integrações",
      title: "Canais conectados",
      description:
        "Gerencie Páginas do Facebook e contas profissionais do Instagram.",
      actions: `<button class="btn btn-primary" data-open-connect>${icon(
        "plus",
        "icon-sm"
      )} Conectar canais</button>`
    })}
    <section class="channels-grid">
      ${state.channels.map(channelCard).join("")}
      <article class="connect-card">
        <div class="connect-logos">${platformBadge(
          "facebook"
        )}<span class="connect-plus">+</span>${platformBadge(
          "instagram"
        )}</div>
        <h3>Adicionar canais da Meta</h3>
        <p>Escolha OAuth gerenciado pelo Composio ou conecte seu próprio aplicativo da Meta.</p>
        <div class="connect-actions">
          <button class="btn btn-primary btn-sm" data-open-connect>${icon(
            "channels",
            "icon-sm"
          )} Escolher conexão</button>
        </div>
      </article>
    </section>
    <div class="analytics-notice">${icon(
      "lock",
      "icon-sm"
    )}<span>Composio: os tokens ficam armazenados e são renovados pelo provedor; o Correiro salva somente o identificador da conexão. Meta direta: os tokens continuam criptografados no banco local.</span></div>
  `;
  content.querySelectorAll("[data-open-connect]").forEach((button) => {
    button.addEventListener("click", () => {
      showConnectionProviderModal(providers);
    });
  });
  content.querySelectorAll("[data-channel-disconnect]").forEach((button) => {
    button.addEventListener("click", async () => {
      const confirmed = await confirmAction({
        title: "Desconectar canal?",
        message:
          "Novos agendamentos serão bloqueados para este canal. Publicações já concluídas permanecem no histórico.",
        confirmLabel: "Desconectar",
        danger: true,
        iconName: "channels"
      });
      if (!confirmed) return;
      try {
        await api(`/channels/${button.dataset.channelDisconnect}`, {
          method: "DELETE"
        });
        toast("Canal desconectado.");
        await renderChannelsPage();
      } catch (error) {
        toast(error.message, "error");
      }
    });
  });
  content.querySelectorAll("[data-channel-reconnect]").forEach((button) => {
    button.addEventListener("click", async () => {
      const channel = state.channels.find(
        (item) => item.id === button.dataset.channelReconnect
      );
      if (!channel) return;
      setButtonLoading(button, true, "Reconectando…");
      try {
        if (channel.connectionProvider === "composio") {
          const connection = await api(
            `/channels/composio/url?platform=${encodeURIComponent(
              channel.platform
            )}`
          );
          window.location.assign(connection.data.url);
        } else if (channel.isDemo || channel.connectionProvider === "demo") {
          await api(`/channels/${channel.id}/reconnect`, { method: "POST" });
          toast("Canal de demonstração reconectado.");
          await renderChannelsPage();
        } else {
          const connection = await api("/channels/meta/url");
          window.location.assign(connection.data.url);
        }
      } catch (error) {
        toast(error.message, "error");
        setButtonLoading(button, false);
      }
    });
  });
}

function channelCard(channel) {
  const requiresReconnect = channel.status !== "connected";
  const connectionProvider =
    channel.connectionProvider || (channel.isDemo ? "demo" : "direct");
  const providerNames = {
    composio: "Composio",
    direct: "Meta direta",
    demo: "Demonstração"
  };
  const credentialStatus =
    connectionProvider === "composio"
      ? "Gerenciadas pelo Composio"
      : connectionProvider === "demo"
        ? "Canal fictício"
        : channel.tokenExpiresAt
          ? `Expira ${relativeTime(channel.tokenExpiresAt)}`
          : "Expiração não informada";
  return `
    <article class="card channel-card">
      <div class="channel-card-top">
        ${avatar(channel, "lg")}
        <div class="channel-card-copy">
          <div class="channel-card-title">
            ${platformBadge(channel.platform)}
            <h3>${escapeHtml(channel.name)}</h3>
            ${statusBadge(channel.status)}
            <span class="provider-chip provider-${escapeAttribute(
              connectionProvider
            )}">${escapeHtml(
              providerNames[connectionProvider] || "Meta direta"
            )}</span>
          </div>
          <p>${
            channel.platform === "instagram"
              ? `@${escapeHtml(channel.username || "conta profissional")} · ${escapeHtml(
                  channel.accountType || "professional"
                )}`
              : `Página do Facebook · ID ${escapeHtml(channel.externalId)}`
          }</p>
        </div>
      </div>
      <div class="channel-card-info">
        <div class="channel-info-item"><span>Última sincronização</span><strong>${formatDateTime(
          channel.lastSyncedAt
        )}</strong></div>
        <div class="channel-info-item"><span>Credenciais</span><strong>${escapeHtml(
          credentialStatus
        )}</strong></div>
      </div>
      <div class="channel-permissions">
        ${(channel.permissions || [])
          .slice(0, 5)
          .map(
            (permission) =>
              `<span class="permission-chip">${escapeHtml(permission)}</span>`
          )
          .join("")}
      </div>
      ${
        channel.statusMessage
          ? `<div class="error-box">${icon(
              "alert",
              "icon-sm"
            )}<span>${escapeHtml(channel.statusMessage)}</span></div>`
          : ""
      }
      <div class="channel-card-actions">
        ${
          requiresReconnect
            ? `<button class="btn btn-primary btn-sm" data-channel-reconnect="${channel.id}">${icon(
                "refresh",
                "icon-sm"
              )} Reconectar</button>`
            : ""
        }
        <button class="btn btn-ghost btn-sm" data-channel-disconnect="${
          channel.id
        }">${icon("logout", "icon-sm")} Desconectar</button>
      </div>
    </article>
  `;
}

function showConnectionProviderModal(providers) {
  const composioReady = Boolean(providers.composio?.configured);
  const directReady = Boolean(providers.direct?.configured);
  const demoReady = Boolean(providers.demo?.configured);
  showModal(
    `
      <div class="modal-header">
        <div>
          <h2>Como deseja conectar?</h2>
          <p>Você pode trocar de provedor depois reconectando o canal.</p>
        </div>
        <button class="btn btn-ghost btn-icon btn-sm" data-close-modal aria-label="Fechar">${icon(
          "x",
          "icon-sm"
        )}</button>
      </div>
      <div class="modal-body">
        <div class="provider-choice-list">
          <article class="provider-choice provider-choice-featured">
            <div class="provider-choice-heading">
              <span class="provider-choice-icon">${icon("lock")}</span>
              <div>
                <div class="provider-choice-title">
                  <h3>Composio</h3>
                  <span class="provider-recommended">Recomendado</span>
                </div>
                <p>OAuth hospedado e tokens gerenciados. Você só configura <code>COMPOSIO_API_KEY</code>, sem App ID ou App Secret da Meta.</p>
              </div>
            </div>
            <div class="provider-platform-actions">
              <button class="btn btn-primary btn-sm" data-connect-composio="facebook" ${
                composioReady ? "" : "disabled"
              }>${platformBadge("facebook")} Conectar Facebook</button>
              <button class="btn btn-primary btn-sm" data-connect-composio="instagram" ${
                composioReady ? "" : "disabled"
              }>${platformBadge("instagram")} Conectar Instagram</button>
            </div>
            <small>${
              composioReady
                ? "Facebook e Instagram usam autorizações separadas no Composio."
                : "Adicione COMPOSIO_API_KEY ao ambiente do servidor para habilitar."
            }</small>
          </article>

          <article class="provider-choice">
            <div class="provider-choice-heading">
              <span class="provider-choice-icon">${icon("settings")}</span>
              <div>
                <div class="provider-choice-title"><h3>Meta direta</h3><span class="provider-advanced">Avançado</span></div>
                <p>Usa seu próprio aplicativo da Meta e armazena os tokens criptografados no Correiro.</p>
              </div>
            </div>
            <button class="btn btn-secondary btn-sm provider-main-action" data-connect-direct ${
              directReady ? "" : "disabled"
            }>${icon("external", "icon-sm")} Autorizar na Meta</button>
            <small>${
              directReady
                ? "META_APP_ID e META_APP_SECRET estão configurados."
                : "Configure META_APP_ID e META_APP_SECRET para habilitar."
            }</small>
          </article>

          <article class="provider-choice provider-choice-compact">
            <div class="provider-choice-heading">
              <span class="provider-choice-icon">${icon("play")}</span>
              <div>
                <div class="provider-choice-title"><h3>Demonstração</h3></div>
                <p>Adiciona canais fictícios para testar agendamento e falhas sem publicar.</p>
              </div>
            </div>
            <button class="btn btn-ghost btn-sm provider-main-action" data-connect-demo ${
              demoReady ? "" : "disabled"
            }>${icon("plus", "icon-sm")} Adicionar canais demo</button>
          </article>
        </div>
      </div>
      <div class="modal-footer">
        <button class="btn btn-secondary" data-close-modal>Fechar</button>
      </div>
    `,
    "modal-lg"
  );

  modalRoot
    .querySelectorAll("[data-connect-composio]")
    .forEach((button) => {
      button.addEventListener("click", async () => {
        setButtonLoading(button, true, "Abrindo Composio…");
        try {
          const connection = await api(
            `/channels/composio/url?platform=${encodeURIComponent(
              button.dataset.connectComposio
            )}`
          );
          window.location.assign(connection.data.url);
        } catch (error) {
          toast(error.message, "error");
          setButtonLoading(button, false);
        }
      });
    });

  modalRoot
    .querySelector("[data-connect-direct]")
    ?.addEventListener("click", async (event) => {
      const button = event.currentTarget;
      setButtonLoading(button, true, "Abrindo Meta…");
      try {
        const connection = await api("/channels/meta/url");
        window.location.assign(connection.data.url);
      } catch (error) {
        toast(error.message, "error");
        setButtonLoading(button, false);
      }
    });

  modalRoot
    .querySelector("[data-connect-demo]")
    ?.addEventListener("click", async (event) => {
      const button = event.currentTarget;
      setButtonLoading(button, true, "Conectando…");
      try {
        await api("/channels/demo", { method: "POST" });
        closeModal();
        toast("Canais de demonstração conectados.");
        await renderChannelsPage();
      } catch (error) {
        toast(error.message, "error");
        setButtonLoading(button, false);
      }
    });
}

async function renderNotificationsPage() {
  const result = await api("/notifications");
  state.unread = result.meta.unread;
  updateUnreadUi();
  const notifications = result.data;
  const content = document.querySelector("#page-content");
  content.innerHTML = `
    ${pageHeader({
      eyebrow: "Atualizações",
      title: "Notificações",
      description:
        "Falhas, publicações concluídas e mudanças importantes nas conexões.",
      actions: state.unread
        ? `<button class="btn btn-secondary" data-read-all>${icon(
            "check",
            "icon-sm"
          )} Marcar todas como lidas</button>`
        : ""
    })}
    <section class="card notification-list">
      ${
        notifications.length
          ? notifications.map(notificationMarkup).join("")
          : `<div class="empty-state"><span class="empty-state-icon">${icon(
              "bell"
            )}</span><h3>Tudo em dia</h3><p>Novas atualizações aparecerão aqui.</p></div>`
      }
    </section>
  `;
  content.querySelector("[data-read-all]")?.addEventListener("click", async () => {
    try {
      await api("/notifications/read-all", { method: "PATCH" });
      state.unread = 0;
      updateUnreadUi();
      renderNotificationsPage();
    } catch (error) {
      toast(error.message, "error");
    }
  });
  content.querySelectorAll("[data-notification-id]").forEach((item) => {
    item.addEventListener("click", async () => {
      if (item.classList.contains("unread")) {
        await api(`/notifications/${item.dataset.notificationId}/read`, {
          method: "PATCH"
        }).catch(() => {});
        state.unread = Math.max(0, state.unread - 1);
        updateUnreadUi();
      }
      if (
        item.dataset.relatedType === "post" &&
        item.dataset.relatedId &&
        item.dataset.relatedId !== "null"
      ) {
        openPostDetail(item.dataset.relatedId);
      } else if (
        ["channel_disconnected", "token_expired", "permission_revoked"].includes(
          item.dataset.notificationType
        )
      ) {
        navigate("channels");
      }
    });
  });
}

function notificationMarkup(item) {
  const iconName =
    item.type === "published"
      ? "success"
      : ["failed", "partially_published", "token_expired"].includes(item.type)
        ? "alert"
        : "info";
  return `
    <article class="notification-item ${item.readAt ? "" : "unread"}" data-notification-id="${
      item.id
    }" data-notification-type="${item.type}" data-related-type="${escapeAttribute(
      item.relatedType || ""
    )}" data-related-id="${escapeAttribute(item.relatedId || "")}">
      <span class="notification-icon ${item.type}">${icon(
        iconName,
        "icon-sm"
      )}</span>
      <div class="notification-copy">
        <h3>${item.readAt ? "" : '<span class="unread-marker"></span>'}${escapeHtml(
          item.title
        )}</h3>
        <p>${escapeHtml(item.message)}</p>
      </div>
      <time class="notification-time">${relativeTime(item.createdAt)}</time>
    </article>
  `;
}

async function renderSettingsPage() {
  const workspaceResult = await api("/workspaces/current");
  state.workspace = workspaceResult.data;
  const content = document.querySelector("#page-content");
  content.innerHTML = `
    ${pageHeader({
      eyebrow: "Preferências",
      title: "Configurações",
      description:
        "Gerencie seu perfil, workspace, segurança e controles de privacidade."
    })}
    <div class="settings-layout">
      <nav class="card settings-nav">
        <button class="settings-link active" data-settings-target="profile">${icon(
          "user",
          "icon-sm"
        )} Perfil</button>
        <button class="settings-link" data-settings-target="workspace">${icon(
          "settings",
          "icon-sm"
        )} Workspace</button>
        <button class="settings-link" data-settings-target="security">${icon(
          "lock",
          "icon-sm"
        )} Segurança</button>
        <button class="settings-link" data-settings-target="privacy">${icon(
          "admin",
          "icon-sm"
        )} Dados e privacidade</button>
      </nav>
      <div class="settings-panels">
        <section class="card settings-panel" data-settings-panel="profile">
          <div class="card-header"><div><h2 class="card-title">Seu perfil</h2><p class="card-description">Como você aparece no workspace.</p></div>${avatar(
            state.user,
            "lg"
          )}</div>
          <form data-profile-form>
            <div class="settings-form">
              <div class="field"><label for="profile-name">Nome</label><input class="input" id="profile-name" name="name" value="${escapeAttribute(
                state.user.name
              )}" required /></div>
              <div class="field"><label for="profile-email">E-mail</label><input class="input" id="profile-email" value="${escapeAttribute(
                state.user.email
              )}" disabled /><p class="field-hint">O e-mail confirmado não pode ser alterado nesta versão.</p></div>
              <label class="toggle"><input type="checkbox" name="notifications" ${
                state.user.emailNotificationsEnabled ? "checked" : ""
              } /><span class="toggle-switch"></span> Receber alertas críticos por e-mail</label>
            </div>
            <div class="settings-footer"><button class="btn btn-primary" type="submit">Salvar perfil</button></div>
          </form>
        </section>
        <section class="card settings-panel" data-settings-panel="workspace" hidden>
          <div class="card-header"><div><h2 class="card-title">Workspace</h2><p class="card-description">Marca, fuso horário e fila de publicação.</p></div></div>
          <form data-workspace-form>
            <div class="settings-form">
              <div class="field"><label for="workspace-name">Nome do workspace</label><input class="input" id="workspace-name" name="name" value="${escapeAttribute(
                state.workspace.name
              )}" required /></div>
              <div class="field"><label for="workspace-timezone">Fuso horário padrão</label><select class="select" id="workspace-timezone" name="timeZone">${timeZoneOptions(
                state.workspace.timeZone
              )}</select><p class="field-hint">Agendamentos são armazenados em UTC e sempre exibidos neste fuso.</p></div>
              <div class="data-action" style="padding:14px 0">
                <div class="data-action-copy"><h4>${
                  state.workspace.publishingPaused
                    ? "Fila pausada"
                    : "Publicação automática ativa"
                }</h4><p>${
                  state.workspace.publishingPaused
                    ? "Os jobs permanecem salvos e serão retomados manualmente."
                    : "Conteúdos agendados serão publicados sem confirmação adicional."
                }</p></div>
                <button class="btn ${
                  state.workspace.publishingPaused
                    ? "btn-primary"
                    : "btn-secondary"
                }" type="button" data-toggle-publishing>${
                  state.workspace.publishingPaused
                    ? icon("play", "icon-sm") + " Retomar fila"
                    : icon("pause", "icon-sm") + " Pausar fila"
                }</button>
              </div>
            </div>
            <div class="settings-footer"><button class="btn btn-primary" type="submit">Salvar workspace</button></div>
          </form>
        </section>
        <section class="card settings-panel" data-settings-panel="security" hidden>
          <div class="card-header"><div><h2 class="card-title">Alterar senha</h2><p class="card-description">As demais sessões serão encerradas.</p></div></div>
          <form data-password-form>
            <div class="settings-form">
              <div class="field"><label for="current-password">Senha atual</label><input class="input" id="current-password" name="currentPassword" type="password" autocomplete="current-password" required /></div>
              <div class="field"><label for="new-password">Nova senha</label><input class="input" id="new-password" name="newPassword" type="password" autocomplete="new-password" minlength="8" required /></div>
            </div>
            <div class="settings-footer"><button class="btn btn-primary" type="submit">Alterar senha</button></div>
          </form>
        </section>
        <section class="card settings-panel" data-settings-panel="privacy" hidden>
          <div class="card-header"><div><h2 class="card-title">Seus dados</h2><p class="card-description">Controles essenciais de privacidade e LGPD.</p></div></div>
          <div>
            <div class="data-action"><div class="data-action-copy"><h4>Exportar meus dados</h4><p>Baixe perfil, workspaces, canais e publicações em JSON.</p></div><button class="btn btn-secondary" data-export-data>${icon(
              "download",
              "icon-sm"
            )} Exportar</button></div>
            <div class="data-action"><div class="data-action-copy"><h4>Sair da conta</h4><p>Encerra apenas esta sessão neste dispositivo.</p></div><button class="btn btn-secondary" data-logout>${icon(
              "logout",
              "icon-sm"
            )} Sair</button></div>
          </div>
        </section>
        <section class="card settings-panel danger-zone" data-settings-panel="privacy" hidden>
          <div class="card-header"><div><h2 class="card-title" style="color:var(--red)">Zona de perigo</h2><p class="card-description">Esta ação não pode ser desfeita.</p></div></div>
          <div class="data-action"><div class="data-action-copy"><h4>Excluir minha conta</h4><p>Desconecta integrações, revoga sessões e anonimiza seus dados pessoais.</p></div><button class="btn btn-danger" data-delete-account>${icon(
            "trash",
            "icon-sm"
          )} Excluir conta</button></div>
        </section>
      </div>
    </div>
  `;
  bindSettings(content);
}

function bindSettings(content) {
  content.querySelectorAll("[data-settings-target]").forEach((button) => {
    button.addEventListener("click", () => {
      content
        .querySelectorAll("[data-settings-target]")
        .forEach((item) => item.classList.toggle("active", item === button));
      content.querySelectorAll("[data-settings-panel]").forEach((panel) => {
        panel.hidden =
          panel.dataset.settingsPanel !== button.dataset.settingsTarget;
      });
    });
  });
  content.querySelector("[data-profile-form]")?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const button = event.currentTarget.querySelector('button[type="submit"]');
    const form = new FormData(event.currentTarget);
    setButtonLoading(button, true, "Salvando…");
    try {
      const result = await api("/auth/profile", {
        method: "PATCH",
        body: {
          name: form.get("name"),
          emailNotificationsEnabled: form.get("notifications") === "on"
        }
      });
      state.user = { ...state.user, ...result.data };
      toast("Perfil atualizado.");
      renderShell();
      navigate("settings", {}, true);
    } catch (error) {
      toast(error.message, "error");
      setButtonLoading(button, false);
    }
  });
  content
    .querySelector("[data-workspace-form]")
    ?.addEventListener("submit", async (event) => {
      event.preventDefault();
      const button = event.currentTarget.querySelector('button[type="submit"]');
      const form = new FormData(event.currentTarget);
      setButtonLoading(button, true, "Salvando…");
      try {
        const result = await api("/workspaces/current", {
          method: "PATCH",
          body: {
            name: form.get("name"),
            timeZone: form.get("timeZone"),
            imageUrl: state.workspace.imageUrl || null
          }
        });
        state.workspace = result.data;
        toast("Workspace atualizado.");
        renderShell();
        navigate("settings", {}, true);
      } catch (error) {
        toast(error.message, "error");
        setButtonLoading(button, false);
      }
    });
  content
    .querySelector("[data-toggle-publishing]")
    ?.addEventListener("click", async (event) => {
      const button = event.currentTarget;
      const paused = !state.workspace.publishingPaused;
      if (
        paused &&
        !(await confirmAction({
          title: "Pausar todos os agendamentos?",
          message:
            "Os jobs permanecerão no banco, mas nenhum canal será enviado até a retomada manual.",
          confirmLabel: "Pausar fila",
          iconName: "pause"
        }))
      )
        return;
      setButtonLoading(button, true);
      try {
        await api("/workspaces/current/publishing", {
          method: "PATCH",
          body: { paused }
        });
        state.workspace.publishingPaused = paused;
        toast(paused ? "Fila de publicação pausada." : "Fila retomada.");
        renderShell();
        navigate("settings", {}, true);
      } catch (error) {
        toast(error.message, "error");
        setButtonLoading(button, false);
      }
    });
  content
    .querySelector("[data-password-form]")
    ?.addEventListener("submit", async (event) => {
      event.preventDefault();
      const button = event.currentTarget.querySelector('button[type="submit"]');
      const form = new FormData(event.currentTarget);
      setButtonLoading(button, true, "Alterando…");
      try {
        await api("/auth/password", {
          method: "PATCH",
          body: {
            currentPassword: form.get("currentPassword"),
            newPassword: form.get("newPassword")
          }
        });
        event.currentTarget.reset();
        toast("Senha alterada com segurança.");
      } catch (error) {
        toast(error.message, "error");
      } finally {
        setButtonLoading(button, false);
      }
    });
  content.querySelector("[data-export-data]")?.addEventListener("click", async () => {
    try {
      const response = await fetch("/api/auth/export", {
        credentials: "same-origin"
      });
      if (!response.ok) throw new Error("Não foi possível exportar os dados.");
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `correiro-dados-${new Date()
        .toISOString()
        .slice(0, 10)}.json`;
      link.click();
      URL.revokeObjectURL(url);
      toast("Exportação preparada.");
    } catch (error) {
      toast(error.message, "error");
    }
  });
  content.querySelector("[data-logout]")?.addEventListener("click", logout);
  content.querySelector("[data-delete-account]")?.addEventListener("click", () => {
    showModal(`
      <div class="modal-header">
        <div><h2>Excluir sua conta?</h2><p>Confirmação por senha obrigatória</p></div>
        <button class="btn btn-ghost btn-icon btn-sm" data-close-modal>${icon(
          "x",
          "icon-sm"
        )}</button>
      </div>
      <form data-delete-account-form>
        <div class="modal-body">
          <p class="confirm-copy">Esta ação desconecta os canais, revoga todas as sessões e anonimiza os dados pessoais. Digite sua senha para confirmar.</p>
          <div class="field" style="margin-top:16px"><label for="delete-password">Senha</label><input class="input" id="delete-password" name="password" type="password" required /></div>
        </div>
        <div class="modal-footer"><button class="btn btn-secondary" type="button" data-close-modal>Cancelar</button><button class="btn btn-danger" type="submit">${icon(
          "trash",
          "icon-sm"
        )} Excluir definitivamente</button></div>
      </form>
    `);
    modalRoot
      .querySelector("[data-delete-account-form]")
      .addEventListener("submit", async (event) => {
        event.preventDefault();
        const button = event.currentTarget.querySelector('button[type="submit"]');
        setButtonLoading(button, true, "Excluindo…");
        try {
          await api("/auth/account", {
            method: "DELETE",
            body: {
              password: new FormData(event.currentTarget).get("password")
            }
          });
          closeModal();
          state.user = null;
          renderAuth(
            "login",
            "<strong>Conta excluída.</strong> Seus dados pessoais foram anonimizados."
          );
        } catch (error) {
          toast(error.message, "error");
          setButtonLoading(button, false);
        }
      });
  });
}

async function logout() {
  try {
    await api("/auth/logout", { method: "POST" });
  } catch {
    // Mesmo que a sessão já tenha expirado, a interface deve voltar ao login.
  }
  state.user = null;
  state.workspace = null;
  state.composer = null;
  window.history.replaceState({}, "", "/");
  renderAuth("login");
}

async function renderAdminPage() {
  if (state.user.role !== "admin") {
    navigate("dashboard", {}, true);
    return;
  }
  const [overviewResult, usersResult, postsResult] = await Promise.all([
    api("/admin/overview"),
    api("/admin/users?limit=12"),
    api("/admin/posts?limit=12")
  ]);
  const overview = overviewResult.data;
  const users = usersResult.data;
  const posts = postsResult.data;
  const content = document.querySelector("#page-content");
  content.innerHTML = `
    ${pageHeader({
      eyebrow: "Operação interna",
      title: "Administração",
      description:
        "Saúde da fila, integrações, usuários e reprocessamentos manuais."
    })}
    <div class="admin-banner">${icon(
      "admin",
      "icon-sm"
    )}<span>Área restrita. Todas as alterações administrativas são registradas na auditoria.</span></div>
    <section class="stats-grid">
      ${statCard("users", overview.users.active, "Usuários ativos", "var(--primary)", "var(--primary-soft)")}
      ${statCard("posts", overview.posts.total, "Publicações", "var(--blue)", "var(--blue-soft)")}
      ${statCard("alert", overview.posts.failed, "Falhas definitivas", "var(--red)", "var(--red-soft)")}
      ${statCard("clock", overview.tokensRequiringAttention, "Tokens em atenção", "var(--yellow)", "var(--yellow-soft)")}
    </section>
    <section class="dashboard-grid">
      <article class="card">
        <div class="card-header"><div><h2 class="card-title">Saúde da fila</h2><p class="card-description">Jobs persistidos por estado.</p></div></div>
        <div class="card-body">
          <div class="queue-grid">
            ${["waiting", "locked", "retry", "failed"]
              .map(
                (status) => `<div class="queue-item"><span>${
                  statusLabels[status] || status
                }</span><strong>${
                  overview.queue[status]?.total || 0
                }</strong></div>`
              )
              .join("")}
          </div>
          <div class="separator" style="margin:18px 0"></div>
          <div class="platform-comparison">
            ${
              overview.providers.length
                ? overview.providers
                    .map(
                      (provider) => `
                        <div class="health-item">
                          ${platformBadge(provider.platform)}
                          <div class="health-copy"><strong>${
                            provider.platform === "facebook"
                              ? "Facebook"
                              : "Instagram"
                          }</strong><span>${
                            provider.attempts
                          } tentativas · média ${provider.averageSeconds.toFixed(
                            1
                          )}s</span></div>
                          <span class="status-badge status-${
                            provider.successRate >= 95
                              ? "published"
                              : "partially_published"
                          }">${provider.successRate}% sucesso</span>
                        </div>
                      `
                    )
                    .join("")
                : `<p class="muted" style="font-size:10px">Sem execuções nos últimos 7 dias.</p>`
            }
          </div>
        </div>
      </article>
      <article class="card">
        <div class="card-header"><div><h2 class="card-title">Contas</h2><p class="card-description">${overview.users.suspended} suspensa(s).</p></div></div>
        <div class="health-list">
          ${users
            .slice(0, 7)
            .map(
              (user) => `
                <div class="health-item">
                  ${avatar(user, "sm")}
                  <div class="health-copy"><strong>${escapeHtml(
                    user.name
                  )}</strong><span>${escapeHtml(
                    user.email
                  )} · ${escapeHtml(user.workspace?.name || "Sem workspace")}</span></div>
                  <button class="btn ${
                    user.status === "active" ? "btn-ghost" : "btn-secondary"
                  } btn-sm" data-admin-user="${user.id}" data-admin-status="${
                    user.status === "active" ? "suspended" : "active"
                  }">${user.status === "active" ? "Suspender" : "Reativar"}</button>
                </div>
              `
            )
            .join("")}
        </div>
      </article>
      <article class="card" style="grid-column:1/-1">
        <div class="card-header"><div><h2 class="card-title">Publicações recentes</h2><p class="card-description">Acesso operacional a payloads e tentativas.</p></div></div>
        <div class="table-wrap">
          <table class="data-table">
            <thead><tr><th>ID / legenda</th><th>Workspace</th><th>Destinos</th><th>Tentativas</th><th>Status</th><th></th></tr></thead>
            <tbody>
              ${posts
                .map(
                  (post) => `
                    <tr>
                      <td><div class="table-caption" style="max-width:380px">${escapeHtml(
                        post.caption || post.id
                      )}</div><div class="table-subline">${escapeHtml(
                        post.id
                      )}</div></td>
                      <td>${escapeHtml(post.workspaceName)}</td>
                      <td>${post.targetCount}</td>
                      <td>${post.attempts}</td>
                      <td>${statusBadge(post.status)}</td>
                      <td><button class="btn btn-ghost btn-sm" data-admin-post="${
                        post.id
                      }">${icon("eye", "icon-sm")} Inspecionar</button></td>
                    </tr>
                  `
                )
                .join("")}
            </tbody>
          </table>
        </div>
      </article>
    </section>
  `;
  content.querySelectorAll("[data-admin-user]").forEach((button) => {
    button.addEventListener("click", async () => {
      const action = button.dataset.adminStatus;
      const confirmed = await confirmAction({
        title: action === "suspended" ? "Suspender usuário?" : "Reativar usuário?",
        message:
          action === "suspended"
            ? "Todas as sessões serão revogadas imediatamente."
            : "O usuário poderá entrar novamente na plataforma.",
        confirmLabel: action === "suspended" ? "Suspender" : "Reativar",
        danger: action === "suspended",
        iconName: "users"
      });
      if (!confirmed) return;
      try {
        await api(`/admin/users/${button.dataset.adminUser}/status`, {
          method: "PATCH",
          body: { status: action }
        });
        toast(action === "suspended" ? "Usuário suspenso." : "Usuário reativado.");
        renderAdminPage();
      } catch (error) {
        toast(error.message, "error");
      }
    });
  });
  content.querySelectorAll("[data-admin-post]").forEach((button) => {
    button.addEventListener("click", () =>
      openAdminPost(button.dataset.adminPost)
    );
  });
}

async function openAdminPost(postId) {
  showModal(
    `<div class="modal-body"><div class="boot-screen" style="min-height:280px"><div class="boot-spinner"></div><p>Carregando payload operacional…</p></div></div>`,
    "modal-lg"
  );
  try {
    const result = await api(`/admin/posts/${postId}`);
    const data = result.data;
    modalRoot.querySelector(".modal").innerHTML = `
      <div class="modal-header">
        <div><h2>Inspeção operacional</h2><p>${escapeHtml(
          data.post.id
        )} · ${escapeHtml(data.post.workspace_name)}</p></div>
        <button class="btn btn-ghost btn-icon btn-sm" data-close-modal>${icon(
          "x",
          "icon-sm"
        )}</button>
      </div>
      <div class="modal-body">
        <div class="analytics-notice">${icon(
          "lock",
          "icon-sm"
        )}<span>Respostas abaixo são sanitizadas. Tokens nunca são exibidos.</span></div>
        <p class="post-detail-caption">${escapeHtml(
          data.post.base_caption || "Sem legenda"
        )}</p>
        <h3 class="card-title">Destinos</h3>
        <div class="target-results">
          ${data.targets
            .map(
              (target) => `
                <div class="target-result">
                  ${platformBadge(target.platform)}
                  <span class="target-result-copy"><strong>${escapeHtml(
                    target.channel_name
                  )}</strong><span>${escapeHtml(
                    target.content_type
                  )} · ${target.attempt_count} tentativa(s)</span>${
                    target.friendly_error
                      ? `<span class="error-box">${escapeHtml(
                          target.friendly_error
                        )}</span>`
                      : ""
                  }</span>
                  <span>${statusBadge(target.status)}${
                    target.status === "failed" &&
                    target.channel_status === "connected"
                      ? `<button class="btn btn-secondary btn-sm" style="margin-top:6px" data-admin-reprocess="${target.id}">${icon(
                          "refresh",
                          "icon-sm"
                        )} Reprocessar</button>`
                      : ""
                  }</span>
                </div>
              `
            )
            .join("")}
        </div>
        <details style="margin-top:18px"><summary class="text-link">Ver tentativas e respostas sanitizadas</summary><pre style="padding:12px;max-height:260px;overflow:auto;background:#f6f6fa;border-radius:10px;font-size:9px;white-space:pre-wrap">${escapeHtml(
          JSON.stringify(data.attempts, null, 2)
        )}</pre></details>
      </div>
    `;
    modalRoot
      .querySelector("[data-close-modal]")
      .addEventListener("click", closeModal);
    modalRoot.querySelectorAll("[data-admin-reprocess]").forEach((button) => {
      button.addEventListener("click", async () => {
        setButtonLoading(button, true, "Enviando…");
        try {
          await api(`/admin/targets/${button.dataset.adminReprocess}/reprocess`, {
            method: "POST"
          });
          closeModal();
          toast("Destino reenviado para a fila.");
          renderAdminPage();
        } catch (error) {
          toast(error.message, "error");
          setButtonLoading(button, false);
        }
      });
    });
  } catch (error) {
    closeModal();
    toast(error.message, "error");
  }
}

async function handleInitialTokenActions(location) {
  if (location.verify) {
    try {
      await api("/auth/verify-email", {
        method: "POST",
        body: { token: location.verify }
      });
      window.history.replaceState({}, "", "/");
      return "<strong>E-mail confirmado.</strong> Entre para acessar seu workspace.";
    } catch (error) {
      return `<strong>Não foi possível confirmar.</strong> ${escapeHtml(
        error.message
      )}`;
    }
  }
  return null;
}

async function init() {
  const location = parseLocation();
  if (location.reset) {
    renderAuth("reset");
    return;
  }
  const tokenMessage = await handleInitialTokenActions(location);
  try {
    await loadSession();
    renderShell();
    const initialRoute = pageLoaders[location.route]
      ? location.route
      : "dashboard";
    await navigate(
      initialRoute,
      {
        postId: location.postId,
        date: location.date
      },
      true
    );
  } catch (error) {
    if (error.status !== 401 && error.code !== "authentication_required") {
      toast(error.message, "error");
    }
    renderAuth("login", tokenMessage);
  }
}

window.addEventListener("popstate", () => {
  if (!state.user) return;
  const location = parseLocation();
  state.composer = location.route === "composer" ? null : state.composer;
  navigate(
    location.route,
    { postId: location.postId, date: location.date },
    true
  );
});

init();
