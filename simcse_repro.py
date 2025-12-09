#!/usr/bin/env python
"""
Minimal SimCSE reproduction script.
- Loads a pretrained SimCSE checkpoint from HuggingFace.
- Evaluates semantic textual similarity on GLUE STS-B.
Dependencies: torch, transformers, datasets, scipy
Example:
    python simcse_repro.py --model_name princeton-nlp/unsup-simcse-bert-base-uncased --split validation
"""

import argparse
from typing import List

import json
import time
import numpy as np
import torch
import torch.nn.functional as F
from datasets import load_dataset
from scipy.stats import spearmanr
from transformers import AutoModel, AutoTokenizer


def encode(
    model: AutoModel,
    tokenizer: AutoTokenizer,
    sentences: List[str],
    device: torch.device,
    batch_size: int = 64,
    max_length: int = 64,
) -> torch.Tensor:
    """Encode sentences with [CLS] pooling and L2 normalization."""
    outputs = []
    for start in range(0, len(sentences), batch_size):
        batch = sentences[start : start + batch_size]
        inputs = tokenizer(
            batch,
            padding=True,
            truncation=True,
            max_length=max_length,
            return_tensors="pt",
        )
        inputs = {k: v.to(device) for k, v in inputs.items()}
        with torch.no_grad():
            result = model(**inputs, output_hidden_states=True, return_dict=True)
            # SimCSE checkpoints expose the MLP-enhanced pooler; fall back to raw [CLS] if absent.
            cls = result.pooler_output if result.pooler_output is not None else result.last_hidden_state[:, 0]
            cls = F.normalize(cls, p=2, dim=1)
        outputs.append(cls.cpu())
    return torch.cat(outputs, dim=0)


def evaluate(model_name: str, split: str, batch_size: int, max_length: int, device: torch.device):
    """Run STS-B evaluation and return a dict with Spearman and metadata."""
    tokenizer = AutoTokenizer.from_pretrained(model_name)
    model = AutoModel.from_pretrained(model_name)
    model.to(device)
    model.eval()

    data = load_dataset("glue", "stsb", split=split)
    if any(l is None for l in data["label"]):
        raise ValueError("Chosen split has no gold labels (GLUE test set hides labels). Use validation/train for scoring.")

    s1, s2, labels = data["sentence1"], data["sentence2"], np.array(data["label"], dtype=np.float32)

    emb1 = encode(model, tokenizer, s1, device, batch_size, max_length)
    emb2 = encode(model, tokenizer, s2, device, batch_size, max_length)
    sims = (emb1 * emb2).sum(dim=1).numpy()  # cosine similarity thanks to normalization

    return {
        "spearman": float(spearmanr(sims, labels).correlation),
        "n_samples": len(labels),
        "device": str(device),
        "model": model_name,
        "split": split,
    }


def main():
    parser = argparse.ArgumentParser(description="Evaluate SimCSE on GLUE STS-B.")
    parser.add_argument(
        "--model_name",
        type=str,
        default="princeton-nlp/unsup-simcse-bert-base-uncased",
        help="HuggingFace model id, e.g., unsup-simcse-bert-base-uncased or sup-simcse-bert-base-uncased",
    )
    parser.add_argument(
        "--split",
        type=str,
        default="validation",
        choices=["train", "validation", "test"],
        help="Which STS-B split to evaluate.",
    )
    parser.add_argument("--batch_size", type=int, default=64, help="Batch size for encoding.")
    parser.add_argument("--max_length", type=int, default=64, help="Maximum sequence length.")
    parser.add_argument(
        "--save_log",
        type=str,
        default=None,
        help="Optional path to save results (JSON). Useful for报告/复现记录。",
    )
    args = parser.parse_args()

    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    print(f"Using device: {device}")
    try:
        result = evaluate(args.model_name, args.split, args.batch_size, args.max_length, device)
    except ValueError as e:
        print(f"[Error] {e}")
        print("Hint: GLUE STS-B test split没有公开标签，请改用 --split validation。")
        return

    score = result["spearman"]
    print(f"Model: {args.model_name}")
    print(f"STS-B split: {args.split}")
    print(f"Spearman correlation: {score:.4f}")
    print("Note: Spearman is scale-invariant; expected ~0.82 (unsup) / ~0.84 (sup) on validation with paper checkpoints.")

    if args.save_log:
        payload = {
            "timestamp": time.strftime("%Y-%m-%d %H:%M:%S"),
            "result": result,
        }
        with open(args.save_log, "w", encoding="utf-8") as f:
            json.dump(payload, f, ensure_ascii=False, indent=2)
        print(f"Saved log to {args.save_log}")


if __name__ == "__main__":
    main()
