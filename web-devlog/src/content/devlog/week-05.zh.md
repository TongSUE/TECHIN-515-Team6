---
week: 5
date: "2026年4月28日 - 5月4日"
title: "数据采集、首个 ML 流水线与 BSEC2 固件升级"
status: "In Progress"
show_next_steps: true
summary: >
  团队从家庭浴室采集了约 3 天的连续 BME680 数据（14 个会话，10 000+ 条读数，10 秒间隔），
  并构建了完整的端到端 ML 流水线：随机森林 IAQ 分类器（Macro F1 0.77）和 1D-CNN 淋浴事件检测器
  （Val F1 0.77，AUC 0.94）。一个关键发现——强 VOC 暴露后原始气体阻抗基线发生永久漂移——
  推动了固件从 Adafruit BME680 驱动升级至 Bosch BSEC2，后者提供自标定 IAQ 指数（0–500），
  无需手动归一化即可应对多日漂移。
credits:
  - name: Lucia
    initials: L
    tags:
      - 数据采集
      - ML 流水线
      - BSEC2 固件
  - name: Yutong
    initials: Y
    tags:
      - 移动端应用
      - 开发日志
prior_week_progress:
  bme680-firmware: true
  voc-pattern-detection: "partial"
  voc-baseline: true
  firebase-reverse: false
planned_next:
  - id: annotated-shower-data
    label: 带标注的淋浴数据采集
    description: "使用 BSEC2 采集 5 个以上淋浴会话，手动标注开始/结束时间并追加到 shower_annotations.csv——目标：≥150 个正样本窗口用于重训练。"
  - id: retrain-shower-model
    label: 用 BSEC2 数据重训练淋浴 CNN
    description: 将 gas_norm 流水线替换为经标定的 iaq + iaq_accuracy ≥ 1 过滤器；重训练 1D-CNN；目标：在正式 held-out 测试集上 Val F1 ≥ 0.85。
  - id: firebase-reverse
    label: Firebase 反向控制
    description: "应用向 /commands/action 写入指令；ESP32 每 3 秒轮询、执行并清除节点——无需 WebSocket 的双向控制。"
  - id: extreme-case-testing
    label: 极端 VOC 场景测试
    description: "香水、空气清新剂、清洁产品——测试 IAQ 峰值幅度、恢复时间，以及分类器的边缘情况（复合事件、高湿度基线天）。"
---

## Mentor Meeting

*本周与项目导师再次进行了会议。*

<div class="mentor-card-embed"></div>

[TODO — 填写导师会议记录]

<div class="special-thanks-card-embed"></div>

## 执行摘要

本周三条并行主线，均围绕"从原始传感器数据到训练好的模型"这一闭环展开。

- **数据采集** — Lucia 将 ESP32-S3 + BME680 部署在家庭浴室，采集了约 3 天的连续数据：从 Firebase 拉取 14 个会话，10 个通过预处理（16 927 条稳定读数，10 秒间隔）。
- **ML 流水线** — 从原始 Firebase 数据到两个训练完毕的模型：随机森林 IAQ 分类器（CV Macro F1 **0.77 ± 0.17**，5 折 GroupKFold）和 1D-CNN 淋浴事件检测器（Val F1 **0.77**，精确率 **0.97**，ROC-AUC **0.94**）。
- **BSEC2 固件升级** — 气体阻抗漂移的关键发现推动了固件升级至 Bosch BSEC2 库，该库输出自标定 IAQ 指数（0–500），无需手动归一化即可应对多日漂移。

<a id="data-collection" style="display:block;height:0;overflow:hidden;scroll-margin-top:7rem"></a>

## 1. 数据采集

Seeed XIAO ESP32-S3 + BME680 传感器部署于家庭浴室，采集了约 **3 天的连续数据**（西雅图时间 4 月 29 日–5 月 2 日）。从 Firebase 拉取 14 个会话，10 个预处理成功（4 个因 NTP 时间戳损坏被丢弃），共 **16 927 条稳定读数**，以 10 秒为间隔上传至 Firebase Realtime Database。

