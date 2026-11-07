# DOBBY — Local AI Assistant

DOBBY is a locally running conversational AI project built around a custom chat interface, a lightweight language model, and persistent conversation storage. The goal is to explore a privacy-conscious personal assistant that can run on a user's own computer.

> **Project status:** Early development. Features described below reflect the current prototype; capabilities on the roadmap are not presented as implemented.

## Current features

- **Local text generation:** Uses Qwen2.5-1.5B-Instruct through the Python model stack for local inference.
- **Conversation storage:** Stores chat history in SQLite.
- **Semantic conversation retrieval:** Uses sentence embeddings from `all-MiniLM-L6-v2` to find potentially relevant earlier conversation context.
- **Custom chat interface:** React and Vite frontend with a matte-black visual design and a custom monochrome DOBBY mascot.
- **Chat management:** Create and select chats, rename, pin, archive/restore, and delete conversations. The current UI also supports copying/sharing a transcript through the clipboard.

Some interface features (such as pinning, archiving, and the chat lock) are local UI/browser features. The lock should not be considered encryption or strong access control.

## Architecture

```text
┌──────────────────────────────┐
│       React + Vite UI        │
│  Chat, conversation controls │
└──────────────┬───────────────┘
               │ HTTP
┌──────────────▼───────────────┐
│        FastAPI backend       │
│     Chat and model routes    │
└───────┬───────────────┬──────┘
        │               │
┌───────▼────────┐ ┌────▼────────────────┐
│ Model manager  │ │ Conversation memory │
│ Qwen inference │ │ MiniLM embeddings   │
└────────────────┘ └─────────┬───────────┘
                             │
                     ┌───────▼───────┐
                     │    SQLite    │
                     │ chat + memory│
                     └───────────────┘
```

### Technology

| Layer | Technology |
|---|---|
| Frontend | React, Vite, JavaScript |
| Backend | Python, FastAPI |
| Language model | Qwen2.5-1.5B-Instruct |
| Embeddings | sentence-transformers / all-MiniLM-L6-v2 |
| Storage | SQLite |
| Model runtime | PyTorch, Hugging Face Transformers |

## Project layout

The project is developed on Windows. A typical local layout includes:

```text
Multi Model AI/
├── backend/
│   ├── main.py
│   └── chat_database.py
├── Core/
│   ├── model_manager.py
│   └── memory.py
├── frontend/
│   ├── package.json
│   └── src/
├── memory/              # Local SQLite databases (not committed)
├── models/              # Downloaded model files (not committed)
└── .venv/               # Python virtual environment (not committed)
```

The exact layout may evolve during development.

## Requirements

- Windows 10/11 (the primary development environment)
- Python 3.10 or newer recommended
- Node.js and npm
- Git
- Enough disk space for Python packages and downloaded model files

The model weights are **not** included in this repository. They must be downloaded separately by the model setup used in the project.

## Installation

The repository's public source is being prepared for its first release. Installation commands below describe the standard development workflow; verify model download/configuration paths in the current source before running the backend.

### 1. Clone

```powershell
git clone https://github.com/dharnish777/DOBBY-Local-AI.git
cd DOBBY-Local-AI
```

### 2. Backend environment

```powershell
py -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install --upgrade pip
```

Install the Python dependencies listed in `requirements.txt` once that file has been generated from the working development environment:

```powershell
pip install -r requirements.txt
```

### 3. Frontend

```powershell
cd frontend
npm install
npm run dev
```

### 4. Run the backend

From the repository root, activate the virtual environment and use:

```powershell
python -m uvicorn backend.main:app --host 127.0.0.1 --port 8000
```

The frontend development server is typically available at `http://localhost:5173` and the backend at `http://127.0.0.1:8000`.

### 5. Model files

DOBBY does not commit model weights. Follow the model setup/configuration in the source code to download and place Qwen2.5-1.5B-Instruct and all-MiniLM-L6-v2 locally. Do not place model files, personal databases, or secrets in a public commit.

## Screenshots

Screenshots will be added here once the current application captures are included:

- Welcome screen
- Active conversation
- Chat options/menu

## Roadmap

Ideas under consideration include stronger conversational memory, model routing, document/tool integrations, and voice interaction. These are future directions and are not claimed as available in this prototype.

## Privacy and security notes

- Inference and chat storage are designed to run locally in the current setup.
- Do not commit API keys, credentials, personal conversation databases, or private user data.
- The chat lock in the interface is not encryption.
- Review all network calls and model download behavior before using the application with sensitive information.

## Contributing

Issues and suggestions are welcome. Please describe the environment, steps to reproduce, and relevant logs when reporting a problem. Avoid attaching private conversation databases or credentials.

## License

This project is licensed under the MIT License. See [LICENSE](LICENSE).
