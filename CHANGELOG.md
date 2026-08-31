# Changelog

All notable changes to this project will be documented in this file.

## [Unreleased]

### Added
- **Player Usability**: Added mouse wheel support for the volume slider. Scrolling over the volume icon or slider now increases/decreases the volume smoothly in 5% steps.
- **Dynamic Volume Icon**: The volume icon in the player now dynamically updates based on the current volume level (e.g., changes the number of sound waves or shows a muted icon at 0%).
- **Real Overview Data**: Replaced dummy data on the Overview page with real data fetched from the API, including the most recently added tracks and genre distribution.
- **"NEW" Badge**: Tracks added since the user's last visit to the overview page are now marked with a "NEW" tag.
- **Genre Support**: Tracks now fully support storing and displaying genre information.

### Changed
- **Player Hitboxes**: Increased the vertical click area (hitbox) of both the playback progress slider and the volume slider to make them easier to grab, without changing their visual thickness. Added pointer cursors for better visual feedback.
- **Deletion Dialog**: Refined the visual design and layout of the deletion confirmation dialog.

### Fixed
- **Cover Arts**: Fixed an issue where vertical or non-square cover artworks would appear distorted. Cover images are now strictly cropped to a square format.
- **Tool Paths**: Restored missing configurations for backend analysis tools (`ffmpeg`, `aubiotrack`, `keyfinder-cli`) by setting them globally on the OS and in the IDE launch configuration.
