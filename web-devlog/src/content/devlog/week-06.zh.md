---
week: 6
date: "2026年5月5日 - 5月11日"
title: "ML 端侧推理、外壳 v2、PCB v1 与 Firebase 验证"
status: "Completed"
show_next_steps: true
summary: >
  本周四条并行主线同步推进。Lucia 将训练好的 IAQ MLP 和淋浴 CNN 权重导出为
  C 浮点数组并集成进 AuraSync 固件——设备现可完全在芯片上完成空气质量分类
  和淋浴事件检测，无需云端推理。Firebase 反向控制回路完成端到端调试与验证，
  往返延迟约 1 秒。外壳从矩形盒体重新设计为圆柱形两段卡扣结构并用 PLA 打印。
  Yutong 设计了圆形 PCB（R = 45 mm），在 GIX LPKF 铣床上完成打样，
  并完成了 Milestone 2 幻灯片。
credits:
  - name: Lucia
    initials: L
    tags:
      - ML 固件集成
      - 外壳 v2
      - Milestone 2 幻灯片
  - name: Yutong
    initials: Y
    tags:
      - PCB 设计
      - Milestone 2 幻灯片
      - 开发日志
prior_week_progress:
  shower-data-and-retrain: true
  extreme-case-testing: "partial"
  enclosure: true
  pcb: true
planned_next:
  - id: pcb-finalize
    label: PCB 最终焊接与测试
    description: "完成 PCB v1 通电测试——LiPo + MT3608 供电，验证所有 GPIO 接线，确认无短路。根据发现的布线或间距问题打样并焊接 PCB v2。"
  - id: enclosure-lid
    label: 外壳上盖
    description: "以硅胶模具翻模透明树脂上盖（A+B 双组分）。3D 打印母模的层纹肌理天然形成磨砂质感，无需后处理。"
  - id: enclosure-base
    label: 外壳下底座
    description: "完成下底座建模并切片，使用 SLA 树脂打印机打印。底座需容纳 PCB、电池、传感器和雾化片，并与上盖的卡扣接口精确对齐。"
  - id: system-integration
    label: 整机系统集成测试
    description: "所有传感器 + ML 触发器 + Firebase + 应用同时运行，在真实条件下验证完整流程：PIR 唤醒 → ML 事件检测 → 喷雾执行 → 冷却生效 → 应用状态实时同步。"
---

## 执行摘要

本周四条并行主线。

- **ML 端侧推理** — Lucia 将训练好的模型权重导出为 C 浮点数组并集成进 AuraSync 固件。设备现在完全在芯片上运行 IAQ 分类和淋浴检测，无需云端步骤。
- **Firebase 验证** — 反向控制回路（应用 → ESP32 → 执行 → 确认）完成端到端调试与验证，往返延迟约 1 秒。
- **外壳 v2** — 从矩形盒体重新设计为圆柱形两段卡扣结构，PLA 打印完成，两段拼合与分离均顺畅。
- **PCB v1** — Yutong 设计了使用 JST 接插件封装的圆形 PCB（R = 45 mm），在 GIX LPKF 铣床上完成打样，并已部分焊接。

<a id="ml-inference" style="display:block;height:0;overflow:hidden;scroll-margin-top:7rem"></a>

## 1. ML 端侧推理

### 模型导出

Lucia 使用自定义导出脚本将训练好的 Python 模型转换为 C 浮点数组，并将三个头文件加入 AuraSync 项目目录：

| 文件 | 内容 |
|---|---|
| `iaq_model.h` | IAQ MLP：StandardScaler 参数 + 两个隐藏层（64 → 32）权重矩阵 + 3 类 softmax 输出（Good / Moderate / Poor） |
| `shower_model.h` | 淋浴 1D-CNN：全部卷积、池化和全连接层权重数组 |
| `feature_buffer.h` | 120 项环形缓冲区（20 分钟窗口）+ `fb_push()`、`computeIAQFeatures()`、`computeShowerWindow()` |

环形缓冲区每 9–10 秒存入一条 BSEC2 LP 采样。特征工程完全在头文件函数内完成，与训练流水线完全对应——相同的 5 分钟差分计算、相同的 10 分钟滚动统计、相同的 StandardScaler 参数。

### 固件集成

AuraSync 状态机现在在每次 BSEC2 LP 回调时执行 ML 推理：

1. `fb_push()` 将新读数（温度、湿度、IAQ 指数）存入环形缓冲区。
2. 缓冲区满 60 条后，`computeIAQFeatures()` 构建 10 维特征向量，IAQ MLP 分类空气质量（Good / Moderate / Poor）。
3. 缓冲区满 30 条后，`computeShowerWindow()` 构建 30×6 归一化窗口，淋浴 CNN 输出概率值。
4. 淋浴概率超过 0.65 时，状态机切换至 SPRAYING 状态。

IAQ 精度门控防止 BSEC2 预热期间的误分类：冷启动后约 30 分钟内，`iaq_accuracy < 1` 的读数不参与分类。

### 第二轮结果（BSEC2 数据）

从原始 `gas_ohm` + 滚动归一化切换到 BSEC2 标定 IAQ 指数后，会话间 IAQ 方差从 **±0.165** 压缩至 **±0.012**——特征稳定性提升约 14 倍。

| 模型 | 指标 | 第一轮 | 第二轮 |
|---|---|---|---|
| IAQ MLP | CV Macro F1 方差 | ±0.165 | ±0.012 |
| 淋浴 CNN | Val F1 | 0.77 | **0.902** |
| 淋浴 CNN | ROC-AUC | 0.94 | 0.94 |

淋浴 CNN val F1 = 0.902，超过第 5 周设定的 ≥ 0.85 目标。

