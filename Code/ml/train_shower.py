#!/usr/bin/env python3
"""
Train shower event detection model (binary classification on 5-minute windows).

Model: 1D-CNN (PyTorch, GPU-accelerated)
       Falls back to sklearn MLP if PyTorch unavailable.
Input: Data/processed/shower_{train,val,test}_{X,y}.npy (from preprocess.py)

Usage:
    python train_shower.py
    python train_shower.py --epochs 100 --lr 5e-4
    python train_shower.py --sklearn   # use sklearn MLP (no GPU needed)
"""
import argparse
import json
import os

import numpy as np


PROC_DIR   = os.path.join(os.path.dirname(__file__), "..", "..", "Data", "processed")
MODELS_DIR = os.path.join(os.path.dirname(__file__), "..", "..", "Data", "models")


# ── Data Loading ──────────────────────────────────────────────────────────────

def load_npy_split(split: str):
    X = np.load(os.path.join(PROC_DIR, f"shower_{split}_X.npy")).astype(np.float32)
    y = np.load(os.path.join(PROC_DIR, f"shower_{split}_y.npy")).astype(np.float32)
    return X, y


# ── Data Augmentation ─────────────────────────────────────────────────────────

def augment_positives(X: np.ndarray, y: np.ndarray, copies: int = 4,
                      noise_std: float = 0.05, scale_range: tuple = (0.85, 1.15),
                      seed: int = 42) -> tuple:
    """
    Augment positive-class windows only (shower=1).
    Generates `copies` augmented versions per positive window using:
      - Gaussian jitter: adds small noise to mimic sensor variability
      - Magnitude scaling: randomly scales feature values to mimic
        different shower intensities and baseline levels
    Val/test sets should NOT be augmented — only training data.
    """
    rng = np.random.default_rng(seed)
    pos_mask = y == 1
    X_pos = X[pos_mask]

    aug_X, aug_y = [X], [y]
    for _ in range(copies):
        noise  = rng.normal(0, noise_std, size=X_pos.shape).astype(np.float32)
        scale  = rng.uniform(*scale_range, size=(len(X_pos), 1, 1)).astype(np.float32)
        X_aug  = X_pos * scale + noise
        aug_X.append(X_aug)
        aug_y.append(np.ones(len(X_aug), dtype=np.float32))

    return np.concatenate(aug_X), np.concatenate(aug_y)


# ── 1D-CNN (PyTorch) ─────────────────────────────────────────────────────────

