import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { LangProvider } from './lang.js';
import { getSessionUser } from './api.js';
import WorkerLogin from './pages/WorkerLogin.js';
import MyJobs from './pages/MyJobs.js';
import JobActions from './pages/JobActions.js';
import Admin from './pages/Admin.js';

function authed() {
  return !!getSessionUser();
}

export default function App() {
  return (
    <LangProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<WorkerLogin />} />
          <Route path="/jobs" element={authed() ? <MyJobs /> : <Navigate to="/" />} />
          <Route path="/jobs/:id" element={authed() ? <JobActions /> : <Navigate to="/" />} />
          <Route path="/admin" element={authed() ? <Admin /> : <Navigate to="/" />} />
        </Routes>
      </BrowserRouter>
    </LangProvider>
  );
}
