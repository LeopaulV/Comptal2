import React from 'react';
import { HashRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import MainLayout from './components/Layout/MainLayout';
import Dashboard from './pages/Dashboard/Dashboard';
import Upload from './pages/Upload/Upload';
import Edition from './pages/Edition/Edition';
import FinanceGlobal from './pages/FinanceGlobal/FinanceGlobal';
import Parametre from './pages/Parametre/Parametre';
import ProjectManagement from './pages/ProjectManagement/ProjectManagement';
import Invoicing from './pages/Invoicing/Invoicing';
import Association from './pages/Association/Association';
import GuidedTour from './components/Onboarding/GuidedTour';
import './styles/guided-tour.css';

const App: React.FC = () => {
  return (
    <Router>
      <MainLayout>
        <Routes>
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/upload" element={<Upload />} />
          <Route path="/edition" element={<Edition />} />
          <Route path="/finance-global" element={<FinanceGlobal />} />
          <Route path="/project-management" element={<ProjectManagement />} />
          <Route path="/invoicing" element={<Invoicing />} />
          <Route path="/association" element={<Association />} />
          <Route path="/parametre" element={<Parametre />} />
        </Routes>
        <GuidedTour />
      </MainLayout>
      <ToastContainer
        position="bottom-right"
        autoClose={3000}
        hideProgressBar={false}
        newestOnTop
        closeOnClick
        pauseOnFocusLoss={false}
        draggable
        pauseOnHover
        theme="colored"
      />
    </Router>
  );
};

export default App;

