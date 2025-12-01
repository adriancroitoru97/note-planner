package com.example.notesApp.dto;

import com.example.notesApp.enums.WebSocketEventType;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class WebSocketMessage {
    private WebSocketEventType type;
    private NoteDto note;
    private Long noteId;
    private Long userId;
    private String username;
}