| 数据集划分 | 会话数 | 读数数 | 标注淋浴次数 |
|---|---|---|---|
| 训练集 | 6 | 9 184 | 1 |
| 验证集 | 1 | 1 461 | 2 |
| 测试集 | 2 | 6 046 | 0 |

> 数据划分在会话级别进行，而非读数级别，以防止连续时序数据的信息泄露。

每条读数包含：`temp_c`、`humidity_pct`、`pressure_hpa`、`gas_ohm`、`elapsed_s`、`unix_ms`、`iso`、`heater_stable`。

### 关键发现——气体基线漂移

在学校喷洒强力 VOC 激活剂后，`gas_ohm` 基线从约 50 kΩ 永久漂移至约 30 kΩ，此后缓慢恢复，历时数日。因此，直接使用原始气体阻抗值作为 ML 特征在跨会话情况下不可靠——这促使了第 2 阶段的归一化方法和第 3 阶段的 BSEC2 升级。

<a id="ml-pipeline" style="display:block;height:0;overflow:hidden;scroll-margin-top:7rem"></a>

## 2. 首个 ML 流水线

从 Firebase 数据到训练好的模型，构建了完整的端到端 ML 流水线。

### 数据预处理

所有会话通过 `fetch_firebase.py` 从 Firebase 导出为 CSV。`heater_stable=False`（每个会话前约 120 秒）的读数被丢弃。为应对气体阻抗基线漂移，采用了**滑动窗口基线归一化**：

$$\text{gas\_norm}_t = \frac{\text{gas\_ohm}_t - \text{baseline}_t}{\text{baseline}_t}, \quad \text{baseline}_t = \max(\text{gas\_ohm}_{t-120:t})$$

20 分钟滑动最大值窗口足够长，可在淋浴事件期间保持稳定而不被污染。下图展示了一个 9 小时训练会话：`gas_ohm` 在整晚随传感器自校准缓慢上升，而 `gas_norm` 在清洁空气段保持接近零值，仅在真实事件期间出现负值尖峰。

![session 20260502-082315 的 gas_ohm 与 gas_norm 对比——9 小时过夜浴室数据，展示归一化信号如何在原始阻抗漂移时保持稳定](images/devlog/ml_gas_norm_session.png "上图：原始气体阻抗（Ω）随传感器过夜自校准缓慢上升。下图：gas_norm 基线归一化信号，事件之间接近零值，异味事件期间出现负值尖峰")

每条读数共构建 **8 个特征**：

| 特征 | 说明 |
|---|---|
| `temp_c` | 原始温度（°C） |
| `humidity_pct` | 原始湿度（%） |
| `gas_norm` | 基线归一化气体阻抗（相对值） |
| `gas_min_10m` | `gas_norm` 的 10 分钟滚动最小值 |
| `gas_delta_5m` | `gas_norm` 的 5 分钟变化率 |
| `humidity_max_10m` | 湿度的 10 分钟滚动最大值 |
| `humidity_delta_5m` | 湿度的 5 分钟变化率 |
| `temp_delta_5m` | 温度的 5 分钟变化率 |
| `hour_sin`、`hour_cos` | 一天中时刻的循环编码 |

> 滚动统计捕捉趋势方向；正弦/余弦时间特征允许模型区分清晨与傍晚的基线差异，同时避免将小时视为线性特征。

**IAQ 标签**通过规则分配（无手动标注）：
- **Good（良好）**：`gas_norm > −0.15` 且 `humidity < 65 %` 且 `temp < 27 °C`
- **Poor（较差）**：`gas_norm < −0.40` 或 `humidity > 80 %`
- **Moderate（一般）**：其余情况

数据集组成：**15 964 Good（96.5 %）** / **473 Moderate（2.9 %）** / **110 Poor（0.7 %）**。

### 任务一——IAQ 分类（Good / Moderate / Poor）

