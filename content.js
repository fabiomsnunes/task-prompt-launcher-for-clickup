/**
 * Adds a launch button to the ClickUp task view: a click opens Claude Code
 * with a prompt built from the template; the caret next to it opens the menu
 * with the other actions.
 *
 * ClickUp is a SPA: the page never reloads, the header nodes are destroyed and
 * rebuilt on every navigation and the selectors change now and then. So the
 * button is re-injected from a MutationObserver and, when no known anchor
 * exists, falls back to a floating button.
 */

const ROOT_ID = "claude-code-launcher";
const MENU_ID = "claude-code-launcher-menu";
// With the ClickUp MCP connected, Claude Code reaches the rest of the task from
// its ID; the web apps cannot, so the web template carries the name and URL.
const DEFAULTS = {
  template: 'Let\'s work on ClickUp task {id} - "{name}".\n\n',
  webTemplate: "Let's work on this ClickUp task:\n\n{name}\n{url}\n\n",
  defaultAction: "open",
};

// Checked against the app in September 2026. The first is the full path; the
// rest are fallbacks for when the structure around it changes.
const HEADER_ANCHOR_SELECTORS = [
  '[data-test="task-container__header-wrapper"] .cu-task-view-header__right',
  ".cu-task-view-header__right",
  '[data-test="task-view-header__right"]',
  ".task-view-header__right",
];

// The inner anchor: the group sits right before the Share button.
const SHARE_BUTTON_SELECTOR = "cu-share-header-button";

const TASK_NAME_SELECTORS = [
  '[data-test="task-title__text-area"]',
  '[data-test="task-title__title-overlay"]',
  '[data-test="task-name__container"]',
  ".cu-task-title__title",
  ".cu-task-title__overlay",
];

// Each tool's own mark, inline so they need no web_accessible_resources. The
// button shows the mark of the default action, so it is clear where it opens.
const svg = (viewBox, d, color) =>
  `<svg viewBox="${viewBox}" width="16" height="16" fill-rule="evenodd" aria-hidden="true" focusable="false"><path fill="${color}" d="${d}"/></svg>`;

