import { ConnectRouter } from "@connectrpc/connect";
import { MatrixEvaluatorService } from "@repo/proto";
import { matrixEvaluatorHandler } from "@/handlers/matrix-evaluator.handler";

/** Register all Connect-RPC service handlers into the router */
export function registerConnectRoutes(router: ConnectRouter) {
  router.service(MatrixEvaluatorService, matrixEvaluatorHandler);
}
