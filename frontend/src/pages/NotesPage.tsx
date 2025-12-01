import React, {useCallback, useEffect, useRef, useState} from "react";
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
import {CollaboratorsModal} from "../components/CollaboratorsModal.tsx";

const getPrivacyColor = (privacy: NotePrivacy) => {
  switch (privacy) {
    case "PUBLIC":
      return "success";
    case "PRIVATE":
      return "error";
  }
};

const DEBOUNCE_DELAY = 500; // milliseconds

const NotesPage: React.FC = () => {
  const [notes, setNotes] = useState<NoteDto[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [currentUserId, setCurrentUserId] = useState<number | null>(null);

  // User cache for displaying names
  const [userCache, setUserCache] = useState<Map<number, UserDto>>(new Map());

  // New note form state - only for creating state
  const [creating, setCreating] = useState(false);

  // Collaborators modal state
  const [collaboratorsModalOpen, setCollaboratorsModalOpen] = useState(false);
  const [editingNoteId, setEditingNoteId] = useState<number | null>(null);

  // Refs for new note form inputs
  const newTitleRef = useRef<HTMLInputElement>(null);
  const newTextRef = useRef<HTMLInputElement>(null);
  const newPrivacyRef = useRef<HTMLSelectElement>(null);

  // Debounce timers for each note
  const updateTimersRef = useRef<Map<number, NodeJS.Timeout>>(new Map());

  const isMyNote = (note: NoteDto): boolean => {
    return currentUserId !== null && note.authorId === currentUserId;
  };

  const loadNotes = async () => {
    setLoading(true);
    setError(null);
    try {
      // Load current user first
      const currentUser = await usersApi.getCurrentUser();
      setCurrentUserId(currentUser.id);
      setUserCache(prev => new Map(prev).set(currentUser.id, currentUser));

      // Load notes
      const data = await notesApi.getAllVisibleNotes();

      // Sort notes: my notes first, then others
      const sortedNotes = data.sort((a, b) => {
        if (a.authorId === currentUser.id && b.authorId !== currentUser.id) return -1;
        if (a.authorId !== currentUser.id && b.authorId === currentUser.id) return 1;
        return 0;
      });

      setNotes(sortedNotes);

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

  // Cleanup timers on unmount
  useEffect(() => {
    return () => {
      updateTimersRef.current.forEach(timer => clearTimeout(timer));
    };
  }, []);

  // Debounced update function
  const debouncedUpdateNote = useCallback((noteId: number, updatedNote: NoteDto) => {
    // Clear existing timer for this note
    const existingTimer = updateTimersRef.current.get(noteId);
    if (existingTimer) {
      clearTimeout(existingTimer);
    }

    // Set new timer
    const timer = setTimeout(async () => {
      try {
        const request: UpdateNoteRequest = {
          title: updatedNote.title,
          text: updatedNote.text,
          privacy: updatedNote.privacy,
          ...(updatedNote.privacy === "PRIVATE" && {
            sharedWithUserIds: updatedNote.sharedWithUserIds || [],
          }),
        };

        await notesApi.updateNote(noteId, request);
        updateTimersRef.current.delete(noteId);
      } catch (err: unknown) {
        setError("Failed to update note");
        console.error("Error updating note:", err);
        // Revert on error
        await loadNotes();
      }
    }, DEBOUNCE_DELAY);

    updateTimersRef.current.set(noteId, timer);
  }, []);

  // Generic update handler for any note field
  const handleNoteUpdate = (noteId: number, updates: Partial<NoteDto>) => {
    setNotes((prev) => {
      return prev.map((note) => {
        if (note.id === noteId) {
          const updatedNote = {...note, ...updates};
          // Trigger debounced update
          debouncedUpdateNote(noteId, updatedNote);
          return updatedNote;
        }
        return note;
      });
    });
  };

  const handleAddNote = async () => {
    const title = newTitleRef.current?.value || "";
    const text = newTextRef.current?.value || "";
    const privacy = (newPrivacyRef.current?.value as NotePrivacy) || "PUBLIC";

    if (!title.trim()) {
      setError("Title is required");
      return;
    }

    setCreating(true);
    setError(null);

    try {
      const request: CreateNoteRequest = {
        title,
        text,
        privacy,
        // Add sharedWithUserIds if privacy is PRIVATE
        ...(privacy === "PRIVATE" && {
          sharedWithUserIds: [],
        }),
      };

      const createdNote = await notesApi.createNote(request);
      // Add new note at the top
      setNotes((prev) => [createdNote, ...prev]);

      // Reset form
      if (newTitleRef.current) newTitleRef.current.value = "";
      if (newTextRef.current) newTextRef.current.value = "";
      if (newPrivacyRef.current) newPrivacyRef.current.value = "PUBLIC";

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

    // Clear any pending updates for this note
    const timer = updateTimersRef.current.get(id);
    if (timer) {
      clearTimeout(timer);
      updateTimersRef.current.delete(id);
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

  const handlePrivacyChange = (noteId: number, privacy: NotePrivacy) => {
    if (privacy === "PRIVATE") {
      // Open modal to select collaborators
      setEditingNoteId(noteId);
      setCollaboratorsModalOpen(true);
    } else {
      // For PUBLIC update immediately
      handleNoteUpdate(noteId, {privacy, sharedWithUserIds: []});
    }
  };

  const handleCollaboratorsSubmit = async (selectedUserIds: number[]) => {
    if (editingNoteId !== null) {
      handleNoteUpdate(editingNoteId, {
        privacy: "PRIVATE",
        sharedWithUserIds: selectedUserIds,
      });
      setSuccess("Collaborators updated successfully!");
    }
  };

  const handleEditCollaborators = (noteId: number) => {
    setEditingNoteId(noteId);
    setCollaboratorsModalOpen(true);
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

  const getEditingNote = (): NoteDto | undefined => {
    return notes.find((note) => note.id === editingNoteId);
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
              inputRef={newTitleRef}
              defaultValue=""
              disabled={creating}
              required
            />
          </Grid>
          <Grid size={{xs: 12, sm: 5}}>
            <TextField
              fullWidth
              label="Text"
              inputRef={newTextRef}
              defaultValue=""
              disabled={creating}
            />
          </Grid>
          <Grid size={{xs: 12, sm: 3}}>
            <Select
              fullWidth
              inputRef={newPrivacyRef}
              defaultValue="PUBLIC"
              disabled={creating}
            >
              <MenuItem value="PUBLIC">Public</MenuItem>
              <MenuItem value="PRIVATE">Private</MenuItem>
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
                          backgroundColor: snapshot.isDragging ? (isMyNote(note) ? "#e0e0d9" : "#f7f6b9") :
                            isMyNote(note)
                              ? "white"
                              : "#faf9d6",
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
                                  handleNoteUpdate(note.id, {title: e.target.value})
                                }
                                sx={{mb: 1}}
                                slotProps={{
                                  input: {
                                    style: {fontWeight: "bold", fontSize: "1.1rem"},
                                  }
                                }}
                              />
                              <TextField
                                variant="outlined"
                                fullWidth
                                multiline
                                minRows={2}
                                value={note.text}
                                onChange={(e) =>
                                  handleNoteUpdate(note.id, {text: e.target.value})
                                }
                              />

                              {isMyNote(note) &&
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
                                            handlePrivacyChange(note.id, e.target.value as NotePrivacy)
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
                                      </Select>

                                    {note.privacy === "PRIVATE" && (
                                      <>
                                        <Button
                                          size="large"
                                          variant="outlined"
                                          onClick={() => handleEditCollaborators(note.id)}
                                        >
                                          Edit Collaborators
                                        </Button>
                                        {note.sharedWithUserIds &&
                                          note.sharedWithUserIds.length > 0 && (
                                            <Stack direction="row" spacing={0.5} flexWrap="wrap">
                                              <Typography variant="caption" sx={{mr: 1, alignSelf: "center"}}>
                                                Shared with:
                                              </Typography>
                                              {note.sharedWithUserIds.map((userId) => (
                                                <Chip
                                                  key={userId}
                                                  avatar={
                                                    <Avatar style={{color: "white"}} sx={{bgcolor: "primary.main"}}>
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
                                      </>
                                    )}
                                  </Stack>}
                            </Grid>

                            <Grid>{isMyNote(note) &&
                                <IconButton
                                    color="error"
                                    onClick={() => handleDelete(note.id)}
                                >
                                    <DeleteIcon/>
                                </IconButton>}
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

      {/* Collaborators Modal */}
      {currentUserId !== null && editingNoteId !== null && (
        <CollaboratorsModal
          open={collaboratorsModalOpen}
          onClose={() => {
            setCollaboratorsModalOpen(false);
            setEditingNoteId(null);
          }}
          currentCollaboratorIds={getEditingNote()?.sharedWithUserIds || []}
          currentUserId={currentUserId}
          onSubmit={handleCollaboratorsSubmit}
        />
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
