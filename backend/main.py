import os
import json
import sqlite3
from datetime import datetime

from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from openai import OpenAI


# =========================================================
# CONFIG
# =========================================================

load_dotenv()

app = FastAPI(title="HelpDeskAI")

client = OpenAI(
    api_key=os.getenv("OPENAI_API_KEY")
)

MODEL = os.getenv("OPENAI_MODEL", "gpt-5.6-luna")

DATABASE = "helpdesk.db"


# =========================================================
# CORS
# =========================================================

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# =========================================================
# DATABASE
# =========================================================

def get_db():
    conn = sqlite3.connect(DATABASE)
    conn.row_factory = sqlite3.Row
    return conn


def init_db():
    conn = get_db()

    cursor = conn.cursor()

    cursor.execute(
        """
        CREATE TABLE IF NOT EXISTS tickets (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            title TEXT NOT NULL,
            description TEXT NOT NULL,
            status TEXT NOT NULL DEFAULT 'open',
            priority TEXT NOT NULL DEFAULT 'medium',
            created_at TEXT NOT NULL,
            conversation TEXT
        )
        """
    )

    conn.commit()
    conn.close()


init_db()

def init_comments_db():
    conn = get_db()
    cursor = conn.cursor()

    cursor.execute(
        """
        CREATE TABLE IF NOT EXISTS comments (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            ticket_id INTEGER NOT NULL,
            author TEXT NOT NULL,
            content TEXT NOT NULL,
            created_at TEXT NOT NULL,
            FOREIGN KEY (ticket_id) REFERENCES tickets(id)
        )
        """
    )

    conn.commit()
    conn.close()


init_comments_db()

# =========================================================
# MODELS
# =========================================================

class ChatRequest(BaseModel):
    messages: list


class TicketCreate(BaseModel):
    title: str
    description: str
    conversation: list = []


class TicketStatusUpdate(BaseModel):
    status: str

class CommentCreate(BaseModel):
    author: str = "Technician"
    content: str

# =========================================================
# AI
# =========================================================

SYSTEM_PROMPT = """
You are HelpDeskAI, an IT support assistant.

Your job is to troubleshoot the user's technical problem step-by-step.

Ask ONE question at a time.

Be practical and concise.

Try to solve the problem yourself before escalating.

You MUST escalate when:
- The user needs administrator permissions they do not have.
- The problem requires a technician to physically access equipment.
- The user explicitly says they cannot perform a required action.
- The problem appears to be caused by company infrastructure that the user cannot access.
- Troubleshooting has failed and further troubleshooting would require technician access.

When the problem is clearly solved, use status "solved".

When a technician is required, use status "escalate".

Otherwise use status "troubleshooting".

You MUST return your answer in this exact format:

STATUS: troubleshooting
MESSAGE: Your response here

or:

STATUS: solved
MESSAGE: Your response here

or:

STATUS: escalate
MESSAGE: Your response here

Do not include any other STATUS or MESSAGE fields.
"""


def ask_ai(messages):
    conversation_text = ""

    for message in messages:
        role = message.get("role", "user")
        content = message.get("content", "")

        if role == "user":
            conversation_text += f"User: {content}\n"
        else:
            conversation_text += f"HelpDeskAI: {content}\n"

    response = client.responses.create(
        model=MODEL,
        instructions=SYSTEM_PROMPT,
        input=conversation_text,
    )

    output = response.output_text.strip()

    status = "troubleshooting"
    message = output

    if "STATUS:" in output and "MESSAGE:" in output:
        status_part = output.split("STATUS:", 1)[1]

        if "MESSAGE:" in status_part:
            status_text, message_text = status_part.split(
                "MESSAGE:",
                1
            )

            status = status_text.strip().lower()
            message = message_text.strip()

    if status not in [
        "troubleshooting",
        "solved",
        "escalate",
    ]:
        status = "troubleshooting"

    return {
        "message": message,
        "status": status,
    }


# =========================================================
# BASIC TEST
# =========================================================

@app.get("/")
def root():
    return {
        "message": "HelpDeskAI backend is running"
    }


@app.get("/api/test")
def test():
    return {
        "message": "Hej från FastAPI :)"
    }


# =========================================================
# CHAT
# =========================================================

@app.post("/api/chat")
def chat(request: ChatRequest):

    result = ask_ai(request.messages)

    return result


