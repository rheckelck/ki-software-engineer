<h1 align="center">Modern Angular Workshop</h1>

<p align="center">
  <img alt="workshops-de-logo-blue" src="docs/logo-workshops-de.png" width="120">
  <br>
  <em>The best way to start embracing AI for your all-day development tasks</em>
  <br>
</p>

<p align="center">
  <a href="https://workshops.de/seminare-schulungen-kurse/angular-ai-agent-driven-development" target="_blank"><strong>workshops.de</strong></a>
  <br>
</p>

## Architecture

See [the architecture summary](ARCHITECTURE.md) for the technology stack, dependencies, application structure, and data flow.

## Local Development

| Command       | Description                                      |
| ------------- | ------------------------------------------------ |
| `npm install` | Installs the packages to develop the Angular app |
| `npm start`   | Starts the Angular app                           |

## Validation

| Command                | Purpose                                                              |
| ---------------------- | -------------------------------------------------------------------- |
| `npm test`             | Run unit tests once in Chrome Headless                               |
| `npm run test:watch`   | Run unit tests in watch mode                                         |
| `npm run test:e2e`     | Run all application browser tests in Chromium                        |
| `npm run test:e2e:all` | Run browser tests in Chromium, Firefox, and WebKit                   |
| `npm run typecheck`    | Check application and test TypeScript                                |
| `npm run format:check` | Check source, test, configuration, and documentation formatting      |
| `npm run build`        | Build for production (Google Fonts inlining requires network access) |

Unit tests require Chrome; set `CHROME_BIN` if it is not automatically detected. Install Playwright's Chromium with
`npx playwright install chromium`, or all configured browsers with `npx playwright install`.
Application browser tests mock the API and do not need a running Bookmonkey API. External-site workshop examples
are preserved in `tests-examples/` and are excluded from the default suite.

## The API

| Command              | Description                                       |
| -------------------- | ------------------------------------------------- |
| `npx bookmonkey-api` | Installs and starts the HTTP API "Bookmonkey API" |

The API provides fake data that you can use in your Angular application.

The frontend's API origin is configured through the `API_BASE_URL` provider in
`src/app/app.config.ts`. Change that provider for a different backend; the book client appends `/books`.

> [!NOTE]
> The API starts at http://localhost:4730.
> When you open this page, you’ll find documentation for all endpoints. 🚀

## VS Code

If you are using [VS Code](https://code.visualstudio.com/) as you editor of choice, you might see a popup after opening this repository.
We added a few plugin recommendations to simplify writing code during the workshop:

1. Angular Language Service - Adds better syntax-highlighting & automatic refactorings
1. Prettier - Formats your code automatically in the same way across your project.

## Angular CLI MCP server

`tools/angular-mcp/index.ts` exposes the `generate_component` tool over stdio. It uses the installed Angular CLI
in this repository, independently of the directory from which the MCP client starts it. `@types/node` was already
installed; the server adds `@modelcontextprotocol/sdk` and `zod`.

Build and inspect the server from the repository root:

```bash
npm run build.angular-mcp
npx @modelcontextprotocol/inspector node dist/angular-mcp/index.js
```

In the Inspector, connect using stdio, list the tools, and call `generate_component`, for example:

```json
{
  "name": "book-preview",
  "path": "src/app/books"
}
```

This creates `src/app/books/book-preview.ts` with an inline template and styles, without a component test file.
The optional `path` is a directory relative to `src/app`, not an Angular project name. The `src/app` prefix and
Windows path separators are accepted. Names can include relative subdirectories; segments accept letters, digits,
underscores, and hyphens. Absolute paths, traversal segments, and CLI options are rejected.

For an MCP client using an `mcpServers` configuration (such as Cursor), add this entry to its MCP settings,
adjusting the absolute server path to your checkout:

```json
{
  "mcpServers": {
    "bookmonkey-angular": {
      "command": "node",
      "args": ["D:/Workshop/ki-software-engineer/dist/angular-mcp/index.js"]
    }
  }
}
```

For other clients, configure the same stdio command and arguments in their MCP server settings. Rebuild after
changing the server source. The server can create files in this checkout; review generated components before using them.
CLI failures return MCP tool errors with diagnostics; server startup errors go to stderr to preserve the protocol on stdout.

Run `npm run test:angular-mcp` to build and verify tool discovery, actual CLI generation, path handling, validation,
and conflict recovery through an SDK client in a temporary Angular workspace. These tests do not change application source.
