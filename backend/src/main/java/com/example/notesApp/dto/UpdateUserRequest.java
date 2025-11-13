package com.example.notesApp.dto;

import com.example.notesApp.enums.Role;
import lombok.Data;

@Data
public class UpdateUserRequest {
    private String firstname;
    private String lastname;
    private String email;
    private Role role;
}