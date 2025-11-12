package com.example.notesApp.repository;

import com.example.notesApp.entity.Note;
import com.example.notesApp.entity.User;
import com.example.notesApp.enums.Privacy;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface NoteRepository extends JpaRepository<Note, Long> {
    List<Note> findAllByPrivacy(Privacy privacy);

    @Query("select n from Note n where n.author = :user")
    List<Note> findAllByAuthor(@Param("user") User user);

    @Query("select n from Note n join n.sharedWith u where u = :user")
    List<Note> findAllSharedWith(@Param("user") User user);
}