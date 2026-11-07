
import sqlite3
import uuid
from pathlib import Path


BASE_PATH = Path(__file__).resolve().parent.parent
DB_PATH = BASE_PATH / "memory" / "chats.db"


def connect():
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    return sqlite3.connect(DB_PATH)


def initialize_database():

    with connect() as db:

        db.execute("""
            CREATE TABLE IF NOT EXISTS chats (
                id TEXT PRIMARY KEY,
                title TEXT NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)

        db.execute("""
            CREATE TABLE IF NOT EXISTS messages (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                chat_id TEXT NOT NULL,
                role TEXT NOT NULL,
                content TEXT NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY(chat_id) REFERENCES chats(id)
            )
        """)

        db.execute("""
            CREATE INDEX IF NOT EXISTS idx_messages_chat
            ON messages(chat_id)
        """)


def create_chat(title="New conversation"):

    chat_id = str(uuid.uuid4())

    with connect() as db:
        db.execute(
            "INSERT INTO chats (id, title) VALUES (?, ?)",
            (chat_id, title)
        )

    return chat_id


def list_chats():

    with connect() as db:
        rows = db.execute("""
            SELECT id, title, created_at, updated_at
            FROM chats
            ORDER BY updated_at DESC
        """).fetchall()

    return [
        {
            "id": row[0],
            "title": row[1],
            "created_at": row[2],
            "updated_at": row[3]
        }
        for row in rows
    ]


def get_messages(chat_id):

    with connect() as db:
        rows = db.execute("""
            SELECT id, role, content, created_at
            FROM messages
            WHERE chat_id = ?
            ORDER BY id ASC
        """, (chat_id,)).fetchall()

    return [
        {
            "id": row[0],
            "role": row[1],
            "content": row[2],
            "created_at": row[3]
        }
        for row in rows
    ]


def add_message(chat_id, role, content):

    with connect() as db:

        exists = db.execute(
            "SELECT id FROM chats WHERE id = ?",
            (chat_id,)
        ).fetchone()

        if not exists:
            raise ValueError("Conversation not found")

        db.execute("""
            INSERT INTO messages (chat_id, role, content)
            VALUES (?, ?, ?)
        """, (chat_id, role, content))

        db.execute("""
            UPDATE chats
            SET updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
        """, (chat_id,))


def rename_chat(chat_id, title):

    with connect() as db:
        cursor = db.execute("""
            UPDATE chats
            SET title = ?, updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
        """, (title, chat_id))

        return cursor.rowcount > 0


def delete_chat(chat_id):

    with connect() as db:
        db.execute(
            "DELETE FROM messages WHERE chat_id = ?",
            (chat_id,)
        )

        cursor = db.execute(
            "DELETE FROM chats WHERE id = ?",
            (chat_id,)
        )

        return cursor.rowcount > 0


initialize_database()
