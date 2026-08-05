import React from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Layers,
  Plus,
  ArrowRight,
  Cpu,
  GitBranch,
  Trash2,
  FolderPlus,
  Loader2,
} from "lucide-react";
import { WorkflowApiService } from "@/services/workflow-api.service";
import { AppHeader } from "@/components/layout/app-header.component";

interface WorkflowDirectoryPageProps {
  onOpenBuilder: (workflowId: string) => void;
}

export const WorkflowDirectoryPage: React.FC<WorkflowDirectoryPageProps> = ({
  onOpenBuilder,
}) => {
  const queryClient = useQueryClient();

  const workflowsQuery = useQuery({
    queryKey: ["workflows"],
    queryFn: WorkflowApiService.list,
  });
  const workflows = workflowsQuery.data ?? [];

  const createMutation = useMutation({
    mutationFn: () =>
      WorkflowApiService.create({
        name: "Untitled Matrix Workflow",
        description: "Newly initialized 2D decision matrix workflow.",
        columns: [{ id: `col_${Date.now()}`, label: "Step 1", order: 0 }],
        rows: [
          {
            id: `row_${Date.now()}`,
            label: "Row #1",
            order: 0,
            type: "standard",
          },
        ],
        cells: {},
      }),
    onSuccess: (record) => {
      queryClient.invalidateQueries({ queryKey: ["workflows"] });
      onOpenBuilder(record.id);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => WorkflowApiService.delete(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["workflows"] }),
    onError: (err) => {
      window.alert(err instanceof Error ? err.message : String(err));
    },
  });

  const handleCreateWorkflow = () => {
    if (!createMutation.isPending) createMutation.mutate();
  };

  const handleDeleteWorkflow = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    deleteMutation.mutate(id);
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans selection:bg-emerald-100 selection:text-emerald-900">
      {/* Top Navigation */}
      <AppHeader onCreateMatrix={handleCreateWorkflow} />

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-8">
        {/* Banner Title */}
        <div className="flex items-center justify-between flex-wrap gap-4 border-b border-slate-200 pb-6">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2.5">
              <Cpu className="h-6 w-6 text-emerald-600" />
              <span>Workflow Matrix Directory</span>
            </h1>
            <p className="text-slate-500 text-xs mt-1 font-mono">
              Manage custom 2D matrix workflows, decision table scorecards, and
              sub-capabilities.
            </p>
          </div>

          <button
            onClick={handleCreateWorkflow}
            disabled={createMutation.isPending}
            className="px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white font-bold text-xs flex items-center space-x-2 shadow-sm transition-all cursor-pointer"
          >
            {createMutation.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Plus className="h-4 w-4" />
            )}
            <span>Create New Matrix</span>
          </button>
        </div>

        {/* Loading / Error / Empty / Grid */}
        {workflowsQuery.isPending ? (
          <div className="flex items-center justify-center py-24 text-slate-400">
            <Loader2 className="h-6 w-6 animate-spin" />
          </div>
        ) : workflowsQuery.isError ? (
          <div className="p-8 border border-rose-200 rounded-2xl bg-rose-50 text-center max-w-md mx-auto my-12 space-y-2">
            <h3 className="text-sm font-bold text-rose-700">
              Failed to load workflows
            </h3>
            <p className="text-xs text-rose-600 font-mono wrap-break-word">
              {workflowsQuery.error instanceof Error
                ? workflowsQuery.error.message
                : String(workflowsQuery.error)}
            </p>
            <button
              onClick={() => workflowsQuery.refetch()}
              className="px-4 py-2 rounded-lg bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs shadow-xs cursor-pointer"
            >
              Retry
            </button>
          </div>
        ) : workflows.length === 0 ? (
          <div className="p-12 border-2 border-dashed border-slate-200 rounded-2xl bg-white text-center space-y-4 max-w-md mx-auto my-12">
            <div className="h-12 w-12 rounded-xl bg-emerald-50 text-emerald-600 border border-emerald-200 flex items-center justify-center mx-auto">
              <FolderPlus className="h-6 w-6" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900">
                No Workflow Matrices Yet
              </h3>
              <p className="text-xs text-slate-500 mt-1 font-mono">
                Get started by creating your first 2D decision matrix workflow.
              </p>
            </div>
            <button
              onClick={handleCreateWorkflow}
              disabled={createMutation.isPending}
              className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white font-bold text-xs inline-flex items-center space-x-1.5 shadow-xs cursor-pointer"
            >
              <Plus className="h-3.5 w-3.5" />
              <span>Create Matrix</span>
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {workflows.map((wf) => (
              <div
                key={wf.id}
                className="p-6 rounded-xl bg-white border border-slate-200 hover:border-emerald-500/50 shadow-sm hover:shadow-md flex flex-col justify-between space-y-4 group transition-all"
              >
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2.5">
                      <div className="h-8 w-8 rounded-lg bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-600">
                        <Layers className="h-4 w-4" />
                      </div>
                      <h3 className="font-bold text-slate-900 text-sm group-hover:text-emerald-600 transition-colors">
                        {wf.name}
                      </h3>
                    </div>

                    <div className="flex items-center space-x-1.5">
                      <span className="text-[10px] font-mono bg-slate-100 text-slate-600 border border-slate-200 px-2 py-0.5 rounded font-semibold">
                        {wf.latestVersion > 0
                          ? `v${wf.latestVersion}`
                          : "draft"}
                      </span>
                      <button
                        onClick={(e) => handleDeleteWorkflow(wf.id, e)}
                        disabled={deleteMutation.isPending}
                        className="text-slate-400 hover:text-rose-600 p-1 rounded hover:bg-slate-100 cursor-pointer transition-colors"
                        title="Delete Workflow"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>

                  <p className="text-slate-600 text-xs leading-relaxed line-clamp-2">
                    {wf.description || "No description provided."}
                  </p>

                  <div className="flex items-center space-x-4 text-[11px] font-mono text-slate-500 pt-2 border-t border-slate-100">
                    <div className="flex items-center space-x-1">
                      <GitBranch className="h-3.5 w-3.5 text-slate-400" />
                      <span>{wf.columnCount} Steps</span>
                    </div>
                    <div>•</div>
                    <div>{wf.rowCount} Rows</div>
                  </div>
                </div>

                <div className="pt-2">
                  <button
                    onClick={() => onOpenBuilder(wf.id)}
                    className="w-full py-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-white border border-slate-900 text-xs font-mono font-semibold transition-all flex items-center justify-center space-x-2 shadow-xs cursor-pointer"
                  >
                    <span>Open Visual Editor</span>
                    <ArrowRight className="h-3.5 w-3.5 text-emerald-400" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
};
