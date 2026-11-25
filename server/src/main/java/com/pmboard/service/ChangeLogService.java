package com.pmboard.service;

import com.pmboard.config.CurrentUser;
import com.pmboard.domain.ChangeKind;
import com.pmboard.domain.ChangeLog;
import com.pmboard.repo.ChangeLogRepository;
import com.pmboard.repo.UserRepository;
import org.springframework.stereotype.Service;

import java.util.Objects;

/**
 * 변경 이력 자동 기록.
 * 서비스의 수정 메서드에서 바꾸기 전 값과 바꾼 뒤 값을 넘기면, 값이 다를 때만 한 줄을 남긴다.
 */
@Service
public class ChangeLogService {
    private final ChangeLogRepository repo;
    private final UserRepository users;

    public ChangeLogService(ChangeLogRepository repo, UserRepository users) {
        this.repo = repo;
        this.users = users;
    }

    /** 이력을 남길 대상 하나를 묶어 둔다: 같은 엔티티의 여러 필드를 연달아 비교할 때 쓴다. */
    public Recorder on(Long projectId, String entityType, Long entityId, String label) {
        return new Recorder(projectId, entityType, entityId, label);
    }

    public final class Recorder {
        private final Long projectId;
        private final String entityType;
        private final Long entityId;
        private final String label;

        private Recorder(Long projectId, String entityType, Long entityId, String label) {
            this.projectId = projectId;
            this.entityType = entityType;
            this.entityId = entityId;
            this.label = label;
        }

        public Recorder diff(String field, ChangeKind kind, Object before, Object after) {
            String b = before == null ? null : String.valueOf(before);
            String a = after == null ? null : String.valueOf(after);
            if (!Objects.equals(b, a)) {
                save(field, kind, b, a);
            }
            return this;
        }

        public void created() {
            save("created", ChangeKind.CREATE, null, label);
        }

        private void save(String field, ChangeKind kind, String b, String a) {
            ChangeLog log = new ChangeLog();
            log.setProjectId(projectId);
            log.setEntityType(entityType);
            log.setEntityId(entityId);
            log.setEntityLabel(label);
            log.setField(field);
            log.setKind(kind);
            log.setOldValue(b);
            log.setNewValue(a);
            log.setChangedBy(users.getReferenceById(CurrentUser.id()));
            repo.save(log);
        }
    }
}