| | |
|---|---|
| **模型** | 随机森林，`n_estimators=200`，`max_depth=10`，`class_weight='balanced'` |
| **验证方法** | 按会话的 5 折 GroupKFold 交叉验证——防止连续时序数据泄露 |
| **CV Macro F1** | **0.771 ± 0.165** |
| **测试集 Macro F1** | **0.667**（测试会话中无 Poor 样本） |

下图展示各折 Macro F1 的柱状图。第 1 折达到 1.0（验证折恰好包含类别均衡的样本）；第 2 折仅 0.58，因为其验证会话中 Moderate/Poor 读数极少。面对如此严重的类别不平衡，GroupKFold 折间方差属正常现象。

![IAQ 随机森林 5 折 GroupKFold 交叉验证结果——各折 Macro F1 柱状图，含均值与 ±1 std 带](images/devlog/ml_iaq_cv.png "5 折 GroupKFold 交叉验证：F1 = [1.00, 0.58, 0.67, 0.67, 0.94]，均值 0.77 ± 0.17")

混淆矩阵（测试集）显示 Good 与 Moderate 之间分类完美——分类器从未混淆两者，但测试集中没有 Poor 样本。

![IAQ 随机森林测试集混淆矩阵——Good 1178 正确，Moderate 28 正确，Poor 类样本不存在](images/devlog/ml_iaq_confusion.png "测试集：1178 个 Good 正确分类，28 个 Moderate 正确分类。Poor 类在测试会话中不存在。")

特征重要性验证了领域知识：`gas_norm` 占分裂增益的 **36 %**，其次是滚动统计特征（`gas_min_10m`、`gas_delta_5m`）。时间特征（`hour_sin`）排第 4，反映出傍晚湿度基线的可预测规律性上升。

![RF 特征重要性（Top 8）——gas_norm 以 0.36 居首，其次是 gas_min_10m（0.18）和 gas_delta_5m（0.12）](images/devlog/ml_iaq_features.png "Top-8 特征重要性：gas_norm 0.36 > gas_min_10m 0.18 > gas_delta_5m 0.12 > hour_sin 0.09 > humidity_pct 0.09 > humidity_max_10m 0.06")

### 任务二——淋浴事件检测

**方法**：滑动窗口二分类——将每个 5 分钟窗口（30 条读数）分类为"淋浴中"或"非淋浴"。步长 50 秒（5 条读数），窗口大量重叠，使检测器能在一个步长内感知事件开始。

**CNN 架构**（PyTorch，在 NVIDIA RTX 4060 Laptop GPU 上训练）：

![淋浴检测 1D-CNN 架构图——Input 30×6 → Conv1d 6→32 → ReLU → Conv1d 32→64 → ReLU → AdaptiveAvgPool1d → Linear 512→32 → sigmoid 输出](images/devlog/ml_cnn_arch.png "架构：Input(30×6) → Conv1d(k=5, 32通道) → Conv1d(k=3, 64通道) → AvgPool(8) → FC(512→32) → FC(32→1, sigmoid)。最终层前 Dropout 0.3。")

| | 训练集 | 验证集 |
|---|---|---|
| **总窗口数** | 1 831 | 285 |
| **淋浴（正样本）** | 96 | 115 |
| **非淋浴** | 1 735 | 170 |

训练时对正样本窗口进行 4 倍数据增强（高斯抖动 σ=0.05 + 幅度缩放 ±10%），以部分弥补正样本极度稀缺的问题。验证集中淋浴窗口比例相对更高，因为标注的验证会话横跨两个淋浴事件。

**阈值 = 0.70 时的结果：**

![1D-CNN 淋浴检测各类别精确率、召回率和 F1——淋浴类精确率 0.97，召回率 0.63，F1 0.77；非淋浴类精确率 0.80，召回率 0.99，F1 0.88](images/devlog/ml_shower_report.png "验证集（285 个窗口）：淋浴精确率=0.97，召回率=0.63，F1=0.77（n=115）。非淋浴精确率=0.80，召回率=0.99，F1=0.88（n=170）。准确率=85%。")

