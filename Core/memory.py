
import sqlite3
import numpy as np
from pathlib import Path


class MemoryManager:

    def __init__(self, model_manager):

        self.base_path = Path(__file__).resolve().parent.parent
        self.memory_path = self.base_path / "memory"
        self.memory_path.mkdir(parents=True, exist_ok=True)

        self.db_path = self.memory_path / "memory.db"
        self.model_manager = model_manager

        self.create_table()

        print("Conversation Memory Manager initialized!")

    def connect(self):
        return sqlite3.connect(self.db_path)

    # Ensure conversation history exists
    def create_table(self):

        with self.connect() as connection:

            connection.execute("""
                CREATE TABLE IF NOT EXISTS conversation_history (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    legacy_memory_id INTEGER,
                    user_message TEXT NOT NULL,
                    ai_response TEXT NOT NULL,
                    embedding BLOB NOT NULL,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            """)

    # Save a conversation
    def save_memory(self, user_message, ai_response):

        user_message = user_message.strip()
        ai_response = ai_response.strip()

        if not user_message or not ai_response:
            return False

        with self.connect() as connection:

            existing = connection.execute("""
                SELECT id FROM conversation_history
                WHERE user_message = ? AND ai_response = ?
            """, (user_message, ai_response)).fetchone()

            if existing:
                print("Duplicate conversation skipped!")
                return False

            memory_text = (
                f"User: {user_message}\n"
                f"Assistant: {ai_response}"
            )

            embedding = self.model_manager.embed(memory_text)[0]

            embedding_blob = embedding.astype(
                np.float32
            ).tobytes()

            connection.execute("""
                INSERT INTO conversation_history (
                    user_message,
                    ai_response,
                    embedding
                )
                VALUES (?, ?, ?)
            """, (
                user_message,
                ai_response,
                embedding_blob
            ))

        print("Conversation saved!")
        return True

    # Search relevant conversations
    def search_memory(self, query, limit=3, threshold=0.35):

        query_embedding = self.model_manager.embed(query)[0]

        with self.connect() as connection:

            rows = connection.execute("""
                SELECT id, user_message, ai_response, embedding
                FROM conversation_history
            """).fetchall()

        results = []

        for row in rows:

            memory_embedding = np.frombuffer(
                row[3],
                dtype=np.float32
            )

            if memory_embedding.shape != query_embedding.shape:
                continue

            similarity = float(
                np.dot(query_embedding, memory_embedding)
            )

            if similarity >= threshold:

                results.append({
                    "id": row[0],
                    "user_message": row[1],
                    "ai_response": row[2],
                    "similarity": similarity
                })

                results.sort(
            key=lambda item: item["similarity"],
            reverse=True
        )

        # Remove duplicate user questions
        unique_results = []
        seen = set()

        for item in results:
            key = item["user_message"].strip().lower()

            if key not in seen:
                seen.add(key)
                unique_results.append(item)

        return unique_results[:limit]

    # Count conversations
    def count_memories(self):

        with self.connect() as connection:

            result = connection.execute(
                "SELECT COUNT(*) FROM conversation_history"
            ).fetchone()

        return result[0]
