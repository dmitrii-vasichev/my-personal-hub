"""
Google Drive API service for Notes module.

Provides folder tree listing, file content reading, file creation,
and folder validation using Google Drive API v3.
"""
from __future__ import annotations

import logging
import time
from typing import Any, Optional

from google.oauth2.credentials import Credentials
from googleapiclient.discovery import build
from googleapiclient.errors import HttpError
from googleapiclient.http import MediaInMemoryUpload

from app.schemas.note import NoteTreeNode

logger = logging.getLogger(__name__)

# In-memory cache: key = folder_id, value = (timestamp, tree)
_tree_cache: dict[str, tuple[float, list[NoteTreeNode]]] = {}
_CACHE_TTL_SECONDS = 300  # 5 minutes

FOLDER_MIME = "application/vnd.google-apps.folder"


def _get_drive_service(credentials: Credentials) -> Any:
    """Build Google Drive API v3 service."""
    return build("drive", "v3", credentials=credentials, cache_discovery=False)


def _is_markdown_file(name: str, mime_type: str) -> bool:
    """Check if file is a markdown file by extension or MIME type."""
    return (
        name.lower().endswith(".md")
        or name.lower().endswith(".markdown")
        or mime_type == "text/markdown"
    )


async def list_folder_tree(
    credentials: Credentials,
    folder_id: str,
    *,
    use_cache: bool = True,
) -> list[NoteTreeNode]:
    """Recursively list folder contents — folders and .md files only.

    Results are cached in memory for 5 minutes per folder_id.
    """
    if use_cache:
        cached = _tree_cache.get(folder_id)
        if cached:
            ts, tree = cached
            if time.time() - ts < _CACHE_TTL_SECONDS:
                return tree

    service = _get_drive_service(credentials)
    tree = _build_tree_sync(service, folder_id)

    _tree_cache[folder_id] = (time.time(), tree)
    return tree


def _build_tree_sync(service: Any, folder_id: str) -> list[NoteTreeNode]:
    """Synchronous recursive tree builder (Drive API is sync)."""
    nodes: list[NoteTreeNode] = []
    page_token: Optional[str] = None

    while True:
        response = (
            service.files()
            .list(
                q=f"'{folder_id}' in parents and trashed = false",
                fields="nextPageToken, files(id, name, mimeType)",
                pageSize=1000,
                pageToken=page_token,
                orderBy="folder, name",
            )
            .execute()
        )

        for item in response.get("files", []):
            mime = item["mimeType"]
            name = item["name"]
            file_id = item["id"]

            if mime == FOLDER_MIME:
                children = _build_tree_sync(service, file_id)
                nodes.append(
                    NoteTreeNode(
                        name=name,
                        type="folder",
                        google_file_id=file_id,
                        children=children,
                    )
                )
            elif _is_markdown_file(name, mime):
                nodes.append(
                    NoteTreeNode(
                        name=name,
                        type="file",
                        google_file_id=file_id,
                    )
                )

        page_token = response.get("nextPageToken")
        if not page_token:
            break

    return nodes


async def get_file_content(
    credentials: Credentials,
    file_id: str,
) -> str:
    """Read raw file content as UTF-8 markdown string."""
    service = _get_drive_service(credentials)

    content = service.files().get_media(fileId=file_id).execute()

    if isinstance(content, bytes):
        return content.decode("utf-8")
    return str(content)


async def validate_folder_access(
    credentials: Credentials,
    folder_id: str,
) -> bool:
    """Check if the folder exists and user has read access."""
    service = _get_drive_service(credentials)
    try:
        file_meta = service.files().get(fileId=folder_id, fields="mimeType").execute()
        return file_meta.get("mimeType") == FOLDER_MIME
    except HttpError as e:
        logger.warning("Drive folder validation failed for %s: %s", folder_id, e)
        return False


def invalidate_cache(folder_id: str) -> None:
    """Remove cached tree for a specific folder."""
    _tree_cache.pop(folder_id, None)


async def create_file(
    credentials: Credentials,
    folder_id: str,
    title: str,
    content: str,
) -> str:
    """Create a markdown file in Google Drive and return its file ID.

    Args:
        credentials: Valid Google OAuth credentials with drive.file scope.
        folder_id: Parent folder ID where the file will be created.
        title: File name (will append .md if not present).
        content: Markdown content for the file.

    Returns:
        The Google Drive file ID of the created file.
    """
    service = _get_drive_service(credentials)

    if not title.lower().endswith(".md"):
        title = f"{title}.md"

    file_metadata = {
        "name": title,
        "parents": [folder_id],
        "mimeType": "text/markdown",
    }

    media = MediaInMemoryUpload(
        content.encode("utf-8"),
        mimetype="text/markdown",
        resumable=False,
    )

    created = (
        service.files()
        .create(body=file_metadata, media_body=media, fields="id")
        .execute()
    )

    file_id = created["id"]
    logger.info("Created Drive file %s in folder %s", file_id, folder_id)

    # Invalidate tree cache so new file appears
    invalidate_cache(folder_id)

    return file_id
