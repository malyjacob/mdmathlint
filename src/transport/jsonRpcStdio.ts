import process from "node:process";

export interface JsonRpcRequest {
  id?: number | string;
  method?: string;
  params?: unknown;
}

type RpcFraming = "content-length" | "newline";

let responseFraming: RpcFraming = "content-length";

/** Encode a JSON-RPC message with Content-Length header. */
export function rpcMessage(payload: object): string {
  const body = JSON.stringify(payload);
  if (responseFraming === "newline") return `${body}\n`;
  return `Content-Length: ${Buffer.byteLength(body)}\r\n\r\n${body}`;
}

/** Encode a JSON-RPC 2.0 success response. */
export function rpcResponse(id: number | string | undefined, result: unknown): string {
  return rpcMessage({ jsonrpc: "2.0", id: id ?? null, result });
}

/** Encode a JSON-RPC 2.0 notification (no id). */
export function rpcNotification(method: string, params: object): string {
  return rpcMessage({ jsonrpc: "2.0", method, params });
}

/** Encode a JSON-RPC 2.0 error response. */
export function rpcError(id: number | string | undefined, code: number, message: string): string {
  return rpcMessage({ jsonrpc: "2.0", id: id ?? null, error: { code, message } });
}

/**
 * Start a JSON-RPC 2.0 server over stdio.
 * Reads messages from stdin, passes them to the handler, and writes responses to stdout.
 * Handler receives parsed requests; returns an array of strings to write back.
 */
export function startRpcServer(handler: (request: JsonRpcRequest) => Promise<string[]>): void {
  let input = Buffer.alloc(0);
  let processing = Promise.resolve();

  process.stdin.on("data", (chunk: Buffer) => {
    input = Buffer.concat([input, chunk]);
    processing = processing.then(drain).catch((error: unknown) => {
      process.stderr.write(`rpc: ${error instanceof Error ? error.message : String(error)}\n`);
    });
  });

  process.stdin.on("end", () => {
    const keepAlive = setInterval(() => undefined, 1000);
    processing = processing
      .then(drain)
      .catch((error: unknown) => {
        process.stderr.write(`rpc: ${error instanceof Error ? error.message : String(error)}\n`);
      })
      .finally(() => clearInterval(keepAlive));
  });

  async function drain(): Promise<void> {
    for (;;) {
      const separator = input.indexOf("\r\n\r\n");
      let body: string | undefined;

      if (separator !== -1) {
        const header = input.subarray(0, separator).toString("ascii");
        const length = Number.parseInt(header.match(/Content-Length:\s*(\d+)/i)?.[1] ?? "", 10);
        if (!Number.isInteger(length)) {
          input = Buffer.alloc(0);
          return;
        }
        const bodyStart = separator + 4;
        if (input.length < bodyStart + length) return;
        body = input.subarray(bodyStart, bodyStart + length).toString("utf8");
        input = input.subarray(bodyStart + length);
        responseFraming = "content-length";
      } else {
        const newline = input.indexOf("\n");
        if (newline === -1) return;
        body = input.subarray(0, newline).toString("utf8").trim();
        input = input.subarray(newline + 1);
        if (!body) continue;
        responseFraming = "newline";
      }

      const outputs = await handler(JSON.parse(body) as JsonRpcRequest);
      outputs.forEach((output) => process.stdout.write(output));
    }
  }
}
