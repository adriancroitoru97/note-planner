package com.example.notesApp.repository;

import com.example.notesApp.entity.User;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.repository.PagingAndSortingRepository;

import java.util.Optional;

public interface UserRepositoryPage extends PagingAndSortingRepository<User, Long> {

    @Override
    Page<User> findAll(Pageable pageable);

    Optional<Page<User>> findAllByLastname(String lastname, Pageable pageable);
}
