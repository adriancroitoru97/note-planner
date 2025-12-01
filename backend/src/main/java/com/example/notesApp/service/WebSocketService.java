package com.example.notesApp.service;

import com.example.notesApp.dto.NoteDto;
import com.example.notesApp.dto.NoteEditingStatusDto;
import com.example.notesApp.dto.WebSocketMessage;
import com.example.notesApp.entity.Note;
import com.example.notesApp.enums.NotePrivacy;
import com.example.notesApp.enums.WebSocketEventType;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Service;

@Slf4j
@Service
@RequiredArgsConstructor
public class WebSocketService {

    private final SimpMessagingTemplate messagingTemplate;

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
            // Send to author using email as principal
            String authorEmail = note.getAuthor().getEmail();
            log.info("Sending to author: email={}, userId={}", authorEmail, note.getAuthor().getId());
            messagingTemplate.convertAndSendToUser(
                    authorEmail,
                    "/queue/notes",
                    message
            );

            // Send to collaborators using email as principal
            note.getSharedWith().forEach(user -> {
                log.info("Sending to collaborator: email={}, userId={}", user.getEmail(), user.getId());
                messagingTemplate.convertAndSendToUser(
                        user.getEmail(),
                        "/queue/notes",
                        message
                );
            });
        }
    }

    public void broadcastNoteUpdated(NoteDto noteDto, Note note) {
        log.info("Broadcasting note updated: id={}, privacy={}", noteDto.getId(), note.getPrivacy());

        WebSocketMessage message = WebSocketMessage.builder()
                .type(WebSocketEventType.NOTE_UPDATED)
                .note(noteDto)
                .build();

        if (note.getPrivacy() == NotePrivacy.PUBLIC) {
            log.info("Broadcasting to /topic/notes");
            messagingTemplate.convertAndSend("/topic/notes", message);
        } else {
            // Send to author using email as principal
            String authorEmail = note.getAuthor().getEmail();
            log.info("Sending to author: email={}, userId={}", authorEmail, note.getAuthor().getId());
            messagingTemplate.convertAndSendToUser(
                    authorEmail,
                    "/queue/notes",
                    message
            );

            // Send to collaborators using email as principal
            note.getSharedWith().forEach(user -> {
                log.info("Sending to collaborator: email={}, userId={}", user.getEmail(), user.getId());
                messagingTemplate.convertAndSendToUser(
                        user.getEmail(),
                        "/queue/notes",
                        message
                );
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
            // Send to author using email as principal
            String authorEmail = note.getAuthor().getEmail();
            log.info("Sending to author: email={}, userId={}", authorEmail, note.getAuthor().getId());
            messagingTemplate.convertAndSendToUser(
                    authorEmail,
                    "/queue/notes",
                    message
            );

            // Send to collaborators using email as principal
            note.getSharedWith().forEach(user -> {
                log.info("Sending to collaborator: email={}, userId={}", user.getEmail(), user.getId());
                messagingTemplate.convertAndSendToUser(
                        user.getEmail(),
                        "/queue/notes",
                        message
                );
            });
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
            // Send to author using email as principal
            String authorEmail = note.getAuthor().getEmail();
            log.info("Sending to author: email={}, userId={}", authorEmail, note.getAuthor().getId());
            messagingTemplate.convertAndSendToUser(
                    authorEmail,
                    "/queue/notes/editing",
                    message
            );

            // Send to collaborators using email as principal
            note.getSharedWith().forEach(user -> {
                log.info("Sending to collaborator: email={}, userId={}", user.getEmail(), user.getId());
                messagingTemplate.convertAndSendToUser(
                        user.getEmail(),
                        "/queue/notes/editing",
                        message
                );
            });
        }
    }
}
