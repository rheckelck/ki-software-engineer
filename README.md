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

`tools/angular-mcp/index.ts` exposes book catalog tools and `generate_component` over stdio. The generator uses the installed Angular CLI
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
      "args": ["D:/Workshop/ki-software-engineer/dist/angular-mcp/index.js"],
      "env": { "BOOKMONKEY_API_URL": "http://localhost:4730" }
    }
  }
}
```

For other clients, configure the same stdio command and arguments in their MCP server settings. Rebuild after
changing the server source. The server can create files in this checkout; review generated components before using them.
CLI failures return MCP tool errors with diagnostics; server startup errors go to stderr to preserve the protocol on stdout.

Run `npm run test:angular-mcp` to build and verify tool discovery, actual CLI generation, path handling, validation,
and conflict recovery through an SDK client in a temporary Angular workspace. These tests do not change application source.

### Book catalog tools

Start the Bookmonkey API separately with `npx bookmonkey-api`. The Angular dev server is not needed for MCP
catalog access. By default, the MCP server uses `http://localhost:4730`, matching `app.config.ts`. Set the MCP
process environment variable `BOOKMONKEY_API_URL` to use a different HTTP(S) base URL. This setting is independent
of the Angular `API_BASE_URL` provider; configure both when switching backends. Restart the MCP connection after
changing its environment or rebuilding the server.

| Tool               | Arguments                                            | Result                                                                    |
| ------------------ | ---------------------------------------------------- | ------------------------------------------------------------------------- |
| `list_books`       | Optional `page` (default 1), `pageSize` (default 10) | A catalog page with book IDs                                              |
| `search_books`     | Required `query`, optional `page`, `pageSize`        | Full-text search using the app's `q` API parameter                        |
| `get_book_details` | Required `id` from a catalog/search result           | Book details including ISBN, author, publisher, pages, price and abstract |

Page numbers start at 1; page sizes range from 1 to 100. Listing and search return `{ books, page, pageSize, total }`.
`total` is `null` when the API does not supply a valid `X-Total-Count` header. Empty search results are successful
responses with an empty `books` array. Results are available as both JSON text and MCP `structuredContent`.

For example, call `search_books` with `{ "query": "Angular", "pageSize": 5 }`, then pass an exact returned ID
to `get_book_details` with `{ "id": "<returned-id>" }`. A title or ISBN is search text, not necessarily a book ID.
The tools query the API directly and do not navigate an open browser. They are read-only; they do not modify books.
Backend failures, missing books, invalid responses, and a ten-second timeout return clear MCP tool errors.

`npm run test:angular-mcp` also verifies these tools through a real stdio MCP connection against a local mock HTTP
API, including pagination, URL encoding, empty results, validation, 404/500 errors, malformed data, timeout, offline
behavior and recovery. No running Bookmonkey API is required for these tests.
