package com.example.notesApp.controller;

import com.example.notesApp.dto.NoteEditingStatusDto;
import com.example.notesApp.entity.Note;
import com.example.notesApp.entity.User;
import com.example.notesApp.repository.NoteRepository;
import com.example.notesApp.repository.UserRepository;
import com.example.notesApp.service.WebSocketService;
import lombok.RequiredArgsConstructor;
import org.springframework.messaging.handler.annotation.MessageMapping;
import org.springframework.messaging.handler.annotation.Payload;
import org.springframework.stereotype.Controller;
import org.springframework.transaction.annotation.Transactional;

import java.security.Principal;

@Controller
@RequiredArgsConstructor
public class WebSocketController {

    private final WebSocketService webSocketService;
    private final UserRepository userRepository;
    private final NoteRepository noteRepository;

    @MessageMapping("/notes/editing")
    @Transactional(readOnly = true)
    public void handleEditingStatus(@Payload NoteEditingStatusDto status, Principal principal) {
        if (principal == null) {
            throw new RuntimeException("User not authenticated");
        }

        // Principal.getName() returns the email
        String userEmail = principal.getName();
        System.out.println("Handling editing status from user: " + userEmail);

        User currentUser = userRepository.findByEmail(userEmail)
                .orElseThrow(() -> new RuntimeException("User not found"));

        Note note = noteRepository.findById(status.getNoteId())
                .orElseThrow(() -> new RuntimeException("Note not found"));

        status.setUserId(currentUser.getId());
        status.setUsername(currentUser.getFirstname() + " " + currentUser.getLastname());

        webSocketService.broadcastEditingStatus(status, note);
    }
}