def train_cnn(X_train, y_train, X_val, y_val, X_test, y_test,
              epochs=50, lr=1e-3, batch_size=32, aug_copies=4):
    import torch
    import torch.nn as nn
    import torch.nn.functional as F
    from torch.utils.data import DataLoader, TensorDataset

    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    print(f"Device: {device}")

    # Augment training positives only (val/test are never augmented)
    if aug_copies > 0 and y_train.sum() > 0:
        X_train, y_train = augment_positives(X_train, y_train, copies=aug_copies)
        pos = int(y_train.sum())
        neg = int((y_train == 0).sum())
        print(f"After augmentation: pos={pos}  neg={neg}  total={pos+neg}")

    n_features  = X_train.shape[2]
    window_size = X_train.shape[1]

    class ShowerCNN(nn.Module):
        def __init__(self):
            super().__init__()
            self.conv1 = nn.Conv1d(n_features, 32, kernel_size=5, padding=2)
            self.conv2 = nn.Conv1d(32, 64, kernel_size=3, padding=1)
            self.pool  = nn.AdaptiveAvgPool1d(8)
            self.fc1   = nn.Linear(64 * 8, 32)
            self.fc2   = nn.Linear(32, 1)
            self.drop  = nn.Dropout(0.3)

        def forward(self, x):
            x = x.permute(0, 2, 1)           # (B, features, window)
            x = F.relu(self.conv1(x))
            x = F.relu(self.conv2(x))
            x = self.pool(x).flatten(1)
            x = F.relu(self.fc1(self.drop(x)))
            return self.fc2(x).squeeze(-1)   # raw logit

    def make_loader(X, y, shuffle=True):
        ds = TensorDataset(torch.from_numpy(X), torch.from_numpy(y))
        return DataLoader(ds, batch_size=batch_size, shuffle=shuffle)

    train_loader = make_loader(X_train, y_train)
    val_loader   = make_loader(X_val,   y_val,   shuffle=False)
    test_loader  = make_loader(X_test,  y_test,  shuffle=False)

    model = ShowerCNN().to(device)
    pos_weight = torch.tensor([(y_train == 0).sum() / max(y_train.sum(), 1)]).to(device)
    criterion  = nn.BCEWithLogitsLoss(pos_weight=pos_weight)
    optimizer  = torch.optim.Adam(model.parameters(), lr=lr, weight_decay=1e-4)

    best_val_f1   = 0.0
    best_state    = None
    patience_left = 10

    for epoch in range(1, epochs + 1):
        model.train()
        total_loss = 0.0
        for X_b, y_b in train_loader:
            X_b, y_b = X_b.to(device), y_b.to(device)
            optimizer.zero_grad()
            loss = criterion(model(X_b), y_b)
            loss.backward()
            optimizer.step()
            total_loss += loss.item()

        val_f1 = eval_cnn(model, val_loader, device)
        print(f"Epoch {epoch:3d}/{epochs}  loss={total_loss/len(train_loader):.4f}  val_F1={val_f1:.4f}")

        if val_f1 > best_val_f1:
            best_val_f1 = val_f1
            best_state  = {k: v.cpu().clone() for k, v in model.state_dict().items()}
            patience_left = 10
        else:
            patience_left -= 1
            if patience_left == 0:
                print(f"Early stop at epoch {epoch}.")
                break

    # Load best weights
    model.load_state_dict({k: v.to(device) for k, v in best_state.items()})
    test_f1, threshold = tune_and_eval(model, val_loader, test_loader, device)

    return model, best_val_f1, test_f1, threshold


def eval_cnn(model, loader, device, threshold=0.5):
    """F1 on a DataLoader at given threshold."""
    import torch
    from sklearn.metrics import f1_score as sk_f1

    model.eval()
    all_logits, all_labels = [], []
    with torch.no_grad():
        for X_b, y_b in loader:
            logits = model(X_b.to(device)).cpu().numpy()
            all_logits.append(logits)
            all_labels.append(y_b.numpy())
    logits = np.concatenate(all_logits)
    labels = np.concatenate(all_labels).astype(int)
    probs  = 1 / (1 + np.exp(-logits))
    preds  = (probs >= threshold).astype(int)
    if labels.sum() == 0:
        return 0.0
    return sk_f1(labels, preds)


def tune_and_eval(model, val_loader, test_loader, device):
    """Sweep threshold on val, evaluate test at best threshold."""
    from sklearn.metrics import f1_score as sk_f1, classification_report
    import torch

    def get_preds(loader, thr):
        model.eval()
        logits_all, labels_all = [], []
        with torch.no_grad():
            for X_b, y_b in loader:
                logits_all.append(model(X_b.to(device)).cpu().numpy())
                labels_all.append(y_b.numpy())
        logits = np.concatenate(logits_all)
        labels = np.concatenate(labels_all).astype(int)
        probs  = 1 / (1 + np.exp(-logits))
        return (probs >= thr).astype(int), labels

    best_thr, best_f1 = 0.5, 0.0
    for thr in np.arange(0.1, 0.9, 0.05):
        preds, labels = get_preds(val_loader, thr)
        if labels.sum() == 0:
            continue
        f1 = sk_f1(labels, preds)
        if f1 > best_f1:
            best_f1, best_thr = f1, thr

    print(f"\nBest val threshold: {best_thr:.2f}  (val F1={best_f1:.4f})")
    test_preds, test_labels = get_preds(test_loader, best_thr)
    if test_labels.sum() > 0:
        test_f1 = sk_f1(test_labels, test_preds)
        print(f"Test F1 @ threshold {best_thr:.2f}: {test_f1:.4f}")
        print(classification_report(test_labels, test_preds,
                                    target_names=["no_shower", "shower"]))
    else:
        test_f1 = 0.0
        print("WARNING: No positive labels in test set — add more annotated sessions.")

    return test_f1, best_thr


# ── Sklearn MLP Fallback ──────────────────────────────────────────────────────

