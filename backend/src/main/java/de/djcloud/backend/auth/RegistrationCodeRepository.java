package de.djcloud.backend.auth;

import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface RegistrationCodeRepository extends JpaRepository<RegistrationCode, Long> {

    Optional<RegistrationCode> findByCode(String code);
}
