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

// stdout is reserved for MCP protocol messages; diagnostics belong on stderr.
server.connect(new StdioServerTransport()).catch((error: unknown) => {
  console.error('Error connecting to MCP server:', error);
  process.exitCode = 1;
});
