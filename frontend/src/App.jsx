import { Navigate, Route, Routes } from "react-router-dom";
import UserReportPage from "./pages/UserReportPage";
import SOICDashboard from "./pages/SOICDashboard";
import UsersDashboardPage from "./pages/UsersDashboardPage";

const App = () => {
  return (
    <Routes>
      <Route path="/" element={<UsersDashboardPage />} />
      <Route path="/users/:userId/report" element={<UserReportPage />} />
      <Route path="/soic" element={<SOICDashboard />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
};

export default App;