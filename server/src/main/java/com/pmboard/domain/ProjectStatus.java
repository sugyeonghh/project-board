package com.pmboard.domain;

public enum ProjectStatus {
    PLANNED, IN_PROGRESS, AT_RISK, BLOCKED, DONE, CANCELLED;

    public boolean isClosed() {
        return this == DONE || this == CANCELLED;
    }
}
