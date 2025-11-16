import React, {useState} from "react";
import {Alert, Box, Button, Container, Link, TextField, Typography,} from "@mui/material";
import {useNavigate} from "react-router-dom";

const Register: React.FC = () => {
    const navigate = useNavigate();

    const [firstName, setFirstName] = useState("");
    const [lastName, setLastName] = useState("");
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [error, setError] = useState("");

    const handleRegister = async (e: React.FormEvent) => {
        e.preventDefault();
        setError("");

        if (!firstName || !lastName || !email || !password || !confirmPassword) {
            setError("All fields are required.");
            return;
        }

        if (password !== confirmPassword) {
            setError("Passwords do not match.");
            return;
        }

        try {
            const response = await fetch("/api/v1/auth/register", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    firstname: firstName,
                    lastname: lastName,
                    email,
                    password,
                }),
            });

            if (!response.ok) {
                const msg = await response.text();
                console.log(msg);
            }

            console.log("Registration success:");

            setTimeout(() => navigate("/login"), 2000);
        } catch (err: unknown) {
            if (err instanceof Error) {
                setError(err.message || "Something went wrong.");
            } else {
                setError("Unexpected error occurred.");
            }
        }
    };

    return (
        <Container maxWidth="xs">
            <Box sx={{mt: 8, textAlign: "center"}}>
                <Typography variant="h4" gutterBottom>
                    Register
                </Typography>

                <form onSubmit={handleRegister}>
                    <TextField
                        fullWidth
                        label="First Name"
                        margin="normal"
                        value={firstName}
                        onChange={(e) => setFirstName(e.target.value)}
                    />
                    <TextField
                        fullWidth
                        label="Last Name"
                        margin="normal"
                        value={lastName}
                        onChange={(e) => setLastName(e.target.value)}
                    />
                    <TextField
                        fullWidth
                        label="Email"
                        margin="normal"
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                    />
                    <TextField
                        fullWidth
                        label="Password"
                        margin="normal"
                        type="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                    />
                    <TextField
                        fullWidth
                        label="Confirm Password"
                        margin="normal"
                        type="password"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                    />

                    {error && (
                        <Alert severity="error" sx={{mt: 2}}>
                            {error}
                        </Alert>
                    )}

                    <Button
                        fullWidth
                        variant="contained"
                        color="primary"
                        type="submit"
                        sx={{mt: 3}}
                    >
                        Register
                    </Button>

                    <Typography variant="body2" sx={{mt: 2}}>
                        Already have an account?{" "}
                        <Link component="button" onClick={() => navigate("/login")}>
                            Login
                        </Link>
                    </Typography>
                </form>
            </Box>
        </Container>
    );
};

export default Register;
