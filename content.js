/**
 * Injeta um botao "Claude Code" na vista de task do ClickUp: clique abre a app
 * com o prompt montado a partir do template; o caret ao lado abre o menu com
 * as restantes accoes.
 *
 * O ClickUp e uma SPA: a pagina nunca recarrega, os nos do header sao
 * destruidos e recriados a cada navegacao e os selectors mudam com alguma
 * frequencia. Por isso o botao e reinjectado a partir de um MutationObserver
 * e, quando nenhuma ancora conhecida existe, cai para um botao flutuante.
 */

const ROOT_ID = "claude-code-launcher";
const MENU_ID = "claude-code-launcher-menu";
// O Claude Code chega ao resto da task pelo MCP do ClickUp a partir do ID; o
// claude.ai e o ChatGPT nao, por isso o template web leva nome e URL.
const DEFAULTS = {
  template: 'Vamos trabalhar na task ClickUp {id} - "{name}".\n\n',
  webTemplate: 'Vamos trabalhar nesta task do ClickUp:\n\n{name}\n{url}\n\n',
};

// Verificados na app em Set/2026. O primeiro e o caminho completo; os
// restantes sao fallbacks para quando a estrutura a volta mudar.
const HEADER_ANCHOR_SELECTORS = [
  '[data-test="task-container__header-wrapper"] .cu-task-view-header__right',
  ".cu-task-view-header__right",
  '[data-test="task-view-header__right"]',
  ".task-view-header__right",
];

// A ancora interna: o grupo fica imediatamente a esquerda do Share.
const SHARE_BUTTON_SELECTOR = "cu-share-header-button";

const TASK_NAME_SELECTORS = [
  '[data-test="task-title__text-area"]',
  '[data-test="task-title__title-overlay"]',
  '[data-test="task-name__container"]',
  ".cu-task-title__title",
  ".cu-task-title__overlay",
];

// Logomark do Claude Code, inline para nao depender de web_accessible_resources.
const CLAUDE_ICON = `<svg viewBox="0 5 24 15" width="20" height="12.5" fill-rule="evenodd" clip-rule="evenodd" aria-hidden="true" focusable="false"><path fill="currentColor" d="M20.998 10.949H24v3.102h-3v3.028h-1.487V20H18v-2.921h-1.487V20H15v-2.921H9V20H7.488v-2.921H6V20H4.487v-2.921H3V14.05H0V10.95h3V5h17.998v5.949zM6 10.949h1.488V8.102H6v2.847zm10.51 0H18V8.102h-1.49v2.847z"/></svg>`;

const CHECK_ICON = `<svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true" focusable="false"><path fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" d="M4.5 12.5l5 5 10-11"/></svg>`;

const CARET_ICON = `<svg viewBox="0 0 12 12" width="10" height="10" aria-hidden="true" focusable="false"><path fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" d="M3 4.5L6 7.5l3-3"/></svg>`;

let cachedTemplates = { ...DEFAULTS };

/**
 * As accoes do menu. Acrescentar ferramentas e acrescentar entradas aqui:
 * cada uma recebe a task e o prompt ja montado.
 */
const ACTIONS = [
  {
    id: "open",
    label: "Abrir no Claude Code",
    primary: true,
    run: (task, prompt) => {
      openExternal(`claude://code/new?q=${encodeURIComponent(prompt)}`);
    },
  },
  {
    id: "open-web",
    label: "Abrir no Claude.ai",
    template: "webTemplate",
    run: (task, prompt) =>
      openExternal(`https://claude.ai/new?q=${encodeURIComponent(prompt)}`, true),
  },
  {
    id: "open-chatgpt",
    label: "Abrir no ChatGPT",
    template: "webTemplate",
    run: (task, prompt) =>
      openExternal(`https://chatgpt.com/?q=${encodeURIComponent(prompt)}`, true),
  },
  {
    id: "copy-prompt",
    label: "Copiar prompt",
    run: (task, prompt) => navigator.clipboard.writeText(prompt),
  },
  {
    id: "copy-id",
    label: "Copiar ID da task",
    run: (task) => navigator.clipboard.writeText(task.id),
  },
  {
    id: "options",
    label: "Editar template",
    separated: true,
    run: () => chrome.runtime.sendMessage({ type: "open-options" }),
  },
];

