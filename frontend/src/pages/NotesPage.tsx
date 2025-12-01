import React, {useEffect, useState} from "react";
import {
  Alert,
  Avatar,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Grid,
  IconButton,
  MenuItem,
  Select,
  Snackbar,
  Stack,
  TextField,
  Tooltip,
  Typography,
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import DeleteIcon from "@mui/icons-material/Delete";
import RefreshIcon from "@mui/icons-material/Refresh";
import {DragDropContext, Draggable, Droppable, type DropResult} from "@hello-pangea/dnd";
import {
  type CreateNoteRequest,
  type NoteDto,
  type NotePrivacy,
  notesApi,
  type UpdateNoteRequest
} from "../hooks/notesApi.ts";
import {type UserDto, usersApi} from "../hooks/usersApi.ts";

const getPrivacyColor = (privacy: NotePrivacy) => {
  switch (privacy) {
    case "PUBLIC":
      return "success";
    case "PRIVATE":
      return "error";
    case "COLLABORATORS":
      return "warning";
  }
};

const NotesPage: React.FC = () => {
  const [notes, setNotes] = useState<NoteDto[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // User cache for displaying names
  const [userCache, setUserCache] = useState<Map<number, UserDto>>(new Map());

  // New note form state
  const [newTitle, setNewTitle] = useState("");
  const [newText, setNewText] = useState("");
  const [newPrivacy, setNewPrivacy] = useState<NotePrivacy>("PUBLIC");
  const [creating, setCreating] = useState(false);

  const loadNotes = async () => {
    setLoading(true);
    setError(null);
    try {
      // You can switch between getAllVisibleNotes() and getMyNotes() based on your needs
      const data = await notesApi.getAllVisibleNotes();
      setNotes(data);

      // Load user information for all unique user IDs in the notes
      const userIds = new Set<number>();
      data.forEach(note => {
        userIds.add(note.authorId);
        note.sharedWithUserIds?.forEach(id => userIds.add(id));
      });

      // Fetch users that aren't in cache
      const uncachedUserIds = Array.from(userIds).filter(id => !userCache.has(id));
      if (uncachedUserIds.length > 0) {
        try {
          const users = await Promise.all(
            uncachedUserIds.map(id => usersApi.getUserById(id).catch(() => null))
          );

          const newCache = new Map(userCache);
          users.forEach(user => {
            if (user) {
              newCache.set(user.id, user);
            }
          });
          setUserCache(newCache);

          const currentUser = await usersApi.getCurrentUser();
          setUserCache(prev => new Map(prev).set(currentUser.id, currentUser));
        } catch (err) {
          console.error("Error loading user information:", err);
          // Continue even if user loading fails
        }
      }
    } catch (err: unknown) {
      setError("Failed to load notes");
      console.error("Error loading notes:", err);
    } finally {
      setLoading(false);
    }
  };

  // Load current user and notes on component mount
  useEffect(() => {
    loadNotes().then(() => {
    });
  }, []);

  const handleAddNote = async () => {
    if (!newTitle.trim()) {
      setError("Title is required");
      return;
    }

    setCreating(true);
    setError(null);

    try {
      const request: CreateNoteRequest = {
        title: newTitle,
        text: newText,
        privacy: newPrivacy,
        // Add sharedWithUserIds if privacy is PRIVATE
        ...(newPrivacy === "PRIVATE" && {
          sharedWithUserIds: [], // You can add a UI to select users
        }),
      };

      const createdNote = await notesApi.createNote(request);
      setNotes((prev) => [...prev, createdNote]);

      // Reset form
      setNewTitle("");
      setNewText("");
      setNewPrivacy("PUBLIC");
      setSuccess("Note created successfully!");
    } catch (err: unknown) {
      setError("Failed to create note");
      console.error("Error creating note:", err);
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!window.confirm("Are you sure you want to delete this note?")) {
      return;
    }

    try {
      await notesApi.deleteNote(id);
      setNotes((prev) => prev.filter((n) => n.id !== id));
      setSuccess("Note deleted successfully!");
    } catch (err: unknown) {
      setError("Failed to delete note");
      console.error("Error deleting note:", err);
    }
  };

  const handleTextChange = async (id: number, text: string) => {
    // Optimistically update UI
    setNotes((prev) => prev.map((n) => (n.id === id ? {...n, text} : n)));

    // Debounce the API call - you might want to implement proper debouncing
    try {
      const request: UpdateNoteRequest = {text};
      await notesApi.updateNote(id, request);
    } catch (err: unknown) {
      setError("Failed to update note text");
      console.error("Error updating note:", err);
      // Revert on error
      await loadNotes();
    }
  };

  const handleTitleChange = async (id: number, title: string) => {
    // Optimistically update UI
    setNotes((prev) => prev.map((n) => (n.id === id ? {...n, title} : n)));

    try {
      const request: UpdateNoteRequest = {title};
      await notesApi.updateNote(id, request);
    } catch (err: unknown) {
      setError("Failed to update note title");
      console.error("Error updating note:", err);
      // Revert on error
      loadNotes();
    }
  };

  const handlePrivacyChange = async (id: number, privacy: NotePrivacy) => {
    try {
      const request: UpdateNoteRequest = {
        privacy,
        ...(privacy === "PRIVATE" && {
          sharedWithUserIds: [], // You can add a UI to select users
        }),
      };

      const updatedNote = await notesApi.updateNote(id, request);
      setNotes((prev) => prev.map((n) => (n.id === id ? updatedNote : n)));
      setSuccess("Privacy updated successfully!");
    } catch (err: unknown) {
      setError("Failed to update privacy");
      console.error("Error updating privacy:", err);
    }
  };

  const handleDragEnd = (result: DropResult) => {
    if (!result.destination) return;

    const reordered = Array.from(notes);
    const [moved] = reordered.splice(result.source.index, 1);
    reordered.splice(result.destination.index, 0, moved);
    setNotes(reordered);

    // Note: You might want to persist the order to the backend
    // This would require adding an endpoint to save note order
  };

  const getInitials = (name: string) =>
    name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase();

  const getUserDisplayName = (userId: number): string => {
    const user = userCache.get(userId);
    return user?.firstname + " " + user?.lastname || `User ${userId}`;
  };

  const getUserInitials = (userId: number): string => {
    const displayName = getUserDisplayName(userId);
    return getInitials(displayName);
  };

  const handleCloseSnackbar = () => {
    setError(null);
    setSuccess(null);
  };

  return (
    <Box sx={{maxWidth: 800, mx: "auto", mt: 6, mb: 10}}>
      <Stack direction="row" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h4" align="center" sx={{flex: 1}}>
          ✨ My Notes
        </Typography>
        <IconButton onClick={loadNotes} disabled={loading} color="primary">
          <RefreshIcon/>
        </IconButton>
      </Stack>

      {/* Create new note */}
      <Card sx={{mb: 4, p: 2}}>
        <Typography variant="h6" gutterBottom>
          Create a New Note
        </Typography>
        <Grid container spacing={2}>
          <Grid size={{xs: 12, sm: 4}}>
            <TextField
              fullWidth
              label="Title"
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              disabled={creating}
              required
            />
          </Grid>
          <Grid size={{xs: 12, sm: 5}}>
            <TextField
              fullWidth
              label="Text"
              value={newText}
              onChange={(e) => setNewText(e.target.value)}
              disabled={creating}
            />
          </Grid>
          <Grid size={{xs: 12, sm: 3}}>
            <Select
              fullWidth
              value={newPrivacy}
              onChange={(e) => setNewPrivacy(e.target.value as NotePrivacy)}
              disabled={creating}
            >
              <MenuItem value="PUBLIC">Public</MenuItem>
              <MenuItem value="PRIVATE">Private</MenuItem>
              <MenuItem value="COLLABORATORS">Collaborators</MenuItem>
            </Select>
          </Grid>
        </Grid>

        <Box sx={{display: "flex", justifyContent: "flex-end", mt: 2}}>
          <Button
            variant="contained"
            color="primary"
            onClick={handleAddNote}
            startIcon={creating ? <CircularProgress size={20}/> : <AddIcon/>}
            disabled={creating}
          >
            {creating ? "Adding..." : "Add Note"}
          </Button>
        </Box>
      </Card>

      {/* Loading state */}
      {loading && (
        <Box sx={{display: "flex", justifyContent: "center", my: 4}}>
          <CircularProgress/>
        </Box>
      )}

      {/* Empty state */}
      {!loading && notes.length === 0 && (
        <Alert severity="info">
          No notes yet. Create your first note above!
        </Alert>
      )}

      {/* Notes list */}
      {!loading && notes.length > 0 && (
        <DragDropContext onDragEnd={handleDragEnd}>
          <Droppable droppableId="notes">
            {(provided) => (
              <Box ref={provided.innerRef} {...provided.droppableProps}>
                {notes.map((note, index) => (
                  <Draggable
                    key={note.id.toString()}
                    draggableId={note.id.toString()}
                    index={index}
                  >
                    {(provided, snapshot) => (
                      <Card
                        ref={provided.innerRef}
                        {...provided.draggableProps}
                        {...provided.dragHandleProps}
                        sx={{
                          mb: 2,
                          p: 2,
                          transition: "background-color 0.2s",
                          backgroundColor: snapshot.isDragging ? "#f5f5f5" : "white",
                          boxShadow: snapshot.isDragging
                            ? 4
                            : "0px 2px 6px rgba(0,0,0,0.1)",
                        }}
                      >
                        <CardContent>
                          <Grid container alignItems="center" spacing={2}>
                            <Grid>
                              <Tooltip title={getUserDisplayName(note.authorId)}>
                                <Avatar sx={{bgcolor: "primary.main"}}>
                                  {getUserInitials(note.authorId)}
                                </Avatar>
                              </Tooltip>
                            </Grid>
                            <Grid size="grow">
                              <TextField
                                variant="standard"
                                fullWidth
                                value={note.title}
                                onChange={(e) =>
                                  handleTitleChange(note.id, e.target.value)
                                }
                                onBlur={(e) =>
                                  handleTitleChange(note.id, e.target.value)
                                }
                                sx={{mb: 1}}
                                InputProps={{
                                  style: {fontWeight: "bold", fontSize: "1.1rem"},
                                }}
                              />
                              <TextField
                                variant="outlined"
                                fullWidth
                                multiline
                                minRows={2}
                                value={note.text}
                                onChange={(e) =>
                                  handleTextChange(note.id, e.target.value)
                                }
                                onBlur={(e) =>
                                  handleTextChange(note.id, e.target.value)
                                }
                              />

                              <Stack
                                direction="row"
                                spacing={1}
                                alignItems="center"
                                sx={{mt: 1}}
                                flexWrap="wrap"
                              >
                                <Select
                                  size="small"
                                  value={note.privacy}
                                  onChange={(e) =>
                                    handlePrivacyChange(
                                      note.id,
                                      e.target.value as NotePrivacy
                                    )
                                  }
                                  sx={{
                                    fontWeight: 500,
                                    backgroundColor: (theme) =>
                                      theme.palette[getPrivacyColor(note.privacy)]
                                        ?.light,
                                  }}
                                >
                                  <MenuItem value="PUBLIC">Public</MenuItem>
                                  <MenuItem value="PRIVATE">Private</MenuItem>
                                  <MenuItem value="COLLABORATORS">
                                    Collaborators
                                  </MenuItem>
                                </Select>

                                {note.privacy === "PRIVATE" &&
                                  note.sharedWithUserIds &&
                                  note.sharedWithUserIds.length > 0 && (
                                    <Stack direction="row" spacing={0.5} flexWrap="wrap">
                                      <Typography variant="caption" sx={{mr: 1, alignSelf: "center"}}>
                                        Shared with:
                                      </Typography>
                                      {note.sharedWithUserIds.map((userId) => (
                                        <Chip
                                          key={userId}
                                          avatar={
                                            <Avatar sx={{bgcolor: "secondary.main"}}>
                                              {getUserInitials(userId)}
                                            </Avatar>
                                          }
                                          label={getUserDisplayName(userId)}
                                          size="small"
                                          sx={{m: 0.5}}
                                        />
                                      ))}
                                    </Stack>
                                  )}
                              </Stack>
                            </Grid>
                            <Grid>
                              <IconButton
                                color="error"
                                onClick={() => handleDelete(note.id)}
                              >
                                <DeleteIcon/>
                              </IconButton>
                            </Grid>
                          </Grid>
                        </CardContent>
                      </Card>
                    )}
                  </Draggable>
                ))}
                {provided.placeholder}
              </Box>
            )}
          </Droppable>
        </DragDropContext>
      )}

      {/* Snackbar notifications */}
      <Snackbar
        open={!!error}
        autoHideDuration={6000}
        onClose={handleCloseSnackbar}
        anchorOrigin={{vertical: "bottom", horizontal: "center"}}
      >
        <Alert onClose={handleCloseSnackbar} severity="error" sx={{width: "100%"}}>
          {error}
        </Alert>
      </Snackbar>

      <Snackbar
        open={!!success}
        autoHideDuration={3000}
        onClose={handleCloseSnackbar}
        anchorOrigin={{vertical: "bottom", horizontal: "center"}}
      >
        <Alert onClose={handleCloseSnackbar} severity="success" sx={{width: "100%"}}>
          {success}
        </Alert>
      </Snackbar>
    </Box>
  );
};

export default NotesPage;