高精确率（0.97）意味着模型标记为淋浴的窗口几乎全部是真实淋浴。较低的召回率（0.63）意味着模型会遗漏部分淋浴窗口——对于我们的使用场景，这是更安全的失败模式（漏喷比误喷的干扰更小）。

| 指标 | 值 |
|---|---|
| Val F1（淋浴类） | **0.755** |
| Val 准确率 | **85 %** |
| ROC-AUC | **0.94** |
| Test F1 | 0.0（测试会话无淋浴标注，测试集暂无法评估） |

**局限性**：目前仅有 3 个标注淋浴事件（增强前 96 个正样本窗口）。Test F1 为 0.0 反映的是测试会话中缺少淋浴标注，而非模型退化——需要采集并标注 5 个以上淋浴会话才能获得可信的泛化性评估。

<a id="bsec2-firmware" style="display:block;height:0;overflow:hidden;scroll-margin-top:7rem"></a>

## 3. BSEC2 固件升级

### 问题

手动 20 分钟滑动最大值基线无法应对多日漂移。根本解决方案需要在固件层面由专业校准算法管理传感器基线。

### 方案：Bosch BSEC2

固件从 Adafruit BME680 驱动升级至 **Bosch-BSEC2-Library**（兼容 ESP32-S3）。BSEC2 同时运行短期和长期背景校准模型，输出自标定的 **IAQ 指数（0–500）**，环境无关且免手动归一化。

### 新增 Firebase 字段

| 字段 | 说明 |
|---|---|
| `iaq` | 经校准的 IAQ 指数，0–500 |
| `iaq_accuracy` | 校准质量：0 = 不可靠 → 3 = 完全校准 |
| `temp_c` | 热源补偿后温度 |
| `humidity_pct` | 热源补偿后湿度 |

> `static_iaq`、`co2_eq_ppm`、`breath_voc_ppm` 需要 BSEC2 Extended（付费版）。三者均由 `gas_ohm` 派生——省略后 ML 不损失任何独立信息。

### 部署过程中的问题与解决

| 问题 | 解决方案 |
|---|---|
| ESP32-S3 缺少 `libalgobsec` | 切换至 Bosch-BSEC2-Library（内含 S3 预编译二进制） |
| 中文用户名路径导致链接器崩溃 | 在 `platformio.ini` 中设置 `build_dir = C:/.pio_build/VOCLogger` |
| `status=14`（不支持的 BSEC2 输出） | 从订阅列表中移除 Extended 专属输出字段 |
| 无 PC 连接时串口上传阻塞 | 添加 `Serial.setTxTimeoutMs(0)`——非阻塞 USB CDC |

### 当前部署状态

- 传感器已部署于浴室，每 10 秒上传一次，通过外接电源持续无头运行
- 多 WiFi：自动在 UW MPSK → 家庭网络之间切换
- BSEC2 校准状态保存至 NVS——断电后恢复
- 冷启动时 `iaq_accuracy = 0`；约 30 分钟后预计 ≥ 1，约 4 天后达到完全校准（3）

## Next Steps

| 完成 | 任务 | 说明 |
|:-:|---|---|
| <input type="checkbox" /> | **带标注的淋浴数据采集** | 使用 BSEC2 采集 5 个以上淋浴会话，标注开始/结束时间，追加到 `shower_annotations.csv`——目标 ≥ 150 个正样本窗口。 |
| <input type="checkbox" /> | **用 BSEC2 数据重训练淋浴 CNN** | 将 `gas_norm` 流水线替换为 `iaq` + `iaq_accuracy ≥ 1` 过滤；重训练 1D-CNN；目标 Val F1 ≥ 0.85。 |
| <input type="checkbox" /> | **Firebase 反向控制** | 应用向 `/commands/action` 写入指令；ESP32 每 3 秒轮询、执行并清除——无需 WebSocket 的双向控制。 |
| <input type="checkbox" /> | **极端 VOC 场景测试** | 香水、空气清新剂、烹饪 VOC——测试 IAQ 峰值幅度、恢复时间，以及分类器的边缘情况。 |
