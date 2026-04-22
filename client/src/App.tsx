import { Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/Layout';
import ConnectOrgs from './pages/ConnectOrgs';
import SelectObjects from './pages/SelectObjects';
import RunMigration from './pages/RunMigration';

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route path="/" element={<ConnectOrgs />} />
        <Route path="/select" element={<SelectObjects />} />
        <Route path="/migrate/:jobId" element={<RunMigration />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}
