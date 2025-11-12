import React from "react";
import {Box, Button, Container, Typography} from "@mui/material";
import {useNavigate} from "react-router-dom";

const Home: React.FC = () => {
  const navigate = useNavigate();

  const handleLogout = () => {
    localStorage.removeItem("token");
    navigate("/login");
  };

  return (
    <Container maxWidth="sm">
      <Box sx={{mt: 10, textAlign: "center"}}>
        <Typography variant="h4" gutterBottom>
          Welcome Home 🎉
        </Typography>
        <Typography variant="body1" sx={{mb: 4}}>
          You are logged in successfully.
        </Typography>
        <Button variant="contained" color="secondary" onClick={handleLogout}>
          Logout
        </Button>
      </Box>
    </Container>
  );
};

export default Home;
