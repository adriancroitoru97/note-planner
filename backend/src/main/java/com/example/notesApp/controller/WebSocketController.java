package com.example.notesApp.controller;

import com.example.notesApp.dto.NoteEditingStatusDto;
import com.example.notesApp.entity.Note;
import com.example.notesApp.entity.User;
import com.example.notesApp.repository.NoteRepository;
import com.example.notesApp.service.UserService;
import com.example.notesApp.service.WebSocketService;
import jakarta.transaction.Transactional;
import lombok.RequiredArgsConstructor;
import org.springframework.messaging.handler.annotation.MessageMapping;
import org.springframework.messaging.handler.annotation.Payload;
import org.springframework.security.core.Authentication;
import org.springframework.stereotype.Controller;

@Controller
@RequiredArgsConstructor
public class WebSocketController {

    private final WebSocketService webSocketService;
    private final UserService userService;
    private final NoteRepository noteRepository;

    @MessageMapping("/notes/editing")
    @Transactional
    public void handleEditingStatus(@Payload NoteEditingStatusDto status, Authentication authentication) {
        User currentUser = userService.getCurrentUser(authentication);

        Note note = noteRepository.findById(status.getNoteId())
                .orElseThrow(() -> new RuntimeException("Note not found"));

        status.setUserId(currentUser.getId());
        status.setUsername(currentUser.getFirstname() + " " + currentUser.getLastname());

        webSocketService.broadcastEditingStatus(status, note);
    }
}
