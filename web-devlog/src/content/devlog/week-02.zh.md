---
week: 2
date: "2026年4月7日 - 4月13日"
title: "原理图、固件框架与机器学习数据策略"
status: "Completed"
summary: >
  本周我们完成了工程基础建设：Yutong 完成了带自定义封装的 KiCAD 原理图和 ESP32-S3 固件骨架，Lucia 则交付了初版 3D 外壳原型和完整的机器学习数据集调研报告。
credits:
  - name: Lucia
    initials: L
    tags:
      - CAD 建模
      - 机器学习数据集调研
  - name: Yutong
    initials: Y
    tags:
      - 原理图与 PCB
      - 固件框架
      - 开发日志
prior_week_progress:
  schematic-pcb: true
  cad-modeling: true
  firmware-framework: true
  ml-deliverable: partial
planned_next:
  - id: refine-cad-schematic
    label: 细化 CAD 与原理图
    description: 使用实际组件尺寸更新 3D 外壳；修订原理图以反映最终硬件配置（雾化器替换）。
  - id: wifi-firebase
    label: WiFi 与 Firebase
    description: 配置 ESP32-S3 的 WiFi 连接，并将模拟传感器数据推送至 Firebase 进行云端验证。
  - id: microphone-module
    label: 麦克风调试
    description: INMP441 到货后实现基本 I2S 音频采集；验证信号质量并流式传输采样数据。
  - id: atomizer-test
    label: 雾化器测试
    description: 通过 MOSFET 驱动验证超声波雾化器集成——确认稳定的雾化输出和开/关控制。
---

## Executive Summary

硬件仍在运输中——我们通过并行工程任务保持推进节奏。

- **KiCAD 原理图** — Yutong 为 XIAO ESP32-S3、INMP441 麦克风和 MT3608 从零手工绘制了自定义封装；完成了包含电源架构和引脚分配的完整系统原理图。
- **固件骨架** — 完成 `AuraSync.ino` 骨架搭建：非阻塞传感器循环、四状态机（IDLE → ML → ACTUATION → COOLDOWN）、I2S + BME680 + WiFi 初始化，全程零 `delay()` 调用。
- **3D 外壳原型** — Lucia 建立了早期阶段外壳模型，用于在确定 PCB 尺寸前验证空间布局：识别了水泵出口间隙、BME680 通风路径和 USB-C 接口位置等约束条件。
- **机器学习数据集调研** — 将四个公开数据集（ESC-50、AudioSet 及两个 Kaggle 室内空气质量数据集）映射到我们的两种感知模态；制定了混合预训练 + 微调策略。

---

## Pre-Flight Q&A

*下次演示前需要回答的导师问题。*

### Q1 · I2S 对于我们的传感器意味着什么？

**I²S**（Inter-IC Sound，集成电路间音频）是一种专为 IC 间传输 PCM 数字音频设计的 3 线串行总线。三条线路均为单向：

| 信号线 | 板载引脚 | 功能 |
|--------|---------|------|
| **BCLK** — 位时钟 | `D8` · GPIO 7 · `I2S_SCK` | 每个时钟脉冲传输一位。频率 = 采样率 × 位深 × 通道数。 |
| **WS** — 字选择 / LRCLK | `D9` · GPIO 8 · `I2S_WS` | LOW = 左声道；HIGH = 右声道。频率等于采样率（16 kHz）。INMP441 的 L/R 接 VDD，使用右声道（WS = HIGH）。 |
| **SD** — 串行数据 | `D10` · GPIO 9 · `I2S_SD` | PCM 音频位流，MSB 优先。 |

**为什么使用 I2S 而不是模拟麦克风？**
INMP441 在芯片内部将音频编码为数字位流，PCB 上传输的信号不受 MT3608 开关电源的 EMI 干扰。ESP32-S3 通过 DMA 直接将数据流读入 RAM，无需任何软件位操作，CPU 资源可完全用于机器学习推理。

