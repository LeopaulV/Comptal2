import React, { useState } from 'react';
import { ZoomProvider, useZoom } from '../../contexts/ZoomContext';
import Sidebar from './Sidebar';
import ThemeToggle from './ThemeToggle';
import ZoomControl from './ZoomControl';

interface MainLayoutProps {
  children: React.ReactNode;
}

const MainContentArea: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { zoomLevel } = useZoom();
  const zoomValue = zoomLevel / 100;

  return (
    <div className="flex-1 overflow-auto p-6">
      <div
        style={{
          zoom: zoomValue,
        }}
      >
        {children}
      </div>
    </div>
  );
};

const MainLayout: React.FC<MainLayoutProps> = ({ children }) => {
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);

  return (
    <ZoomProvider>
      <div className="flex h-screen bg-gray-50 dark:bg-gray-900">
        {/* Sidebar */}
        <Sidebar
          isCollapsed={isSidebarCollapsed}
          onToggle={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
        />

        {/* Main Content */}
        <main
          className={`
          flex-1 flex flex-col overflow-hidden
          transition-all duration-300
          ${isSidebarCollapsed ? 'ml-16' : 'ml-64'}
        `}
        >
          {/* Top Bar */}
          <header className="h-16 shrink-0 bg-white dark:bg-gray-800 shadow-sm border-b border-gray-200 dark:border-gray-700 flex items-center justify-between px-6">
            <div className="flex-1" />

            <div className="flex items-center gap-4">
              <ZoomControl />
              <ThemeToggle />
            </div>
          </header>

          {/* Page Content - zoom appliqué uniquement ici */}
          <MainContentArea>{children}</MainContentArea>
        </main>
      </div>
    </ZoomProvider>
  );
};

export default MainLayout;

