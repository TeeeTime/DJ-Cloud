package de.djcloud.backend.track;

/** The three tasks run, in order, for every track that goes through the analysis pipeline. */
public enum AnalysisStep {
    PREVIEW_GENERATION,
    BPM_ANALYSIS,
    KEY_ANALYSIS
}