**数据格式细节：** INMP441 输出的 24 位采样数据在 32 位 I2S 帧中左对齐。固件读取 32 位字并右移 8 位，还原有符号 24 位数值后再进行 DSP 处理。

---

### Q2 · 我们的系统每秒采集多少数据点？

这取决于传感器。由于硬件尚未到货，以下为*设计目标*——实际数值将在硬件调试时验证。

**BME680 — 环境传感器**

| 参数 | 数值 |
|------|------|
| 采样率 | **1 Hz**（每秒一次完整读数） |
| 每次读数的值 | 4 个：温度（°C）、湿度（%）、气压（hPa）、气体阻抗（Ω） |
| 每秒原始数据 | **4 个值** |
| 30 秒机器学习窗口 | ~30 组采样 → ~60 个派生梯度特征（Δhumidity/Δt、ΔVOC/Δt） |

采样率在固件中通过 `readBME680()` 的 1000 ms millis 节流设置，以适应 BME680 的自动气体加热周期。芯片内置一个微型（~0.3 mm²）片上电阻加热器，将 VOC 传感表面加热至约 320°C，持续约 150 ms——这完全由 Bosch BSEC/Arduino 驱动处理，无需手写加热器代码。加热器功耗约 16 mW，占空比 15%，对外壳无热风险。对于浴室设备，VOC 通道尤其有用：VOC 峰值叠加湿度正斜率是强有力的"淋浴开始"信号。固件注意事项：加热器可能对温度通道产生微小自热偏移；Bosch 建议在触发气体测量之前先读取温度和湿度——我们的非阻塞循环已经按此顺序处理。

**INMP441 — I2S 麦克风**

| 参数 | 数值 |
|------|------|
| 采样率 | **16,000 Hz（16 kHz）** |
| 位深（DMA 缓冲区） | 32 位帧（24 位有效） |
| 每秒原始数据 | ~64 KB——以约 32 ms DMA 帧处理；原始 PCM **不**大量存储 |
| 语音指令模式 | ~1 s 关键词窗口 → 16,000 个采样 ≈ **64 KB** 原始 PCM 缓冲区 → Edge Impulse 关键词识别模型 |
| 环境监测模式 | ~30 s 每帧 FFT 特征向量（原始音频每帧丢弃）→ 淋浴/环境分类器；**无大型 PCM 缓冲区** |

> 以上数据均为固件框架中的设计目标，将在传感器到货后进行实际验证。

---

## 1. 原理图与 PCB
<a id="schematic-pcb" style="display:block;height:0;overflow:hidden;scroll-margin-top:7rem"></a>

### 概述

AuraSync v1.0 完整系统原理图在 **KiCAD 9.0** 中绘制完成。由于我们使用的模块均无官方 KiCAD 库符号或封装，所有组件均手工绘制：

- **XIAO ESP32-S3** — 自定义符号，14 个用户可访问引脚均以焊盘名称和 GPIO 编号标注（例如 `GPIO5_A4_D4_SDA`）
- **INMP441 分线板** — 6 针符号：VDD、GND、WS、SCK、SD、L/R
- **MT3608 升压模块** — 4 针符号：VIN+、VIN−、VOUT+、VOUT−
- **N 沟道 MOSFET 驱动模块** — 4 针：Signal、V+、GND、Out+/Out−

### 关键设计决策

**电源架构：** 锂电池（标称 3.7V）接入 MT3608 升压转换器，升至稳定 5V 轨，为 MOSFET 驱动器和水泵供电。ESP32-S3 板载 3.3V LDO 为所有逻辑级外设（BME680、INMP441）供电。

**I2C 地址：** BME680 的 `SDO` 引脚接 GND，I2C 地址固定为 **0x76**。

**I2S 声道：** INMP441 的 `L/R` 引脚接 VDD（+3.3V），选择**右声道**（`WS = HIGH`）。固件 `channel_format` 相应设置为 `I2S_CHANNEL_FMT_ONLY_RIGHT`。

