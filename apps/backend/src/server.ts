import http from 'node:http';
import { connectNodeAdapter } from '@connectrpc/connect-node';
import { authInterceptor } from '@/interceptors/auth.interceptor';
import { registerConnectRoutes } from '@/router';

const PORT = 8080;

// Create Connect Node HTTP request listener
const handler = connectNodeAdapter({
  routes: registerConnectRoutes,
  interceptors: [authInterceptor],
});

// Create HTTP server with CORS headers for browser requests
const server = http.createServer((req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Connect-Protocol-Version, Authorization, x-user-id');
  res.setHeader('Access-Control-Expose-Headers', 'Grpc-Status, Grpc-Message, Connect-Content-Encoding');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  handler(req, res);
});

server.listen(PORT, () => {
  console.log(`🚀 Connect-RPC Backend Engine listening on http://localhost:${PORT}`);
});
