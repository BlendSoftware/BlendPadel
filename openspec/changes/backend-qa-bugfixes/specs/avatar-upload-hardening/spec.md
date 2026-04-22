## ADDED Requirements

### Requirement: Avatar upload works with non-seekable streams
The avatar upload flow SHALL buffer the file contents into memory before MIME detection, eliminating the dependency on file.Seek(). The total buffer MUST NOT exceed 5MB (the existing size limit).

#### Scenario: Upload via standard multipart form
- **WHEN** a player uploads a valid JPEG avatar via multipart form
- **THEN** the file is saved and the avatar URL is updated in the database

#### Scenario: Upload via streaming (non-seekable) transport
- **WHEN** a player uploads a valid PNG avatar via a transport that doesn't support Seek
- **THEN** the file is saved correctly (no Seek errors)

#### Scenario: Oversized file rejected before full buffer
- **WHEN** a player uploads a file larger than 5MB
- **THEN** the system returns HTTP 422 with "file too large" error without reading the entire file
