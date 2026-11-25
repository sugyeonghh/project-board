package com.pmboard.repo;

import com.pmboard.domain.Report;
import com.pmboard.domain.ReportType;
import org.springframework.data.jpa.repository.JpaRepository;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

public interface ReportRepository extends JpaRepository<Report, Long> {
    Optional<Report> findByOwnerIdAndTypeAndPeriodStart(Long ownerId, ReportType type, LocalDate periodStart);
    List<Report> findByOwnerIdAndPeriodStartBetweenOrderByPeriodStartDesc(Long ownerId, LocalDate from, LocalDate to);
}
