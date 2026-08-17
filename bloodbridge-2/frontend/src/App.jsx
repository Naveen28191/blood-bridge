import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { SessionProvider } from "./context/SessionContext.jsx";

import RoleSelect from "./pages/RoleSelect.jsx";
import NewRequest from "./pages/Ambulance/NewRequest.jsx";
import RequestStatus from "./pages/Ambulance/RequestStatus.jsx";
import Login from "./pages/Dashboard/Login.jsx";
import Layout from "./pages/Dashboard/Layout.jsx";
import Inventory from "./pages/Dashboard/Inventory.jsx";
import IncomingRequests from "./pages/Dashboard/IncomingRequests.jsx";

export default function App() {
  return (
    <SessionProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<RoleSelect />} />

          <Route path="/ambulance/new" element={<NewRequest />} />
          <Route path="/ambulance/status/:id" element={<RequestStatus />} />

          <Route path="/dashboard/login" element={<Login />} />
          <Route path="/dashboard" element={<Layout />}>
            <Route index element={<IncomingRequests />} />
            <Route path="inventory" element={<Inventory />} />
          </Route>

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </SessionProvider>
  );
}
