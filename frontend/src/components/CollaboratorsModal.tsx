import React, {useEffect, useState} from "react";
import {
  Alert,
  Avatar,
  Box,
  Button,
  Checkbox,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  List,
  ListItem,
  Typography,
} from "@mui/material";
import {type UserDto, usersApi} from "../hooks/usersApi.ts";

interface CollaboratorsModalProps {
  open: boolean;
  onClose: () => void;
  currentCollaboratorIds: number[];
  currentUserId: number;
  onSubmit: (selectedUserIds: number[]) => void;
}

export const CollaboratorsModal: React.FC<CollaboratorsModalProps> = ({
                                                                        open,
                                                                        onClose,
                                                                        currentCollaboratorIds,
                                                                        currentUserId,
                                                                        onSubmit,
                                                                      }) => {
  const [users, setUsers] = useState<UserDto[]>([]);
  const [selectedUserIds, setSelectedUserIds] = useState<number[]>(currentCollaboratorIds);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      loadUsers();
      setSelectedUserIds(currentCollaboratorIds);
    }
  }, [open, currentCollaboratorIds]);

  const loadUsers = async () => {
    setLoading(true);
    setError(null);
    try {
      const allUsers = await usersApi.getAllUsers();
      // Filter out the current user
      const filteredUsers = allUsers.filter((user) => user.id !== currentUserId);
      setUsers(filteredUsers);
    } catch (err) {
      setError("Failed to load users");
      console.error("Error loading users:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleToggleUser = (userId: number) => {
    setSelectedUserIds((prev) => {
      if (prev.includes(userId)) {
        return prev.filter((id) => id !== userId);
      } else {
        return [...prev, userId];
      }
    });
  };

  const handleSubmit = () => {
    onSubmit(selectedUserIds);
    onClose();
  };

  const handleCancel = () => {
    setSelectedUserIds(currentCollaboratorIds);
    onClose();
  };

  const getInitials = (firstName: string, lastName: string) => {
    return `${firstName[0]}${lastName[0]}`.toUpperCase();
  };

  return (
    <Dialog open={open} onClose={handleCancel} maxWidth="sm" fullWidth>
      <DialogTitle>Select Collaborators</DialogTitle>
      <DialogContent>
        {loading && (
          <Box sx={{display: "flex", justifyContent: "center", py: 4}}>
            <CircularProgress/>
          </Box>
        )}

        {error && (
          <Alert severity="error" sx={{mb: 2}}>
            {error}
          </Alert>
        )}

        {!loading && !error && users.length === 0 && (
          <Alert severity="info">No other users available</Alert>
        )}

        {!loading && !error && users.length > 0 && (
          <List>
            {users.map((user) => (
              <ListItem
                key={user.id}
                sx={{
                  border: "1px solid #e0e0e0",
                  borderRadius: 1,
                  mb: 1,
                  "&:hover": {
                    backgroundColor: "#f5f5f5",
                  },
                }}
              >
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={selectedUserIds.includes(user.id)}
                      onChange={() => handleToggleUser(user.id)}
                    />
                  }
                  label={
                    <Box sx={{display: "flex", alignItems: "center", ml: 1}}>
                      <Avatar
                        sx={{
                          bgcolor: "primary.main",
                          width: 32,
                          height: 32,
                          mr: 2,
                        }}
                      >
                        {getInitials(user.firstname, user.lastname)}
                      </Avatar>
                      <Typography>
                        {user.firstname} {user.lastname}
                      </Typography>
                    </Box>
                  }
                  sx={{width: "100%", m: 0}}
                />
              </ListItem>
            ))}
          </List>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={handleCancel} color="inherit">
          Cancel
        </Button>
        <Button onClick={handleSubmit} variant="contained" color="primary">
          Save ({selectedUserIds.length} selected)
        </Button>
      </DialogActions>
    </Dialog>
  );
};
