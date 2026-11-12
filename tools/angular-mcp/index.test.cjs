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
      ['generate_component']
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
    assert.equal((await client.listTools()).tools.length, 1);
  } finally {
    await client.close();
    // Only remove the exact temporary workspace allocated by this test.
    assert.equal(path.dirname(workspace), path.resolve(os.tmpdir()));
    assert.ok(path.basename(workspace).startsWith('bookmonkey-angular-mcp-'));
    await fs.rm(workspace, { recursive: true, force: true });
  }
});
