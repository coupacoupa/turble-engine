import React, { useEffect, useMemo, useRef } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { MatrixSchema } from "@/types/matrix.types";
import { MatrixEvaluatorConnectService } from "@/services/matrix-evaluator.service";
import { WorkflowApiService } from "@/services/workflow-api.service";
import { SpreadsheetToolbar } from "@/components/workflow-editor/spreadsheet-toolbar.component";
import { MatrixSheet } from "@/components/workflow-editor/matrix-sheet.component";
import { CellEditorModal } from "@/components/workflow-editor/cell-editor-modal.component";
import { ExecutionInspectorBottomPanel } from "@/components/workflow-editor/execution-inspector-bottom-panel.component";
import { useMatrixEditorStore } from "@/stores/matrix-editor.store";
import { useMatrixKeyboardShortcuts } from "@/hooks/use-matrix-keyboard-shortcuts.hook";

interface MatrixBuilderPageProps {
  workflowId: string;
  onBackToDashboard: () => void;
}

export const MatrixBuilderPage: React.FC<MatrixBuilderPageProps> = ({
  workflowId,
  onBackToDashboard,
}) => {
  const queryClient = useQueryClient();
  const matrix = useMatrixEditorStore((s) => s.matrix);
  const setMatrix = useMatrixEditorStore((s) => s.setMatrix);
  const setSaveState = useMatrixEditorStore((s) => s.setSaveState);
  const setLatestVersion = useMatrixEditorStore((s) => s.setLatestVersion);
  const isInspectorOpen = useMatrixEditorStore((s) => s.isInspectorOpen);
  const setIsInspectorOpen = useMatrixEditorStore((s) => s.setIsInspectorOpen);
  const testInputPayload = useMatrixEditorStore((s) => s.testInputPayload);
  const setHoveredStepRecord = useMatrixEditorStore(
    (s) => s.setHoveredStepRecord,
  );
  const setHoveredVariableKey = useMatrixEditorStore(
    (s) => s.setHoveredVariableKey,
  );
  const resetEditor = useMatrixEditorStore((s) => s.resetEditor);

  // Attach global keyboard shortcuts (0 props required!)
  useMatrixKeyboardShortcuts();

  // The store is a global singleton: clear the previous workflow's matrix,
  // selection, and panels when this page unmounts or switches workflows,
  // otherwise the next workflow briefly renders (and autosaves!) stale data.
  useEffect(() => {
    return () => resetEditor();
  }, [workflowId, resetEditor]);

  // Load Workflow Query
  const workflowQuery = useQuery({
    queryKey: ["workflow", workflowId],
    queryFn: () => WorkflowApiService.get(workflowId),
    staleTime: Infinity,
    refetchOnWindowFocus: false,
    retry: false,
  });

  const subWorkflowsQuery = useQuery({
    queryKey: ["workflows"],
    queryFn: WorkflowApiService.list,
  });

  const lastSavedRef = useRef<string | null>(null);

  useEffect(() => {
    if (workflowQuery.data && matrix === undefined) {
      setMatrix(workflowQuery.data.matrix);
      setLatestVersion(workflowQuery.data.latestVersion ?? 0);
      lastSavedRef.current = JSON.stringify(workflowQuery.data.matrix);
    }
  }, [workflowQuery.data, matrix, setMatrix, setLatestVersion]);

  const saveDraftMutation = useMutation({
    mutationFn: (m: MatrixSchema) =>
      WorkflowApiService.saveDraft(workflowId, m),
    onMutate: () => setSaveState("saving"),
    onSuccess: ({ record }) => {
      setSaveState("saved");
      queryClient.setQueryData(["workflow", workflowId], record);
      queryClient.invalidateQueries({ queryKey: ["workflows"] });
    },
    onError: () => {
      setSaveState("error");
      lastSavedRef.current = null;
    },
  });

  const publishMutation = useMutation({
    mutationFn: () => WorkflowApiService.publish(workflowId),
    onSuccess: (data) => {
      setLatestVersion(data.versionNumber);
      queryClient.invalidateQueries({ queryKey: ["workflow", workflowId] });
      queryClient.invalidateQueries({ queryKey: ["workflows"] });
    },
    onError: (err) => {
      window.alert(err instanceof Error ? err.message : String(err));
    },
  });

  // Debounced Autosave
  useEffect(() => {
    if (!matrix) return;
    const serialized = JSON.stringify(matrix);
    if (serialized === lastSavedRef.current) return;
    const timer = setTimeout(() => {
      lastSavedRef.current = serialized;
      saveDraftMutation.mutate(matrix);
    }, 800);
    return () => clearTimeout(timer);
  }, [matrix, saveDraftMutation]);

  const handlePublish = async () => {
    if (!matrix || publishMutation.isPending) return;
    const serialized = JSON.stringify(matrix);
    if (serialized !== lastSavedRef.current) {
      lastSavedRef.current = serialized;
      try {
        await saveDraftMutation.mutateAsync(matrix);
      } catch (err) {
        window.alert(err instanceof Error ? err.message : String(err));
        return;
      }
    }
    publishMutation.mutate();
  };

  const handleExportJson = () => {
    if (!matrix) return;
    const jsonStr = JSON.stringify(matrix, null, 2);
    const blob = new Blob([jsonStr], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${matrix.id || "workflow_matrix"}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const availableSubWorkflows = useMemo<MatrixSchema[]>(
    () =>
      (subWorkflowsQuery.data ?? [])
        .filter((w) => w.id !== workflowId)
        .map((w) => ({
          id: w.id,
          name: w.name,
          description: w.description,
          columns: [],
          rows: [],
          cells: {},
        })),
    [subWorkflowsQuery.data, workflowId],
  );

  const executeMatrixMutation = useMutation({
    mutationFn: (variables: {
      matrix: MatrixSchema;
      inputPayload: Record<string, any>;
    }) =>
      MatrixEvaluatorConnectService.executeMatrix(
        variables.matrix,
        variables.inputPayload,
      ),
  });

  const handleStartExecution = async (inputPayload: Record<string, any>) => {
    if (!matrix) throw new Error("No matrix loaded");
    const res = await executeMatrixMutation.mutateAsync({
      matrix,
      inputPayload,
    });
    setIsInspectorOpen(true);
    return res;
  };

  if (!matrix) {
    return (
      <div className="h-screen w-screen bg-slate-50 flex items-center justify-center p-4 font-sans">
        <div className="text-center space-y-3">
          <p className="text-sm font-semibold text-slate-700">
            {workflowQuery.isPending
              ? "Loading workflow matrix…"
              : "Workflow Matrix not found."}
          </p>
          <button
            onClick={onBackToDashboard}
            className="px-3 py-1.5 rounded-lg bg-slate-900 text-white text-xs font-bold shadow-sm cursor-pointer"
          >
            Back to Dashboard
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen w-screen flex flex-col bg-slate-100 font-sans overflow-hidden select-none">
      {/* 1. Header & Wireframe Toolbar Layout */}
      <SpreadsheetToolbar
        onBackToDashboard={onBackToDashboard}
        onExportJson={handleExportJson}
        onPublish={handlePublish}
        isPublishing={publishMutation.isPending}
      />

      {/* 2. Main Studio Content View */}
      <div className="flex-1 w-full h-full flex flex-row overflow-hidden relative min-h-0">
        <MatrixSheet />
      </div>

      {/* 3. Docked Bottom Inspector */}
      {isInspectorOpen ? (
        <ExecutionInspectorBottomPanel
          isOpen={isInspectorOpen}
          onClose={() => setIsInspectorOpen(false)}
          matrix={matrix}
          initialInputPayload={testInputPayload}
          onRunExecution={handleStartExecution}
          isExecuting={executeMatrixMutation.isPending}
          onHoverStepRecord={setHoveredStepRecord}
          onHoverVariableKey={setHoveredVariableKey}
        />
      ) : null}

      {/* 4. Cell Editor Modal */}
      <CellEditorModal availableSubWorkflows={availableSubWorkflows} />
    </div>
  );
};
