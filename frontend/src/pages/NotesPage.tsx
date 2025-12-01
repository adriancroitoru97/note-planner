import React, {useCallback, useEffect, useRef, useState} from "react";
import {
  Alert,
  Avatar,
  Badge,
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
import EditIcon from "@mui/icons-material/Edit";
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
import {type EditingUser, useWebSocket} from "../hooks/useWebSocket.ts";

const getPrivacyColor = (privacy: NotePrivacy) => {
  switch (privacy) {
    case "PUBLIC":
      return "success";
    case "PRIVATE":
      return "error";
  }
};

const NotesPage: React.FC = () => {
  const [notes, setNotes] = useState<NoteDto[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [currentUserId, setCurrentUserId] = useState<number | null>(null);
  const [currentUserEmail, setCurrentUserEmail] = useState<string | null>(null);

  // User cache for displaying names
  const [userCache, setUserCache] = useState<Map<number, UserDto>>(new Map());

  // New note form state
  const [creating, setCreating] = useState(false);

  // Collaborators modal state
  const [collaboratorsModalOpen, setCollaboratorsModalOpen] = useState(false);
  const [editingNoteId, setEditingNoteId] = useState<number | null>(null);

  // Track who's editing which note
  const [editingUsers, setEditingUsers] = useState<Map<number, EditingUser[]>>(new Map());
  const [locallyEditingNoteId, setLocallyEditingNoteId] = useState<number | null>(null);

  // Refs for new note form inputs
  const newTitleRef = useRef<HTMLInputElement>(null);
  const newTextRef = useRef<HTMLInputElement>(null);
  const newPrivacyRef = useRef<HTMLSelectElement>(null);

  // Track if an update came from WebSocket to prevent echo
  const isRemoteUpdateRef = useRef(false);

  // Queue for pending updates to prevent race conditions
  const updateQueueRef = useRef<Map<number, Promise<void>>>(new Map());

  // Track currently focused input to prevent WebSocket overwrites
  const focusedInputRef = useRef<{ noteId: number, field: 'title' | 'text' } | null>(null);
  const inputValuesRef = useRef<Map<string, string>>(new Map());

  // Debounce timer for API updates
  const debounceTimersRef = useRef<Map<number, NodeJS.Timeout>>(new Map());

  const isMyNote = (note: NoteDto): boolean => {
    return currentUserId !== null && note.authorId === currentUserId;
  };

  // Check if current user can access a note
  const canAccessNote = useCallback((note: NoteDto): boolean => {
    if (!currentUserId) return false;

    // Author can always access
    if (note.authorId === currentUserId) return true;

    // Public notes are accessible to everyone
    if (note.privacy === "PUBLIC") return true;

    // Check if user is in shared list
    return note.sharedWithUserIds?.includes(currentUserId) || false;
  }, [currentUserId]);

  // WebSocket handlers
  const handleNoteCreated = useCallback((note: NoteDto) => {
    console.log('Note created via WebSocket:', note);

    // Only add if we can access it
    if (!canAccessNote(note)) {
      console.log('Cannot access note, skipping');
      return;
    }

    setNotes((prev) => {
      // Check if note already exists
      if (prev.find(n => n.id === note.id)) {
        return prev;
      }
      return [note, ...prev];
    });
    if (note.authorId !== currentUserId) {
      setSuccess(`New note created by ${getUserDisplayName(note.authorId)}`);
    }
  }, [currentUserId, canAccessNote]);

  const handleNoteUpdated = useCallback((note: NoteDto) => {
    console.log('Note updated via WebSocket:', note);
    isRemoteUpdateRef.current = true;

    setNotes((prev) => {
      const existingNote = prev.find(n => n.id === note.id);

      // Check if we can still access this note
      if (!canAccessNote(note)) {
        console.log('Lost access to note, removing from view');
        // We lost access (removed as collaborator or changed to private)
        if (existingNote) {
          setSuccess('You no longer have access to a note');
        }
        return prev.filter(n => n.id !== note.id);
      }

      if (existingNote) {
        // Don't overwrite fields that are currently being edited
        const focused = focusedInputRef.current;
        if (focused && focused.noteId === note.id) {
          // Keep the current value for the focused field
          const key = `${note.id}-${focused.field}`;
          const currentValue = inputValuesRef.current.get(key);

          if (currentValue !== undefined) {
            return prev.map((n) => {
              if (n.id === note.id) {
                return {
                  ...note,
                  [focused.field]: currentValue
                };
              }
              return n;
            });
          }
        }

        // Update existing note
        return prev.map((n) => (n.id === note.id ? note : n));
      } else {
        // Note might have been shared with us, add it
        setSuccess('A note was shared with you');
        return [note, ...prev];
      }
    });

    setTimeout(() => {
      isRemoteUpdateRef.current = false;
    }, 100);
  }, [canAccessNote]);

  const handleNoteDeleted = useCallback((noteId: number) => {
    console.log('Note deleted via WebSocket:', noteId);
    setNotes((prev) => prev.filter((n) => n.id !== noteId));
    setSuccess('A note was deleted');
  }, []);

  const handleUserEditing = useCallback((editingUser: EditingUser) => {
    console.log('User started editing:', editingUser);
    setEditingUsers((prev) => {
      const newMap = new Map(prev);
      const editors = newMap.get(editingUser.noteId) || [];
      // Add user if not already in the list
      if (!editors.find(e => e.userId === editingUser.userId)) {
        newMap.set(editingUser.noteId, [...editors, editingUser]);
      }
      return newMap;
    });
  }, []);

  const handleUserStoppedEditing = useCallback((editingUser: EditingUser) => {
    console.log('User stopped editing:', editingUser);
    setEditingUsers((prev) => {
      const newMap = new Map(prev);
      const editors = newMap.get(editingUser.noteId) || [];
      newMap.set(
        editingUser.noteId,
        editors.filter(e => e.userId !== editingUser.userId)
      );
      return newMap;
    });
  }, []);

  // Initialize WebSocket
  const {connected, sendEditingStatus} = useWebSocket({
    onNoteCreated: handleNoteCreated,
    onNoteUpdated: handleNoteUpdated,
    onNoteDeleted: handleNoteDeleted,
    onUserEditing: handleUserEditing,
    onUserStoppedEditing: handleUserStoppedEditing,
    currentUserId,
    currentUserEmail
  });

  const loadNotes = async () => {
    setLoading(true);
    setError(null);
    try {
      // Load current user first
      const currentUser = await usersApi.getCurrentUser();
      setCurrentUserId(currentUser.id);
      setCurrentUserEmail(currentUser.email);
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
    loadNotes();
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      // Notify that we stopped editing
      if (locallyEditingNoteId) {
        sendEditingStatus(locallyEditingNoteId, false);
      }

      // Clear all debounce timers
      debounceTimersRef.current.forEach(timer => clearTimeout(timer));
    };
  }, [locallyEditingNoteId, sendEditingStatus]);

  // Update note with queueing to prevent race conditions
  const updateNoteImmediately = useCallback(async (noteId: number, updatedNote: NoteDto) => {
    // Don't send update if this was triggered by a remote update
    if (isRemoteUpdateRef.current) {
      return;
    }

    // Wait for any pending update on this note to complete
    const existingUpdate = updateQueueRef.current.get(noteId);
    if (existingUpdate) {
      await existingUpdate;
    }

    // Create new update promise
    const updatePromise = (async () => {
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
        // WebSocket will broadcast the change to others
      } catch (err: unknown) {
        setError("Failed to update note");
        console.error("Error updating note:", err);
        // Revert on error
        await loadNotes();
      } finally {
        // Remove from queue when done
        updateQueueRef.current.delete(noteId);
      }
    })();

    // Store in queue
    updateQueueRef.current.set(noteId, updatePromise);

    return updatePromise;
  }, []);

  // Generic update handler for any note field with debouncing
  const handleNoteUpdate = (noteId: number, updates: Partial<NoteDto>) => {
    // Update local state immediately for responsive UI
    setNotes((prev) => {
      return prev.map((note) => {
        if (note.id === noteId) {
          return {...note, ...updates};
        }
        return note;
      });
    });

    // Clear existing debounce timer for this note
    const existingTimer = debounceTimersRef.current.get(noteId);
    if (existingTimer) {
      clearTimeout(existingTimer);
    }

    // Set new debounce timer
    const timer = setTimeout(() => {
      setNotes((prev) => {
        const note = prev.find(n => n.id === noteId);
        if (note) {
          updateNoteImmediately(noteId, note);
        }
        return prev;
      });
      debounceTimersRef.current.delete(noteId);
    }, 500); // 500ms debounce

    debounceTimersRef.current.set(noteId, timer);
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
        ...(privacy === "PRIVATE" && {
          sharedWithUserIds: [],
        }),
      };

      await notesApi.createNote(request);
      // Note will be added via WebSocket

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

    try {
      await notesApi.deleteNote(id);
      // Note will be removed via WebSocket
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
  };

  const getInitials = (name: string) =>
    name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase();

  const getUserDisplayName = (userId: number): string => {
    const user = userCache.get(userId);
    if (!user) {
      usersApi.getUserById(userId).then((fetchedUser) => {
        setUserCache((prev) => new Map(prev).set(userId, fetchedUser));
      });
    }

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

  const getEditorsForNote = (noteId: number): EditingUser[] => {
    return editingUsers.get(noteId) || [];
  };

  // Handle editing status and track focused inputs
  const handleFocus = (noteId: number, field: 'title' | 'text') => {
    sendEditingStatus(noteId, true);
    setLocallyEditingNoteId(noteId);
    focusedInputRef.current = {noteId, field};

    // Store current value
    const note = notes.find(n => n.id === noteId);
    if (note) {
      const key = `${noteId}-${field}`;
      inputValuesRef.current.set(key, note[field]);
    }
  };

  const handleBlur = (noteId: number, field: 'title' | 'text') => {
    sendEditingStatus(noteId, false);
    if (locallyEditingNoteId === noteId) {
      setLocallyEditingNoteId(null);
    }

    // Clear focused input tracking
    if (focusedInputRef.current?.noteId === noteId && focusedInputRef.current?.field === field) {
      focusedInputRef.current = null;
    }

    // Clear stored value
    const key = `${noteId}-${field}`;
    inputValuesRef.current.delete(key);

    // Trigger immediate update on blur to ensure final state is saved
    const existingTimer = debounceTimersRef.current.get(noteId);
    if (existingTimer) {
      clearTimeout(existingTimer);
      debounceTimersRef.current.delete(noteId);

      const note = notes.find(n => n.id === noteId);
      if (note) {
        updateNoteImmediately(noteId, note);
      }
    }
  };

  // Handle input changes
  const handleInputChange = (noteId: number, field: 'title' | 'text', value: string) => {
    // Update tracked value
    const key = `${noteId}-${field}`;
    inputValuesRef.current.set(key, value);

    // Update note
    handleNoteUpdate(noteId, {[field]: value});
  };

  return (
    <Box sx={{maxWidth: 800, mx: "auto", mt: 6, mb: 10}}>
      <Stack direction="row" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h4" align="center" sx={{flex: 1}}>
          ✨ My Notes
        </Typography>
        <Stack direction="row" spacing={1} alignItems="center">
          <Chip
            label={connected ? "Connected" : "Disconnected"}
            color={connected ? "success" : "error"}
            size="small"
          />
          <IconButton onClick={loadNotes} disabled={loading} color="primary">
            <RefreshIcon/>
          </IconButton>
        </Stack>
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
                {notes.map((note, index) => {
                  const editors = getEditorsForNote(note.id);
                  const hasEditors = editors.length > 0;

                  return (
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
                            border: hasEditors ? "2px solid #1976d2" : "none",
                          }}
                        >
                          <CardContent>
                            {hasEditors && (
                              <Stack direction="row" spacing={0.5} mb={1} flexWrap="wrap">
                                <Chip
                                  icon={<EditIcon/>}
                                  label={`${editors.map(e => e.username).join(", ")} editing...`}
                                  size="small"
                                  color="primary"
                                  variant="outlined"
                                />
                              </Stack>
                            )}

                            <Grid container alignItems="center" spacing={2}>
                              <Grid>
                                <Tooltip title={getUserDisplayName(note.authorId)}>
                                  <Badge
                                    overlap="circular"
                                    anchorOrigin={{vertical: 'bottom', horizontal: 'right'}}
                                    badgeContent={
                                      hasEditors ? (
                                        <Box
                                          sx={{
                                            width: 12,
                                            height: 12,
                                            borderRadius: '50%',
                                            backgroundColor: '#1976d2',
                                            border: '2px solid white',
                                          }}
                                        />
                                      ) : null
                                    }
                                  >
                                    <Avatar sx={{bgcolor: "primary.main"}}>
                                      {getUserInitials(note.authorId)}
                                    </Avatar>
                                  </Badge>
                                </Tooltip>
                              </Grid>
                              <Grid size="grow">
                                <TextField
                                  variant="standard"
                                  fullWidth
                                  value={note.title}
                                  onChange={(e) =>
                                    handleInputChange(note.id, 'title', e.target.value)
                                  }
                                  onFocus={() => handleFocus(note.id, 'title')}
                                  onBlur={() => handleBlur(note.id, 'title')}
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
                                    handleInputChange(note.id, 'text', e.target.value)
                                  }
                                  onFocus={() => handleFocus(note.id, 'text')}
                                  onBlur={() => handleBlur(note.id, 'text')}
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
                  );
                })}
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
