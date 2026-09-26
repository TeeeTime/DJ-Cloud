package de.djcloud.backend.track;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.Map;

import org.junit.jupiter.api.Test;

/**
 * Unit-tests the pure ffprobe-field-to-PCM-codec mapping directly, without running any process —
 * mirrors how {@link BpmAnalyzer#parseBpm} isolates its own pure parsing logic for testability.
 */
class AudioStreamProbeTest {

    @Test
    void mapsSixteenBitIntegerToPcmS16le() {
        assertThat(AudioStreamProbe.mapToPcmCodec(Map.of("sample_fmt", "s16", "bits_per_raw_sample", "N/A",
                "bits_per_sample", "16"))).isEqualTo("pcm_s16le");
    }

    @Test
    void prefersBitsPerRawSampleForTwentyFourBitSourcesStoredAsThirtyTwoBitSamples() {
        // e.g. a 24-bit FLAC: ffprobe reports sample_fmt=s32 but bits_per_raw_sample=24
        assertThat(AudioStreamProbe.mapToPcmCodec(Map.of("sample_fmt", "s32", "bits_per_raw_sample", "24",
                "bits_per_sample", "0"))).isEqualTo("pcm_s24le");
    }

    @Test
    void mapsThirtyTwoBitIntegerToPcmS32le() {
        assertThat(AudioStreamProbe.mapToPcmCodec(Map.of("sample_fmt", "s32", "bits_per_raw_sample", "32",
                "bits_per_sample", "32"))).isEqualTo("pcm_s32le");
    }

    @Test
    void mapsFloatSampleFormatToPcmF32le() {
        assertThat(AudioStreamProbe.mapToPcmCodec(Map.of("sample_fmt", "fltp", "bits_per_raw_sample", "N/A",
                "bits_per_sample", "0"))).isEqualTo("pcm_f32le");
    }

    @Test
    void mapsDoubleSampleFormatToPcmF64le() {
        assertThat(AudioStreamProbe.mapToPcmCodec(Map.of("sample_fmt", "dbl", "bits_per_raw_sample", "N/A",
                "bits_per_sample", "0"))).isEqualTo("pcm_f64le");
    }

    @Test
    void fallsBackToSampleFormatWhenBitDepthFieldsAreUnavailable() {
        assertThat(AudioStreamProbe.mapToPcmCodec(Map.of("sample_fmt", "s32", "bits_per_raw_sample", "N/A",
                "bits_per_sample", "N/A"))).isEqualTo("pcm_s32le");
    }

    @Test
    void fallsBackToSixteenBitWhenFieldsAreMissingOrUnrecognized() {
        assertThat(AudioStreamProbe.mapToPcmCodec(Map.of())).isEqualTo("pcm_s16le");
        assertThat(AudioStreamProbe.mapToPcmCodec(Map.of("sample_fmt", "unknown"))).isEqualTo("pcm_s16le");
    }
}
