# Claude Code for ClickUp

Extensão de browser (Chrome/Brave, Manifest V3) que põe um botão do Claude no
header das tasks do ClickUp. Um clique abre o Claude Desktop na tab Code com o
prompt inicial já escrito; o caret ao lado abre o menu com as restantes ações.

Uso privado. Sem build, sem dependências, sem distribuição na Chrome Web Store.

## Instalar

1. `brave://extensions` (ou `chrome://extensions`)
2. Ligar **Developer mode**
3. **Load unpacked** e escolher a pasta do repositório (ou a pasta extraída do
   zip da release)

Na primeira utilização o Brave pede confirmação para abrir a app externa.
Marcar "sempre permitir" para `app.clickup.com`.

## Usar

Abrir uma task e clicar no ícone do Claude, à esquerda do **Share**. Quando o
header não é reconhecido, o botão aparece como pill flutuante no canto inferior
direito.

Ações no menu:

| Ação | O que faz |
| --- | --- |
| Abrir no Claude Code | `claude://code/new?q=<prompt>` (o mesmo que o clique no ícone) |
| Copiar prompt | Põe o prompt na clipboard |
| Copiar ID da task | Só o ID, para colar num prompt já a decorrer |
| Editar template | Abre a página de opções |

Acrescentar ferramentas é acrescentar uma entrada ao array `ACTIONS` no
[`content.js`](content.js): cada ação recebe a task e o prompt já montado.

## Template

Editável na página de opções, guardado em `chrome.storage.sync`.

Default:

```
Vamos trabalhar na task ClickUp {id} - "{name}".

```

Variáveis: `{id}`, `{name}`, `{url}`. A linha vazia no fim deixa o cursor pronto
a escrever.

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
- O ID sai do URL. O ClickUp normaliza `/t/{id}` para `/t/{teamId}/{id}`, e com
  custom IDs o último segmento é o custom ID.
- O nome sai de `[data-test="task-title__text-area"]`, com fallback para o
  `document.title` (`Nome da task | #id`). Os selectors foram confirmados na app
  em Setembro de 2026 e estão todos no topo do `content.js`. Se partirem
  demasiadas vezes, o passo seguinte é ir à API do ClickUp com um token pessoal
  em `chrome.storage.local`.
- O ClickUp tem tema claro e escuro e não segue o tema do sistema, por isso o
  menu escolhe as cores pela luminância do fundo por baixo do botão.

## Release

Tag `vX.Y.Z` → o workflow sincroniza a versão do `manifest.json` com a tag,
valida, empacota e publica o zip na release.

```bash
git tag v1.1.0 && git push origin v1.1.0
```

## Fora de âmbito (v1)

Vários templates, mapeamento lista → pasta local (`folder`), atalho de teclado,
botão nas linhas da lista, abrir no CLI em vez do Desktop.
