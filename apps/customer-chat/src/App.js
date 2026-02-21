import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { ChatPage } from "./pages/ChatPage";
import "./styles.css";
export const App = () => (_jsx(BrowserRouter, { children: _jsxs(Routes, { children: [_jsx(Route, { path: "/chat/:companySlug", element: _jsx(ChatPage, {}) }), _jsx(Route, { path: "*", element: _jsx(Navigate, { to: "/chat/acme", replace: true }) })] }) }));
