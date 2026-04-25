---
week: 4
date: "2026年4月21日 - 4月27日"
title: "BME680 调试、统一固件与省电状态机"
status: "In Progress"
show_next_steps: true
summary: >
  Lucia 完成了 BME680 VOC/环境传感器的调试——I2C 地址 0x77 验证通过，四路数据流全部确认，热风枪测试验证了实时响应。Yutong 将 PIR、语音识别与 Firebase 合并为单一 AuraSync 固件，采用双层状态机架构，并通过 WiFi 调制解调器休眠和 Core 0 频率限制实现了可量化的空闲省电效果。双层状态机架构（SLEEP/AWAKE × IDLE/SPRAYING/COOLDOWN）与四优先级触发模型由两人共同设计；BME680 集成进固件的工作仍在进行中。
credits:
  - name: Lucia
    initials: L
    tags:
      - BME680 调试
      - 状态机设计
      - 开发日志
  - name: Yutong
    initials: Y
    tags:
      - AuraSync 统一固件
      - 状态机设计
      - 开发日志
prior_week_progress:
  end-to-end-integration: true
  unified-state-machine: true
  mobile-app: false
  bme680-bring-up: true
planned_next:
  - id: bme680-firmware
    label: BME680 固件集成
    description: 将 BME680 与 PIR 和麦克风一起集成到 AuraSync——三路传感器在单一 ESP32-S3 上协同采样。
  - id: voc-pattern-detection
    label: VOC 模式检测
    description: 实现滑动窗口 VOC 先升后降检测，结合 PIR 确认作为自动喷雾触发器（P3）。
  - id: voc-baseline
    label: 真实环境 VOC 基线
    description: 在真实浴室环境中采集气体阻抗时间序列数据，为 P2 极端异味阈值提供校准依据。
  - id: firebase-reverse
    label: Firebase 反向控制
    description: "应用向 /commands/action 写入指令；ESP32 每 3 秒轮询、执行并清除节点——无需 WebSocket 的双向控制。"
---

## Executive Summary

传感器、固件、架构——三条并行线索本周同步推进。

- **BME680 调试** — Lucia 在 I2C 地址 0x77 完成验证，确认四路数据流（温度、湿度、气压、VOC 气体阻抗）全部正常，并通过热风枪测试验证了实时环境响应。冷启动加热器预热被识别为校准注意事项。
- **AuraSync 统一固件** — Yutong 将 PIR、语音识别与 Firebase 合并至 `AuraSync.ino`——首个三条硬件路径共享同一状态机的固件版本。串口输出极简：仅打印状态转换和窗口内语音指令。
- **省电优化** — WiFi 调制解调器休眠（DTIM 间隔射频门控）与 SLEEP 模式下的 Core 0 轮询频率限制，在不影响 Core 1 或 I2S 时钟的情况下降低了空闲电流。
- **状态机架构** — 共同设计了双层模型：第一层（SLEEP/AWAKE，PIR 驱动）和第二层（IDLE/SPRAYING/COOLDOWN，共享绝对冷却时间）以及四优先级触发层次体系。BME680 集成进固件的工作仍在进行中。

<a id="bme680-bring-up" style="display:block;height:0;overflow:hidden;scroll-margin-top:7rem"></a>

## 1. BME680 调试

BME680 本周到货。调试沿用了麦克风和 PIR 调试时同样的自底向上验证流程：在叠加软件复杂度之前，先确认硬件路径正确。

### 接线

| BME680 引脚 | XIAO ESP32-S3 | 说明 |
|---|---|---|
| VIN | 3V3 | 3.3V 供电 |
| GND | GND | 公共地 |
| SDI (SDA) | D4 | 默认 SDA（GPIO5） |
| SCK (SCL) | D5 | 默认 SCL（GPIO6） |

### 第一步——I2C 地址扫描

在编写任何传感器相关代码之前，先用 I2C 扫描程序确认总线是否正常。结果：在地址 **0x77** 发现设备——接线正确。

### 第二步——库安装与初始化

通过 Arduino Library Manager 安装 **Adafruit BME680** 和 **Adafruit Unified Sensor** 库。初始化过程中遇到一个非直觉性问题：

| 尝试 | 调用方式 | 结果 |
|---|---|---|
| 显式指定 GPIO | `Wire.begin(2, 3)` | I2C 检测失败 |
| 默认（无参数） | `Wire.begin()` | I2C 检测通过——传感器成功初始化 |

