import "dotenv/config";
import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import { mountConnectRouter } from "@/connect-hono.adapter";
import { authInterceptor } from "@/interceptors/auth.interceptor";
import { registerConnectRoutes } from "@/router";

const PORT = 8080;
const WEB_ORIGIN = process.env.WEB_ORIGIN ?? "http://localhost:3000";

const app = new Hono();

app.use(logger());
// Auth endpoints are hosted by Neon Auth; RPCs authenticate via a Bearer JWT
// verified against Neon's JWKS in the auth interceptor.
app.use(
  cors({
    origin: WEB_ORIGIN,
    allowMethods: ["POST", "GET", "OPTIONS"],
    allowHeaders: ["Content-Type", "Connect-Protocol-Version", "Authorization"],
    exposeHeaders: ["Grpc-Status", "Grpc-Message", "Connect-Content-Encoding"],
  }),
);

app.get("/healthz", (c) => c.json({ status: "ok" }));

mountConnectRouter(app, registerConnectRoutes, {
  interceptors: [authInterceptor],
});

serve({ fetch: app.fetch, port: PORT }, (info) => {
  console.log(
    `🚀 Connect-RPC Backend Engine (Hono) listening on http://localhost:${info.port}`,
  );
});