**引脚分配（XIAO ESP32-S3）：**

| 信号 | Arduino 引脚 | GPIO |
|------|------------|------|
| I2C SDA | D4 | GPIO 5 |
| I2C SCL | D5 | GPIO 6 |
| I2S BCLK | D8 | GPIO 7 |
| I2S LRCLK | D9 | GPIO 8 |
| I2S 数据 | D10 | GPIO 9 |
| 水泵信号 | D3 | GPIO 4 |

### 原理图

![AuraSync v1.0 系统原理图](images/devlog/schematic_v1.png)

*AuraSync v1.0 KiCAD 原理图——四个模块均包含自定义封装。*

---

## 2. CAD 建模与原型
<a id="cad-modeling" style="display:block;height:0;overflow:hidden;scroll-margin-top:7rem"></a>

### 初版 3D 原型

Lucia 在确定 PCB 尺寸之前，创建了早期阶段 3D 外壳原型，用于探索物理布局。该模型有两个目标：

1. **空间布局验证** — 确定香水储液罐和水泵相对于电子元件的位置，识别集成约束条件（水泵出口间隙、走线路径）。
2. **形态感知** — 在首次制造尝试之前，让团队对设备的物理尺感有直观认识。

原型的关键观察：

- 水泵出口方向要求储液罐与水泵同高或高于水泵，否则无法维持吸水引流。
- BME680 需要外露通风路径，以采样环境空气而非内部循环空气。
- XIAO ESP32-S3 的 USB-C 接口应保持外部可访问，以便烧录固件。

![AuraSync 外壳原型——正面视图](images/devlog/enclosure_1.png)

![AuraSync 外壳原型——背面面板与元件仓](images/devlog/enclosure_2.png)

### 计划改进

待 PCB 尺寸确定、雾化器模块到货（替换原水泵以实现雾化输出）后，外壳将根据精确安装约束和传感器通风槽公差重新建模。

---

## 3. 固件框架
<a id="firmware-framework" style="display:block;height:0;overflow:hidden;scroll-margin-top:7rem"></a>

### 架构

`AuraSync.ino` 固件骨架（`Code/AuraSync/AuraSync.ino`）实现了完全非阻塞的骨架结构：

**`setup()`**

- `Serial.begin(115200)`
- `PIN_PUMP` → OUTPUT，LOW（安全优先）
- `connectWiFi()` — 15 秒超时，离线回退
- `Wire.begin(GPIO5, GPIO6)` — BME680 的 I2C 接口
- `initBME680()` — 8×/2×/4× 过采样 + IIR 滤波器
- `initI2S()` — 16 kHz、32 位、右声道、DMA ×4

**`loop()` — 零 `delay()` 调用**

- `readBME680()` — millis 节流，1 Hz
- `readI2SAudio()` — 非阻塞 `i2s_read(timeout=0)`
- `updatePumpState()` — 通过 millis 比较实现 2 秒关泵
- `runStateMachine()` — IDLE → ML_PROCESSING → ACTUATION → COOLDOWN

### 状态机

使用 `enum SystemState` 和 `switch-case` 调度器实现四个状态：

| 状态 | 进入条件 | 退出条件 |
|------|---------|---------|
| `IDLE` | 默认 / 冷却结束 | 传感器斜率超过阈值 |
| `ML_PROCESSING` | 斜率触发 | 置信度 ≥ 70% → ACTUATION；否则 → IDLE |
| `ACTUATION` | 调用 `triggerPump()` | 2 秒后 → COOLDOWN |
| `COOLDOWN` | 水泵关闭 | 60 秒后 → IDLE |

### DSP 占位函数

三个 DSP 占位函数已存根并注释，用于后续 Edge Impulse 集成：