**根本原因：** XIAO ESP32-S3 的 Arduino 框架将默认 I2C 总线映射到 D4/D5（GPIO5/GPIO6）。传入 `Wire.begin(2, 3)` 会路由到 GPIO2/GPIO3，而这两个引脚未连接 BME680。修复方法：使用无参数的 `Wire.begin()`，让框架应用正确的默认映射。

### 第三步——数据验证

首次成功读取：

| 测量值 | 读数 |
|---|---|
| 温度 | ~28 °C |
| 湿度 | ~17 % |
| 气压 | ~1013 hPa |
| VOC 气体阻抗 | ~37 kΩ |

![BME680 首次实时读数——四路数据流全部确认](images/devlog/BME_log.png "BME680 串口输出——温度、湿度、气压与气体阻抗均在 I2C 地址 0x77 正常读取")

### 第四步——实时响应测试

将热风枪对准传感器，温度读数立即上升并实时跟踪热源——确认是真实环境感知而非缓存数值。

### 采样配置

```cpp
bme.setTemperatureOversampling(BME680_OS_8X);
bme.setHumidityOversampling(BME680_OS_2X);
bme.setPressureOversampling(BME680_OS_4X);
bme.setIIRFilterSize(BME680_FILTER_SIZE_3);
bme.setGasHeater(320, 150);  // 320 °C，150 ms——VOC 测量所必需
```

> **冷启动注意：** 内部气体加热器在上电后需要数分钟才能达到热平衡。冷启动后约 2 分钟内的气体阻抗读数应视为未稳定状态，不应用于阈值比较。

<a id="end-to-end-integration" style="display:block;height:0;overflow:hidden;scroll-margin-top:7rem"></a>
<a id="unified-state-machine" style="display:block;height:0;overflow:hidden;scroll-margin-top:7rem"></a>

## 2. AuraSync 统一固件

在 PIR、语音识别、Firebase 分别在三个独立草图（`PIRTest`、`VoiceTest`、`FirebaseTest`）中完成验证之后，本周固件目标是将三者合并为单一草图：`Code/AuraSync/AuraSync.ino`。

![PIR、INMP441 麦克风、XIAO ESP32-S3 与超声波雾化器集成在面包板上——Firebase 喷雾事件实时记录中](images/devlog/firebase_pir_voice_atomizer.png "联调测试实物：三条硬件路径（PIR、语音、雾化器）同时运行，后台 Firebase 控制台实时接收喷雾事件")

### 架构

VoiceTest 的双核分配方案得以保留并扩展：

| 核心 | 职责 |
|---|---|
| **Core 1** — `srTask` | I2S 读取 → AFE 噪声抑制 → MultiNet 识别 → `cmdQueue` |
| **Core 0** — `loop()` | PIR 轮询 · 状态机 · 雾化器 · Firebase 推送 · BME680（计划中） |

SR 任务以 `configMAX_PRIORITIES - 1`——FreeRTOS 最高优先级——运行，确保音频处理不会被同一核心上的 Firebase I/O 抢占。

### 四状态机

<div class="aurasync-four-state-diagram-embed"></div>

### 串口协议

输出经过精简——串口监控器中只显示有意义的状态转换：

| 数据行 | 触发时机 |
|---|---|
| `SPRAY:idle` / `SPRAY:spraying` / `SPRAY:cooldown` | 状态转换时 |
| `VOICE:aura` | 唤醒词确认时 |
| `WORD:spray:0.73` | **仅在** 7 秒窗口内识别到指令时 |
| `ERROR:xxx` | 仅发生故障时 |

窗口外检测到的指令会被静默丢弃。这消除了 VoiceTest 原始串口输出中杂乱的误触发噪声，使监控器一目了然。

### Firebase 事件结构

每次喷雾事件推送至 `/spray_events/<push_id>`：

```json
{
  "trigger":     "pir",
  "command":     "spray",
  "duration_ms": 5000,
  "unixMs":      1776658120000,
  "iso":         "2026-04-25T21:08:40Z"
}
```

`trigger` 字段（v2 新增）区分传感器驱动喷雾与人工指令喷雾——对于后续分析设备在何时、为何触发至关重要。

