import {
  createConnectRouter,
  type ConnectRouter,
  type ConnectRouterOptions,
} from "@connectrpc/connect";
import { createFetchHandler } from "@connectrpc/connect/protocol";
import type { Hono } from "hono";

/**
 * Mount Connect-RPC services onto a Hono app.
 *
 * Each RPC is registered at its canonical request path
 * (`/<package>.<Service>/<Method>`) using Connect's fetch-API universal
 * handlers, so the same app runs unchanged on Node, AWS Lambda, or any
 * other fetch-based runtime.
 */
export function mountConnectRouter(
  app: Hono,
  routes: (router: ConnectRouter) => void,
  options?: ConnectRouterOptions,
): void {
  const router = createConnectRouter(options);
  routes(router);

  for (const uHandler of router.handlers) {
    const fetchHandler = createFetchHandler(uHandler);
    app.on(uHandler.allowedMethods, uHandler.requestPath, (c) =>
      fetchHandler(c.req.raw),
    );
  }
}
