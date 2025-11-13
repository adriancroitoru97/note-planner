package com.example.notesApp.controller;

import com.example.notesApp.dto.CreateNoteRequest;
import com.example.notesApp.dto.NoteDto;
import com.example.notesApp.dto.UpdateNoteRequest;
import com.example.notesApp.service.NoteService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/v1/notes")
@RequiredArgsConstructor
public class NoteController {

    private final NoteService noteService;

    // CREATE
    @PreAuthorize("hasAnyRole('ADMIN', 'USER')")
    @PostMapping("/createNote")
    public ResponseEntity<NoteDto> createNote(@RequestBody CreateNoteRequest request,
                                              Authentication authentication) {
        return ResponseEntity.ok(noteService.createNote(request, authentication));
    }

    // READ single
    @PreAuthorize("hasAnyRole('ADMIN', 'USER')")
    @GetMapping("/getNote/{id}")
    public ResponseEntity<NoteDto> getNote(@PathVariable Long id,
                                           Authentication authentication) {
        return ResponseEntity.ok(noteService.getNote(id, authentication));
    }

    // READ all visible to current user (public + shared + own)
    @PreAuthorize("hasAnyRole('ADMIN', 'USER')")
    @GetMapping("/getAllVisibleNotes")
    public ResponseEntity<List<NoteDto>> getAllVisibleNotes(Authentication authentication) {
        return ResponseEntity.ok(noteService.getAllVisibleNotes(authentication));
    }

    // READ only my notes
    @PreAuthorize("hasAnyRole('ADMIN', 'USER')")
    @GetMapping("/getMyNotes")
    public ResponseEntity<List<NoteDto>> getMyNotes(Authentication authentication) {
        return ResponseEntity.ok(noteService.getMyNotes(authentication));
    }

    // UPDATE
    @PreAuthorize("hasAnyRole('ADMIN', 'USER')")
    @PutMapping("/updateNote/{id}")
    public ResponseEntity<NoteDto> updateNote(@PathVariable Long id,
                                              @RequestBody UpdateNoteRequest request,
                                              Authentication authentication) {
        return ResponseEntity.ok(noteService.updateNote(id, request, authentication));
    }

    // DELETE
    @PreAuthorize("hasAnyRole('ADMIN', 'USER')")
    @DeleteMapping("/deleteNote/{id}")
    public ResponseEntity<Void> deleteNote(@PathVariable Long id,
                                           Authentication authentication) {
        noteService.deleteNote(id, authentication);
        return ResponseEntity.noContent().build();
    }
}