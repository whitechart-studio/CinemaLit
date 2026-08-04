// src/App.tsx
import { useStudioStore } from './store/studio';
import { useKeyboard } from './hooks/useKeyboard';
import { HomePage } from './components/home/HomePage';
import { LoginScreen } from './components/screens/LoginScreen';
import { NewProjectWizard } from './components/wizard/NewProjectWizard';

import { TopBar } from './components/layout/TopBar';
import { LeftRail } from './components/layout/LeftRail';
import { WorkspaceHeader } from './components/layout/WorkspaceHeader';
import { StatusBar } from './components/layout/StatusBar';
import { InspectorPanel } from './components/inspector/InspectorPanel';

// Views
import { SceneCanvas } from './components/canvas/SceneCanvas';
import { ScreenplayView } from './components/views/ScreenplayView';
import { BreakdownView } from './components/views/BreakdownView';
import { StripboardView } from './components/views/StripboardView';
import { ShotListView } from './components/views/ShotListView';
import { BudgetView } from './components/views/BudgetView';
import { CallSheetView } from './components/views/CallSheetView';
import { SqlView } from './components/views/SqlView';
import { StoryboardView } from './components/views/StoryboardView';

export default function App() {
  const { currentScreen, activeView, user } = useStudioStore();
  useKeyboard();

  const handleExport = () => {
    window.open('/greenlight_package.html', '_blank');
  };

  return (
    <>
      {!user || currentScreen === 'login' ? (
        <LoginScreen />
      ) : currentScreen === 'home' ? (
        <HomePage />
      ) : (
        <div style={{ height: '100vh', width: '100vw', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <TopBar onExport={handleExport} />

          <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
            {/* DEDICATED AI DIRECTOR AGENT CHAT PANEL ON THE LEFT */}
            <LeftRail />

            <main style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minWidth: 0 }}>
              <WorkspaceHeader />

              <div style={{ flex: 1, position: 'relative', overflow: 'hidden', display: 'flex', flexDirection: 'column', height: '100%', width: '100%' }}>
                {activeView === 'canvas'     && <SceneCanvas />}
                {activeView === 'script'     && <ScreenplayView />}
                {activeView === 'storyboard' && <StoryboardView />}
                {activeView === 'breakdown'  && <BreakdownView />}
                {activeView === 'stripboard' && <StripboardView />}
                {activeView === 'shotlist'   && <ShotListView />}
                {activeView === 'budget'     && <BudgetView />}
                {activeView === 'callsheet'  && <CallSheetView />}
                {activeView === 'sql'        && <SqlView />}
              </div>

              <StatusBar />
            </main>

            {/* PROJECT EXPLORER & INSPECTOR PANEL ON THE RIGHT */}
            <InspectorPanel />
          </div>
        </div>
      )}

      {/* Project Initiation Wizard Modal */}
      <NewProjectWizard />
    </>
  );
}
