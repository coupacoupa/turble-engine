import {
  createRootRoute,
  createRoute,
  createRouter,
  Outlet,
  useNavigate,
} from "@tanstack/react-router";
import React from "react";
import { MatrixBuilderPage } from "@/pages/matrix-builder.page";
import { WorkflowDirectoryPage } from "@/pages/workflow-directory.page";

const rootRoute = createRootRoute({
  component: () => <Outlet />,
});

function DirectoryRoute() {
  const navigate = useNavigate();
  return (
    <WorkflowDirectoryPage
      onOpenBuilder={(workflowId) =>
        navigate({ to: "/builder/$workflowId", params: { workflowId } })
      }
    />
  );
}

const directoryRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/",
  component: DirectoryRoute,
});

function BuilderRoute() {
  const { workflowId } = builderRoute.useParams();
  const navigate = useNavigate();
  return (
    <MatrixBuilderPage
      workflowId={workflowId}
      onBackToDashboard={() => navigate({ to: "/" })}
    />
  );
}

const builderRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/builder/$workflowId",
  component: BuilderRoute,
});

const routeTree = rootRoute.addChildren([directoryRoute, builderRoute]);

export const router = createRouter({ routeTree });

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}
