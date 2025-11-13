package com.example.notesApp.dto;

import com.example.notesApp.enums.NotePrivacy;
import lombok.Data;

import java.util.Set;

@Data
public class CreateNoteRequest {
    private String title;
    private String text;
    private NotePrivacy privacy;
    // Only relevant if privacy = PRIVATE
    private Set<Long> sharedWithUserIds;
}