![Firebase 实时数据库——AuraSync 固件推送的喷雾事件，包含触发来源与时间戳字段](images/devlog/firebase_log.png "Firebase 控制台显示带 push ID、trigger 字段、duration_ms 和 ISO 时间戳的实时喷雾事件")

### 省电优化

以下两项轻量改动在不影响语音响应的前提下降低了空闲电流。估算基于 XIAO ESP32-S3 数据手册及 BOM 硬件（MT3608 从 3.7V 锂电池升压，INMP441 持续工作电流 1.4mA）。

| 技术手段 | 节省电流 | 工作机制 |
|---|---|---|
| `WiFi.setSleep(WIFI_PS_MAX_MODEM)` | **约 90–110 mA** | 射频门控到 DTIM 信标间隔（约 102ms）。WiFi 分量从持续接收时的约 80–130 mA 降至约 5–20 mA 均值；ESP32-S3 总电流从约 130–180 mA 降至约 20–35 mA。 |
| SLEEP 模式下 `loop()` 中执行 `delay(80)` | **约 20–30 mA** | Core 0 从近连续轮询（约 1 kHz）降至约 12 Hz。FreeRTOS 每 83ms 中约有 80ms 进入无滴答空闲（WFI），CPU 活跃电流从约 40 mA 降至约 5–10 mA。 |
| SLEEP 模式下 BME680 每 30 秒采样一次 | **约 1.6 mA** | 气体加热器（320°C，峰值约 35 mA）每 30 秒仅工作 150ms（占空比 0.5%），相比每 3 秒工作一次（占空比 5%），平均电流从约 1.75 mA 降至约 0.18 mA。 |

> **续航估算：** 在约 30 mA 系统空闲电流（SLEEP 模式，三项优化全部生效）下，EEMB 2000 mAh 锂电池可提供约 **60–70 小时**连续空闲续航——相比无任何优化时的约 13 小时大幅提升。Core 1（SR 任务 + I2S）始终全速运行，唤醒词检测不受影响。

<a id="state-machine-architecture" style="display:block;height:0;overflow:hidden;scroll-margin-top:7rem"></a>

## 3. 双层状态机设计

*本节为设计记录——固件实现仍在进行中。*

第二节中的四状态模型针对当前硬件（PIR + 语音）。本节记录了为将 BME680 集成到固件而设计的扩展架构。

### 双层结构

<div class="two-layer-state-machine-diagram-embed"></div>

### 触发优先级

<div class="trigger-priority-diagram-embed"></div>

### P2——极端异味逻辑

无论是否检测到人员存在，当气体阻抗低于 10 kΩ 时 P2 触发。在 SLEEP 模式下，P2 同时唤醒系统。若 P2 触发时冷却正在进行，喷雾将入队（`p2Pending = true`），在冷却到期后立即执行——确保极端异味无论如何都会得到响应，即使最近一次喷雾仍在锁定期内。

### P3——VOC 拐点 + PIR

P3 针对如厕后场景：异味积累时 VOC 升高，到峰值后随通风开始下降。固件通过存储 8 个 BME680 采样的滚动历史（以 3 秒为间隔，覆盖约 24 秒历史数据）来检测此拐点。检测条件：最近三个读数显示气体阻抗持续下降趋势（阻抗降低 = 异味升高），当前读数出现恢复（阻抗上升）。同时要求 PIR 在过去 5 秒内检测到 HIGH 信号以确认有人存在。

## Next Steps

第 5 周将重心从固件架构转向传感器集成与真实环境数据采集。

| 完成 | 任务 | 说明 |
|:-:|---|---|
| <input type="checkbox" /> | **BME680 固件集成** | 将 BME680 与 PIR 和麦克风一起集成到 AuraSync——三路传感器在单一设备上协同采样。 |
| <input type="checkbox" /> | **VOC 模式检测** | 实现滑动窗口 VOC 先升后降检测，结合 PIR 确认作为自动喷雾触发器（P3）。 |
| <input type="checkbox" /> | **真实环境 VOC 基线** | 在真实浴室采集气体阻抗时间序列数据，为 P2 极端异味阈值提供校准数据。 |
| <input type="checkbox" /> | **Firebase 反向控制** | 应用向 `/commands/action` 写入指令；ESP32 每 3 秒轮询、执行并清除——无需 WebSocket 的双向控制。 |
