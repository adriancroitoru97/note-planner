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
import org.springframework.transaction.annotation.Transactional;

import java.util.HashSet;
import java.util.List;
import java.util.Set;

@Service
@RequiredArgsConstructor
public class NoteService {

    private final NoteRepository noteRepository;
    private final UserRepository userRepository;
    private final UserService userService;
    private final WebSocketService webSocketService;

    @Transactional
    public NoteDto createNote(CreateNoteRequest request, Authentication auth) {
        User author = userService.getCurrentUser(auth);
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

        // Force initialization before leaving transaction
        saved.getSharedWith().size();
        saved.getAuthor().getId();

        NoteDto dto = toDto(saved);

        // Broadcast the creation
        webSocketService.broadcastNoteCreated(dto, saved);

        return dto;
    }

    @Transactional(readOnly = true)
    public NoteDto getNote(Long id, Authentication auth) {
        User current = userService.getCurrentUser(auth);

        Note note = noteRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Note not found"));

        if (!canUserAccess(note, current)) {
            throw new RuntimeException("Access denied to this note");
        }

        return toDto(note);
    }

    @Transactional(readOnly = true)
    public List<NoteDto> getAllVisibleNotes(Authentication auth) {
        User current = userService.getCurrentUser(auth);
        return noteRepository.findAllVisibleForUser(current)
                .stream()
                .map(this::toDto)
                .toList();
    }

    @Transactional(readOnly = true)
    public List<NoteDto> getMyNotes(Authentication auth) {
        User current = userService.getCurrentUser(auth);
        return noteRepository.findByAuthor(current)
                .stream()
                .map(this::toDto)
                .toList();
    }

    @Transactional
    public NoteDto updateNote(Long id, UpdateNoteRequest request, Authentication auth) {
        User current = userService.getCurrentUser(auth);

        Note note = noteRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Note not found"));

        // Force initialization
        note.getSharedWith().size();

        // Store old state for WebSocket notification
        NotePrivacy oldPrivacy = note.getPrivacy();
        Set<User> oldSharedWith = new HashSet<>(note.getSharedWith());

        // only author/collaborators can update
        if (!note.getAuthor().getId().equals(current.getId()) &&
                note.getSharedWith().stream().noneMatch(user -> user.getId().equals(current.getId())) &&
                note.getPrivacy() != NotePrivacy.PUBLIC
        ) {
            throw new RuntimeException("Only author/collaborators can update the note");
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

        // Force initialization before leaving transaction
        saved.getSharedWith().size();
        saved.getAuthor().getId();

        NoteDto dto = toDto(saved);

        // Broadcast the update with both old and new state
        webSocketService.broadcastNoteUpdated(dto, saved, oldPrivacy, oldSharedWith);

        return dto;
    }

    @Transactional
    public void deleteNote(Long id, Authentication auth) {
        User current = userService.getCurrentUser(auth);

        Note note = noteRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Note not found"));

        // Force initialization
        note.getSharedWith().size();
        note.getAuthor().getId();

        // only author can delete
        if (!note.getAuthor().getId().equals(current.getId())) {
            throw new RuntimeException("Only author can delete the note");
        }

        // Broadcast before deletion
        webSocketService.broadcastNoteDeleted(id, note);

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
