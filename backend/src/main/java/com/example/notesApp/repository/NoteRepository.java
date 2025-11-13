package com.example.notesApp.repository;

import com.example.notesApp.entity.Note;
import com.example.notesApp.entity.User;
import com.example.notesApp.enums.NotePrivacy;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface NoteRepository extends JpaRepository<Note, Long> {
    List<Note> findByAuthor(User author);

    List<Note> findByPrivacy(NotePrivacy privacy);

    @Query("""
           select n from Note n
           left join n.sharedWith u
           where n.privacy = com.example.notesApp.enums.NotePrivacy.PUBLIC
              or n.author = :user
              or u = :user
           """)
    List<Note> findAllVisibleForUser(User user);
}