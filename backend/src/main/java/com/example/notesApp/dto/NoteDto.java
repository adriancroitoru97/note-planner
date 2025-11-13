package com.example.notesApp.dto;

import com.example.notesApp.enums.NotePrivacy;
import lombok.Data;

import java.util.Set;

@Data
public class NoteDto {
    private Long id;
    private String title;
    private String text;
    private NotePrivacy privacy;
    private Long authorId;
    private Set<Long> sharedWithUserIds;
}