const ICONS = {
  claudeCode: svg("0 0 24 24", "M20.998 10.949H24v3.102h-3v3.028h-1.487V20H18v-2.921h-1.487V20H15v-2.921H9V20H7.488v-2.921H6V20H4.487v-2.921H3V14.05H0V10.95h3V5h17.998v5.949zM6 10.949h1.488V8.102H6v2.847zm10.51 0H18V8.102h-1.49v2.847z", "#d97757"),
  claude: svg("0 0 24 24", "m4.7144 15.9555 4.7174-2.6471.079-.2307-.079-.1275h-.2307l-.7893-.0486-2.6956-.0729-2.3375-.0971-2.2646-.1214-.5707-.1215-.5343-.7042.0546-.3522.4797-.3218.686.0608 1.5179.1032 2.2767.1578 1.6514.0972 2.4468.255h.3886l.0546-.1579-.1336-.0971-.1032-.0972L6.973 9.8356l-2.55-1.6879-1.3356-.9714-.7225-.4918-.3643-.4614-.1578-1.0078.6557-.7225.8803.0607.2246.0607.8925.686 1.9064 1.4754 2.4893 1.8336.3643.3035.1457-.1032.0182-.0728-.164-.2733-1.3539-2.4467-1.445-2.4893-.6435-1.032-.17-.6194c-.0607-.255-.1032-.4674-.1032-.7285L6.287.1335 6.6997 0l.9957.1336.419.3642.6192 1.4147 1.0018 2.2282 1.5543 3.0296.4553.8985.2429.8318.091.255h.1579v-.1457l.1275-1.706.2368-2.0947.2307-2.6957.0789-.7589.3764-.9107.7468-.4918.5828.2793.4797.686-.0668.4433-.2853 1.8517-.5586 2.9021-.3643 1.9429h.2125l.2429-.2429.9835-1.3053 1.6514-2.0643.7286-.8196.85-.9046.5464-.4311h1.0321l.759 1.1293-.34 1.1657-1.0625 1.3478-.8804 1.1414-1.2628 1.7-.7893 1.36.0729.1093.1882-.0183 2.8535-.607 1.5421-.2794 1.8396-.3157.8318.3886.091.3946-.3278.8075-1.967.4857-2.3072.4614-3.4364.8136-.0425.0304.0486.0607 1.5482.1457.6618.0364h1.621l3.0175.2247.7892.522.4736.6376-.079.4857-1.2142.6193-1.6393-.3886-3.825-.9107-1.3113-.3279h-.1822v.1093l1.0929 1.0686 2.0035 1.8092 2.5075 2.3314.1275.5768-.3218.4554-.34-.0486-2.2039-1.6575-.85-.7468-1.9246-1.621h-.1275v.17l.4432.6496 2.3436 3.5214.1214 1.0807-.17.3521-.6071.2125-.6679-.1214-1.3721-1.9246L14.38 17.959l-1.1414-1.9428-.1397.079-.674 7.2552-.3156.3703-.7286.2793-.6071-.4614-.3218-.7468.3218-1.4753.3886-1.9246.3157-1.53.2853-1.9004.17-.6314-.0121-.0425-.1397.0182-1.4328 1.9672-2.1796 2.9446-1.7243 1.8456-.4128.164-.7164-.3704.0667-.6618.4008-.5889 2.386-3.0357 1.4389-1.882.929-1.0868-.0062-.1579h-.0546l-6.3385 4.1164-1.1293.1457-.4857-.4554.0608-.7467.2307-.2429 1.9064-1.3114Z", "#d97757"),
  openai: svg("0 0 24 24", "M22.2819 9.8211a5.9847 5.9847 0 0 0-.5157-4.9108 6.0462 6.0462 0 0 0-6.5098-2.9A6.0651 6.0651 0 0 0 4.9807 4.1818a5.9847 5.9847 0 0 0-3.9977 2.9 6.0462 6.0462 0 0 0 .7427 7.0966 5.98 5.98 0 0 0 .511 4.9107 6.051 6.051 0 0 0 6.5146 2.9001A5.9847 5.9847 0 0 0 13.2599 24a6.0557 6.0557 0 0 0 5.7718-4.2058 5.9894 5.9894 0 0 0 3.9977-2.9001 6.0557 6.0557 0 0 0-.7475-7.0729zm-9.022 12.6081a4.4755 4.4755 0 0 1-2.8764-1.0408l.1419-.0804 4.7783-2.7582a.7948.7948 0 0 0 .3927-.6813v-6.7369l2.02 1.1686a.071.071 0 0 1 .038.052v5.5826a4.504 4.504 0 0 1-4.4945 4.4944zm-9.6607-4.1254a4.4708 4.4708 0 0 1-.5346-3.0137l.142.0852 4.783 2.7582a.7712.7712 0 0 0 .7806 0l5.8428-3.3685v2.3324a.0804.0804 0 0 1-.0332.0615L9.74 19.9502a4.4992 4.4992 0 0 1-6.1408-1.6464zM2.3408 7.8956a4.485 4.485 0 0 1 2.3655-1.9728V11.6a.7664.7664 0 0 0 .3879.6765l5.8144 3.3543-2.0201 1.1685a.0757.0757 0 0 1-.071 0l-4.8303-2.7865A4.504 4.504 0 0 1 2.3408 7.872zm16.5963 3.8558L13.1038 8.364 15.1192 7.2a.0757.0757 0 0 1 .071 0l4.8303 2.7913a4.4944 4.4944 0 0 1-.6765 8.1042v-5.6772a.79.79 0 0 0-.407-.667zm2.0107-3.0231l-.142-.0852-4.7735-2.7818a.7759.7759 0 0 0-.7854 0L9.409 9.2297V6.8974a.0662.0662 0 0 1 .0284-.0615l4.8303-2.7866a4.4992 4.4992 0 0 1 6.6802 4.66zM8.3065 12.863l-2.02-1.1638a.0804.0804 0 0 1-.038-.0567V6.0742a4.4992 4.4992 0 0 1 7.3757-3.4537l-.142.0805L8.704 5.459a.7948.7948 0 0 0-.3927.6813zm1.0976-2.3654l2.602-1.4998 2.6069 1.4998v2.9994l-2.5974 1.4997-2.6067-1.4997Z", "currentColor"),
};


const CHECK_ICON = `<svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true" focusable="false"><path fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" d="M4.5 12.5l5 5 10-11"/></svg>`;

const CARET_ICON = `<svg viewBox="0 0 12 12" width="10" height="10" aria-hidden="true" focusable="false"><path fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" d="M3 4.5L6 7.5l3-3"/></svg>`;

let cachedTemplates = { ...DEFAULTS };

/**
 * The menu actions. Adding a tool means adding an entry here: each one gets
 * the task and the prompt already built.
 */
const ACTIONS = [
  {
    id: "open",
    label: "Open in Claude Code",
    icon: ICONS.claudeCode,
    run: (task, prompt) => {
      openExternal(`claude://code/new?q=${encodeURIComponent(prompt)}`);
    },
  },
  {
    id: "open-codex",
    label: "Open in Codex",
    icon: ICONS.openai,
    run: (task, prompt) => {
      openExternal(`codex://threads/new?prompt=${encodeURIComponent(prompt)}`);
    },
  },
  {
    id: "open-web",
    label: "Open in Claude.ai",
    icon: ICONS.claude,
    template: "webTemplate",
    run: (task, prompt) =>
      openExternal(`https://claude.ai/new?q=${encodeURIComponent(prompt)}`, true),
  },
  {
    id: "open-chatgpt",
    label: "Open in ChatGPT",
    icon: ICONS.openai,
    template: "webTemplate",
    run: (task, prompt) =>
      openExternal(`https://chatgpt.com/?q=${encodeURIComponent(prompt)}`, true),
  },
  {
    id: "copy-prompt",
    label: "Copy prompt",
    run: (task, prompt) => navigator.clipboard.writeText(prompt),
  },
  {
    id: "copy-id",
    label: "Copy task ID",
    run: (task) => navigator.clipboard.writeText(task.id),
  },
  {
    id: "options",
    label: "Edit templates",
    separated: true,
    run: () => chrome.runtime.sendMessage({ type: "open-options" }),
  },
];

