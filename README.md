# Abrir no Claude Code

Extensão de browser (Chrome/Brave, Manifest V3) que injeta um botão nas tasks do
ClickUp. Um clique abre o Claude Desktop na tab Code com o prompt inicial já
escrito, no estilo do botão "Start Timer" do Clockify.

Uso privado. Sem build, sem dependências, sem distribuição na Chrome Web Store.

## Instalar

1. `brave://extensions` (ou `chrome://extensions`)
2. Ligar **Developer mode**
3. **Load unpacked** e escolher a pasta do repositório (ou a pasta extraída do
   zip da release)

Na primeira utilização o Brave pede confirmação para abrir a app externa.
Marcar "sempre permitir" para `app.clickup.com`.

## Usar

1. Abrir uma task no ClickUp
2. Clicar em **Claude Code** (junto aos controlos da task, ou no botão flutuante
   canto inferior direito quando o header não é reconhecido)
3. O Claude Desktop abre com o prompt preenchido; escrever o resto e enviar

**Alt+clique** copia o prompt para a clipboard em vez de abrir a app. Serve de
escape quando o browser bloqueia o esquema `claude://`.

## Template

Editável na página de opções da extensão (Extensions → Abrir no Claude Code →
Details → Extension options). Guardado em `chrome.storage.sync`.

Default:

```
Vamos trabalhar na task ClickUp {id} - "{name}".

```

Variáveis: `{id}`, `{name}`, `{url}`.

O ID chega para o Claude Code ir buscar descrição, subtasks e comentários pelo
MCP do ClickUp. O nome serve de contexto rápido e de confirmação visual.

## Deep link

```
claude://code/new?q=<prompt URL-encoded>
```

Referência: https://support.claude.com/en/articles/14729294-open-claude-desktop-with-a-link

## Notas de implementação

- O ClickUp é uma SPA: o botão é reinjectado por `MutationObserver` e por um
  patch a `history.pushState` / `replaceState`, com verificação de duplicados.
- O ID sai do URL (`/t/{id}`, ou `/t/{teamId}/{CUSTOM-ID}`).
- O nome sai do DOM, com fallback para o `document.title`. Os selectors do
  ClickUp mudam com frequência; a lista de candidatos está no topo do
  `content.js`. Se partir demasiadas vezes, o passo seguinte é ir à API do
  ClickUp com um token pessoal em `chrome.storage.local`.

## Release

Tag `vX.Y.Z` → o workflow sincroniza a versão do `manifest.json` com a tag,
valida, empacota e publica o zip na release.

```bash
git tag v1.0.0 && git push origin v1.0.0
```

## Fora de âmbito (v1)

Vários templates, mapeamento lista → pasta local (`folder`), atalho de teclado,
botão nas linhas da lista, abrir no CLI em vez do Desktop.
