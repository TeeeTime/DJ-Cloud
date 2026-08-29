# Future Ideas & Refinements

This document collects ideas for future UI/UX improvements to coordinate between developers (Julius & Tom). **None of these are implemented yet.**

## 1. Multi-Select & Track Actions
- **Idea**: Instead of having a dropdown menu (Edit, Stems, Download, Delete) for every single track, introduce **checkboxes** next to the tracks in the list.
- **Benefit**: Allows selecting multiple songs at once to delete or download them in bulk.
- **Note**: "Edit Info" would still apply to single tracks, but bulk actions would become much easier.

## 2. Inline Editing
- **Idea**: Clicking directly on a track's metadata (Name, Artist, Genre, BPM) in the list should instantly turn it into an editable text field.
- **Benefit**: Faster metadata correction without having to open a separate "Edit Info" dialog window every time.

## 3. Genre Filtering (Bubbles)
- **Idea**: Add a way to filter the track list by genres.
- **Interaction**: Clicking a genre on a track creates an active "Bubble" (pill/badge) floating at the top of the list.
- **Functionality**: Multiple genre bubbles can be active at the same time, filtering the visible tracks to only show the selected genres.

## 4. Bottom Player Alignment
- **Idea**: Re-evaluate the alignment of the Bottom Player controls.
- **Issue**: There is blank space on the bottom right (where the queue/upload status widget sits), which makes the player feel a bit off-center when nothing is uploading.
- **Goal**: Potentially center the playback controls perfectly within the window, regardless of the right-side widget's state.

## 5. Waveform Visualization
- **Idea**: Replace or enhance the simple playback slider with a real audio waveform.
- **Benefit**: DJs rely heavily on visual cues to see drops, breakdowns, and track structure at a glance.
- **Note**: Will be discussed with Tom.

## 6. Sorting & Filtering
- **Idea**: Add column headers or a toolbar to sort tracks by **BPM**, **Key**, and **Date Added**.
- **Benefit**: Essential for DJs who need to quickly find tracks in a specific tempo or key range.
- **Note**: Decided against adding a search bar to avoid visual clutter.
