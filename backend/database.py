import sqlite3
import json
from datetime import datetime

DATABASE = "helpdesk.db"


def get_connection():
    connection = sqlite3.connect(DATABASE)
    connection.row_factory = sqlite3.Row
    return connection


def init_db():
    connection = get_connection()

    connection.execute("""
        CREATE TABLE IF NOT EXISTS tickets (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            title TEXT NOT NULL,
            description TEXT NOT NULL,
            conversation TEXT NOT NULL,
            status TEXT NOT NULL DEFAULT 'open',
            priority TEXT NOT NULL DEFAULT 'medium',
            created_at TEXT NOT NULL
        )
    """)

    connection.commit()
    connection.close()


def create_ticket(title, description, conversation):
    connection = get_connection()

    cursor = connection.execute(
        """
        INSERT INTO tickets (
            title,
            description,
            conversation,
            status,
            priority,
            created_at
        )
        VALUES (?, ?, ?, 'open', 'medium', ?)
        """,
        (
            title,
            description,
            conversation,
            datetime.now().isoformat()
        )
    )

    connection.commit()

    ticket_id = cursor.lastrowid

    connection.close()

    return ticket_id

def get_all_tickets():
    connection = get_connection()

    tickets = connection.execute(
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
    ).fetchall()

    connection.close()

    return [dict(ticket) for ticket in tickets]


def get_ticket(ticket_id):
    connection = get_connection()

    ticket = connection.execute(
        """
        SELECT *
        FROM tickets
        WHERE id = ?
        """,
        (ticket_id,)
    ).fetchone()

    connection.close()

    if ticket is None:
        return None

    ticket = dict(ticket)

    # Conversation sparas som JSON i databasen
    ticket["conversation"] = json.loads(ticket["conversation"])

    return ticket