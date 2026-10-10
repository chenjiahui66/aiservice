package com.neighborhood.service.common;

import com.baomidou.mybatisplus.core.metadata.IPage;
import lombok.Data;

import java.io.Serializable;
import java.util.Collections;
import java.util.List;
import java.util.function.Function;

/** 分页结果。 */
@Data
public class PageResult<T> implements Serializable {

    private List<T> records;
    private long total;
    private long page;
    private long size;
    private long pages;

    public static <T> PageResult<T> empty(long page, long size) {
        PageResult<T> r = new PageResult<>();
        r.setRecords(Collections.emptyList());
        r.setTotal(0);
        r.setPage(page);
        r.setSize(size);
        r.setPages(0);
        return r;
    }

    public static <T> PageResult<T> of(IPage<T> iPage) {
        PageResult<T> r = new PageResult<>();
        r.setRecords(iPage.getRecords());
        r.setTotal(iPage.getTotal());
        r.setPage(iPage.getCurrent());
        r.setSize(iPage.getSize());
        r.setPages(iPage.getPages());
        return r;
    }

    /** 把 MyBatis-Plus 原始分页对象映射成 DTO 分页结果。 */
    public static <E, T> PageResult<T> of(IPage<E> iPage, Function<E, T> mapper) {
        PageResult<T> r = new PageResult<>();
        r.setRecords(iPage.getRecords().stream().map(mapper).toList());
        r.setTotal(iPage.getTotal());
        r.setPage(iPage.getCurrent());
        r.setSize(iPage.getSize());
        r.setPages(iPage.getPages());
        return r;
    }
}