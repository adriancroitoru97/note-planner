package com.example.notesApp.dto;

import com.example.notesApp.enums.NotePrivacy;
import lombok.Data;

import java.util.Set;

@Data
public class UpdateNoteRequest {
    private String title;
    private String text;
    private NotePrivacy privacy;
    private Set<Long> sharedWithUserIds;
}
