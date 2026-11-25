package com.pmboard.service;

import com.pmboard.config.ApiException;
import com.pmboard.config.CurrentUser;
import com.pmboard.domain.Memo;
import com.pmboard.repo.MemoRepository;
import com.pmboard.web.dto.Dtos.MemoDto;
import com.pmboard.web.dto.Dtos.MemoRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

/** 메모장: 본인 메모만 보고 고칠 수 있다. */
@Service
@Transactional
public class MemoService {
    private final MemoRepository memos;

    public MemoService(MemoRepository memos) {
        this.memos = memos;
    }

    @Transactional(readOnly = true)
    public List<MemoDto> mine() {
        return memos.findByOwnerIdOrderByPinnedDescUpdatedAtDesc(CurrentUser.id()).stream().map(Mappers::memo).toList();
    }

    public MemoDto create(MemoRequest req) {
        if (req.body() == null || req.body().isBlank()) throw ApiException.badRequest("메모 내용을 입력해 주세요.");
        Memo m = new Memo();
        m.setOwnerId(CurrentUser.id());
        m.setBody(req.body());
        m.setTag(req.tag());
        m.setPinned(Boolean.TRUE.equals(req.pinned()));
        return Mappers.memo(memos.save(m));
    }

    public MemoDto update(Long id, MemoRequest req) {
        Memo m = own(id);
        if (req.body() != null) m.setBody(req.body());
        if (req.tag() != null) m.setTag(req.tag());
        if (req.pinned() != null) m.setPinned(req.pinned());
        return Mappers.memo(m);
    }

    public void delete(Long id) {
        memos.delete(own(id));
    }

    private Memo own(Long id) {
        Memo m = memos.findById(id).orElseThrow(() -> ApiException.notFound("메모"));
        if (!m.getOwnerId().equals(CurrentUser.id())) throw new ApiException(403, "본인 메모만 고칠 수 있습니다.");
        return m;
    }
}
