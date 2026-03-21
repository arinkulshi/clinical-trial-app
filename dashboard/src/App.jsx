import { Routes, Route } from 'react-router-dom';
import { StudyProvider } from './hooks/useStudy';
import Layout from './components/layout/Layout';
import StudyOverview from './pages/StudyOverview';
import SafetyDashboard from './pages/SafetyDashboard';
import PatientJourney from './pages/PatientJourney';
import DataManagement from './pages/DataManagement';

export default function App() {
  return (
    <StudyProvider>
      <Routes>
        <Route element={<Layout />}>
          <Route index element={<StudyOverview />} />
          <Route path="safety" element={<SafetyDashboard />} />
          <Route path="patient" element={<PatientJourney />} />
          <Route path="data" element={<DataManagement />} />
        </Route>
      </Routes>
    </StudyProvider>
  );
}
