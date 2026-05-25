const path = require("node:path");
const vscode = require("vscode");
const { LanguageClient, TransportKind } = require("vscode-languageclient/node");

let client;

function activate(context) {
  const configuredPath = vscode.workspace.getConfiguration("mdmathlint").get("serverPath");
  const serverPath = configuredPath || path.resolve(context.extensionPath, "..", "dist", "lsp.js");
  const serverOptions = {
    run: { module: serverPath, transport: TransportKind.stdio },
    debug: { module: serverPath, transport: TransportKind.stdio },
  };
  const clientOptions = {
    documentSelector: [{ scheme: "file", language: "markdown" }, { scheme: "untitled", language: "markdown" }],
    synchronize: { configurationSection: "mdmathlint" },
  };
  client = new LanguageClient("mdmathlint", "mdmathlint", serverOptions, clientOptions);
  client.start();
  context.subscriptions.push({ dispose: () => void client.stop() });
}

async function deactivate() {
  if (client) await client.stop();
}

module.exports = { activate, deactivate };
