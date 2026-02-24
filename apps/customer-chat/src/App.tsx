import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { ChatPage } from "./pages/ChatPage";
import "./styles.css";

export const App = () => (
  <BrowserRouter>
    <Routes>
      <Route path="/chat/:companySlug" element={<ChatPage />} />
      <Route path="*" element={<Navigate to="/chat/acme" replace />} />
    </Routes>
  </BrowserRouter>
);
