---
week: 5
date: "2026年4月28日 - 5月4日"
title: "数据采集、ML 流水线、BSEC2 固件升级与应用重设计"
status: "In Progress"
show_next_steps: true
summary: >
  团队采集了约 3 天连续 BME680 数据（16 927 条读数），构建了完整端到端 ML 流水线：
  随机森林 IAQ 分类器（CV Macro F1 0.77 ± 0.17）和 1D-CNN 淋浴事件检测器
  （Val F1 0.77，AUC 0.94）。固件升级至 Bosch BSEC2 解决了多日气体阻抗基线漂移问题。
  Yutong 实现了完整的 Firebase 双向控制——应用通过 JSON 消息总线向 ESP32 发送指令，
  通过节点删除确认执行，并将应用重设计为 Apple 风格智能家居面板，
  包含实时传感器显示、冷却倒计时、设置同步、使用统计和推送通知。
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
      - Firebase 反向控制
      - 应用重设计
      - 开发日志
prior_week_progress:
  bme680-firmware: true
  voc-pattern-detection: "partial"
  voc-baseline: true
  firebase-reverse: true
planned_next:
  - id: shower-data-and-retrain
    label: 淋浴数据采集与 CNN 重训练
    description: "使用 BSEC2 采集 5 个以上淋浴会话并标注开始/结束时间（≥150 个正样本窗口），随后将 gas_norm 流水线替换为经标定的 iaq + iaq_accuracy ≥ 1 过滤器重训练 1D-CNN；目标 Val F1 ≥ 0.85。"
  - id: extreme-case-testing
    label: 极端 VOC 场景测试
    description: "香水、空气清新剂、烹饪 VOC——测试 IAQ 峰值幅度、恢复时间及分类器边缘情况（复合事件、高湿度基线天）。"
  - id: enclosure
    label: 中保真度外壳
    description: "设计并制作容纳全部元件（ESP32-S3、BME680、PIR、雾化片、电池）的中保真度外壳——Milestone 2 演示所需的无线独立形态。"
  - id: pcb
    label: PCB 设计与制作
    description: "将 ESP32-S3、INMP441、BME680、PIR、雾化 MOSFET、MT3608 升压及 LiPo 接口集成到单块 PCB；完成布线、验证封装、送厂打样。"
---

## Mentor Meeting

*本周与项目导师 Justin 再次进行了会议。*

<div class="mentor-card-embed"></div>

Justin 给出了五点具体建议：

**1 · ML 边缘情况覆盖**
构建机器学习模型时，需要考虑传感器在真实使用中可能遇到的各种极端情况，例如：有人进入但未如厕（只是拿东西）、多人连续使用、清洁剂或香皂（非如厕来源）引起的 VOC 变化，以及设备刚启动时不稳定的预热读数。需要设计系统性测试，验证模型在这些场景下不会误触发。

**2 · 应用远程提前喷雾**
当无人在卫生间时，用户应能提前通过手机应用触发喷雾——例如进入卫生间之前。我们待办中的 Firebase 反向控制功能正好对应这一需求；Justin 建议优先推进。

**3 · PCB 与外壳协同设计**
PCB 布局应与外壳设计同步进行，而不是事后调整。需提前规划：每个传感器的固定方式（螺丝孔、卡扣位置）、BME680 的通气开口（必须接触环境空气）、PIR 的朝向与视角范围，以及接口和走线位置不被外壳遮挡。

**4 · 换用更小的 PIR 传感器**
HC-SR501 体积较大，不适合紧凑外壳。Justin 建议换用更小的模块，例如 **AM312**，体积小得多，更适合最终产品形态。

