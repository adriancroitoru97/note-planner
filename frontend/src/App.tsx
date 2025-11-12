import React from "react";
import {Navigate, Route, Routes} from "react-router-dom";
import Login from "./pages/Login";
import Register from "./pages/Register";
import Home from "./pages/Home.tsx";

import './App.css';
import NotesPage from "./pages/NotesPage.tsx";

const App: React.FC = () => {
  const isLoggedIn = !!localStorage.getItem("token");

  return (
    <Routes>
      <Route path="/" element={isLoggedIn ? <Home/> : <Navigate to="/login"/>}/>
      <Route path="/login" element={<Login/>}/>
      <Route path="/register" element={<Register/>}/>
      <Route path="/notes" element={<NotesPage/>}/>
    </Routes>
  );
};

export default App;
