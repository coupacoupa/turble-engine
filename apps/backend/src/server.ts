import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import { mountConnectRouter } from "@/connect-hono.adapter";
import { authInterceptor } from "@/interceptors/auth.interceptor";
import { registerConnectRoutes } from "@/router";

const PORT = 8080;

const app = new Hono();

app.use(logger());
app.use(
  cors({
    origin: "*",
    allowMethods: ["POST", "GET", "OPTIONS"],
    allowHeaders: [
      "Content-Type",
      "Connect-Protocol-Version",
      "Authorization",
      "x-user-id",
    ],
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