function readTemplates() {
  return new Promise((resolve) => {
    chrome.storage.sync.get(DEFAULTS, (items) => {
      resolve({
        template: items.template || DEFAULTS.template,
        webTemplate: items.webTemplate || DEFAULTS.webTemplate,
      });
    });
  });
}

/**
 * Aceita /t/{id}, /t/{teamId}/{id} e /t/{teamId}/{CUSTOM-ID}. O ClickUp
 * normaliza o URL para a forma com teamId pouco depois de abrir a task.
 */
function readTaskId() {
  const match = location.pathname.match(/\/t\/(?:(\d+)\/)?([A-Za-z0-9_-]+)/);
  return match ? match[2] : null;
}

function readTaskNameFromDom() {
  for (const selector of TASK_NAME_SELECTORS) {
    const node = document.querySelector(selector);
    if (!node) continue;
    const text = (node.value || node.textContent || "").trim();
    if (text) return text;
  }
  return "";
}

/** O titulo do separador e `Nome da task | #id`. */
function readTaskNameFromTitle() {
  return document.title
    .replace(/^\(\d+\)\s*/, "")
    .replace(/\s*\|\s*#\S+\s*$/, "")
    .trim();
}

function readTask() {
  const id = readTaskId();
  if (!id) return null;
  return {
    id,
    name: readTaskNameFromDom() || readTaskNameFromTitle(),
    url: location.href.split("?")[0],
  };
}

function buildPrompt(template, task) {
  return template
    .replaceAll("{id}", task.id)
    .replaceAll("{name}", task.name)
    .replaceAll("{url}", task.url);
}

function openExternal(href, newTab) {
  const link = document.createElement("a");
  link.href = href;
  if (newTab) {
    link.target = "_blank";
    link.rel = "noopener";
  }
  link.style.display = "none";
  document.body.appendChild(link);
  link.click();
  link.remove();
}

function flash(button, modifier) {
  button.innerHTML = CHECK_ICON;
  button.classList.add(modifier);
  setTimeout(() => {
    button.innerHTML = CLAUDE_ICON;
    button.classList.remove(modifier);
  }, 1500);
}

async function runAction(action, { feedback } = {}) {
  const task = readTask();
  if (!task) return;

  try {
    const template = cachedTemplates[action.template ?? "template"];
    await action.run(task, buildPrompt(template, task));
    if (feedback && !action.primary) flash(feedback, "claude-code-launcher__button--ok");
  } catch {
    if (feedback) flash(feedback, "claude-code-launcher__button--failed");
  }
}

/**
 * O ClickUp tem tema claro e escuro e o header nao segue o tema do sistema.
 * A cor do menu vem da primeira cor de fundo opaca acima da ancora.
 */
function resolveTheme(node) {
  for (let el = node; el; el = el.parentElement) {
    const background = getComputedStyle(el).backgroundColor;
    const parts = background.match(/[\d.]+/g);
    if (!parts || Number(parts[3] ?? 1) === 0) continue;
    const [r, g, b] = parts.map(Number);
    return 0.2126 * r + 0.7152 * g + 0.0722 * b < 128 ? "dark" : "light";
  }
  return "light";
}

function closeMenu() {
  document.getElementById(MENU_ID)?.remove();
  document
    .querySelector(".claude-code-launcher__toggle")
    ?.setAttribute("aria-expanded", "false");
}

function openMenu(toggle, feedback) {
  closeMenu();

  const menu = document.createElement("div");
  menu.id = MENU_ID;
  menu.className = `claude-code-launcher-menu claude-code-launcher-menu--${resolveTheme(
    toggle
  )}`;
  menu.setAttribute("role", "menu");

  for (const action of ACTIONS) {
    if (action.separated) {
      const separator = document.createElement("div");
      separator.className = "claude-code-launcher-menu__separator";
      menu.appendChild(separator);
    }
    const item = document.createElement("button");
    item.type = "button";
    item.className = "claude-code-launcher-menu__item";
    item.setAttribute("role", "menuitem");
    item.textContent = action.label;
    item.addEventListener("click", () => {
      closeMenu();
      runAction(action, { feedback });
    });
    menu.appendChild(item);
  }

  document.body.appendChild(menu);

  const rect = toggle.getBoundingClientRect();
  menu.style.top = `${rect.bottom + 6}px`;
  menu.style.left = `${Math.max(
    8,
    Math.min(rect.right - menu.offsetWidth, window.innerWidth - menu.offsetWidth - 8)
  )}px`;

  toggle.setAttribute("aria-expanded", "true");
}

function createLauncher(floating) {
  const root = document.createElement("div");
  root.id = ROOT_ID;
  root.className = floating
    ? "claude-code-launcher claude-code-launcher--floating"
    : "claude-code-launcher";

  const main = document.createElement("button");
  main.type = "button";
  main.className = "claude-code-launcher__button claude-code-launcher__main";
  main.innerHTML = CLAUDE_ICON;
  main.title = "Abrir no Claude Code";
  main.setAttribute("aria-label", "Abrir no Claude Code");
  main.addEventListener("click", () => {
    closeMenu();
    runAction(ACTIONS[0], { feedback: main });
  });

  const toggle = document.createElement("button");
  toggle.type = "button";
  toggle.className = "claude-code-launcher__button claude-code-launcher__toggle";
  toggle.innerHTML = CARET_ICON;
  toggle.title = "Mais accoes";
  toggle.setAttribute("aria-label", "Mais accoes");
  toggle.setAttribute("aria-haspopup", "menu");
  toggle.setAttribute("aria-expanded", "false");
  toggle.addEventListener("click", () => {
    if (document.getElementById(MENU_ID)) closeMenu();
    else openMenu(toggle, main);
  });

  root.append(main, toggle);
  return root;
}

function findHeaderAnchor() {
  for (const selector of HEADER_ANCHOR_SELECTORS) {
    const node = document.querySelector(selector);
    if (node) return node;
  }
  return null;
}

function placeInHeader(anchor, launcher) {
  const share = anchor.querySelector(SHARE_BUTTON_SELECTOR);
  if (share) anchor.insertBefore(launcher, share);
  else anchor.prepend(launcher);
}

function syncLauncher() {
  const existing = document.getElementById(ROOT_ID);

  if (!readTaskId()) {
    existing?.remove();
    closeMenu();
    return;
  }

  const anchor = findHeaderAnchor();

  if (existing) {
    const isFloating = existing.classList.contains(
      "claude-code-launcher--floating"
    );
    // Um botao flutuante da lugar ao header assim que este aparece.
    if (existing.isConnected && !(anchor && isFloating)) return;
    existing.remove();
    closeMenu();
  }

  const launcher = createLauncher(!anchor);
  if (anchor) placeInHeader(anchor, launcher);
  else document.body.appendChild(launcher);
}

function watchUrlChanges(onChange) {
  for (const method of ["pushState", "replaceState"]) {
    const original = history[method];
    history[method] = function (...args) {
      const result = original.apply(this, args);
      onChange();
      return result;
    };
  }
  window.addEventListener("popstate", onChange);
}

function start() {
  let pending = null;
  const schedule = () => {
    clearTimeout(pending);
    pending = setTimeout(syncLauncher, 250);
  };

  new MutationObserver(schedule).observe(document.body, {
    childList: true,
    subtree: true,
  });
  watchUrlChanges(schedule);

  document.addEventListener("click", (event) => {
    if (!event.target.closest(`#${MENU_ID}, #${ROOT_ID}`)) closeMenu();
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") closeMenu();
  });
  window.addEventListener("resize", closeMenu);

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== "sync") return;
    for (const key of Object.keys(DEFAULTS)) {
      if (changes[key]) cachedTemplates[key] = changes[key].newValue || DEFAULTS[key];
    }
  });

  readTemplates().then((templates) => {
    cachedTemplates = templates;
    syncLauncher();
  });
}

start();