function readTemplates() {
  return new Promise((resolve) => {
    chrome.storage.sync.get(DEFAULTS, (items) => {
      resolve(
        Object.fromEntries(
          Object.keys(DEFAULTS).map((key) => [key, items[key] || DEFAULTS[key]])
        )
      );
    });
  });
}

/**
 * Accepts /t/{id}, /t/{teamId}/{id} and /t/{teamId}/{CUSTOM-ID}. ClickUp
 * rewrites the URL to the teamId form shortly after the task opens.
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

/** The tab title is `Task name | #id`. */
function readTaskNameFromTitle() {
  return document.title
    .replace(/^\(\d+\)\s*/, "")
    .replace(/\s*\|\s*#\S+\s*$/, "")
    .trim();
}

/**
 * The dates button shows what ClickUp draws ("Today", "Mon", "12 Sep"), not
 * the absolute date. Relative ones are resolved here so the prompt still makes
 * sense when it is read days later.
 */
const RELATIVE_DAYS = { today: 0, tomorrow: 1, yesterday: -1 };

function readDueDate() {
  const text = readText('[data-test="task-dates-display-button"]');
  const offset = RELATIVE_DAYS[text.toLowerCase()];
  if (offset === undefined) return text;

  const date = new Date();
  date.setDate(date.getDate() + offset);
  return `${text} (${date.toISOString().slice(0, 10)})`;
}

function readText(selector) {
  const node = document.querySelector(selector);
  const text = (node?.innerText || "").trim();
  return text === "Empty" ? "" : text;
}

function readAll(selector) {
  return [...document.querySelectorAll(selector)]
    .map((node) => node.innerText.trim())
    .filter(Boolean)
    .join(", ");
}

/** Empty values stay empty: what the preview shows is what comes out. */
const SHORTCODES = {
  id: (id) => id,
  name: () => readTaskNameFromDom() || readTaskNameFromTitle(),
  url: () => location.href.split("?")[0],
  date: readDueDate,
  priority: () => readText('[data-test="task-hero-section-priority__row-data"]'),
  tags: () => readAll('[data-test="task-hero-section__tags"] .cu-cf-value-tag__text'),
  // The visually hidden list in cu-assignees has one name per assignee; the
  // visible one collapses into avatars as soon as there is more than one.
  assignees: () => readAll('[data-test="task-hero-section__assignees"] ul li'),
  // The last breadcrumb is the list; the ones before are the space and folder.
  list: () => {
    const crumbs = document.querySelectorAll(
      '[data-test="task-view-breadcrumbs__timl-list-item"]'
    );
    return crumbs.length ? crumbs[crumbs.length - 1].innerText.trim() : "";
  },
};

function readTask() {
  const id = readTaskId();
  if (!id) return null;
  return Object.fromEntries(
    Object.entries(SHORTCODES).map(([key, read]) => [key, read(id)])
  );
}

function buildPrompt(template, task) {
  return Object.entries(task).reduce(
    (prompt, [key, value]) => prompt.replaceAll(`{${key}}`, value),
    template
  );
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

function defaultAction() {
  return (
    ACTIONS.find((action) => action.id === cachedTemplates.defaultAction && action.icon) ||
    ACTIONS[0]
  );
}

function paintMain(main) {
  const action = defaultAction();
  main.innerHTML = action.icon;
  main.title = action.label;
  main.setAttribute("aria-label", action.label);
}

function flash(button, modifier) {
  button.innerHTML = CHECK_ICON;
  button.classList.add(modifier);
  setTimeout(() => {
    paintMain(button);
    button.classList.remove(modifier);
  }, 1500);
}

async function runAction(action, { feedback } = {}) {
  const task = readTask();
  if (!task) return;

  try {
    const template = cachedTemplates[action.template ?? "template"];
    await action.run(task, buildPrompt(template, task));
    if (feedback && action !== defaultAction()) flash(feedback, "claude-code-launcher__button--ok");
  } catch {
    if (feedback) flash(feedback, "claude-code-launcher__button--failed");
  }
}

/**
 * ClickUp has light and dark themes and the header ignores the system theme.
 * The menu colours follow the first opaque background above the anchor.
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
    const icon = document.createElement("span");
    icon.className = "claude-code-launcher-menu__icon";
    icon.innerHTML = action.icon || "";
    item.append(icon, action.label);
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
  paintMain(main);
  main.addEventListener("click", () => {
    closeMenu();
    runAction(defaultAction(), { feedback: main });
  });

  const toggle = document.createElement("button");
  toggle.type = "button";
  toggle.className = "claude-code-launcher__button claude-code-launcher__toggle";
  toggle.innerHTML = CARET_ICON;
  toggle.title = "More actions";
  toggle.setAttribute("aria-label", "More actions");
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
    // A floating button gives way to the header as soon as it appears.
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
    const main = document.querySelector(".claude-code-launcher__main");
    if (main) paintMain(main);
  });

  readTemplates().then((templates) => {
    cachedTemplates = templates;
    syncLauncher();
  });
}

start();
