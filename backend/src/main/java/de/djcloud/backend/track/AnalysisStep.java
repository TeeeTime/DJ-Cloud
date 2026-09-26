package de.djcloud.backend.track;

/** The five tasks run, in order, for every track that goes through the analysis pipeline. */
public enum AnalysisStep {
    VALIDATION,
    REMUX,
    PREVIEW_GENERATION,
    BPM_ANALYSIS,
    KEY_ANALYSIS
}
