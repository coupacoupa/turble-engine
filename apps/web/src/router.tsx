import {
  createRootRoute,
  createRoute,
  createRouter,
  Link,
  Outlet,
  redirect,
  useNavigate,
} from "@tanstack/react-router";
import React from "react";
import {
  NeonAuthUIProvider,
  AuthView,
} from "@neondatabase/neon-js/auth/react/ui";
import { authClient } from "@/lib/auth-client";
import { MatrixBuilderPage } from "@/pages/matrix-builder.page";
import { WorkflowDirectoryPage } from "@/pages/workflow-directory.page";

/** Redirect to the sign-in page when no Neon Auth session exists. */
async function requireSession() {
  const { data } = await authClient.getSession();
  if (!data?.session) {
    throw redirect({
      to: "/auth/$pathname",
      params: { pathname: "sign-in" },
    });
  }
}

function RootLayout() {
  const navigate = useNavigate();
  return (
    <NeonAuthUIProvider
      authClient={authClient}
      // Bridge Neon Auth UI's string-path navigation into TanStack Router.
      navigate={(href: string) => navigate({ to: href as never })}
      replace={(href: string) => navigate({ to: href as never, replace: true })}
      Link={({ href, ...props }) => <Link to={href as never} {...props} />}
      social={{ providers: ["google"] }}
    >
      <Outlet />
    </NeonAuthUIProvider>
  );
}

const rootRoute = createRootRoute({
  component: RootLayout,
});

/** Hosted auth pages: /auth/sign-in, /auth/sign-up, /auth/forgot-password, ... */
function AuthPage() {
  const { pathname } = authRoute.useParams();
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 p-4">
      <AuthView pathname={pathname} />
    </div>
  );
}

const authRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/auth/$pathname",
  component: AuthPage,
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
  beforeLoad: requireSession,
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
  beforeLoad: requireSession,
  component: BuilderRoute,
});

const routeTree = rootRoute.addChildren([
  authRoute,
  directoryRoute,
  builderRoute,
]);

export const router = createRouter({ routeTree });

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}
