const assert = require('node:assert/strict');
const { test } = require('node:test');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { Client } = require('@modelcontextprotocol/sdk/client/index.js');
const { StdioClientTransport } = require('@modelcontextprotocol/sdk/client/stdio.js');

const projectRoot = path.resolve(__dirname, '../..');

test('stdio tool generates components and reports validation and CLI failures', { timeout: 120_000 }, async () => {
  const workspace = await fs.mkdtemp(path.join(os.tmpdir(), 'bookmonkey-angular-mcp-'));
  const client = new Client({ name: 'angular-mcp-test', version: '1.0.0' });
  const transport = new StdioClientTransport({
    command: process.execPath,
    args: [path.join(workspace, 'dist/angular-mcp/index.js')],
    cwd: os.tmpdir(),
    stderr: 'pipe'
  });
  try {
    await fs.mkdir(path.join(workspace, 'dist/angular-mcp'), { recursive: true });
    await fs.mkdir(path.join(workspace, 'src/app'), { recursive: true });
    await fs.copyFile(
      path.join(projectRoot, 'dist/angular-mcp/index.js'),
      path.join(workspace, 'dist/angular-mcp/index.js')
    );
    await fs.copyFile(path.join(projectRoot, 'angular.json'), path.join(workspace, 'angular.json'));
    await fs.writeFile(path.join(workspace, 'package.json'), '{"private":true}');
    await fs.symlink(path.join(projectRoot, 'node_modules'), path.join(workspace, 'node_modules'), 'junction');
    await client.connect(transport);
    const { tools } = await client.listTools();
    assert.deepEqual(
      tools.map(tool => tool.name),
      ['generate_component', 'list_books', 'search_books', 'get_book_details']
    );

    for (const [name, directory, expected] of [
      ['root-card', undefined, 'root-card'],
      ['book-card', 'src/app/books', 'books/book-card'],
      ['windows-card', 'src\\app\\books', 'books/windows-card'],
      ['nested/card', 'shared', 'shared/nested/card']
    ]) {
      const result = await client.callTool({ name: 'generate_component', arguments: { name, path: directory } });
      assert.ok(!result.isError, JSON.stringify(result));
      assert.match(result.content[0].text, /generated successfully/);
      const component = await fs.readFile(path.join(workspace, `src/app/${expected}.ts`), 'utf8');
      assert.match(component, /@Component/);
      assert.match(component, /template:/);
      assert.match(component, /styles:/);
      await assert.rejects(fs.access(path.join(workspace, `src/app/${expected}.spec.ts`)));
    }

    await fs.writeFile(path.join(workspace, 'src/app/root-card.ts'), '// Existing customized component');
    const duplicate = await client.callTool({ name: 'generate_component', arguments: { name: 'root-card' } });
    assert.equal(duplicate.isError, true);
    assert.match(duplicate.content[0].text, /CLI Error:/);

    for (const args of [
      { name: '../outside' },
      { name: 'card;echo injected' },
      { name: '--help' },
      { name: 'card', path: '../outside' },
      { name: 'card', path: '/absolute' },
      { name: 'card', path: '/' },
      { name: 'card', path: 'C:\\outside' }
    ]) {
      const result = await client.callTool({ name: 'generate_component', arguments: args });
      assert.equal(result.isError, true, JSON.stringify(args));
    }
    // A failed call must leave the server available for subsequent requests.
    assert.equal((await client.listTools()).tools.length, 4);
  } finally {
    await client.close();
    // Only remove the exact temporary workspace allocated by this test.
    assert.equal(path.dirname(workspace), path.resolve(os.tmpdir()));
    assert.ok(path.basename(workspace).startsWith('bookmonkey-angular-mcp-'));
    await fs.rm(workspace, { recursive: true, force: true });
  }
});

const http = require('node:http');

