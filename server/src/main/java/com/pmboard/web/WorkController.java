package com.pmboard.web;

import com.pmboard.config.CurrentUser;
import com.pmboard.service.CalendarService;
import com.pmboard.service.MemoService;
import com.pmboard.service.OpsService;
import com.pmboard.service.SearchService;
import com.pmboard.web.dto.Dtos.*;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.util.List;
import java.util.Map;

/** 운영업무 · 정기 작업 · 메모장 · 캘린더 · 통합 검색 */
@RestController
@RequestMapping("/api")
public class WorkController {
    private final OpsService ops;
    private final MemoService memos;
    private final CalendarService calendar;
    private final SearchService search;

    public WorkController(OpsService ops, MemoService memos, CalendarService calendar, SearchService search) {
        this.ops = ops;
        this.memos = memos;
        this.calendar = calendar;
        this.search = search;
    }

    // 운영업무
    @GetMapping("/ops")
    public List<OpsDto> ops(@RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
                            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to) {
        LocalDate t = to != null ? to : LocalDate.now();
        return ops.list(from != null ? from : t.minusDays(30), t);
    }

    @GetMapping("/ops/{id}")
    public OpsDto getOps(@PathVariable Long id) {
        return ops.get(id);
    }

    @PostMapping("/ops")
    public OpsDto createOps(@RequestBody OpsRequest req) {
        return ops.create(req);
    }

    @PutMapping("/ops/{id}")
    public OpsDto updateOps(@PathVariable Long id, @RequestBody OpsRequest req) {
        return ops.update(id, req);
    }

    @DeleteMapping("/ops/{id}")
    public void deleteOps(@PathVariable Long id) {
        ops.delete(id);
    }

    @PostMapping("/ops/{id}/convert")
    public Map<String, Long> convert(@PathVariable Long id) {
        return Map.of("projectId", ops.convertToProject(id));
    }

    // 정기 작업
    @GetMapping("/routines")
    public List<RoutineDto> routines() {
        return ops.routines(LocalDate.now());
    }

    @PostMapping("/routines")
    public RoutineDto addRoutine(@RequestBody RoutineRequest req) {
        return ops.saveRoutine(null, req);
    }

    @PutMapping("/routines/{id}")
    public RoutineDto updateRoutine(@PathVariable Long id, @RequestBody RoutineRequest req) {
        return ops.saveRoutine(id, req);
    }

    @PostMapping("/routines/{id}/toggle")
    public RoutineDto toggleRoutine(@PathVariable Long id) {
        return ops.toggleRoutine(id, LocalDate.now());
    }

    // 메모장
    @GetMapping("/memos")
    public List<MemoDto> memos() {
        return memos.mine();
    }

    @PostMapping("/memos")
    public MemoDto addMemo(@RequestBody MemoRequest req) {
        return memos.create(req);
    }

    @PutMapping("/memos/{id}")
    public MemoDto updateMemo(@PathVariable Long id, @RequestBody MemoRequest req) {
        return memos.update(id, req);
    }

    @DeleteMapping("/memos/{id}")
    public void deleteMemo(@PathVariable Long id) {
        memos.delete(id);
    }

    // 캘린더 · 검색
    @GetMapping("/calendar")
    public List<CalendarEvent> calendar(@RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
                                        @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to,
                                        @RequestParam(defaultValue = "false") boolean mine) {
        return calendar.between(from, to, mine ? CurrentUser.id() : null);
    }

    @GetMapping("/search")
    public List<SearchResult> search(@RequestParam String q) {
        return search.search(q, CurrentUser.id(), 100);
    }
}
