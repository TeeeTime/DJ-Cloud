use std::fs::File;
use std::io::BufReader;
use std::path::Path;

use lofty::config::ParseOptions;
use lofty::file::AudioFile;
use lofty::id3::v2::{Frame, Id3v2Tag};
use lofty::iff::wav::WavFile;
use lofty::mpeg::MpegFile;

/// Description jaudiotagger uses for its `FieldKey.CUSTOM1` field, written as an ID3v2 `COMM`
/// (comment) frame — NOT a `TXXX` user-text frame, confirmed by inspecting the raw bytes of a
/// file jaudiotagger tagged. jaudiotagger reuses this "Songs-DB_CustomN" convention (from the
/// old Songs-DB/MediaMonkey custom-field scheme) for all five of its CUSTOM1-CUSTOM5 slots.
const CUSTOM1_COMMENT_DESCRIPTION: &str = "Songs-DB_Custom1";

/// Reads the track id embedded by the backend's `AudioMetadataWriter#writeInternalId` (see
/// `backend/.../track/AudioMetadataWriter.java`) back out of a local audio file, for both mp3
/// and wav. Returns `None` if the file can't be read, isn't tagged, or holds something that
/// isn't a valid id — the sync logic treats all of those the same way: "not present locally".
pub fn read_track_id_tag(path: &Path) -> Option<i64> {
    let extension = path.extension()?.to_str()?.to_ascii_lowercase();
    let id3v2 = read_id3v2(path, &extension)?;
    comment_by_description(&id3v2, CUSTOM1_COMMENT_DESCRIPTION)?
        .content
        .parse()
        .ok()
}

fn read_id3v2(path: &Path, extension: &str) -> Option<Id3v2Tag> {
    let file = File::open(path).ok()?;
    let mut reader = BufReader::new(file);
    let parse_options = ParseOptions::new();

    match extension {
        "mp3" => MpegFile::read_from(&mut reader, parse_options)
            .ok()?
            .id3v2()
            .cloned(),
        "wav" => WavFile::read_from(&mut reader, parse_options)
            .ok()?
            .id3v2()
            .cloned(),
        _ => None,
    }
}

fn comment_by_description<'a>(
    tag: &'a Id3v2Tag,
    description: &str,
) -> Option<&'a lofty::id3::v2::CommentFrame<'a>> {
    tag.into_iter().find_map(|frame| match frame {
        Frame::Comment(comment) if comment.description == description => Some(comment),
        _ => None,
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    // Fixtures tagged via the backend's real AudioMetadataWriter.writeInternalId logic (mirrored
    // in a throwaway Java harness during development) — a real ffmpeg-encoded mp3/wav, each
    // carrying a CUSTOM1 COMM frame, to confirm lofty reads back exactly what jaudiotagger wrote.
    #[test]
    fn reads_id_tag_written_by_jaudiotagger_mp3() {
        let path = Path::new(concat!(
            env!("CARGO_MANIFEST_DIR"),
            "/../test-fixtures/fixture.mp3"
        ));
        assert_eq!(read_track_id_tag(path), Some(42424));
    }

    #[test]
    fn reads_id_tag_written_by_jaudiotagger_wav() {
        let path = Path::new(concat!(
            env!("CARGO_MANIFEST_DIR"),
            "/../test-fixtures/fixture.wav"
        ));
        assert_eq!(read_track_id_tag(path), Some(77777));
    }
}
