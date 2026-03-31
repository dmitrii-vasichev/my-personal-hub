"""
Google Gmail API service for Outreach module.

Provides email sending and thread reply detection using Gmail API v1.
"""
from __future__ import annotations

import base64
import logging
from email.mime.text import MIMEText
from typing import Any, Optional

from google.oauth2.credentials import Credentials
from googleapiclient.discovery import build
from googleapiclient.errors import HttpError

logger = logging.getLogger(__name__)


def _get_gmail_service(credentials: Credentials) -> Any:
    """Build Google Gmail API v1 service."""
    return build("gmail", "v1", credentials=credentials, cache_discovery=False)


async def send_email(
    credentials: Credentials,
    to: str,
    subject: str,
    body: str,
    reply_to_message_id: Optional[str] = None,
    thread_id: Optional[str] = None,
) -> dict:
    """Send an email via Gmail API.

    Args:
        credentials: Valid Google OAuth credentials with gmail.send scope.
        to: Recipient email address.
        subject: Email subject line.
        body: Email body (plain text).
        reply_to_message_id: If replying, the Message-ID header of the original.
        thread_id: If replying, the Gmail thread ID to continue.

    Returns:
        {"message_id": str, "thread_id": str} from Gmail API response.
    """
    service = _get_gmail_service(credentials)

    message = MIMEText(body, "plain", "utf-8")
    message["to"] = to
    message["subject"] = subject

    if reply_to_message_id:
        message["In-Reply-To"] = reply_to_message_id
        message["References"] = reply_to_message_id

    raw = base64.urlsafe_b64encode(message.as_bytes()).decode("ascii")

    send_body: dict[str, Any] = {"raw": raw}
    if thread_id:
        send_body["threadId"] = thread_id

    result = service.users().messages().send(userId="me", body=send_body).execute()

    return {
        "message_id": result["id"],
        "thread_id": result["threadId"],
    }


async def get_thread_replies(
    credentials: Credentials,
    thread_id: str,
    known_message_ids: set[str],
) -> list[dict]:
    """Fetch new messages in a Gmail thread that we haven't seen yet.

    Args:
        credentials: Valid Google OAuth credentials with gmail.readonly scope.
        thread_id: Gmail thread ID to check.
        known_message_ids: Set of Gmail message IDs already logged as activities.

    Returns:
        List of new messages with keys: message_id, thread_id, subject, body, from_email, date.
    """
    service = _get_gmail_service(credentials)

    try:
        thread = service.users().threads().get(
            userId="me", id=thread_id, format="full"
        ).execute()
    except HttpError as e:
        if e.resp.status == 404:
            logger.warning("Gmail thread %s not found", thread_id)
            return []
        raise

    new_messages = []
    for msg in thread.get("messages", []):
        if msg["id"] in known_message_ids:
            continue

        headers = {h["name"].lower(): h["value"] for h in msg["payload"].get("headers", [])}

        # Skip messages sent by us (from address matches authenticated user)
        label_ids = msg.get("labelIds", [])
        if "SENT" in label_ids:
            continue

        body_text = _extract_body(msg["payload"])

        new_messages.append({
            "message_id": msg["id"],
            "thread_id": thread_id,
            "subject": headers.get("subject", ""),
            "body": body_text,
            "from_email": headers.get("from", ""),
            "date": headers.get("date", ""),
        })

    return new_messages


def _extract_body(payload: dict) -> str:
    """Extract plain text body from Gmail message payload."""
    # Simple message with body directly
    if payload.get("mimeType") == "text/plain" and payload.get("body", {}).get("data"):
        return base64.urlsafe_b64decode(payload["body"]["data"]).decode("utf-8", errors="replace")

    # Multipart message — look for text/plain part
    for part in payload.get("parts", []):
        if part.get("mimeType") == "text/plain" and part.get("body", {}).get("data"):
            return base64.urlsafe_b64decode(part["body"]["data"]).decode("utf-8", errors="replace")
        # Nested multipart (e.g., multipart/alternative inside multipart/mixed)
        if part.get("parts"):
            result = _extract_body(part)
            if result:
                return result

    return ""
