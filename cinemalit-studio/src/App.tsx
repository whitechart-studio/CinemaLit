// src/App.tsx
import { useEffect } from 'react';
import { Agentation } from 'agentation';
import { Toaster } from './components/ui/sonner';
import { useStudioStore } from './store/studio';
import { apiFetch } from './utils/api';
import { useKeyboard } from './hooks/useKeyboard';
import { JobBanner } from './components/layout/JobBanner';
import { HomePage } from './components/home/HomePage';
import { LandingPage } from './components/screens/LandingPage';
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
import { StoryboardView } from './components/views/StoryboardView';

export default function App() {
  const { currentScreen, activeView, user, token, setAuth, refreshProjects } = useStudioStore();
  useKeyboard();

  // A user restored from localStorage may hold a stale/expired/revoked token.
  // Confirm it against the server on load — apiFetch clears the session on 401.
  useEffect(() => {
    if (user && token) {
      void apiFetch('/api/auth/me').then(async (res) => {
        if (res.ok) {
          const data = await res.json();
          if (data.status === 'ok') setAuth(data.user, token);
        }
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Projects live in ClickHouse now, not localStorage — pull them once signed in.
  useEffect(() => {
    if (user) void refreshProjects();
  }, [user, refreshProjects]);

  return (
    <>
      {!user && currentScreen === 'landing' ? (
        <LandingPage />
      ) : !user || currentScreen === 'login' ? (
        <LoginScreen />
      ) : currentScreen === 'home' ? (
        <HomePage />
      ) : (
        <div style={{ height: '100vh', width: '100vw', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <TopBar />

          <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
            <LeftRail />

            <main style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minWidth: 0 }}>
              <WorkspaceHeader />
              <JobBanner />

              <div style={{ flex: 1, position: 'relative', overflow: 'hidden', display: 'flex', flexDirection: 'column', height: '100%', width: '100%' }}>
                {activeView === 'canvas'     && <SceneCanvas />}
                {activeView === 'script'     && <ScreenplayView />}
                {activeView === 'storyboard' && <StoryboardView />}
                {activeView === 'breakdown'  && <BreakdownView />}
                {activeView === 'stripboard' && <StripboardView />}
                {activeView === 'shotlist'   && <ShotListView />}
                {activeView === 'budget'     && <BudgetView />}
                {activeView === 'callsheet'  && <CallSheetView />}
              </div>

              <StatusBar />
            </main>

            <InspectorPanel />
          </div>
        </div>
      )}

      {/* Project Initiation Wizard Modal */}
      <NewProjectWizard />

      {/* Dev-only visual feedback overlay for AI coding agents — never ships to prod */}
      {import.meta.env.DEV && <Agentation />}
      <Toaster position="bottom-right" />
    </>
  );
}