- `computeHumiditySlope()` — 返回 Δhumidity / Δt（%/s）
- `computeVOCSlope()` — 返回 Δgas_resistance / Δt（Ω/s）
- `analyzeAudioEnergy()` — 从 32 位 DMA 缓冲区计算 RMS；FFT 钩子已在注释中标注

### 非阻塞水泵控制

水泵 2 秒活跃期完全非阻塞。`triggerPump()` 设置 `pumpActive = true` 并记录 `pumpStartTime = millis()`。每次 `loop()` 调用时，`updatePumpState()` 检查 `millis() - pumpStartTime ≥ 2000` 并关闭 MOSFET——主循环中没有任何 `delay()`。

---

## 4. 机器学习数据集调研
<a id="ml-deliverable" style="display:block;height:0;overflow:hidden;scroll-margin-top:7rem"></a>

### 数据集调研

硬件运输期间，Lucia 进行了系统性的公开数据集调研，旨在在我们自己的录制数据可用之前，找到可以作为训练流程种子的数据源。

**音频模态（INMP441 麦克风）**

| 数据集 | 相关特征 | 用途 |
|--------|---------|------|
| [ESC-50](https://github.com/karoldvl/ESC-50) | 倒水声、雨声、滴水声、马桶冲水声 | 基础音频分类器；水事件检测的初始训练数据 |
| [AudioSet（谷歌）](https://research.google.com/audioset/) | 水龙头声、液体声、室内环境声 | 多样性增强；提升真实环境下的鲁棒性 |

**环境模态（BME680 传感器）**

| 数据集 | 相关特征 | 用途 |
|--------|---------|------|
| [室内空气质量数据集 – hemanthkarnati](https://www.kaggle.com/datasets/hemanthkarnati/indoor-air-quality-dataset) | 湿度、温度、气体/VOC、CO₂ | 学习正常与活跃模式；模拟 BME680 行为 |
| [IoT 室内空气质量 – khajaahmed1](https://www.kaggle.com/datasets/khajaahmed1/iot-indoor-air-quality) | 湿度、温度、空气质量指数 | 场景分类；检测状态转换 |

### 混合数据策略

现有数据集覆盖了相关模态，但不针对*具体场景*——没有任何数据集是在小型浴室环境中以我们特定的声学和 VOC 动态录制的。我们提出以下策略：

1. **阶段一（当前）：** 用 ESC-50 + AudioSet 预训练音频模型；用 Kaggle IAQ 数据集训练环境基线模型。
2. **阶段二（第 3-4 周）：** 硬件到货后，在真实浴室场景中采集带标注的录音，对阶段一模型进行领域特定微调。
3. **阶段三：** 将音频特征（FFT 频段）与环境梯度（ΔH/Δt、ΔVOC/Δt）合并为统一特征向量，输入 Edge Impulse 分类器。

### 核心洞察

> 淋浴不是单一传感器标签——它是**多信号的叠加**：湿度正斜率急剧上升 + 流水声能量 + 无 VOC 峰值。这种多模态融合正是区分我们系统与简单阈值触发器的关键，也决定了我们需要采用数据集组合策略。

正式流程演示幻灯片正在最终定稿，将于第 3 周演示。

---

## Next Steps

硬件预计下周到货，工作重心转向调试与集成：

| 完成 | 任务 | 说明 |
|:-:|---|---|
| ✅ | **细化 CAD 与原理图** | 原理图已更新，纳入 SPH0645 麦克风替换和 PIR 传感器添加。 |
| ✅ | **WiFi 与 Firebase** | Firebase 实时数据库连接成功；喷雾事件通过 NTP 时间戳写入日志；云端仪表盘已构建。 |
| ✅ | **麦克风调试** | SPH0645 I2S 麦克风正常运行；ESP-SR 语音识别唤醒词功能可用。 |
| ✅ | **雾化器测试** | HC-SR501 PIR 传感器集成完成；雾化器通过 2N2222 三极管实现存在感触发。 |
