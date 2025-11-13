package com.example.notesApp.service;

import com.example.notesApp.dto.CreateNoteRequest;
import com.example.notesApp.dto.NoteDto;
import com.example.notesApp.dto.UpdateNoteRequest;
import com.example.notesApp.entity.Note;
import com.example.notesApp.entity.User;
import com.example.notesApp.enums.NotePrivacy;
import com.example.notesApp.repository.NoteRepository;
import com.example.notesApp.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.Authentication;
import org.springframework.stereotype.Service;

import java.util.HashSet;
import java.util.List;
import java.util.Set;

@Service
@RequiredArgsConstructor
public class NoteService {

    private final NoteRepository noteRepository;
    private final UserRepository userRepository;

    // helper: current logged-in user from Authentication
    private User getCurrentUser(Authentication authentication) {
        String email = authentication.getName();
        return userRepository.findByEmail(email)
                .orElseThrow(() -> new RuntimeException("Current user not found"));
    }

    public NoteDto createNote(CreateNoteRequest request, Authentication auth) {
        User author = getCurrentUser(auth);
        Note note = new Note();
        note.setTitle(request.getTitle());
        note.setText(request.getText());
        note.setPrivacy(request.getPrivacy());
        note.setAuthor(author);

        if (request.getPrivacy() == NotePrivacy.PRIVATE && request.getSharedWithUserIds() != null) {
            Set<User> shared = new HashSet<>(
                    userRepository.findAllById(request.getSharedWithUserIds())
            );
            note.setSharedWith(shared);
        }

        Note saved = noteRepository.save(note);
        return toDto(saved);
    }

    public NoteDto getNote(Long id, Authentication auth) {
        User current = getCurrentUser(auth);

        Note note = noteRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Note not found"));

        if (!canUserAccess(note, current)) {
            throw new RuntimeException("Access denied to this note");
        }

        return toDto(note);
    }

    public List<NoteDto> getAllVisibleNotes(Authentication auth) {
        User current = getCurrentUser(auth);
        return noteRepository.findAllVisibleForUser(current)
                .stream()
                .map(this::toDto)
                .toList();
    }

    public List<NoteDto> getMyNotes(Authentication auth) {
        User current = getCurrentUser(auth);
        return noteRepository.findByAuthor(current)
                .stream()
                .map(this::toDto)
                .toList();
    }

    public NoteDto updateNote(Long id, UpdateNoteRequest request, Authentication auth) {
        User current = getCurrentUser(auth);

        Note note = noteRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Note not found"));

        // only author can update
        if (!note.getAuthor().getId().equals(current.getId())) {
            throw new RuntimeException("Only author can update the note");
        }

        note.setTitle(request.getTitle());
        note.setText(request.getText());
        note.setPrivacy(request.getPrivacy());

        if (request.getPrivacy() == NotePrivacy.PRIVATE && request.getSharedWithUserIds() != null) {
            Set<User> shared = new HashSet<>(
                    userRepository.findAllById(request.getSharedWithUserIds())
            );
            note.setSharedWith(shared);
        } else {
            note.getSharedWith().clear();
        }

        Note saved = noteRepository.save(note);
        return toDto(saved);
    }

    public void deleteNote(Long id, Authentication auth) {
        User current = getCurrentUser(auth);

        Note note = noteRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Note not found"));

        // only author can delete
        if (!note.getAuthor().getId().equals(current.getId())) {
            throw new RuntimeException("Only author can delete the note");
        }

        noteRepository.delete(note);
    }

    private boolean canUserAccess(Note note, User user) {
        if (note.getPrivacy() == NotePrivacy.PUBLIC) return true;
        if (note.getAuthor().getId().equals(user.getId())) return true;
        return note.getSharedWith().stream().anyMatch(u -> u.getId().equals(user.getId()));
    }

    private NoteDto toDto(Note note) {
        NoteDto dto = new NoteDto();
        dto.setId(note.getId());
        dto.setTitle(note.getTitle());
        dto.setText(note.getText());
        dto.setPrivacy(note.getPrivacy());
        dto.setAuthorId(note.getAuthor() != null ? note.getAuthor().getId() : null);
        dto.setSharedWithUserIds(
                note.getSharedWith().stream()
                        .map(User::getId)
                        .collect(java.util.stream.Collectors.toSet())
        );
        return dto;
    }
}