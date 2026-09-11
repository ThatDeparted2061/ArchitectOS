import * as vscode from 'vscode';
import * as path from 'path';
import * as cp from 'child_process';
import * as http from 'http';

let serverProcess: cp.ChildProcess | null = null;
let backendOutputChannel: vscode.OutputChannel | null = null;

export function activate(context: vscode.ExtensionContext) {
  console.log('ArchitectOS Extension Activated.');

  // Create VS Code Output Channel for backend logs
  backendOutputChannel = vscode.window.createOutputChannel("ArchitectOS");
  backendOutputChannel.appendLine("Starting ArchitectOS Server (Express + Frontend on Port 3000)...");
  backendOutputChannel.show();

  // Ensure port 3000 is clean before starting
  if (process.platform === 'win32') {
    try {
      cp.execSync('powershell -Command "Get-NetTCPConnection -LocalPort 3000 -ErrorAction SilentlyContinue | Where-Object { $_.OwningProcess -gt 4 } | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue }"', { stdio: 'ignore' });
    } catch {}
  }

  // Start Express backend process automatically (serves both API & Frontend bundle)
  const backendPath = path.join(context.extensionPath, '../backend/index.ts');
  try {
    serverProcess = cp.spawn('npx', ['tsx', backendPath], {
      cwd: path.join(context.extensionPath, '../backend'),
      shell: true,
      env: { ...process.env, PORT: '3000', AI_ENABLED: 'true' }
    });

    serverProcess.stdout?.on('data', (data) => {
      backendOutputChannel?.append(data.toString());
    });
    serverProcess.stderr?.on('data', (data) => {
      backendOutputChannel?.append(`[Error] ${data.toString()}`);
    });
  } catch (err: any) {
    backendOutputChannel?.appendLine(`Failed to start backend server process: ${err.message}`);
  }

  // Register dashboard command
  let disposable = vscode.commands.registerCommand('architectos.open', () => {
    const panel = vscode.window.createWebviewPanel(
      'architectos',
      'ArchitectOS Visualizer',
      vscode.ViewColumn.Beside,
      {
        enableScripts: true,
        retainContextWhenHidden: true,
        portMapping: [
          { webviewPort: 3000, extensionHostPort: 3000 }
        ]
      }
    );

    // Embed the unified server iframe
    panel.webview.html = getWebviewContent();

    // Handle messages from the webview
    panel.webview.onDidReceiveMessage(async (message) => {
      // 1. Read workspace files for reverse-engineering
      if (message.command === 'readWorkspaceFiles') {
        try {
          const uris = await vscode.workspace.findFiles(
            '**/*.{js,ts,jsx,tsx,py,go,java,rs,c,cpp,h,rb,php,cs,swift,kt}',
            '{**/node_modules/**,**/.venv/**,**/venv/**,**/.git/**,**/.vscode/**,**/dist/**,**/build/**}'
          );
          const sliced = uris.slice(0, 40);
          const files = [];
          for (const uri of sliced) {
            const contentBuffer = await vscode.workspace.fs.readFile(uri);
            const content = new TextDecoder('utf-8').decode(contentBuffer);
            const relativePath = vscode.workspace.asRelativePath(uri);
            files.push({ path: relativePath, content });
          }
          // Send files back to the Webview (which then forwards them to the iframe)
          panel.webview.postMessage({ command: 'workspaceFilesResult', files });
        } catch (error: any) {
          vscode.window.showErrorMessage('Failed to read workspace files: ' + error.message);
        }
      }

      // 2. Open file directly in VS Code editor when clicked on visual graph card
      if (message.command === 'openFile' && message.path) {
        try {
          const workspaceFolders = vscode.workspace.workspaceFolders;
          if (workspaceFolders && workspaceFolders.length > 0) {
            const rootUri = workspaceFolders[0].uri;
            const targetUri = vscode.Uri.joinPath(rootUri, message.path);
            vscode.window.showTextDocument(targetUri, { viewColumn: vscode.ViewColumn.One, preview: true });
          }
        } catch (error: any) {
          vscode.window.showErrorMessage(`Failed to open file ${message.path}: ${error.message}`);
        }
      }
    });
  });

  context.subscriptions.push(disposable);

  // Connect to Express backend SSE events stream to support terminal command opens
  connectToBackendEvents();
}

