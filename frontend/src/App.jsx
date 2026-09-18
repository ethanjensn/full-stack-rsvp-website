import { useEffect, useState } from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import { getConfig } from "./api";
import Home from "./pages/Home";
import Rsvp from "./pages/Rsvp";
import Qa from "./pages/Qa";
import Confirmation from "./pages/Confirmation";
import AdminLogin from "./pages/AdminLogin";
import AdminDashboard from "./pages/AdminDashboard";

function App() {
  const [config, setConfig] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const { data } = await getConfig();
      setConfig(data || {});
      setLoading(false);
    }
    load();
  }, []);

  if (loading) {
    return <div className="page" />;
  }

  const adminPath = config.ADMIN_PATH || "admin";

  return (
    <Routes>
      <Route path="/" element={<Home config={config} />} />
      <Route path="/rsvp" element={<Rsvp config={config} />} />
      <Route path="/qa" element={<Qa config={config} />} />
      <Route path="/confirmation" element={<Confirmation config={config} />} />
      <Route path={`/${adminPath}/login`} element={<AdminLogin adminPath={adminPath} />} />
      <Route path={`/${adminPath}`} element={<AdminDashboard adminPath={adminPath} />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default App;
