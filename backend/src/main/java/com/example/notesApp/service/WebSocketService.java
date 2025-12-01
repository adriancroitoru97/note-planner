package com.example.notesApp.service;

import com.example.notesApp.dto.NoteDto;
import com.example.notesApp.dto.NoteEditingStatusDto;
import com.example.notesApp.dto.WebSocketMessage;
import com.example.notesApp.entity.Note;
import com.example.notesApp.enums.NotePrivacy;
import com.example.notesApp.enums.WebSocketEventType;
import lombok.RequiredArgsConstructor;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Service;

@Service
@RequiredArgsConstructor
public class WebSocketService {

    private final SimpMessagingTemplate messagingTemplate;

    public void broadcastNoteCreated(NoteDto noteDto, Note note) {
        WebSocketMessage message = WebSocketMessage.builder()
                .type(WebSocketEventType.NOTE_CREATED)
                .note(noteDto)
                .build();

        handleNote(note, message);
    }

    public void broadcastNoteUpdated(NoteDto noteDto, Note note) {
        WebSocketMessage message = WebSocketMessage.builder()
                .type(WebSocketEventType.NOTE_UPDATED)
                .note(noteDto)
                .build();

        handleNote(note, message);
    }

    public void broadcastNoteDeleted(Long noteId, Note note) {
        WebSocketMessage message = WebSocketMessage.builder()
                .type(WebSocketEventType.NOTE_DELETED)
                .noteId(noteId)
                .build();

        handleNote(note, message);
    }

    public void broadcastEditingStatus(NoteEditingStatusDto status, Note note) {
        WebSocketMessage message = WebSocketMessage.builder()
                .type(status.getIsEditing() ? WebSocketEventType.USER_EDITING : WebSocketEventType.USER_STOPPED_EDITING)
                .noteId(status.getNoteId())
                .userId(status.getUserId())
                .username(status.getUsername())
                .build();

        if (note.getPrivacy() == NotePrivacy.PUBLIC) {
            messagingTemplate.convertAndSend("/topic/notes/editing", message);
        } else {
            // Send to author
            messagingTemplate.convertAndSendToUser(
                    note.getAuthor().getId().toString(),
                    "/queue/notes/editing",
                    message
            );

            // Send to collaborators
            note.getSharedWith().forEach(user -> {
                messagingTemplate.convertAndSendToUser(
                        user.getId().toString(),
                        "/queue/notes/editing",
                        message
                );
            });
        }
    }

    private void handleNote(Note note, WebSocketMessage message) {
        if (note.getPrivacy() == NotePrivacy.PUBLIC) {
            // Broadcast to all users
            messagingTemplate.convertAndSend("/topic/notes", message);
        } else {
            // Send to author
            messagingTemplate.convertAndSendToUser(
                    note.getAuthor().getId().toString(),
                    "/queue/notes",
                    message
            );

            // Send to collaborators
            note.getSharedWith().forEach(user -> {
                messagingTemplate.convertAndSendToUser(
                        user.getId().toString(),
                        "/queue/notes",
                        message
                );
            });
        }
    }
}
