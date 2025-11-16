import React, {useState} from "react";
import {Box, Button, Container, Link, TextField, Typography} from "@mui/material";
import {useNavigate} from "react-router-dom";

const Login: React.FC = () => {
    const navigate = useNavigate();

    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [error, setError] = useState("");

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setError("");

        if (!email || !password)
        {
            setError("Please enter both email and password.");
            return;
        }

        try {
            const response = await fetch("/api/v1/auth/authenticate", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({email, password}),
            });

            if (!response.ok) {
                const msg = await response.text();
                console.log(msg);
            }

            const data = await response.json();

            localStorage.setItem("token", data.token);

            setTimeout(() => navigate("/notes"), 1500);
        } catch (err: unknown) {
            if (err instanceof Error) {
                setError(err.message || "Login failed. Please try again.");
            } else {
                setError("Unexpected error occurred.");
            }
        }
    };

    return (
        <Container maxWidth="xs">
            <Box sx={{mt: 10, textAlign: "center"}}>
                <Typography variant="h4" gutterBottom>
                    Login
                </Typography>
                <form onSubmit={handleLogin}>
                    <TextField
                        fullWidth
                        label="Email"
                        margin="normal"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                    />
                    <TextField
                        fullWidth
                        label="Password"
                        type="password"
                        margin="normal"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                    />
                    <Button fullWidth variant="contained" color="primary" type="submit" sx={{mt: 2}}>
                        Login
                    </Button>
                    <Typography variant="body2" sx={{mt: 2}}>
                        Don't have an account?{" "}
                        <Link component="button" onClick={() => navigate("/register")}>
                            Register
                        </Link>
                    </Typography>
                </form>
            </Box>
        </Container>
    );
};

export default Login;
