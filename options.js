const DEFAULT_TEMPLATE = 'Vamos trabalhar na task ClickUp {id} - "{name}".\n\n';

const SAMPLE_TASK = {
  id: "86c1abcde",
  name: "Corrigir checkout do Woo em mobile",
  url: "https://app.clickup.com/t/86c1abcde",
};

const templateField = document.getElementById("template");
const preview = document.getElementById("preview");
const status = document.getElementById("status");

function render() {
  preview.textContent = templateField.value
    .replaceAll("{id}", SAMPLE_TASK.id)
    .replaceAll("{name}", SAMPLE_TASK.name)
    .replaceAll("{url}", SAMPLE_TASK.url);
}

function announce(message) {
  status.textContent = message;
  setTimeout(() => {
    status.textContent = "";
  }, 2000);
}

chrome.storage.sync.get({ template: DEFAULT_TEMPLATE }, (items) => {
  templateField.value = items.template;
  render();
});

templateField.addEventListener("input", render);

document.getElementById("save").addEventListener("click", () => {
  chrome.storage.sync.set({ template: templateField.value }, () =>
    announce("Guardado")
  );
});

document.getElementById("reset").addEventListener("click", () => {
  templateField.value = DEFAULT_TEMPLATE;
  render();
  chrome.storage.sync.set({ template: DEFAULT_TEMPLATE }, () =>
    announce("Default reposto")
  );
});