def train_sklearn_mlp(X_train, y_train, X_val, y_val, X_test, y_test):
    from sklearn.neural_network import MLPClassifier
    from sklearn.metrics import f1_score, classification_report
    import numpy as np

    N_train, W, F = X_train.shape
    X_tr = X_train.reshape(N_train, -1)
    X_vl = X_val.reshape(len(X_val), -1)
    X_ts = X_test.reshape(len(X_test), -1)

    pos_weight = (y_train == 0).sum() / max(y_train.sum(), 1)
    sample_w = np.where(y_train == 1, pos_weight, 1.0)

    mlp = MLPClassifier(hidden_layer_sizes=(128, 64), max_iter=300, random_state=42)
    mlp.fit(X_tr, y_train.astype(int), sample_weight=sample_w)

    val_f1  = f1_score(y_val.astype(int),  mlp.predict(X_vl))
    test_f1 = f1_score(y_test.astype(int), mlp.predict(X_ts))
    print(f"MLP  val F1={val_f1:.4f}  test F1={test_f1:.4f}")
    print(classification_report(y_test.astype(int), mlp.predict(X_ts),
                                target_names=["no_shower", "shower"]))
    return mlp, val_f1, test_f1


# ── Main ──────────────────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--epochs",  type=int,   default=50)
    parser.add_argument("--lr",      type=float, default=1e-3)
    parser.add_argument("--batch",   type=int,   default=32)
    parser.add_argument("--sklearn", action="store_true", help="Use sklearn MLP instead of PyTorch")
    args = parser.parse_args()

    os.makedirs(MODELS_DIR, exist_ok=True)

    for split in ("train", "val", "test"):
        path = os.path.join(PROC_DIR, f"shower_{split}_X.npy")
        if not os.path.exists(path):
            print(f"ERROR: {path} not found. Run preprocess.py first.")
            return

    X_train, y_train = load_npy_split("train")
    X_val,   y_val   = load_npy_split("val")
    X_test,  y_test  = load_npy_split("test")

    print(f"Train: {X_train.shape}  pos={int(y_train.sum())}  neg={int((y_train==0).sum())}")
    print(f"Val:   {X_val.shape}    pos={int(y_val.sum())}    neg={int((y_val==0).sum())}")
    print(f"Test:  {X_test.shape}   pos={int(y_test.sum())}   neg={int((y_test==0).sum())}")

    if y_train.sum() == 0:
        print("\nERROR: No positive shower windows in training set.")
        print("Add shower annotations to Data/shower_annotations.csv and re-run preprocess.py")
        return

    results_path = os.path.join(MODELS_DIR, "results.json")
    try:
        results = json.load(open(results_path))
    except FileNotFoundError:
        results = {}

    if args.sklearn:
        mlp, val_f1, test_f1 = train_sklearn_mlp(X_train, y_train, X_val, y_val, X_test, y_test)
        import joblib
        model_path = os.path.join(MODELS_DIR, "shower_mlp_v1.pkl")
        joblib.dump(mlp, model_path)
        print(f"Saved sklearn MLP → {model_path}")
        results["shower_mlp"] = {"val_f1": round(val_f1, 4), "test_f1": round(test_f1, 4)}
    else:
        try:
            import torch
        except ImportError:
            print("PyTorch not found. Re-run with --sklearn for CPU-only training.")
            return
        model, val_f1, test_f1, threshold = train_cnn(
            X_train, y_train, X_val, y_val, X_test, y_test,
            epochs=args.epochs, lr=args.lr, batch_size=args.batch,
        )
        model_path = os.path.join(MODELS_DIR, "shower_cnn_v1.pt")
        torch.save({
            "state_dict": model.state_dict(),
            "threshold":  float(threshold),
            "n_features": int(X_train.shape[2]),
            "window_size": int(X_train.shape[1]),
        }, model_path)
        print(f"\nSaved CNN checkpoint → {model_path}")
        results["shower_cnn"] = {"val_f1": round(val_f1, 4), "test_f1": round(test_f1, 4),
                                  "threshold": round(threshold, 3)}

    json.dump(results, open(results_path, "w"), indent=2)
    print(f"Results → {results_path}")


if __name__ == "__main__":
    main()
