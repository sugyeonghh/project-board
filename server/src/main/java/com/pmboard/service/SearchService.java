package com.pmboard.service;

import com.pmboard.web.dto.Dtos.SearchResult;
import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Service;

import java.util.List;

/**
 * 통합 검색. LIKE 부분 일치라 한글 단어 일부로도 찾을 수 있다 (utf8mb4_0900_ai_ci: 대소문자 구분 없음).
 * 팀 규모 데이터에서는 충분히 빠르다. 데이터가 많아지면 MySQL FULLTEXT(ngram parser)로 바꾸면 된다.
 * 메모는 본인 것만 검색된다.
 */
@Service
public class SearchService {
    private static final String SQL = """
            SELECT * FROM (
              SELECT 'PROJECT' AS type, p.id, p.name AS title, coalesce(p.description, '') AS context, p.id AS project_id, p.updated_at AS ts
                FROM project p WHERE p.name LIKE :q OR p.description LIKE :q OR p.goal LIKE :q
              UNION ALL
              SELECT 'TASK', t.id, t.title, concat(p.name, coalesce(concat(' · ', t.summary), '')), t.project_id, t.updated_at
                FROM task t JOIN project p ON p.id = t.project_id
               WHERE t.title LIKE :q OR t.summary LIKE :q OR t.description LIKE :q OR t.blocked_reason LIKE :q
              UNION ALL
              SELECT 'NOTE', n.id, n.title, concat(p.name, ' · 지식노트'), n.project_id, n.updated_at
                FROM note n JOIN project p ON p.id = n.project_id
               WHERE n.title LIKE :q OR n.body LIKE :q OR n.tags LIKE :q
              UNION ALL
              SELECT 'ATTACHMENT', a.id, a.original_name, p.name, a.project_id, a.created_at
                FROM attachment a JOIN project p ON p.id = a.project_id WHERE a.original_name LIKE :q
              UNION ALL
              SELECT 'COMMENT', c.task_id, left(c.body, 200), concat('할일 "', t.title, '"'), t.project_id, c.created_at
                FROM task_comment c JOIN task t ON t.id = c.task_id WHERE c.body LIKE :q
              UNION ALL
              SELECT 'MEMO', m.id, left(m.body, 200), '메모장', NULL, m.updated_at
                FROM memo m WHERE m.owner_id = :me AND m.body LIKE :q
              UNION ALL
              SELECT 'OPS', o.id, o.title, concat('운영업무 · ', o.category), NULL, o.created_at
                FROM ops_task o WHERE o.title LIKE :q OR o.description LIKE :q OR o.requester LIKE :q
              UNION ALL
              SELECT 'CHANGE', c.id,
                     concat(coalesce(c.entity_label, ''), ' ', c.field, ': ', coalesce(c.old_value, ''), ' → ', coalesce(c.new_value, '')),
                     '변경 이력', c.project_id, c.changed_at
                FROM change_log c WHERE c.entity_label LIKE :q OR c.new_value LIKE :q OR c.old_value LIKE :q
            ) r
            ORDER BY r.ts DESC
            LIMIT :limit
            """;

    private final NamedParameterJdbcTemplate jdbc;

    public SearchService(NamedParameterJdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    public List<SearchResult> search(String query, Long me, int limit) {
        String q = query == null ? "" : query.trim();
        if (q.length() < 2) return List.of();
        String like = "%" + q.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_") + "%";
        var params = new MapSqlParameterSource().addValue("q", like).addValue("me", me).addValue("limit", limit);
        return jdbc.query(SQL, params, (rs, i) -> new SearchResult(rs.getString("type"), rs.getLong("id"),
                rs.getString("title"), rs.getString("context"), (Long) rs.getObject("project_id")));
    }
}
