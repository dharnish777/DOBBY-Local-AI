
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from Core.model_manager import ModelManager
from Core.memory import MemoryManager
from backend import chat_database as db


app = FastAPI(title="DOBBY AI", version="0.2.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

model_manager = ModelManager()
memory = MemoryManager(model_manager)


class ChatRequest(BaseModel):
    message: str


class RenameRequest(BaseModel):
    title: str


@app.get("/health")
def health():
    return {
        "status": "online",
        "name": "DOBBY AI",
        "version": "0.2.0"
    }


@app.post("/chats")
def create_chat():
    chat_id = db.create_chat()
    return {"id": chat_id, "title": "New conversation"}


@app.get("/chats")
def list_chats():
    return {"chats": db.list_chats()}


@app.get("/chats/{chat_id}")
def get_chat(chat_id: str):
    chats = db.list_chats()

    if not any(chat["id"] == chat_id for chat in chats):
        raise HTTPException(status_code=404, detail="Chat not found")

    return {
        "id": chat_id,
        "messages": db.get_messages(chat_id)
    }


@app.patch("/chats/{chat_id}")
def rename_chat(chat_id: str, request: RenameRequest):
    title = request.title.strip()

    if not title:
        raise HTTPException(status_code=400, detail="Title cannot be empty")

    if not db.rename_chat(chat_id, title):
        raise HTTPException(status_code=404, detail="Chat not found")

    return {"success": True, "title": title}


@app.delete("/chats/{chat_id}")
def delete_chat(chat_id: str):
    if not db.delete_chat(chat_id):
        raise HTTPException(status_code=404, detail="Chat not found")

    return {"success": True}


@app.post("/chats/{chat_id}/messages")
def chat(chat_id: str, request: ChatRequest):

    question = request.message.strip()

    if not question:
        raise HTTPException(status_code=400, detail="Message cannot be empty")

    chats = db.list_chats()

    if not any(item["id"] == chat_id for item in chats):
        raise HTTPException(status_code=404, detail="Chat not found")

    db.add_message(chat_id, "user", question)

    results = memory.search_memory(
        question,
        limit=3,
        threshold=0.40
    )

    context = ""

    for item in results:
        context += (
            f"\nPrevious question: {item['user_message']}"
            f"\nPrevious answer: {item['ai_response']}\n"
        )

    prompt = f"""
You are DOBBY, an independent local AI assistant.
You are not a fictional character.

Use relevant previous conversations as context.

Rules:
- Speak directly using "you".
- Never refer to the person as "the user".
- Answer naturally and clearly.
- Never invent personal information.

PREVIOUS CONVERSATIONS:
{context if context else "No relevant memories found."}

CURRENT QUESTION:
{question}

ANSWER:
"""

    response = model_manager.generate(prompt, max_tokens=200)

    db.add_message(chat_id, "assistant", response)
    memory.save_memory(question, response)

    # Automatically title a new conversation
    current_chat = next(
        item for item in chats if item["id"] == chat_id
    )

    if current_chat["title"] == "New conversation":
        title = question[:45]
        db.rename_chat(chat_id, title)

    return {
        "response": response,
        "memories_retrieved": len(results),
        "chat_id": chat_id
    }
