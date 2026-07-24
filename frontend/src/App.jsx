import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import Layout from './components/Layout';

import Login        from './pages/Login';
import Home         from './pages/Home';
import MyTasks      from './pages/MyTasks';
import Teams        from './pages/Teams';
import TeamProjects from './pages/TeamProjects';
import Board        from './pages/Board';
import TaskDetail   from './pages/TaskDetail';
import Members      from './pages/Members';
import MemberForm   from './pages/MemberForm';
import ProfilePage  from './pages/ProfilePage';
import TeamForm     from './pages/TeamForm';
import ProjectForm  from './pages/ProjectForm';

function Protected({ children }) {
  const { user, loading } = useAuth();
  if (loading) return <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', color: 'var(--text-3)', fontWeight: 800 }}>Loading…</div>;
  if (!user)   return <Navigate to="/login" replace />;
  return children;
}

function AdminOnly({ children }) {
  const { user } = useAuth();
  if (!user?.isAdmin) return <Navigate to="/my-tasks" replace />;
  return children;
}

function Root() {
  const { user, loading } = useAuth();
  if (loading) return null;
  if (!user)   return <Navigate to="/login" replace />;
  return <Navigate to={user.isAdmin ? '/home' : '/my-tasks'} replace />;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />

      <Route element={<Protected><Layout /></Protected>}>
        <Route path="/"           element={<Root />} />

        {/* Admin home */}
        <Route path="/home"       element={<AdminOnly><Home /></AdminOnly>} />

        {/* Member home */}
        <Route path="/my-tasks"   element={<MyTasks />} />

        {/* Profile — any logged-in member */}
        <Route path="/profile"    element={<ProfilePage />} />

        {/* Teams */}
        <Route path="/teams"                    element={<AdminOnly><Teams /></AdminOnly>} />
        <Route path="/teams/new"                element={<AdminOnly><TeamForm /></AdminOnly>} />
        <Route path="/teams/:teamId/edit"       element={<AdminOnly><TeamForm /></AdminOnly>} />
        <Route path="/teams/:teamId/projects"   element={<TeamProjects />} />
        <Route path="/teams/:teamId/projects/new" element={<AdminOnly><ProjectForm /></AdminOnly>} />
        <Route path="/projects/:projectId/edit" element={<AdminOnly><ProjectForm /></AdminOnly>} />

        {/* Board */}
        <Route path="/projects/:projectId/board"       element={<Board />} />
        <Route path="/projects/:projectId/tasks/:taskId" element={<TaskDetail />} />

        {/* Members */}
        <Route path="/members"       element={<AdminOnly><Members /></AdminOnly>} />
        <Route path="/members/new"   element={<AdminOnly><MemberForm /></AdminOnly>} />
        <Route path="/members/:id/edit" element={<AdminOnly><MemberForm /></AdminOnly>} />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
