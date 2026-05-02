# AuraSync Team 6 — Project Context

## 项目概述
AuraSync 是一个智能卫生间空气质量监测 + 自动喷香系统。
- **硬件**：Seeed XIAO ESP32-S3 + BME680 传感器，部署在卫生间
- **数据**：每 10 秒采集一次，实时上传 Firebase
- **ML 目标**：洗澡事件检测 + 室内空气质量分类（Good/Moderate/Poor）

## 硬件配置
- Board: Seeed XIAO ESP32-S3
- Sensor: Bosch BME680（I2C，SDA=GPIO5, SCL=GPIO6）
- LED: GPIO21（慢闪=正常，快闪=错误）
- 固件路径: `Code/VOCLogger/src/main.cpp`

## Firebase 配置
- Database URL: `https://aurasync-team6-default-rtdb.firebaseio.com/`
- 数据路径: `/voc_dataset/sessions/<session_id>/readings/<push_id>`
- Session ID 格式: `YYYYMMDD-HHMMSS`（UTC 时间）
- 每条 reading 字段: `temp_c`, `humidity_pct`, `pressure_hpa`, `gas_ohm`, `elapsed_s`, `iso`, `unix_ms`, `heater_stable`
- 凭据在 `Code/VOCLogger/src/secrets.h`（已 gitignore）

## 数据现状
- 时间戳全部是 **UTC**（西雅图本地时间 = UTC - 7）
- `gas_ohm` 基线约 **30k Ω**（曾喷强 VOC 导致基线漂移，原来约 50k+）
- **不能用 gas_ohm 绝对值**训练，要用相对基线的变化量（滑动基线归一化）
- `heater_stable=false` 的前 120 秒数据（传感器预热期）建议过滤掉

## 已修复的 Bug
1. **unix_ms 溢出**：`(int)(now * 1000LL)` → `(double)now * 1000.0`
2. **WiFi 重试**：连接失败最多重试 3 次，每次 20 秒超时
3. **NTP 重试**：同步失败最多重试 3 次，每次 15 秒超时
4. **Firebase 自动重启**：连续 5 次 push 失败后 `ESP.restart()`
5. **历史 unix_ms 修复**：用 `Code/fix_unix_ms.py` 从 iso 字段反推已修正

## 现有 Python 脚本
- `Code/plot_voc.py` — 从 Firebase 拉取指定 session 数据并画图
- `Code/fix_unix_ms.py` — 修复 Firebase 中负数 unix_ms
- `Code/requirements.txt` — Python 依赖（不含 PyTorch，需单独安装 GPU 版）

## ML 目标与数据集

### 任务 1：洗澡事件检测
- 特征信号：humidity 急速上升、temperature 上升、gas_ohm 下降
- 需要手动标注洗澡时间（记录 UTC 开始/结束时间戳）
- 公开数据集参考：
  - **SDHAR-HOME**（有 Shower 标签）: https://github.com/raugom13/SDHAR-HOME-A-Sensor-Dataset-for-Human-Activity-Recognition-at-Home
  - **E-care@home**（浴室 T+H 数据）: https://data.mendeley.com/datasets/t9n68ykfk3/1

### 任务 2：空气质量分类（Good/Moderate/Poor）
- 主要特征：gas_ohm（相对变化）、humidity、temperature
- 公开数据集参考：
  - **UCI Gas Sensors for Home Activity Monitoring**（MOX 传感器，原理同 BME680）: https://archive.ics.uci.edu/dataset/362/gas+sensors+for+home+activity+monitoring
  - **UCI Single Elder Home Gas**: https://archive.ics.uci.edu/dataset/799/single+elder+home+monitoring+gas+and+position

## Windows ML 环境设置
```bash
# 创建 conda 环境
conda create -n aursync-ml python=3.11
conda activate aursync-ml

# 安装 PyTorch（GPU，根据实际 CUDA 版本调整）
# 先运行 nvidia-smi 确认 CUDA 版本
conda install pytorch torchvision torchaudio pytorch-cuda=12.1 -c pytorch -c nvidia

# 安装其余依赖
pip install -r Code/requirements.txt

# 验证 GPU
python -c "import torch; print(torch.cuda.is_available()); print(torch.cuda.get_device_name(0))"
```

## 下一步 ML 任务
- [ ] `Code/ml/fetch_firebase.py` — 导出所有 session 为 CSV
- [ ] `Code/ml/preprocess.py` — 滑动基线归一化、洗澡事件标注、数据对齐
- [ ] `Code/ml/train_shower.py` — 洗澡检测模型（建议 LSTM 或 1D-CNN）
- [ ] `Code/ml/train_iaq.py` — 空气质量分类（建议 Random Forest 或 MLP）

## 注意事项
- Kaggle 的两个数据集（第一个和 IoT Indoor AQ）传感器与 BME680 不兼容，不建议用
- 所有图都在 VS Code 中用 Jupyter Notebook 开发，conda 环境选 `aursync-ml`
- 公开数据集下载后放 `Data/` 目录（已 gitignore 大文件）
