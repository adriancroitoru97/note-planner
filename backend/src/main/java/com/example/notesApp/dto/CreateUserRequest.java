package com.example.notesApp.dto;

import com.example.notesApp.enums.Role;
import lombok.Data;

@Data
public class CreateUserRequest {
    private String firstname;
    private String lastname;
    private String email;
    private String password;
    private Role role; // ADMIN can choose role
}