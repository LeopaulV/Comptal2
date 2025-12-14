import React from 'react';
import { HashRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import MainLayout from './components/Layout/MainLayout';
import Dashboard from './pages/Dashboard/Dashboard';
import Upload from './pages/Upload/Upload';
import Edition from './pages/Edition/Edition';
import FinanceGlobal from './pages/FinanceGlobal/FinanceGlobal';
import Parametre from './pages/Parametre/Parametre';

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
          <Route path="/parametre" element={<Parametre />} />
        </Routes>
      </MainLayout>
    </Router>
  );
};

export default App;

