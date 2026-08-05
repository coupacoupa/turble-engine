import { ConnectRouter } from "@connectrpc/connect";
import { MatrixEvaluatorService, WorkflowService } from "@repo/proto";
import { matrixEvaluatorHandler } from "@/handlers/matrix-evaluator.handler";
import { workflowHandler } from "@/handlers/workflow.handler";

/** Register all Connect-RPC service handlers into the router */
export function registerConnectRoutes(router: ConnectRouter) {
  router.service(MatrixEvaluatorService, matrixEvaluatorHandler);
  router.service(WorkflowService, workflowHandler);
}
