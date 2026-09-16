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
| Abrir no Claude.ai | `https://claude.ai/new?q=<prompt>` em separador novo |
| Abrir no ChatGPT | `https://chatgpt.com/?q=<prompt>` em separador novo |
| Copiar prompt | Põe o prompt na clipboard |
| Copiar ID da task | Só o ID, para colar num prompt já a decorrer |
| Editar template | Abre a página de opções |

Nenhum dos dois destinos web submete sozinho: ambos só preenchem o composer.

Acrescentar ferramentas é acrescentar uma entrada ao array `ACTIONS` no
[`content.js`](content.js): cada ação recebe a task e o prompt já montado.

## Templates

Dois templates, editáveis na página de opções e guardados em
`chrome.storage.sync`. A linha vazia no fim deixa o cursor pronto a escrever.

| Shortcode | Vem de | Exemplo |
| --- | --- | --- |
| `{id}` | URL | `123zgec38ut` |
| `{name}` | Título da task | `Stop And Buy não consegue pagar...` |
| `{url}` | URL | `https://app.clickup.com/t/2450702/123zgec38ut` |
| `{date}` | Due date | `Today (2026-09-16)` |
| `{priority}` | Prioridade | `High` |
| `{tags}` | Tags, separadas por vírgula | `support` |
| `{assignees}` | Assignees, separados por vírgula | `Fábio Nunes` |
| `{list}` | Último breadcrumb | `Moneybox (20min)` |

Na página de opções cada shortcode é um chip: clicar insere-o no template onde
está o cursor. Campos vazios na task saem vazios no prompt.

O ClickUp desenha a due date em relativo ("Today", "Mon"), sem data absoluta em
lado nenhum do DOM. O `{date}` resolve `Today`, `Tomorrow` e `Yesterday` para a
data real entre parênteses; as outras formas ficam como o ClickUp as mostra.

**Claude Code** (default):

```
Vamos trabalhar na task ClickUp {id} - "{name}".

```

O ID chega para o Claude Code ir buscar descrição, subtasks e comentários pelo
MCP do ClickUp. O nome serve de contexto rápido e de confirmação visual.

**Claude.ai e ChatGPT** (default):

```
Vamos trabalhar nesta task do ClickUp:

{name}
{url}

```

Do outro lado não há MCP do ClickUp, por isso o prompt leva o nome e o URL em
vez de contar com o ID.

## Deep links

```
claude://code/new?q=<prompt URL-encoded>
https://claude.ai/new?q=<prompt URL-encoded>
https://chatgpt.com/?q=<prompt URL-encoded>
```

O ChatGPT reescreve o `?q=` para `?prompt=` ao carregar.

Referência: https://support.claude.com/en/articles/14729294-open-claude-desktop-with-a-link

## Notas de implementação

- O ClickUp é uma SPA: o botão é reinjectado por `MutationObserver` e por um
  patch a `history.pushState` / `replaceState`, com verificação de duplicados.
- O ID sai do URL. O ClickUp normaliza `/t/{id}` para `/t/{teamId}/{id}`, e com
  custom IDs o último segmento é o custom ID.
- O nome sai de `[data-test="task-title__text-area"]`, com fallback para o
  `document.title` (`Nome da task | #id`). Os restantes campos saem do hero
  section e dos breadcrumbs, pelo mapa `SHORTCODES` no `content.js`. Todos os
  selectors foram confirmados numa task real em Setembro de 2026. Se partirem
  demasiadas vezes, o passo seguinte é ir à API do ClickUp com um token pessoal
  em `chrome.storage.local`.
- Os assignees saem da lista `ul` escondida do `cu-assignees` (a versão à vista
  colapsa em avatares quando são mais do que um).
- O ClickUp tem tema claro e escuro e não segue o tema do sistema, por isso o
  menu escolhe as cores pela luminância do fundo por baixo do botão.

## Release

Tag `vX.Y.Z` → o workflow sincroniza a versão do `manifest.json` com a tag,
valida, empacota e publica o zip na release.

```bash
git tag v1.4.0 && git push origin v1.4.0
```

## Fora de âmbito (v1)

Vários templates, mapeamento lista → pasta local (`folder`), atalho de teclado,
botão nas linhas da lista, abrir no CLI em vez do Desktop.
