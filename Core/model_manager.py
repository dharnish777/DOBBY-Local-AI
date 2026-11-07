
import torch
from pathlib import Path
from transformers import (
    AutoTokenizer,
    AutoModelForCausalLM,
    AutoModel
)
import torch.nn.functional as F


class ModelManager:

    def __init__(self):

        # Project root
        self.base_path = Path(__file__).resolve().parent.parent

        # Models directory
        self.models_path = self.base_path / "models"

        # Model paths
        self.qwen_path = str(
            self.models_path / "Qwen2.5-1.5B-Instruct"
        )

        self.embedding_path = str(
            self.models_path / "all-MiniLM-L6-v2"
        )

        # Device selection
        self.device = "cuda" if torch.cuda.is_available() else "cpu"

        # Model instances
        self.qwen_tokenizer = None
        self.qwen_model = None

        self.embedding_tokenizer = None
        self.embedding_model = None

        print(f"Model Manager initialized on {self.device}")

    # Load Qwen instruction model
    def load_qwen(self):

        if self.qwen_model is not None:
            return

        print("Loading Qwen2.5-1.5B-Instruct...")

        self.qwen_tokenizer = AutoTokenizer.from_pretrained(
            self.qwen_path,
            local_files_only=True
        )

        dtype = torch.float16 if self.device == "cuda" else torch.float32

        self.qwen_model = AutoModelForCausalLM.from_pretrained(
            self.qwen_path,
            dtype=dtype,
            low_cpu_mem_usage=True,
            local_files_only=True
        ).to(self.device)

        self.qwen_model.eval()

        print("Qwen Instruct loaded successfully!")

    # Generate text using Qwen
    def generate(self, prompt, max_tokens=200):

        self.load_qwen()

        messages = [
            {
                "role": "system",
                "content": "You are a helpful AI assistant. Answer clearly and naturally in English unless another language is requested."
            },
            {
                "role": "user",
                "content": prompt
            }
        ]

        inputs = self.qwen_tokenizer.apply_chat_template(
            messages,
            tokenize=True,
            add_generation_prompt=True,
            return_dict=True,
            return_tensors="pt"
        )

        inputs = {
            key: value.to(self.device)
            for key, value in inputs.items()
        }

        input_length = inputs["input_ids"].shape[1]

        with torch.inference_mode():

            outputs = self.qwen_model.generate(
                **inputs,
                max_new_tokens=max_tokens,
                do_sample=False,
                pad_token_id=self.qwen_tokenizer.eos_token_id
            )

        new_tokens = outputs[0][input_length:]

        response = self.qwen_tokenizer.decode(
            new_tokens,
            skip_special_tokens=True
        )

        return response.strip()

    # Load MiniLM embedding model
    def load_embedding(self):

        if self.embedding_model is not None:
            return

        print("Loading MiniLM...")

        self.embedding_tokenizer = AutoTokenizer.from_pretrained(
            self.embedding_path,
            local_files_only=True
        )

        self.embedding_model = AutoModel.from_pretrained(
            self.embedding_path,
            local_files_only=True
        ).to("cpu")

        self.embedding_model.eval()

        print("MiniLM loaded successfully!")

    # Convert text into sentence embeddings
    def embed(self, texts):

        self.load_embedding()

        if isinstance(texts, str):
            texts = [texts]

        inputs = self.embedding_tokenizer(
            texts,
            padding=True,
            truncation=True,
            max_length=256,
            return_tensors="pt"
        )

        with torch.inference_mode():

            outputs = self.embedding_model(**inputs)

            token_embeddings = outputs.last_hidden_state
            attention_mask = inputs["attention_mask"]

            mask = attention_mask.unsqueeze(-1).expand(
                token_embeddings.size()
            ).float()

            sum_embeddings = torch.sum(
                token_embeddings * mask,
                dim=1
            )

            sum_mask = torch.clamp(
                mask.sum(dim=1),
                min=1e-9
            )

            embeddings = sum_embeddings / sum_mask

            embeddings = F.normalize(
                embeddings,
                p=2,
                dim=1
            )

        return embeddings.cpu().numpy()

    # Unload Qwen to release memory
    def unload_qwen(self):

        if self.qwen_model is not None:

            del self.qwen_model
            del self.qwen_tokenizer

            self.qwen_model = None
            self.qwen_tokenizer = None

            import gc
            gc.collect()

            if torch.cuda.is_available():
                torch.cuda.empty_cache()

            print("Qwen unloaded!")
