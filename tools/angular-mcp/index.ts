import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { execFile } from 'node:child_process';
import { resolve } from 'node:path';
import { promisify } from 'node:util';
import { z } from 'zod';

const exec = promisify(execFile);
// Both tools/angular-mcp and dist/angular-mcp are two levels below the workspace.
const projectRoot = resolve(__dirname, '../..');
const relativePath = z
  .string()
  .regex(/^[a-zA-Z0-9_][a-zA-Z0-9_-]*(\/[a-zA-Z0-9_][a-zA-Z0-9_-]*)*$/, 'Use relative name segments separated by /');

const server = new McpServer({ name: 'workshops-de-angular-mcp', version: '1.0.0' });

server.registerTool(
  'generate_component',
  {
    title: 'Generate Angular Component',
    description: 'Creates an Angular component in this workspace using its installed Angular CLI',
    inputSchema: {
      name: relativePath.describe('Component name, optionally including relative subdirectories'),
      path: z.string().optional().describe('Target directory relative to src/app; an src/app prefix is also accepted')
    }
  },
  async ({ name, path }) => {
    try {
      const directory = path
        ?.replace(/\\/g, '/')
        .replace(/^src\/app(?:\/|$)/, '')
        .replace(/(.)\/$/, '$1');
      if (directory) {
        relativePath.parse(directory);
      }
      const target = directory ? `${directory}/${name}` : name;
      const { stdout, stderr } = await exec(
        process.execPath,
        [
          resolve(projectRoot, 'node_modules/@angular/cli/bin/ng.js'),
          'generate',
          'component',
          target,
          '--standalone',
          '--flat',
          '--skip-tests',
          '--inline-style',
          '--inline-template',
          '--no-interactive'
        ],
        {
          cwd: projectRoot,
          timeout: 120_000,
          maxBuffer: 1024 * 1024,
          windowsHide: true,
          env: { ...process.env, NG_CLI_ANALYTICS: 'false', FORCE_COLOR: '0' }
        }
      );
      return { content: [{ type: 'text', text: `Component generated successfully:\n${stdout}${stderr}` }] };
    } catch (error: unknown) {
      return {
        isError: true,
        content: [{ type: 'text', text: `CLI Error: ${error instanceof Error ? error.message : 'Unknown error'}` }]
      };
    }
  }
);

// Match the fields consumed by the BookMonkey UI; reject malformed API payloads.
const bookSchema = z.object({
  id: z.string(),
  isbn: z.string(),
  title: z.string(),
  subtitle: z.string().optional(),
  author: z.string(),
  publisher: z.string(),
  numPages: z.number(),
  price: z.string(),
  cover: z.string(),
  abstract: z.string(),
  userId: z.number()
});
const paginationSchema = {
  page: z.number().int().min(1).default(1).describe('Page number, starting at 1'),
  pageSize: z.number().int().min(1).max(100).default(10).describe('Books per page (1–100)')
};
const readAnnotations = { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true };

function bookToolError(error: unknown) {
  let message = 'Book API request failed. Check that the Bookmonkey API is running and BOOKMONKEY_API_URL is correct.';
  if (error instanceof z.ZodError) {
    message = 'The Book API returned an invalid response; expected BookMonkey book data.';
  } else if (error instanceof Error && error.name === 'TimeoutError') {
    message = 'The Book API did not respond within 10 seconds. Try again later.';
  } else if (error instanceof Error && error.message.startsWith('Book API:')) {
    message = error.message;
  }
  return { isError: true, content: [{ type: 'text' as const, text: message }] };
}

async function requestBooks<T>(endpoint: string, schema: z.ZodType<T>, params?: URLSearchParams) {
  const baseUrl = new URL(process.env['BOOKMONKEY_API_URL'] ?? 'http://localhost:4730');
  if (!['http:', 'https:'].includes(baseUrl.protocol) || baseUrl.search || baseUrl.hash) {
    throw new Error('Book API: BOOKMONKEY_API_URL must be an HTTP(S) base URL without a query or fragment.');
  }
  const url = new URL(`${baseUrl.href.replace(/\/$/, '')}/books${endpoint}`);
  if (params) url.search = params.toString();
  const response = await fetch(url, { signal: AbortSignal.timeout(10_000), headers: { Accept: 'application/json' } });
  if (!response.ok) {
    if (response.status === 404 && endpoint) throw new Error('Book API: Book not found. Search for its ID first.');
    throw new Error(`Book API: Request failed (HTTP ${response.status}). Try again later.`);
  }
  let json: unknown;
  try {
    json = await response.json();
  } catch (error: unknown) {
    if (!(error instanceof SyntaxError)) throw error;
    throw new Error('Book API: Invalid JSON response.');
  }
  return { data: schema.parse(json), response };
}

async function getBookPage(page: number, pageSize: number, query?: string) {
  try {
    const params = new URLSearchParams({ _limit: String(pageSize) });
    if (page > 1) params.set('_page', String(page));
    if (query) params.set('q', query);
    const { data: books, response } = await requestBooks('', z.array(bookSchema), params);
    const count = response.headers.get('X-Total-Count');
    const parsedCount = count?.trim() ? Number(count) : NaN;
    const total = Number.isSafeInteger(parsedCount) && parsedCount >= 0 ? parsedCount : null;
    const result = { books, page, pageSize, total };
    return { content: [{ type: 'text' as const, text: JSON.stringify(result) }], structuredContent: result };
  } catch (error: unknown) {
    return bookToolError(error);
  }
}

server.registerTool(
  'list_books',
  {
    title: 'List Books',
    description:
      'Browse the BookMonkey catalog page by page. Returns books and their IDs; total is null if the API omits a valid count.',
    inputSchema: paginationSchema,
    annotations: readAnnotations
  },
  async ({ page, pageSize }) => getBookPage(page, pageSize)
);

server.registerTool(
  'search_books',
  {
    title: 'Search Books',
    description:
      'Search the BookMonkey catalog using the same full-text q query as the app (for example title or author). Returns books and IDs for get_book_details.',
    inputSchema: {
      query: z.string().trim().min(1).max(500).describe('Search text, for example a title or author'),
      ...paginationSchema
    },
    annotations: readAnnotations
  },
  async ({ query, page, pageSize }) => getBookPage(page, pageSize, query)
);

server.registerTool(
  'get_book_details',
  {
    title: 'Get Book Details',
    description:
      'Get a BookMonkey book by its exact ID from list_books or search_books, including ISBN, author, publisher, pages, price and abstract.',
    inputSchema: {
      id: z
        .string()
        .trim()
        .min(1)
        .max(500)
        .refine(value => value !== '.' && value !== '..', 'Use a book ID')
        .describe('Exact book ID, not a title or ISBN search')
    },
    annotations: readAnnotations
  },
  async ({ id }) => {
    try {
      const { data: book } = await requestBooks(`/${encodeURIComponent(id)}`, bookSchema);
      return { content: [{ type: 'text' as const, text: JSON.stringify(book) }], structuredContent: book };
    } catch (error: unknown) {
      return bookToolError(error);
    }
  }
);

// stdout is reserved for MCP protocol messages; diagnostics belong on stderr.
server.connect(new StdioServerTransport()).catch((error: unknown) => {
  console.error('Error connecting to MCP server:', error);
  process.exitCode = 1;
});