> [AM312 迷你热释电 PIR（Amazon 链接）](https://www.amazon.com/HiLetgo-Pyroelectric-Sensor-Infrared-Detector/dp/B07RT7MK7C/ref=sr_1_5?crid=TWL9YZ1T5VSM&dib=eyJ2IjoiMSJ9.l1xKrNlnzEthz1oRjEpGYT8CihWAyuwJTb89TiNx1Mm0Q51JTMCSAW7ZHh4v0hPP7ZNXtp8_59dRTvwixmbeX0Fe14uw1TeO9mm5TWhNbvjUsYQBK4L_TxCijl69Q1IBpJyNwJ6iB3UO2rGH0YyvzX2LsYJolBoKuudWQIte7b8LyjgFtpjhw3ocRsv14HR4tn3-66SfWjp42oqY92pq0GpFVG_hWluqajOa1xAmJdHeq1MxVUAgvDG03wGdbeu5kcRwuPWostLJgfXAcxa2MvQyGkRoKlyLvXBw81cBqzs.NFvSE8Vvaa9xcc0Blp5dKBWsKA1565p8HRNywZMI6pA&dib_tag=se&keywords=AM312+Mini+Pyroelectric&qid=1777671054&sprefix=am312+mini+pyroelectric+%2Caps%2C145&sr=8-5)

**5 · 3.3V → 5V 升压方案**
超声波雾化片需要 5V 供电，而 ESP32-S3 工作在 3.3V。Justin 建议评估小型升压模块。我们手头已有 **MT3608**（已在 BOM 中），是非常合适的选择。他还推荐了 **XL6002** 作为紧凑型替代方案，适合直接集成到 PCB 上。

> [XL6002 升压模块（Amazon 链接）](https://www.amazon.com/EC-Buying-XL63020-3-3-XL63020-3-3V-Microcontroller/dp/B0D8T3J8QZ/ref=sxin_17_pa_sp_search_thematic_sspa?content-id=amzn1.sym.9a3e287f-4954-410d-ad08-8ae28dc40a36%3Aamzn1.sym.9a3e287f-4954-410d-ad08-8ae28dc40a36&crid=SHWVWJAWK9ND&cv_ct_cx=boost+convertor&keywords=boost+convertor&pd_rd_i=B0D8T3J8QZ&pd_rd_r=4bbd85b6-dcdf-462b-bb9f-4f481078cf7a&pd_rd_w=uSpOG&pd_rd_wg=Fsrx1&pf_rd_p=9a3e287f-4954-410d-ad08-8ae28dc40a36&pf_rd_r=G2JKQSXNVKTV496J0RCP&qid=1777670940&s=electronics&sbo=RZvfv%2F%2FHxDF%2BO5021pAnSA%3D%3D&sprefix=boost+convertor%2Celectronics%2C161&sr=1-1-6e60e730-e094-43e9-99e8-1a4854cd27ff-spons&aref=JRGHB5aJmx&sp_csd=d2lkZ2V0TmFtZT1zcF9zZWFyY2hfdGhlbWF0aWM&psc=1)

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

### 部署过程

为保护裸露的面包板电路不受浴室水汽和冷凝水的影响，整个电路在每次部署前均用**保鲜膜**进行了包裹处理——这是一种快速的原型保护方案，在多日无人值守运行中被证明切实有效。

![ESP32-S3 和 BME680 面包板电路用保鲜膜包裹做防水处理](images/devlog/water-proof.jpg "面包板电路用保鲜膜包裹，保护裸露器件免受浴室湿气和水汽影响")

数据采集分两个地点进行。我们首先在 **GIX 楼的卫生间**采集了一个下午的数据，建立初步的真实环境基线，并在箱子上贴上便利贴提示路人勿触碰设备。

![传感器部署在 GIX 楼卫生间，放置在纸箱上，便利贴写着"正在采集数据，请勿触碰"和"有问题请联系 Lucia / Yutong"](images/devlog/collecting-in-gix.jpg "GIX 楼首次实地部署——面包板放在洗手台纸箱上，附有告示便利贴")

随后 Lucia 将设备带回家，持续运行数日，采集了**数据集的主体部分**，包含日常生活中自然产生的 VOC 变化。

![传感器部署在家庭浴室洗手台上，保鲜膜包裹的面包板和 USB 线清晰可见](images/devlog/collecting-in-home.jpg "家庭浴室部署——多日连续数据采集，设备放置在洗手台上")

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

<a id="firebase-reverse" style="display:block;height:0;overflow:hidden;scroll-margin-top:7rem"></a>

## 4. Firebase 反向控制与应用重设计

### 双向指令协议

目标：应用向 ESP32 发送喷雾指令并获得确认——无需手机和设备在同一局域网，也无需维持持久的 WebSocket 连接。

**方案：以 Firebase RTDB 为一次性消息总线。** 应用向 `/commands/action` 写入 JSON 指令；ESP32 每 3 秒轮询、读取并执行，随后调用 `deleteNode` 清除该路径。Firebase 将删除操作以 `null` 快照的形式传播给应用的 `onValue` 监听器——这是一种轻量级的拉取式确认机制，往返延迟约 1 秒。

```
应用写入  →  /commands/action:
             { action: "spray", source: "app",
               sprayDurationS: 5, requestedAt: 1746354000000 }

ESP32 每 3 s 轮询  →  读取 JSON  →  执行喷雾
ESP32  →  deleteNode("/commands/action")

应用 onValue:  snap.val() === null  →  指令已确认 ✓
```

**开发过程中修复的 Bug：** 原始 `pollFirebaseCommands` 使用 `getString` 读取节点（对 JSON 对象会静默失败）并通过 `setString(..., "")` 确认（设为空字符串 `""` 而非 `null`，但应用检测的是 `null`）。已修正：`getString` → `getJSON` + `FirebaseJsonData`，确认方式 → `deleteNode`。

<div class="app-debug-photos-embed"></div>

应用侧设有 10 秒超时，无确认则转为 `pending → error` 状态，3 秒后自动重置为 `idle`。

指令中包含 `sprayDurationS` 字段。固件读取后为该次喷雾覆盖雾化时长——应用触发的喷雾可独立请求 1–30 秒的任意时长，不受存储设置影响。

### 传感器与状态反馈路径

为实现设备到应用的反馈闭环，固件现在将传感器状态和冷却时间写入 Firebase：

| 路径 | 写入方 | 内容 |
|---|---|---|
| `/sensors/latest` | ESP32 每 5 s | `temp_c`、`humidity_pct`、`gas_ohm`、`heater_ok`、`context`、`updatedAt` |
| `/status/cooldownEndsAt` | ESP32 状态变化时 | 冷却结束时的 Unix 毫秒时间戳；空闲时为 `0` |
| `/settings/autoSprayEnabled` | 应用 | `true`/`false`——在固件侧禁用 P2/P3 传感器触发 |
| `/settings/sprayDurationS` | 应用 | 默认雾化时长（1–30 s）；固件每 10 s 重新读取 |

### 移动端应用重设计

双向指令通道跑通后，应用从喷雾历史查看器重设计为完整的智能家居控制面板，采用 Apple 风格的深色/浅色双主题。

**主题系统：** `useColorScheme()` 检测系统偏好。`ThemeCtx` React Context 持有当前色板 `C` 和经 `useMemo` 缓存的 `StyleSheet` `s`——所有组件调用 `useTheme()` 而非接受属性传参。`StyleSheet` 仅在配色方案切换时重建。

**新增 UI 模块：**

<div class="app-ui-screenshots-embed"></div>

| 模块 | 显示内容 |
|---|---|
| **喷雾按钮** | 168 px 圆形渐变按钮；冷却中变灰；待确认时橙色脉动 |
| **冷却倒计时条** | 设备卡片内的动画进度条，根据 `/status/cooldownEndsAt` 倒计 |
| **传感器卡片** | 实时空气质量（气体 kΩ，颜色分级 Good / Moderate / Poor）、温度、湿度、情境标签（空闲 / 运动 / 喷雾中 / 冷却中） |
| **设置卡片** | 自动喷雾开关（Switch → `/settings/autoSprayEnabled`）和时长步进器（− / + 按钮，1–30 s → `/settings/sprayDurationS`） |
| **用量卡片** | 今日喷雾次数、触发类型分类（彩色标签）、累计储液估算（剩余 ml / 30 ml） |
| **推送通知** | 通过 `expo-notifications` 在 Firebase 检测到非应用触发喷雾（trigger ≠ `app`）时发送本地通知 |

## Next Steps

| 完成 | 任务 | 说明 |
|:-:|---|---|
| <input type="checkbox" /> | **淋浴数据采集与 CNN 重训练** | 使用 BSEC2 采集 5 个以上淋浴会话并标注开始/结束时间（≥150 个正样本窗口）；将 `gas_norm` 替换为经标定的 `iaq` + `iaq_accuracy ≥ 1` 重训练 1D-CNN；目标 Val F1 ≥ 0.85。 |
| <input type="checkbox" /> | **极端 VOC 场景测试** | 香水、空气清新剂、烹饪 VOC——测试 IAQ 峰值幅度、恢复时间及分类器边缘情况。 |
| <input type="checkbox" /> | **中保真度外壳** | 设计并制作容纳全部元件（ESP32-S3、BME680、PIR、雾化片、电池）的中保真度外壳——Milestone 2 演示所需的无线独立形态。 |
| <input type="checkbox" /> | **PCB 设计与制作** | 将 ESP32-S3、INMP441、BME680、PIR、MOSFET、MT3608 升压及 LiPo 接口集成到单块 PCB；布线、验证封装、送厂打样。 |
