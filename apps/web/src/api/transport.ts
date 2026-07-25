import { createConnectTransport } from '@connectrpc/connect-web';
import { authInterceptor } from '@/api/interceptors/auth.interceptor';

// Create ConnectTransport setup (baseURL, binary/JSON transport)
export const connectTransport = createConnectTransport({
  baseUrl: 'http://localhost:8080',
  useBinaryFormat: false,
  interceptors: [authInterceptor],
});