# =========================================================
# TICKETS
# =========================================================

@app.post("/api/tickets")
def create_ticket(ticket: TicketCreate):

    conn = get_db()
    cursor = conn.cursor()

    created_at = datetime.now().isoformat()

    cursor.execute(
        """
        INSERT INTO tickets
        (
            title,
            description,
            status,
            priority,
            created_at,
            conversation
        )
        VALUES (?, ?, ?, ?, ?, ?)
        """,
        (
            ticket.title,
            ticket.description,
            "open",
            "medium",
            created_at,
            json.dumps(ticket.conversation),
        )
    )

    ticket_id = cursor.lastrowid

    conn.commit()
    conn.close()

    return {
        "success": True,
        "ticket_id": ticket_id,
        "status": "open",
    }


# =========================================================
# GET ALL TICKETS
# =========================================================

@app.get("/api/tickets")
def get_tickets():

    conn = get_db()
    cursor = conn.cursor()

    cursor.execute(
        """
        SELECT
            id,
            title,
            description,
            status,
            priority,
            created_at
        FROM tickets
        ORDER BY id DESC
        """
    )

    rows = cursor.fetchall()

    conn.close()

    return [
        dict(row)
        for row in rows
    ]


# =========================================================
# GET SINGLE TICKET
# =========================================================

@app.get("/api/tickets/{ticket_id}")
def get_ticket(ticket_id: int):

    conn = get_db()
    cursor = conn.cursor()

    cursor.execute(
        """
        SELECT *
        FROM tickets
        WHERE id = ?
        """,
        (ticket_id,)
    )

    row = cursor.fetchone()

    conn.close()

    if row is None:
        return {
            "error": "Ticket not found"
        }

    ticket = dict(row)

    if ticket.get("conversation"):
        try:
            ticket["conversation"] = json.loads(
                ticket["conversation"]
            )
        except json.JSONDecodeError:
            ticket["conversation"] = []
    else:
        ticket["conversation"] = []

    return ticket


# =========================================================
# UPDATE TICKET STATUS
# =========================================================

@app.patch("/api/tickets/{ticket_id}/status")
def update_ticket_status(
    ticket_id: int,
    update: TicketStatusUpdate
):

    allowed_statuses = [
        "open",
        "in_progress",
        "resolved",
    ]

    if update.status not in allowed_statuses:
        return {
            "success": False,
            "error": "Invalid status",
            "allowed_statuses": allowed_statuses,
        }

    conn = get_db()
    cursor = conn.cursor()

    cursor.execute(
        """
        UPDATE tickets
        SET status = ?
        WHERE id = ?
        """,
        (
            update.status,
            ticket_id,
        )
    )

    if cursor.rowcount == 0:
        conn.close()

        return {
            "success": False,
            "error": "Ticket not found",
        }

    conn.commit()
    conn.close()

    return {
        "success": True,
        "ticket_id": ticket_id,
        "status": update.status,
    }

@app.get("/api/tickets/{ticket_id}/comments")
def get_ticket_comments(ticket_id: int):

    conn = get_db()
    cursor = conn.cursor()

    cursor.execute(
        """
        SELECT *
        FROM comments
        WHERE ticket_id = ?
        ORDER BY id ASC
        """,
        (ticket_id,)
    )

    rows = cursor.fetchall()

    conn.close()

    return [dict(row) for row in rows]


@app.post("/api/tickets/{ticket_id}/comments")
def create_ticket_comment(
    ticket_id: int,
    comment: CommentCreate
):

    conn = get_db()
    cursor = conn.cursor()

    # Make sure ticket exists
    cursor.execute(
        """
        SELECT id
        FROM tickets
        WHERE id = ?
        """,
        (ticket_id,)
    )

    ticket = cursor.fetchone()

    if ticket is None:
        conn.close()

        return {
            "success": False,
            "error": "Ticket not found"
        }

    created_at = datetime.now().isoformat()

    cursor.execute(
        """
        INSERT INTO comments
        (
            ticket_id,
            author,
            content,
            created_at
        )
        VALUES (?, ?, ?, ?)
        """,
        (
            ticket_id,
            comment.author,
            comment.content,
            created_at
        )
    )

    comment_id = cursor.lastrowid

    conn.commit()
    conn.close()

    return {
        "success": True,
        "comment_id": comment_id,
        "ticket_id": ticket_id
    }