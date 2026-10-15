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

/** Auth check must run at render time, not once at module init. */
function RequireAuth({ children }: { children: React.ReactNode }) {
  return authed() ? <>{children}</> : <Navigate to="/" />;
}

export default function App() {
  return (
    <LangProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<WorkerLogin />} />
          <Route path="/jobs" element={<RequireAuth><MyJobs /></RequireAuth>} />
          <Route path="/jobs/:id" element={<RequireAuth><JobActions /></RequireAuth>} />
          <Route path="/admin" element={<RequireAuth><Admin /></RequireAuth>} />
        </Routes>
      </BrowserRouter>
    </LangProvider>
  );
}
