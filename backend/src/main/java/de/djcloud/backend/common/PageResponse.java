package de.djcloud.backend.common;

import java.util.List;

import org.springframework.data.domain.Page;

/**
 * Stable replacement for returning a raw Spring Data {@link Page} from a controller — {@code Page}'s
 * own JSON serialization isn't considered part of its public contract (Spring Boot warns about this
 * at startup), so every paginated endpoint returns this instead.
 */
public record PageResponse<T>(List<T> content, int page, int size, long totalElements, int totalPages,
                               boolean hasNext) {

    public static <T> PageResponse<T> of(Page<T> page) {
        return new PageResponse<>(page.getContent(), page.getNumber(), page.getSize(), page.getTotalElements(),
                page.getTotalPages(), page.hasNext());
    }

    /** For result sets built by hand (e.g. a custom ordered-by-aggregate query) rather than a {@link Page}. */
    public static <T> PageResponse<T> of(List<T> content, int page, int size, long totalElements) {
        int totalPages = size == 0 ? 0 : (int) Math.ceil((double) totalElements / size);
        boolean hasNext = (long) (page + 1) * size < totalElements;
        return new PageResponse<>(content, page, size, totalElements, totalPages, hasNext);
    }
}
