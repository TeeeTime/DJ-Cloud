package de.djcloud.backend.track;

import java.awt.Color;
import java.awt.Graphics2D;
import java.awt.RenderingHints;
import java.awt.image.BufferedImage;
import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.util.Iterator;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.Semaphore;

import javax.imageio.IIOImage;
import javax.imageio.ImageIO;
import javax.imageio.ImageWriteParam;
import javax.imageio.ImageWriter;
import javax.imageio.stream.ImageOutputStream;

import org.springframework.stereotype.Component;

import lombok.extern.slf4j.Slf4j;

/**
 * Downscaled cover art for {@code GET /api/tracks/{id}/cover?size=}. Embedded artwork is often
 * 1000–3000px, while the UI shows it at 32–56px. Sending the original makes every browser download and
 * decode tens of megabytes per visible row.
 *
 * <p>Results are kept in a small in-memory LRU cache keyed by track, cover version and size. A changed
 * cover gets a new version (see {@link Track#getCoverVersion}), so a stale entry can never be served for
 * the new cover; it just ages out. Resizing itself decodes the full-size original, so at most
 * {@link #MAX_CONCURRENT_RESIZES} run at once to keep a burst of thumbnail requests (a freshly opened
 * library page) from spiking server memory.
 */
@Slf4j
@Component
class CoverThumbnails {

    /** Only these sizes are served — keeps the cache (server and browser) from fragmenting. */
    static final Set<Integer> ALLOWED_SIZES = Set.of(64, 128, 512);

    private static final int MAX_CACHE_ENTRIES = 2000;
    private static final int MAX_CONCURRENT_RESIZES = 2;
    private static final float JPEG_QUALITY = 0.85f;

    private final Semaphore resizePermits = new Semaphore(MAX_CONCURRENT_RESIZES);

    private final Map<String, CoverArt> cache = new LinkedHashMap<>(256, 0.75f, true) {
        @Override
        protected boolean removeEldestEntry(Map.Entry<String, CoverArt> eldest) {
            return size() > MAX_CACHE_ENTRIES;
        }
    };

    CoverThumbnails() {
        // Everything here works on in-memory streams; no reason for ImageIO to spill to temp files.
        ImageIO.setUseCache(false);
    }

    CoverArt cached(long trackId, long coverVersion, int size) {
        synchronized (cache) {
            return cache.get(key(trackId, coverVersion, size));
        }
    }

    /**
     * Returns the cover scaled to fit within {@code size}×{@code size} (aspect ratio kept). Falls back
     * to the original bytes if it's already small enough or if the format can't be decoded by ImageIO
     * (e.g. WebP or CMYK JPEG): a too-large image is still better than no image.
     */
    CoverArt resize(long trackId, long coverVersion, int size, CoverArt original) {
        CoverArt result;
        try {
            resizePermits.acquire();
        } catch (InterruptedException ex) {
            Thread.currentThread().interrupt();
            return original;
        }
        try {
            result = scale(original, size);
        } finally {
            resizePermits.release();
        }

        synchronized (cache) {
            cache.put(key(trackId, coverVersion, size), result);
        }
        return result;
    }

    private static String key(long trackId, long coverVersion, int size) {
        return trackId + ":" + coverVersion + ":" + size;
    }

    private static CoverArt scale(CoverArt original, int size) {
        try {
            BufferedImage source = ImageIO.read(new ByteArrayInputStream(original.data()));
            if (source == null) {
                return original;
            }

            int width = source.getWidth();
            int height = source.getHeight();
            if (Math.max(width, height) <= size) {
                return original;
            }

            double ratio = (double) size / Math.max(width, height);
            int targetWidth = Math.max(1, (int) Math.round(width * ratio));
            int targetHeight = Math.max(1, (int) Math.round(height * ratio));

            // Halve repeatedly first, then do the final step: a single big bilinear downscale
            // skips most source pixels and looks noticeably aliased.
            BufferedImage current = source;
            int currentWidth = width;
            int currentHeight = height;
            while (currentWidth / 2 >= targetWidth && currentHeight / 2 >= targetHeight) {
                currentWidth /= 2;
                currentHeight /= 2;
                current = drawScaled(current, currentWidth, currentHeight);
            }
            if (currentWidth != targetWidth || currentHeight != targetHeight || current == source) {
                current = drawScaled(current, targetWidth, targetHeight);
            }

            return new CoverArt(encodeJpeg(current), "image/jpeg");
        } catch (IOException | RuntimeException ex) {
            log.debug("Could not downscale cover art, serving the original instead", ex);
            return original;
        }
    }

    /** Always produces opaque RGB, so transparent PNG covers come out on black, matching the dark UI. */
    private static BufferedImage drawScaled(BufferedImage source, int width, int height) {
        BufferedImage target = new BufferedImage(width, height, BufferedImage.TYPE_INT_RGB);
        Graphics2D g = target.createGraphics();
        try {
            g.setRenderingHint(RenderingHints.KEY_INTERPOLATION, RenderingHints.VALUE_INTERPOLATION_BILINEAR);
            g.setRenderingHint(RenderingHints.KEY_RENDERING, RenderingHints.VALUE_RENDER_QUALITY);
            g.setColor(Color.BLACK);
            g.fillRect(0, 0, width, height);
            g.drawImage(source, 0, 0, width, height, null);
        } finally {
            g.dispose();
        }
        return target;
    }

    private static byte[] encodeJpeg(BufferedImage image) throws IOException {
        Iterator<ImageWriter> writers = ImageIO.getImageWritersByFormatName("jpeg");
        if (!writers.hasNext()) {
            throw new IOException("No JPEG writer available");
        }
        ImageWriter writer = writers.next();
        ByteArrayOutputStream out = new ByteArrayOutputStream();
        try (ImageOutputStream stream = ImageIO.createImageOutputStream(out)) {
            writer.setOutput(stream);
            ImageWriteParam param = writer.getDefaultWriteParam();
            param.setCompressionMode(ImageWriteParam.MODE_EXPLICIT);
            param.setCompressionQuality(JPEG_QUALITY);
            writer.write(null, new IIOImage(image, null, null), param);
        } finally {
            writer.dispose();
        }
        return out.toByteArray();
    }
}
