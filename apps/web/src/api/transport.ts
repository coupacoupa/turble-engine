import { createConnectTransport } from "@connectrpc/connect-web";
import { authInterceptor } from "@/api/interceptors/auth.interceptor";

// Create ConnectTransport setup (baseURL, binary/JSON transport).
// Auth rides on the Authorization header (set by authInterceptor), not cookies.
export const connectTransport = createConnectTransport({
  baseUrl: import.meta.env.VITE_API_URL ?? "http://localhost:8080",
  useBinaryFormat: false,
  interceptors: [authInterceptor],
});
