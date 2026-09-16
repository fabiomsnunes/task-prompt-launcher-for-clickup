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
const DEFAULT_TEMPLATE = 'Vamos trabalhar na task ClickUp {id} - "{name}".\n\n';

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
const CLAUDE_ICON = `<svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true" focusable="false"><path fill="currentColor" d="M4.709 15.955l4.72-2.647.079-.23-.08-.128H9.2l-.79-.048-2.698-.073-2.339-.097-2.266-.122-.571-.121L0 11.784l.055-.352.48-.321.686.06 1.52.103 2.278.158 1.652.097 2.449.255h.389l.055-.157-.134-.098-.103-.097-2.358-1.596-2.552-1.688-1.336-.972-.724-.491-.364-.462-.158-1.008.656-.722.881.06.225.061.893.686 1.908 1.476 2.491 1.833.365.304.145-.103.019-.073-.164-.274-1.355-2.446-1.446-2.49-.644-1.032-.17-.619a2.97 2.97 0 01-.104-.729L6.283.134 6.696 0l.996.134.42.365.62 1.414 1.002 2.229 1.555 3.03.456.898.243.832.091.255h.158V9.01l.128-1.706.237-2.095.23-2.695.08-.76.376-.91.747-.492.584.28.48.685-.067.444-.286 1.851-.559 2.903-.364 1.942h.212l.243-.242.985-1.306 1.652-2.064.73-.82.85-.904.547-.431h1.033l.76 1.129-.34 1.166-1.064 1.347-.881 1.142-1.264 1.7-.79 1.36.073.11.188-.02 2.856-.606 1.543-.28 1.841-.315.833.388.091.395-.328.807-1.969.486-2.309.462-3.439.813-.042.03.049.061 1.549.146.662.036h1.622l3.02.225.79.522.474.638-.079.485-1.215.62-1.64-.389-3.829-.91-1.312-.329h-.182v.11l1.093 1.068 2.006 1.81 2.509 2.33.127.578-.322.455-.34-.049-2.205-1.657-.851-.746-1.926-1.62h-.128v.17l.444.649 2.345 3.521.122 1.08-.17.353-.608.213-.668-.122-1.374-1.925-1.415-2.167-1.143-1.943-.14.08-.674 7.254-.316.37-.729.28-.607-.461-.322-.747.322-1.476.389-1.924.315-1.53.286-1.9.17-.632-.012-.042-.14.018-1.434 1.967-2.18 2.945-1.726 1.845-.414.164-.717-.37.067-.662.401-.589 2.388-3.036 1.44-1.882.93-1.086-.006-.158h-.055L4.132 18.56l-1.13.146-.487-.456.061-.746.231-.243 1.908-1.312-.006.006z"/></svg>`;

const CHECK_ICON = `<svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true" focusable="false"><path fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" d="M4.5 12.5l5 5 10-11"/></svg>`;


const CARET_ICON = `<svg viewBox="0 0 12 12" width="10" height="10" aria-hidden="true" focusable="false"><path fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" d="M3 4.5L6 7.5l3-3"/></svg>`;

let cachedTemplate = DEFAULT_TEMPLATE;

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

function readTemplate() {
  return new Promise((resolve) => {
    chrome.storage.sync.get({ template: DEFAULT_TEMPLATE }, (items) => {
      resolve(items.template || DEFAULT_TEMPLATE);
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

function openExternal(href) {
  const link = document.createElement("a");
  link.href = href;
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
    await action.run(task, buildPrompt(cachedTemplate, task));
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
    if (area === "sync" && changes.template) {
      cachedTemplate = changes.template.newValue || DEFAULT_TEMPLATE;
    }
  });

  readTemplate().then((template) => {
    cachedTemplate = template;
    syncLauncher();
  });
}

start();
