package com.example.notesApp.service;

import com.example.notesApp.dto.NoteDto;
import com.example.notesApp.dto.NoteEditingStatusDto;
import com.example.notesApp.dto.WebSocketMessage;
import com.example.notesApp.entity.Note;
import com.example.notesApp.entity.User;
import com.example.notesApp.enums.NotePrivacy;
import com.example.notesApp.enums.WebSocketEventType;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.messaging.simp.user.SimpUser;
import org.springframework.messaging.simp.user.SimpUserRegistry;
import org.springframework.stereotype.Service;

import java.util.HashSet;
import java.util.Set;

@Slf4j
@Service
@RequiredArgsConstructor
public class WebSocketService {

    private final SimpMessagingTemplate messagingTemplate;
    private final SimpUserRegistry userRegistry;

    public void broadcastNoteCreated(NoteDto noteDto, Note note) {
        log.info("Broadcasting note created: id={}, privacy={}", noteDto.getId(), note.getPrivacy());

        WebSocketMessage message = WebSocketMessage.builder()
                .type(WebSocketEventType.NOTE_CREATED)
                .note(noteDto)
                .build();

        if (note.getPrivacy() == NotePrivacy.PUBLIC) {
            log.info("Broadcasting to /topic/notes");
            messagingTemplate.convertAndSend("/topic/notes", message);
        } else {
            sendToAuthorAndCollaborators(message, note);
        }
    }

    public void broadcastNoteUpdated(NoteDto noteDto, Note note, NotePrivacy oldPrivacy, Set<User> oldSharedWith) {
        log.info("Broadcasting note updated: id={}, oldPrivacy={}, newPrivacy={}",
                noteDto.getId(), oldPrivacy, note.getPrivacy());

        WebSocketMessage message = WebSocketMessage.builder()
                .type(WebSocketEventType.NOTE_UPDATED)
                .note(noteDto)
                .build();

        // Collect all users who should receive the update
        Set<String> targetEmails = new HashSet<>();

        // Always include the author
        targetEmails.add(note.getAuthor().getEmail());

        // If old privacy was PUBLIC, send to everyone
        boolean wasPublic = oldPrivacy == NotePrivacy.PUBLIC;
        boolean isPublic = note.getPrivacy() == NotePrivacy.PUBLIC;

        if (wasPublic || isPublic) {
            // If it was public or is now public, broadcast to everyone
            log.info("Broadcasting to /topic/notes (was or is public)");
            messagingTemplate.convertAndSend("/topic/notes", message);
        } else {
            // Private note - send to old collaborators (they need to know it's gone)
            // and new collaborators (they need to see it now)
            oldSharedWith.forEach(user -> targetEmails.add(user.getEmail()));
            note.getSharedWith().forEach(user -> targetEmails.add(user.getEmail()));

            // Send to all affected users
            targetEmails.forEach(email -> {
                log.info("Sending update to user: email={}", email);
                try {
                    messagingTemplate.convertAndSendToUser(
                            email,
                            "/queue/notes",
                            message
                    );
                } catch (Exception e) {
                    log.error("Failed to send message to user {}: {}", email, e.getMessage());
                }
            });
        }
    }

    public void broadcastNoteDeleted(Long noteId, Note note) {
        log.info("Broadcasting note deleted: id={}, privacy={}", noteId, note.getPrivacy());

        WebSocketMessage message = WebSocketMessage.builder()
                .type(WebSocketEventType.NOTE_DELETED)
                .noteId(noteId)
                .build();

        if (note.getPrivacy() == NotePrivacy.PUBLIC) {
            log.info("Broadcasting to /topic/notes");
            messagingTemplate.convertAndSend("/topic/notes", message);
        } else {
            sendToAuthorAndCollaborators(message, note);
        }
    }

    public void broadcastEditingStatus(NoteEditingStatusDto status, Note note) {
        log.info("Broadcasting editing status: noteId={}, userId={}, isEditing={}",
                status.getNoteId(), status.getUserId(), status.getIsEditing());

        WebSocketMessage message = WebSocketMessage.builder()
                .type(status.getIsEditing() ? WebSocketEventType.USER_EDITING : WebSocketEventType.USER_STOPPED_EDITING)
                .noteId(status.getNoteId())
                .userId(status.getUserId())
                .username(status.getUsername())
                .build();

        if (note.getPrivacy() == NotePrivacy.PUBLIC) {
            log.info("Broadcasting to /topic/notes/editing");
            messagingTemplate.convertAndSend("/topic/notes/editing", message);
        } else {
            sendToAuthorAndCollaborators(message, note, "/queue/notes/editing");
        }
    }

    private void sendToAuthorAndCollaborators(WebSocketMessage message, Note note) {
        sendToAuthorAndCollaborators(message, note, "/queue/notes");
    }

    private void sendToAuthorAndCollaborators(WebSocketMessage message, Note note, String destination) {
        // Log all connected users
        log.info("Connected WebSocket users: {}",
                userRegistry.getUsers().stream()
                        .map(SimpUser::getName)
                        .toList()
        );

        // Send to author
        String authorEmail = note.getAuthor().getEmail();
        log.info("Attempting to send to author: email={}, userId={}", authorEmail, note.getAuthor().getId());

        try {
            messagingTemplate.convertAndSendToUser(
                    authorEmail,
                    destination,
                    message
            );
            log.info("Successfully sent message to author");
        } catch (Exception e) {
            log.error("Failed to send message to author: {}", e.getMessage(), e);
        }

        // Send to collaborators
        note.getSharedWith().forEach(user -> {
            log.info("Attempting to send to collaborator: email={}, userId={}", user.getEmail(), user.getId());
            try {
                messagingTemplate.convertAndSendToUser(
                        user.getEmail(),
                        destination,
                        message
                );
                log.info("Successfully sent message to collaborator");
            } catch (Exception e) {
                log.error("Failed to send message to collaborator: {}", e.getMessage(), e);
            }
        });
    }
}
