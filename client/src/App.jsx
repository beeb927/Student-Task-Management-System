import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import Layout from "./components/Layout";
import Register from "./pages/Register";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import CreateTask from "./pages/CreateTask";
import EditTask from "./pages/EditTask";
import TaskChecklist from "./pages/TaskChecklist";
import Courses from "./pages/Courses";
import Schedule from "./pages/Schedule";
import Calendar from "./pages/Calendar";
import SleepLog from "./pages/SleepLog";

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Navigate to="/login" />} />
        <Route path="/register" element={<Register />} />
        <Route path="/login" element={<Login />} />
        <Route element={<Layout />}>
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/tasks/create" element={<CreateTask />} />
          <Route path="/tasks/:id/edit" element={<EditTask />} />
          <Route path="/tasks/:id/checklist" element={<TaskChecklist />} />
          <Route path="/courses" element={<Courses />} />
          <Route path="/schedule" element={<Schedule />} />
          <Route path="/calendar" element={<Calendar />} />
          <Route path="/sleep" element={<SleepLog />} />
        </Route>
        <Route
          path="*"
          element={
            <main className="container">
              <h2>Page not found</h2>
              <a href="/dashboard">Return to dashboard</a>
            </main>
          }
        />
      </Routes>
    </BrowserRouter>
  );
}

export default App;