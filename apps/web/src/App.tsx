import React, { useState } from 'react';
import { WorkflowDirectoryPage } from './pages/workflow-directory.page';
import { MatrixBuilderPage } from './pages/matrix-builder.page';

export function App() {
  const [activePage, setActivePage] = useState<'directory' | 'builder'>('directory');
  const [activeWorkflowId, setActiveWorkflowId] = useState<string>('wf_credit_origination');

  const handleOpenBuilder = (id: string) => {
    setActiveWorkflowId(id);
    setActivePage('builder');
  };

  const handleBackToDashboard = () => {
    setActivePage('directory');
  };

  return (
    <>
      {activePage === 'directory' ? (
        <WorkflowDirectoryPage onOpenBuilder={handleOpenBuilder} />
      ) : (
        <MatrixBuilderPage workflowId={activeWorkflowId} onBackToDashboard={handleBackToDashboard} />
      )}
    </>
  );
}

export default App;
