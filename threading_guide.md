# Front-end Integration Guide: Email Threading & Conversation Management

This document provides a guide for the frontend team on how to implement email conversation threading, replying, and replying-to-all using our backend APIs.

---

## 1. Threading Overview

Our mail server groups emails into conversations using standard email headers (`Message-ID`, `In-Reply-To`, `References`) and subject similarity fallbacks. 
- Every email has a `conversation_id` (UUID string).
- Emails with the same `conversation_id` belong to the same conversation thread.
- Standard folders like `INBOX` and `Sent` contain emails that can belong to the same conversation.

---

## 2. API Endpoints

### A. Fetching Message List
Retrieve the list of emails for a given folder. Each metadata object contains the `conversation_id`.

- **URL:** `/api/messages/`
- **Method:** `GET`
- **Query Params:**
  - `folder` (optional, default: `INBOX`)
- **Response Shape:**
  ```json
  [
    {
      "id": 12,
      "uid": 105,
      "folder": "INBOX",
      "subject": "Update Regarding Today's Discussion Call",
      "from_addr": "anish@domain.com",
      "to_addrs": "ritesh@domain.com, sejal@domain.com",
      "date": "2026-07-02T11:00:00Z",
      "seen": true,
      "flagged": false,
      "snippet": "Dear Ritesh, I wanted to follow up...",
      "conversation_id": "8f8c474d-4be9-4a9c-9c7b-7b0a3c20db23"
    }
  ]
  ```

*UI Tip:* You can group emails by `conversation_id` in your folder view, showing the latest active conversation thread at the top.

---

### B. Fetching a Single Message & Thread
Retrieve a detailed message along with the entire conversation thread it belongs to.

- **URL:** `/api/messages/<str:folder>/<int:uid>/`
- **Method:** `GET`
- **Example:** `/api/messages/INBOX/105/`
- **Response Shape:**
  ```json
  {
    "uid": 105,
    "folder": "INBOX",
    "subject": "Update Regarding Today's Discussion Call",
    "from": "Anish <anish@domain.com>",
    "to": ["ritesh@domain.com", "sejal@domain.com"],
    "date": "2026-07-02T11:00:00Z",
    "text": "Dear Ritesh, I wanted to follow up...",
    "html": "<p>Dear Ritesh...</p>",
    "attachments": [],
    "message_id": "<anish-original-msg-id@domain.com>",
    "in_reply_to": "",
    "sender_name": "Anish",
    "sender_email": "anish@domain.com",
    "is_target": true,
    "thread": [
      {
        "uid": 105,
        "folder": "INBOX",
        "subject": "Update Regarding Today's Discussion Call",
        "from": "Anish <anish@domain.com>",
        "to": ["ritesh@domain.com", "sejal@domain.com"],
        "date": "2026-07-02T11:00:00Z",
        "text": "Dear Ritesh, I wanted to follow up...",
        "html": "<p>Dear Ritesh...</p>",
        "attachments": [],
        "message_id": "<anish-original-msg-id@domain.com>",
        "in_reply_to": "",
        "sender_name": "Anish",
        "sender_email": "anish@domain.com"
      },
      {
        "uid": 42,
        "folder": "Sent",
        "subject": "Re: Update Regarding Today's Discussion Call",
        "from": "ritesh@domain.com",
        "to": ["anish@domain.com"],
        "date": "2026-07-02T11:15:00Z",
        "text": "Hi Anish, I have reply details...",
        "html": "<p>Hi Anish...</p>",
        "attachments": [],
        "message_id": "<ritesh-reply-1@domain.com>",
        "in_reply_to": "<anish-original-msg-id@domain.com>",
        "sender_name": "ritesh@domain.com",
        "sender_email": "ritesh@domain.com"
      }
    ]
  }
  ```

*UI Tip:* Loop through the `thread` array in chronological order to render the stacked thread view (similar to Gmail).

---

### C. Sending, Replying & Replying to All
All outgoing mail actions use the `/api/send/` endpoint.

- **URL:** `/api/send/`
- **Method:** `POST`
- **Content-Type:** `multipart/form-data` (or JSON if sending no attachments)

#### 1. Compose New Email
```json
{
  "to": "recipient1@domain.com, recipient2@domain.com",
  "cc": "cc-recipient@domain.com",
  "bcc": "",
  "subject": "Project Kickoff",
  "body": "Hello Team, let's kick off the project."
}
```

#### 2. Reply to a Specific Message
To reply to an individual email, set the recipient to the original sender and attach `in_reply_to` pointing to the target message's `message_id`.

```json
{
  "to": "anish@domain.com",
  "subject": "Re: Update Regarding Today's Discussion Call",
  "body": "Hi Anish, looking forward to it.",
  "in_reply_to": "<anish-original-msg-id@domain.com>"
}
```

#### 3. Reply to All
To reply to everyone on the thread, aggregate all participants from the target email's `From`, `To`, and `Cc` lists (excluding the current user's address), and send them as the updated recipients list.

```json
{
  "to": "anish@domain.com, sejal@domain.com",
  "cc": "clifftan@domain.com, prashant@domain.com",
  "subject": "Re: Update Regarding Today's Discussion Call",
  "body": "Hi everyone, I have rescheduled the call to 4 PM.",
  "in_reply_to": "<ritesh-reply-1@domain.com>"
}
```

---

## 3. Key Frontend Recommendations

1. **Reply Recipient Resolution**:
   - **Reply**: Map the target message's `sender_email` (or `from` address parsing) directly to the outgoing `to` field.
   - **Reply All**: Map the target message's `sender_email` + all entries in the original message's `to` array to the outgoing `to` field. Map all entries in the original message's `cc` array to the outgoing `cc` field. **Filter out the current user's own email address** to avoid sending the email to themselves.
2. **References Construction**:
   - Do not worry about constructing the `References` header. The backend's [SendView](file:///d:/Ritesh/Mail/SMTP_Backend/api/views.py#L365) automatically retrieves the full sibling chain of messages for the given `in_reply_to` value and formats the `References` header correctly.
3. **Displaying the Thread**:
   - Use the `thread` array returned by `/api/messages/<folder>/<uid>/` directly. It contains all incoming/outgoing messages in the thread, pre-sorted chronologically.