export function deactivate() {
  if (serverProcess && serverProcess.pid) {
    try {
      if (process.platform === 'win32') {
        cp.execSync(`taskkill /pid ${serverProcess.pid} /T /F`);
      } else {
        serverProcess.kill('SIGTERM');
      }
    } catch {
      serverProcess.kill();
    }
    serverProcess = null;
  }
}

function connectToBackendEvents() {
  const req = http.get('http://localhost:3000/extension-events', (res) => {
    res.on('data', (chunk) => {
      const message = chunk.toString();
      if (message.includes('data: open')) {
        vscode.commands.executeCommand('architectos.open');
      }
    });

    res.on('end', () => {
      setTimeout(connectToBackendEvents, 2000);
    });
  });

  req.on('error', () => {
    setTimeout(connectToBackendEvents, 2000);
  });
}

function getWebviewContent() {
  return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta http-equiv="Content-Security-Policy" content="default-src * 'unsafe-inline' 'unsafe-eval' data: blob:; frame-src http://localhost:* http://127.0.0.1:* *; connect-src http://localhost:* http://127.0.0.1:* ws://localhost:* ws://127.0.0.1:* *;">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>ArchitectOS Dashboard</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { background: #0b0f19; color: #94a3b8; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; height: 100vh; width: 100vw; overflow: hidden; display: flex; align-items: center; justify-content: center; }
        #loading-screen { display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 16px; text-align: center; }
        .spinner { width: 36px; height: 36px; border: 3px solid rgba(59, 130, 246, 0.2); border-top-color: #3b82f6; border-radius: 50%; animation: spin 0.8s linear infinite; }
        @keyframes spin { to { transform: rotate(360deg); } }
        .title { color: #f8fafc; font-weight: 700; font-size: 15px; letter-spacing: 0.05em; text-transform: uppercase; }
        .subtitle { font-size: 12px; color: #64748b; font-family: monospace; }
        #iframe { width: 100vw; height: 100vh; border: none; display: none; }
    </style>
</head>
<body>
    <div id="loading-screen">
        <div class="spinner"></div>
        <div class="title">ArchitectOS Visualizer</div>
        <div class="subtitle" id="status-text">Booting backend server on Port 3000...</div>
    </div>
    <iframe id="iframe" src="" style="width: 100vw; height: 100vh; border: none;"></iframe>

    <script>
        const vscode = acquireVsCodeApi();
        const iframe = document.getElementById('iframe');
        const loadingScreen = document.getElementById('loading-screen');
        const statusText = document.getElementById('status-text');

        async function waitForServerAndLoad() {
            let retries = 0;
            const maxRetries = 30;

            while (retries < maxRetries) {
                try {
                    const res = await fetch('http://localhost:3000/health', { mode: 'no-cors' });
                    statusText.innerText = 'Connected! Loading interface...';
                    iframe.src = 'http://localhost:3000';
                    iframe.style.display = 'block';
                    loadingScreen.style.display = 'none';
                    return;
                } catch (e) {
                    retries++;
                    statusText.innerText = 'Connecting to server (attempt ' + retries + '/' + maxRetries + ')...';
                    await new Promise(r => setTimeout(r, 1000));
                }
            }

            statusText.innerHTML = '<span style="color: #ef4444;">Could not connect to server on port 3000.</span><br><br><button onclick="location.reload()" style="background: #3b82f6; color: #fff; border: none; padding: 6px 14px; font-weight: bold; cursor: pointer; border-radius: 2px;">Retry</button>';
        }

        waitForServerAndLoad();

        // Forward messages between frontend and VS Code extension host
        window.addEventListener('message', (event) => {
            if (event.origin.startsWith('http://localhost:3000') || event.origin.startsWith('http://127.0.0.1:3000')) {
                vscode.postMessage(event.data);
            } else if (iframe && iframe.contentWindow && event.source !== iframe.contentWindow) {
                iframe.contentWindow.postMessage(event.data, '*');
            }
        });
    </script>
</body>
</html>`;
}