<a id="firebase-reverse" style="display:block;height:0;overflow:hidden;scroll-margin-top:7rem"></a>

## 2. Firebase 反向控制——验证

Firebase 指令协议在第 5 周已完成设计。本周对 ESP32 轮询回路进行了调试，端到端完整回路得到验证。

### Bug 修复

原实现用 `getString` 读取 `/commands/action` 节点，当节点存储的是 JSON 对象时会静默失败。修复方案：

| 修改前 | 修改后 |
|---|---|
| `getString` → JSON 节点返回空字符串 | `getJSON` + `FirebaseJsonData` → 正确解析 |
| 确认：`setString(..., "")` （空字符串 ≠ null） | 确认：`deleteNode("/commands/action")` |

应用侧 `onValue` 监听器通过 `snap.val() === null` 判断指令已被接收——节点删除是正确的确认信号。

同时修复了一个 WiFi 省电模式 Bug：`WIFI_PS_MAX_MODEM` 导致无线电在 SSL 握手期间休眠过于激进，产生 `ERROR:mRunUntil1: SSL internals timed out!`。已改为 `WIFI_PS_MIN_MODEM`。

<div class="app-debug-photos-embed"></div>

从应用点击按钮到 ESP32 执行喷雾并收到确认，在家庭 WiFi 环境下往返延迟约 **1 秒**。

<a id="enclosure" style="display:block;height:0;overflow:hidden;scroll-margin-top:7rem"></a>

## 3. 外壳 v2

### 目标效果

目标是紧凑的消费产品形态——透明上壳展示香氛瓶，白色底座，呼吸灯显示交互状态。

<div class="enclosure-concept-embed"></div>

### CAD 设计

外壳为**圆柱形两段卡扣结构**。上筒容纳香氛储液和雾化片，下底座容纳 PCB、电池和全部传感器，所有交互功能均在此集中布局。

**下底座各功能设计：**

**麦克风** — 沿底座整圈开了一道环形槽。单一开孔收音效果不足；环形连续槽可从任意方向拾音，降低对设备朝向的依赖。

**PIR 传感器** — AM312 小型 PIR 正对正面，通过开孔直接露出。齐平露出无需额外透镜或外壳，视场角不受遮挡。

**指示灯** — 目前为单一指示灯开孔。后续版本考虑内置 LED 灯带，以呼吸灯效果呈现设备状态（待机 / 喷雾 / 冷却），透过外壳壁可见。最终透明上壳版本会使灯光效果尤为突出。

### 打印原型

<div class="enclosure-printed-embed"></div>

两段拼合与分离均顺畅。当前打印件为黄色 PLA 结构验证原型，并非最终材料与颜色。

### 后续迭代

| 项目 | 说明 |
|---|---|
| 结构固定 | PCB v1 通电测试后，设计安装固定点、走线路径，以及底座内 LiPo 电池和香氛容器的预留空间 |
| 装配间隙验证 | PCB 最终尺寸确认后核查各部件间隙；补充 USB-C 开口和 PCB 固定方式 |
| 高保真外观 | 3D 打印母模 → 树脂翻模，获得光滑表面；目标透明上壳 + 白色底座（暂定） |
| LED 灯效 | 评估内置 LED 灯带方案，通过外壳壁呈现呼吸灯交互状态 |
| 香氛瓶 | 选配尺寸与内筒直径匹配的香氛瓶 |

<a id="pcb" style="display:block;height:0;overflow:hidden;scroll-margin-top:7rem"></a>

## 4. PCB 设计 v1

### 设计方案

由于所有元件均为成品开发板，PCB 以 **JST 接插件封装**作为接口，无需直接焊接元件。板上集成：

- XIAO ESP32-S3
- BME680 开发板
- INMP441 麦克风开发板
- PIR 传感器接口
- 雾化片 MOSFET 驱动电路
- MT3608 升压转换器（封装从零绘制）
- LiPo 电池接口

PCB 为**圆形，半径 45 mm**，与圆柱形外壳底座匹配。

![PCB v1 原理图 — 所有开发板通过 JST 接插件连接](images/devlog/pcb-schematic-v1.png "PCB v1 原理图")

![PCB v1 KiCAD 布线图 — 圆形板 R=45mm，JST 接插件封装](images/devlog/pcb-design-v1.png "PCB v1 PCB 布线")

### 制作

PCB 在 **GIX 使用 LPKF PCB 铣床**完成打样。铣切结果确认圆形板可放入外壳底座，同时直观呈现了走线质量和接口间距。

![PCB v1 LPKF 铣切完成](images/devlog/pcb-manufacture.png "PCB v1 在 GIX LPKF 铣床打样完成，已裁切，等待焊接")

![PCB v1 部分焊接中](images/devlog/pcb-solder-test.png "PCB v1 部分焊接 — 各子系统通电测试进行中")

**当前状态：** 板已裁切，部分焊接完成。下一步对 PCB 上各子系统进行功能测试，随后根据发现的间距或走线问题进行第二版修订，再进行整机组装。

## 下一步计划

| 完成 | 任务 | 说明 |
|:-:|---|---|
| <input type="checkbox" /> | **PCB 最终焊接与测试** | 完成 PCB v1 通电测试，LiPo + MT3608 供电，验证 GPIO 接线，确认无短路。根据问题打样并焊接 PCB v2。 |
| <input type="checkbox" /> | **外壳上盖** | 以硅胶模具翻模透明树脂上盖。PLA 母模的层纹天然形成磨砂质感。 |
| <input type="checkbox" /> | **外壳下底座** | 完成建模与切片，SLA 打印；需与上盖卡扣精确对齐。 |
| <input type="checkbox" /> | **整机系统集成测试** | 所有传感器 + ML + Firebase + 应用同时运行，在真实条件下验证完整流程。 |
