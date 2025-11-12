import React, {useState} from "react";
import {
  Avatar,
  Box,
  Button,
  Card,
  CardContent,
  Grid,
  IconButton,
  MenuItem,
  Select,
  Stack,
  TextField,
  Tooltip,
  Typography,
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import DeleteIcon from "@mui/icons-material/Delete";
import {DragDropContext, Draggable, Droppable, type DropResult} from "@hello-pangea/dnd";

interface Collaborator {
  id: string;
  name: string;
}

interface Note {
  id: string;
  title: string;
  text: string;
  privacy: "Public" | "Private" | "Collaborators";
  author: string;
  collaborators: Collaborator[];
}

const getPrivacyColor = (privacy: Note["privacy"]) => {
  switch (privacy) {
    case "Public":
      return "success";
    case "Private":
      return "error";
    case "Collaborators":
      return "warning";
    default:
      return "default";
  }
};

const NotesPage: React.FC = () => {
  const [notes, setNotes] = useState<Note[]>([]);
  const [newTitle, setNewTitle] = useState("");
  const [newText, setNewText] = useState("");
  const [newPrivacy, setNewPrivacy] = useState<Note["privacy"]>("Public");

  const handleAddNote = () => {
    if (!newTitle.trim()) return;

    const authorName = "John Doe"; // Placeholder author
    const collaborators: Collaborator[] = [
      {id: "1", name: "Alice"},
      {id: "2", name: "Bob"},
    ];

    const newNote: Note = {
      id: Date.now().toString(),
      title: newTitle,
      text: newText,
      privacy: newPrivacy,
      author: authorName,
      collaborators: newPrivacy === "Collaborators" ? collaborators : [],
    };

    setNotes((prev) => [...prev, newNote]);
    setNewTitle("");
    setNewText("");
    setNewPrivacy("Public");
  };

  const handleDelete = (id: string) => {
    setNotes((prev) => prev.filter((n) => n.id !== id));
  };

  const handleTextChange = (id: string, text: string) => {
    setNotes((prev) => prev.map((n) => (n.id === id ? {...n, text} : n)));
  };

  const handleTitleChange = (id: string, title: string) => {
    setNotes((prev) => prev.map((n) => (n.id === id ? {...n, title} : n)));
  };

  const handlePrivacyChange = (id: string, privacy: Note["privacy"]) => {
    setNotes((prev) =>
      prev.map((n) =>
        n.id === id
          ? {
            ...n,
            privacy,
            collaborators:
              privacy === "Collaborators"
                ? [
                  {id: "1", name: "Alice"},
                  {id: "2", name: "Bob"},
                ]
                : [],
          }
          : n
      )
    );
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

  return (
    <Box sx={{maxWidth: 800, mx: "auto", mt: 6, mb: 10}}>
      <Typography variant="h4" gutterBottom align="center">
        ✨ My Notes
      </Typography>

      {/* Create new note */}
      <Card sx={{mb: 4, p: 2}}>
        <Typography variant="h6" gutterBottom>
          Create a New Note
        </Typography>
        <Grid container spacing={2}>
          <Grid item xs={12} sm={4}>
            <TextField
              fullWidth
              label="Title"
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
            />
          </Grid>
          <Grid item xs={12} sm={5}>
            <TextField
              fullWidth
              label="Text"
              value={newText}
              onChange={(e) => setNewText(e.target.value)}
            />
          </Grid>
          <Grid item xs={12} sm={3}>
            <Select
              fullWidth
              value={newPrivacy}
              onChange={(e) =>
                setNewPrivacy(e.target.value as Note["privacy"])
              }
            >
              <MenuItem value="Public">Public</MenuItem>
              <MenuItem value="Private">Private</MenuItem>
              <MenuItem value="Collaborators">Collaborators</MenuItem>
            </Select>
          </Grid>
        </Grid>

        <Box sx={{display: "flex", justifyContent: "flex-end", mt: 2}}>
          <Button
            variant="contained"
            color="primary"
            onClick={handleAddNote}
            startIcon={<AddIcon/>}
          >
            Add Note
          </Button>
        </Box>
      </Card>

      {/* Notes list */}
      <DragDropContext onDragEnd={handleDragEnd}>
        <Droppable droppableId="notes">
          {(provided) => (
            <Box ref={provided.innerRef} {...provided.droppableProps}>
              {notes.map((note, index) => (
                <Draggable key={note.id} draggableId={note.id} index={index}>
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
                          <Grid item>
                            <Avatar sx={{bgcolor: "primary.main"}}>
                              {getInitials(note.author)}
                            </Avatar>
                          </Grid>

                          <Grid item xs>
                            <TextField
                              variant="standard"
                              fullWidth
                              value={note.title}
                              onChange={(e) =>
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
                            />

                            <Stack
                              direction="row"
                              spacing={1}
                              alignItems="center"
                              sx={{mt: 1}}
                            >
                              <Select
                                size="small"
                                value={note.privacy}
                                onChange={(e) =>
                                  handlePrivacyChange(
                                    note.id,
                                    e.target.value as Note["privacy"]
                                  )
                                }
                                sx={{
                                  fontWeight: 500,
                                  backgroundColor: (theme) =>
                                    theme.palette[
                                      getPrivacyColor(note.privacy)
                                      ]?.light,
                                }}
                              >
                                <MenuItem value="Public">Public</MenuItem>
                                <MenuItem value="Private">Private</MenuItem>
                                <MenuItem value="Collaborators">
                                  Collaborators
                                </MenuItem>
                              </Select>

                              {note.privacy === "Collaborators" && (
                                <Stack direction="row" spacing={-0.5}>
                                  {note.collaborators.map((c) => (
                                    <Tooltip title={c.name} key={c.id}>
                                      <Avatar
                                        sx={{
                                          width: 28,
                                          height: 28,
                                          bgcolor: "secondary.main",
                                          fontSize: "0.75rem",
                                        }}
                                      >
                                        {getInitials(c.name)}
                                      </Avatar>
                                    </Tooltip>
                                  ))}
                                </Stack>
                              )}
                            </Stack>
                          </Grid>

                          <Grid item>
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
    </Box>
  );
};

export default NotesPage;