test('book tools use the application API contract and recover from API failures', { timeout: 40_000 }, async () => {
  const book = {
    id: 'book-1',
    isbn: '9780000000001',
    title: 'Angular',
    subtitle: 'A guide',
    author: 'Ada Example',
    publisher: 'Workshop',
    numPages: 320,
    price: '29.90',
    cover: 'https://example.org/cover.jpg',
    abstract: 'Learn Angular.',
    userId: 1
  };
  const requests = [];
  let reply = { body: [book], count: '21' };
  const api = http.createServer((req, res) => {
    requests.push(req.url);
    if (reply.hang) return;
    res.statusCode = reply.status ?? 200;
    if (reply.count !== undefined) res.setHeader('X-Total-Count', reply.count);
    res.setHeader('Content-Type', 'application/json');
    res.end(reply.raw ?? JSON.stringify(reply.body));
  });
  await new Promise(resolve => api.listen(0, '127.0.0.1', resolve));
  const apiUrl = `http://127.0.0.1:${api.address().port}/api`;
  const client = new Client({ name: 'book-tools-test', version: '1.0.0' });
  const transport = new StdioClientTransport({
    command: process.execPath,
    args: [path.join(projectRoot, 'dist/angular-mcp/index.js')],
    env: { ...process.env, BOOKMONKEY_API_URL: apiUrl },
    stderr: 'pipe'
  });
  const call = (name, args = {}) => client.callTool({ name, arguments: args });
  try {
    await client.connect(transport);
    for (const tool of (await client.listTools()).tools.filter(tool => tool.name !== 'generate_component')) {
      assert.equal(tool.annotations.readOnlyHint, true);
    }
    const listed = await call('list_books');
    assert.ok(!listed.isError, JSON.stringify(listed));
    assert.deepEqual(listed.structuredContent, { books: [book], page: 1, pageSize: 10, total: 21 });
    assert.deepEqual(JSON.parse(listed.content[0].text), listed.structuredContent);
    assert.equal(requests.at(-1), '/api/books?_limit=10');

    const searched = await call('search_books', { query: '  Ada & Angular?  ', page: 2, pageSize: 5 });
    assert.ok(!searched.isError, JSON.stringify(searched));
    const searchUrl = new URL(requests.at(-1), apiUrl);
    assert.equal(searchUrl.searchParams.get('q'), 'Ada & Angular?');
    assert.equal(searchUrl.searchParams.get('_page'), '2');
    assert.equal(searchUrl.searchParams.get('_limit'), '5');
    assert.equal(searched.structuredContent.page, 2);

    reply = { body: book };
    const details = await call('get_book_details', { id: 'book/1?#' });
    assert.deepEqual(details.structuredContent, book);
    assert.equal(requests.at(-1), '/api/books/book%2F1%3F%23');

    for (const count of [undefined, 'invalid', '-1', '1.5', '']) {
      reply = { body: [], count };
      const empty = await call('search_books', { query: 'missing' });
      assert.ok(!empty.isError);
      assert.deepEqual(empty.structuredContent, { books: [], page: 1, pageSize: 10, total: null });
    }
    reply = { body: [], count: '0' };
    assert.equal((await call('list_books')).structuredContent.total, 0);

    for (const [name, args] of [
      ['search_books', { query: '   ' }],
      ['list_books', { page: 0 }],
      ['list_books', { page: 1.5 }],
      ['list_books', { pageSize: 101 }],
      ['get_book_details', { id: '' }],
      ['get_book_details', { id: '..' }]
    ]) {
      const before = requests.length;
      assert.equal((await call(name, args)).isError, true);
      assert.equal(requests.length, before, 'invalid arguments must not reach the API');
    }

    for (const [response, name, args, expected] of [
      [{ status: 404, body: {} }, 'get_book_details', { id: 'missing' }, /Book not found/],
      [{ status: 500, body: { secret: 'backend-details' } }, 'list_books', {}, /HTTP 500/],
      [{ raw: '<html>Error</html>' }, 'list_books', {}, /Invalid JSON/],
      [{ body: [{ title: 'Incomplete' }] }, 'list_books', {}, /invalid response/],
      [{ body: [] }, 'get_book_details', { id: 'bad' }, /invalid response/],
      [{ hang: true }, 'list_books', {}, /within 10 seconds/]
    ]) {
      reply = response;
      const failed = await call(name, args);
      assert.equal(failed.isError, true, JSON.stringify(failed));
      assert.match(failed.content[0].text, expected);
      assert.doesNotMatch(failed.content[0].text, /backend-details/);
    }
    reply = { body: [book] };
    assert.ok(!(await call('list_books')).isError, 'server must recover after errors and timeout');
    api.closeAllConnections();
    await new Promise(resolve => api.close(resolve));
    const offline = await call('list_books');
    assert.equal(offline.isError, true);
    assert.match(offline.content[0].text, /Check that the Bookmonkey API is running/);
  } finally {
    await client.close();
    api.closeAllConnections();
    if (api.listening) await new Promise(resolve => api.close(resolve));
  }
});
