---
week: 3
date: "2026年4月14日 - 4月20日"
title: "语音识别、Firebase 与 PIR——构建日志"
status: "In Progress"
show_next_steps: true
summary: >
  Yutong 验证了 PSRAM 和 SPH0645 麦克风，搭建了完整的 ESP-SR 语音识别流水线（包含唤醒词状态机与实时串口监控），接入 Firebase 实时数据库和云端仪表盘，并将 KiCAD 原理图更新至 v2.0。Lucia 为 HC-SR501 PIR 传感器接线，通过存在感触发超声波雾化器，完成里程碑 1 演示幻灯片并提交预算更新表格。BME680 VOC 传感器仍在运输中。
credits:
  - name: Lucia
    initials: L
    tags:
      - PIR 传感器
      - 里程碑幻灯片
      - 预算更新表格
  - name: Yutong
    initials: Y
    tags:
      - 语音识别
      - Firebase 集成
      - 原理图更新
      - 开发日志
prior_week_progress:
  refine-cad-schematic: true
  wifi-firebase: true
  microphone-module: true
  atomizer-test: true
planned_next:
  - id: end-to-end-integration
    label: PIR + 雾化器 + Firebase 端到端集成
    description: "最高优先级：合并两条已验证路径——PIR 触发 → 雾化器喷雾 → Firebase 事件写入——完成首个完整闭环流水线。"
  - id: unified-state-machine
    label: 语音 + PIR 统一状态机
    description: 将语音指令和 PIR 触发合并为单一状态机，定义优先级（例如语音"stop"可中断 PIR 触发的喷雾）并处理并发冲突。
  - id: mobile-app
    label: 移动端应用框架
    description: 构建一个连接 Firebase 的基础应用，展示带时间戳的喷雾事件历史记录。
  - id: bme680-bring-up
    label: BME680 调试
    description: "若本周传感器到货：验证 I2C 通信，读取原始 VOC/温度/湿度数据，并开始采集浴室 VOC 时间序列数据用于机器学习数据集。"
---

## Executive Summary

两条已验证的硬件路径、一条实时云端流水线，以及首次完整的端到端喷雾循环。

- **PSRAM 与麦克风验证** — 确认 8 MB OPI PSRAM（ESP-SR AFE 的必要条件）；在集成完整流水线之前，以独立模式验证 SPH0645 的连线和音频路径。
- **语音识别** — 搭建完整 ESP-SR v2.0 流水线：AFE 噪声抑制 + MultiNet v7 关键词检测器，唤醒词状态机（"Aura" → 7 秒指令窗口），FreeRTOS 双核分配。调试了两个非显而易见的 I2S 问题（API 冲突；DMA 交错）。
- **串口语音监控** — 实时 Streamlit 仪表盘（`voice_monitor.py`）通过 USB 串口流式传输音频电平、已识别指令和系统状态——无需用户交互。
- **Firebase 集成** — 将 ESP32 接入 Firebase 实时数据库；经过三种认证方式的尝试，最终采用数据库密钥（legacy token）方案。每次"Spray"指令向 `/spray_events` 写入带时间戳的事件记录。
- **云端仪表盘** — `firebase_dashboard.py`：通过 REST 轮询 Firebase，无需 SDK，支持深色/浅色模式，5 秒自动刷新，展示喷雾历史图表。
- **PIR + 雾化器** — Lucia 通过 2N2222 NPN 三极管连接 HC-SR501；首次端到端存在感触发喷雾循环确认成功。
- **BME680** — 仍在运输中；调试延至第 4 周。

## Mentor Meeting

*本周我们与项目导师进行了交流。*

<div class="mentor-card-embed"></div>

导师的反馈涉及三个方面：

**1 · 融入智能家居生态系统**
Justin 建议将 AuraSync 定位为**智能家居配件**——接入 Apple HomeKit、Google Home 或 Matter 协议，通过用户现有的智能音箱或手机接收指令，而非作为独立设备自带麦克风和云端后端。这种方式将语音识别完全交由成熟平台 API（Siri、Google Assistant）处理，并自然融入用户已建立的智能家居场景。

**2 · 传感器精简**
Justin 观察到麦克风和 BME680 最终推断的是相同的高层事件——存在感、淋浴开始、异味峰值。由于 BME680 提供更丰富、更有辨识度的环境信号，他建议保留 BME680，将麦克风替换为更简单、功耗更低的 **PIR 传感器**用于存在感检测。一旦平台语音 API 在场景中发挥作用，麦克风的价值便大为重叠。

**3 · 云端架构**
将语音功能委托给 Apple/Google API 后，自定义云端流水线的问题自然消解：平台负责语音到意图的转换；AuraSync 只需响应本地家庭网络上的配件事件。

**我们在里程碑 1 的回应：** 我们认为融入生态系统的方向很有吸引力，计划在里程碑后探索。当前演示阶段保留麦克风（已验证并集成），同时按 Justin 建议新增 PIR 传感器。我们将在里程碑 2 重新评估麦克风与平台方案的取舍，届时将有真实的 BME680 信号质量数据作为参考。

<div class="special-thanks-card-embed"></div>

<a id="voice-recognition" style="display:block;height:0;overflow:hidden;scroll-margin-top:7rem"></a>
<a id="microphone-module" style="display:block;height:0;overflow:hidden;scroll-margin-top:7rem"></a>
<a id="streamlit-dashboard" style="display:block;height:0;overflow:hidden;scroll-margin-top:7rem"></a>

## 1. 硬件调试、语音识别与串口监控

本次构建遵循自底向上的刻意顺序：先验证硬件前提条件（PSRAM），再确认麦克风独立工作正常，最后在此基础上叠加完整的 ESP-SR 语音流水线。这样，每一步都有清晰的通过/失败判定，然后再增加下一层的复杂度。

### PSRAM 验证

ESP-SR 的 AFE（音频前端）在初始化时会在 PSRAM 中分配大型音频缓冲区——如果没有 PSRAM，AFE 会立即崩溃。在投入完整语音流水线之前，我们运行 `PsramTest.ino` 确认硬件前提条件。

该程序调用 `psramInit()`，检查 `psramFound()`，通过 `getPsramSize()` / `ESP.getFreePsram()` 报告总堆和可用堆，并尝试 512 KB 的 `ps_malloc()` 分配。**通过条件：** `psramFound()` = YES，分配成功。

> **结果：** 确认 8,386,560 字节（8 MB）OPI PSRAM 可用——ESP-SR 可以运行。

> **构建注意：** Arduino IDE 开发板菜单中的 Tools → PSRAM 必须设置为 **"OPI PSRAM"**。默认的"Disabled"设置会使 `psramFound()` 返回 false，即使硬件实际存在。

---

### 麦克风调试

PSRAM 确认后，下一个问题是麦克风本身是否产生有效音频。为了避免同时在完整 ESP-SR 流水线中调试硬件和软件，我们编写了独立的 `MicTest.ino` 先验证 SPH0645 连线和音频路径。该程序使用旧版 `driver/i2s.h` API（独立测试时更简单；`VoiceTest` 切换到 ESP-SR 所需的新 `i2s_std.h` API）。

**直流阻断高通滤波器**（截止频率约 8 Hz，实现为一阶 IIR 滤波器）去除 SPH0645 的直流偏置，再进行能量估算。**基于能量的 VAD** 将短期能量（α = 0.03，时间常数约 32 ms）与长期噪声底（α = 0.001，时间常数约 2 s）对比；当 STE/LTE > 8× 时判定为语音，并通过板载 LED 保持 2 秒。

> **结果：** 麦克风确认正常；VAD 在实验台上可靠区分语音与背景噪声。

---

### SPH0645 I2S 麦克风

在描述调试结果之前，先说明硬件本身：本次使用的麦克风并非原理图中最初指定的 INMP441。INMP441 被替换为 **Adafruit SPH0645LM4H 分线板**（产品编号 #3421）。SPH0645 性能**更优**——更高的信噪比和更低的噪声底——同时共享完全相同的 I2S 引脚定义。唯一的接线差异：SPH0645 的 SEL 引脚接 GND，选择**左声道**。

| 信号 | XIAO 引脚 | GPIO | 说明 |
|------|----------|------|------|
| BCLK   | D8       | 7    | 位时钟 |
| LRCL   | D9       | 8    | 左/右字选择 |
| DOUT   | D10      | 9    | 串行音频数据 |
| SEL    | GND      | —    | 左声道选择 |
| VDD    | 3V3      | —    | |
| GND    | GND      | —    | |

SPH0645 输出 18 位音频，左对齐于 32 位 I2S 帧的 [31:14] 位。固件读取完整 32 位字，右移 14 位获取峰值电平，或右移 16 位获取 16 位 PCM 数据以送入 ESP-SR AFE。

![SPH0645 与 XIAO ESP32-S3 的接线图](images/devlog/mictest_wiring.png)

---

### ESP-SR 流水线

PSRAM 确认且麦克风输出干净音频后，我们进入实际的语音识别层。`VoiceTest.ino` 将两者集成进 Espressif 的 ESP-SR 框架，在已验证的音频路径之上添加唤醒词检测和指令识别。

**ESP-SR v2.0**（随 Arduino ESP32 v3.x 捆绑，无需单独安装）提供：
- **AFE**（音频前端）— 噪声抑制 + VAD；运行于 PSRAM（`AFE_MEMORY_ALLOC_MORE_PSRAM`）
- **MultiNet v7** — 英语关键词检测器；在 `ESP_MN_STATE_DETECTED` 时触发

两个组件均运行于 **FreeRTOS Core 1**（通过 `xTaskCreatePinnedToCore` 固定），Core 0 留给水泵、LED 和 Firebase I/O。

**分区要求：** ESP-SR 模型文件存放在专用 SPIFFS 分区。自定义 `partitions.csv`（app0 = 3.7 MB，model SPIFFS = 4.25 MB）放置于草图文件夹中，配合一次性 `flash_model.ps1` 脚本将模型烧录到 Flash。Arduino IDE 开发板菜单选择：**"Huge APP (3MB No OTA / 1MB SPIFFS)"**。

**注册指令：** `aura`（唤醒词）、`spray`（触发雾化器）、`stop`

**I2S API：** 全程使用新版 `driver/i2s_std.h` API（ESP-IDF v5 风格）——旧版 `driver/i2s.h` 与 ESP-SR 的内部 I2S 使用冲突，会导致全零读取。

### 唤醒词状态机

在任意时刻识别短小的孤立指令容易产生误识别。我们实现了两阶段模型：**唤醒词**控制一个短暂的指令窗口。

<div class="wake-word-state-machine-diagram-embed"></div>

指令窗口为 **7 秒**——5 秒被证明太短，因为 MultiNet 仅在 VAD 检测到语音时运行；静默间隔消耗窗口时间却不推进识别。

LED 反馈：听到"Aura"→ 缓慢三次闪烁；"Spray"→ LED 亮 2 秒；"Stop"→ LED 立即熄灭。

### 串口协议

固件向串口监控器流式输出结构化数据行：

| 数据行 | 含义 | 频率 |
|-------|------|------|
| `LEVEL:xx.x` | 归一化音频幅度（0–80） | 每个 DMA 帧（约 32 ms） |
| `WORD:word:prob` | 已识别指令 + 置信度 | 检测时输出 |
| `STATE:listening` | 听到唤醒词，指令窗口开启 | "Aura"触发时 |
| `STATE:idle` | 指令执行完毕或窗口超时 | 状态转换时 |

### 遇到的挑战

| 症状 | 根本原因 | 解决方案 |
|------|---------|---------|
| 所有 I2S 采样返回 `0x00000001` | ESP-SR AFE 通过新版驱动 API 在内部初始化 I2S；之后调用旧版 `i2s_driver_install()` 损坏了硬件寄存器 | 将整个 I2S 层替换为 `i2s_std.h`（`i2s_chan_handle_t`、`i2s_new_channel`、`i2s_channel_read`） |
| 尽管有音频输入，识别从未触发 | 即使在 MONO 配置下，DMA 缓冲区也会交错 L/R 槽——AFE 接收到 L、0、L、0，有效采样率降至 8 kHz，破坏了 MultiNet 的音素模型 | 分配 2× 缓冲区，读取 2× 采样，再提取偶数索引帧传递给 AFE |

---

### 串口语音监控

语音流水线功能已完备，但观察系统运行状态需要在 Arduino IDE 中读取原始串口输出——`LEVEL:xx.x`、`WORD:spray:0.87`、`STATE:listening` 等数据行混杂在一起，无法一眼读懂。为使系统状态在测试中一目了然，我们构建了 `monitor/voice_monitor.py` 作为实时 Streamlit 仪表盘。

`monitor/voice_monitor.py` 实现了一个实时监控界面，用户只需打开 URL，无需任何交互操作。

![AuraSync 语音监控——SPRAY 状态激活，实时音频电平与词汇卡片](images/devlog/voice_test_streamlit_app.png)

**架构：** 使用 `st.empty()` 占位符模式——单个 `while True` 循环每帧覆盖占位符内容，无需触发完整的 Streamlit 脚本重新运行。

**自动连接：** 启动时，应用自动扫描可用的 COM 端口并连接第一个找到的端口。若端口被其他进程占用（如 Arduino IDE 串口监控器），侧边栏会显示说明冲突的错误信息，而非显示无声的零值。

**功能面板：**

| 面板 | 实现方式 | 更新频率 |
|------|---------|---------|
| 状态横幅 | 纯 HTML `<div>` | 每帧（0.4 秒） |
| 音频电平 | HTML 进度条 + CSS `transition` | 每帧——无闪烁 |
| 词汇卡片 | HTML——当前词高亮 | 每帧 |
| 历史折线图 | Plotly `go.Scatter` | 每 5 帧（2 秒） |
| 识别卡片 | HTML——最新指令大字显示，历史紧凑排列 | 每帧 |
| 词频柱状图 | Plotly `go.Bar` | 每 5 帧（2 秒） |

Plotly 图表以降低的频率更新，以避免每帧替换完整 SVG 时产生的重新渲染闪烁。

<video controls muted playsinline style="width:100%;border-radius:0.5rem;margin-bottom:0.75rem">
  <source src="images/devlog/voice_monitor_test.mp4" type="video/mp4" />
</video>

> **展望未来：** BME680 到货后，VOC 气体阻抗将成为补充触发器——无需唤醒词，当气味超过学习阈值时直接触发喷雾。长远来看，将语音功能委托给 Apple HomeKit / Google Home / Matter API 可将语音识别转交成熟平台基础设施；AuraSync 只需响应本地家庭网络上的配件事件。

<a id="firebase" style="display:block;height:0;overflow:hidden;scroll-margin-top:7rem"></a>

## 2. Firebase 集成与云端仪表盘

### 为什么选择 Firebase

语音流水线已完全正常运行，但每次喷雾事件仅存在于 RAM 中——拔掉电源或重启后数据即消失。串口监控也需要 USB 物理连接才能观察。为了证明数据流水线的端到端可行性，并使事件可远程访问，下一步是添加持久化云端存储。

我们选择 **Firebase 实时数据库**，因为它可通过 REST 从任何设备访问，无需自定义服务器，而且免费 Spark 套餐足以支撑演示。

### 固件架构

**库：** Mobizt 的 `Firebase_ESP_Client`（Arduino Library Manager）。

语音识别 SR 任务运行于 Core 1，将指令 ID 写入 **FreeRTOS 队列**（深度 8）。Core 0 的 `loop()` 负责消耗队列并调用 `pushSprayEvent()` → `Firebase.RTDB.pushJSON()`。语音流水线不会因网络 I/O 而阻塞。

### 分区挑战

`VoiceTest.ino` 单独编译约 1.5 MB；Firebase 客户端库增加约 800 KB，总计约 2.3 MB——超出了默认 2 MB 的 app 分区。

**报错：** `"text section exceeds available space in device"`（链接时）。

**解决方案：** 使用与 VoiceTest 相同的自定义 `partitions.csv`（app0 = 3.7 MB），同时在 Arduino IDE 中选择 **Tools → Partition Scheme → "Huge APP"**。两项更改必须同时进行：CSV 控制 Flash 布局；IDE 菜单控制链接器的大小检查。

### 认证历程

让 ESP32 通过认证经历了三次尝试：

**尝试一 — 匿名登录。** `Firebase.signUp("","")` 每次重启都创建新的匿名用户。几次测试后，Firebase Console 中已积累了 8+ 个匿名账户。放弃。

**尝试二 — 邮箱/密码固定账户。** 切换到固定测试账户后遇到 `PASSWORD_LOGIN_DISABLED`（Console 中邮箱/密码提供商尚未启用）。启用后，下一个错误是 `INVALID_LOGIN_CREDENTIALS`——代码中的密码与 Console 中输入的不匹配。

**尝试三 — 数据库密钥（legacy token）。** 将 `fbConfig.signer.tokens.legacy_token` 设置为项目的数据库密钥，完全绕过 GITKit 认证。该方式即时生效，无需用户管理，是 IoT 设备（而非人类客户端）的正确模式。

> **核心启示：** IoT 设备不应以人类用户身份认证。数据库密钥（或具有受限规则的服务账户密钥）才是正确的原语——无会话管理、无密码轮换、无匿名用户积累。

### 事件数据结构

每次喷雾事件推送至 `/spray_events/<Firebase push ID>`：

```json
{
  "command": "spray",
  "unixMs": 1776658120000,
  "iso": "2026-04-19T21:08:40Z"
}
```

> **端到端演示：** 说 **"Aura"** → 在 7 秒窗口内说 **"Spray"** → LED 亮起，雾化器触发，Firebase Console 实时出现新记录。

![Firebase 实时数据库——spray_events 及 push ID、command、iso 时间戳和 unixMs](images/devlog/firebase_test.png)

### 云端仪表盘

事件持久化到 Firebase 后，最后一块拼图是在不打开 Firebase Console 的情况下查看数据。我们希望与串口监控器同样的零摩擦体验——打开 URL 即可看到实时数据。`monitor/firebase_dashboard.py` 是一个 Streamlit 应用，通过 REST 从 Firebase 拉取喷雾事件并展示，无需 USB 连接。

**数据访问：** 直接使用 `requests.get(f"{DATABASE_URL}/spray_events.json?auth={DATABASE_SECRET}")` —— 无需 Firebase SDK 或服务账户 JSON。`@st.cache_data(ttl=5)` 将响应缓存 5 秒；`st.rerun()` 驱动自动刷新循环。

**UI 功能：**
- 通过 CSS 自定义属性 + `st.session_state` 实现深色/浅色模式切换
- 4 个指标卡片：总事件数、最近喷雾时间、距上次喷雾时长、最近 60 分钟内的喷雾次数
- 累积阶梯图（面积填充）——同时展示频率（斜率）和总用量（高度）
- 每小时分布柱状图
- 带时间徽章的近期事件列表
- 按比例进度条展示的每日细分

累积图的选择优于原始散点图，因为它同时传递了频率（斜率）和总用量（高度）两个维度的信息。

![AuraSync 云端仪表盘——5 次喷雾记录，累积图与每小时分布](images/devlog/firebase_test_streamlit_app.png)

> **展望未来：** **双向应用控制** — 应用向 `/commands/<pushId>` 写入 `{action:"spray", executed:false}`；ESP32 轮询、执行后标记 `executed:true`，无需 WebSocket 或持久连接。**VOC 衰减仪表盘** — BME680 到货后，绘制带喷雾标记的气体阻抗曲线，计算"清新指数"（0–100%，归一化阻抗恢复率），并通过拟合一阶指数衰减估算再次喷雾时间：C(t) = C_max · e^(−k·t)。

<a id="pir-sensor" style="display:block;height:0;overflow:hidden;scroll-margin-top:7rem"></a>
<a id="atomizer-test" style="display:block;height:0;overflow:hidden;scroll-margin-top:7rem"></a>

## 3. PIR 传感器与存在感触发雾化器

### 硬件

| 组件 | 型号 |
|------|------|
| 微控制器 | Seeed Studio XIAO ESP32-S3 |
| 存在感传感器 | HC-SR501 PIR |
| 雾化器模块 | SazkJere 超声波雾化器 + PCB（Micro USB 供电） |
| 开关元件 | 2N2222 NPN 三极管 |
| 基极电阻 | 1 kΩ |

### 接线

| 连接 | 说明 |
|------|------|
| PIR VCC → XIAO 3V3 | PIR 电源 |
| PIR GND → GND | 公共地 |
| PIR OUT → GPIO4 | 存在感信号输入 |
| GPIO5 → 1 kΩ → 2N2222 基极（中间引脚） | 三极管控制信号 |
| 2N2222 发射极（左引脚）→ GND | |
| 2N2222 集电极（右引脚）→ 雾化器 PCB GND | 切换 GND 回路 |
| 雾化器 PCB VCC → XIAO 5V | 雾化器电源 |

*2N2222 方向——平面朝向自己：左 = 发射极 · 中 = 基极 · 右 = 集电极。*

![HC-SR501 PIR + 2N2222 三极管接线图](images/devlog/pirtest_wiring.png)

### HC-SR501 配置

| 控制 | 设置 | 原因 |
|------|------|------|
| 灵敏度旋钮（左） | 最小（完全逆时针） | 缩小检测范围，避免对面房间误触发 |
| 延迟旋钮（右） | 最小（完全逆时针） | 人离开后信号快速返回 LOW，实现快速冷却 |
| 跳线 | **H** — 重复触发 | 持续有人时保持 HIGH 输出；**L**（单次触发）模式导致输出约 1 秒后下降，无论是否仍有人 |

### 执行逻辑

<div class="pir-actuation-diagram-embed"></div>

雾化器 PCB 上有板载拨动开关。由于每次循环手动拨动不可靠，**两个开关焊盘已焊接在一起（短接）**，使 PCB 在施加供电电压时立即上电并开始雾化。

### 遇到的挑战

| 症状 | 根本原因 | 解决方案 |
|------|---------|---------|
| 上电时雾化器持续运行 | GPIO 逻辑反转——HIGH 时应为 LOW | 交换固件中的 `HIGH`/`LOW` |
| 持续存在时 PIR 约 1 秒后变 LOW | 跳线处于 **L**（单次触发）模式 | 将跳线移至 **H**（重复触发） |
| 进度条反复重置为 26% | 同一单次触发问题——3 秒前计时器已清除 | 同上修复 |
| 雾化器 PCB 内部开关干扰控制 | PCB 开关在 OFF 状态时断开 GND 回路 | 焊接开关焊盘实现永久短接 |

<!-- 图片：雾化器产生雾气的演示照片（待补充） -->

<a id="schematic-update" style="display:block;height:0;overflow:hidden;scroll-margin-top:7rem"></a>
<a id="refine-cad-schematic" style="display:block;height:0;overflow:hidden;scroll-margin-top:7rem"></a>

## 4. 原理图更新

KiCAD 原理图更新至 **Rev v2.0**，以反映本周的硬件变更：

- **U4 SPH0645\_Mic** 替换 INMP441——I2S 引脚分配相同（BCLK → GPIO7、LRCL → GPIO8、DOUT → GPIO9）；SEL 接 GND 选择左声道
- **U2 HC-SR501 PIR** 新增——VCC → 3V3、GND → GND、OUT → GPIO4（Signal）
- **J2 电池连接器** 新增为独立 2 针符号（BATT+ / BATT−）用于锂电池输入
- U1 BME680、U3 MOSFET 驱动、U5 MT3608 升压及所有电源轨从 v1.0 起保持不变

![AuraSync v2.0 原理图——SPH0645 麦克风、HC-SR501 PIR、BME680、MT3608 升压、MOSFET 驱动、电池连接器](images/devlog/schematic_v2.png)

*AuraSync v2.0 KiCAD 原理图——Rev v2.0，2026-04-20。*

## 5. 预算更新

| 物品 | 数量 | 单价 | 小计 |
|------|-----|------|------|
| Seeed Studio XIAO ESP32-S3 | 2 | $7.49 | $14.98 |
| Adafruit BME680 | 1 | $18.95 | $18.95 |
| Adafruit MOSFET 驱动 | 1 | $3.95 | $3.95 |
| 微型水泵 | 4 | $2.36 | $9.43 |
| 3.7V 2000mAh 锂电池 | 1 | $13.06 | $13.06 |
| INMP441 麦克风模块 | 3 | $3.20 | $9.59 |
| Adafruit I2S MEMS 麦克风分线板 | 1 | $13.72 | $13.72 |
| DC-DC 升压转换器 | 5 | $1.19 | $5.95 |
| 杜邦跳线（120 根装） | 1 | $6.88 | $6.88 |
| 超声波雾化片 | 6 | $1.17 | $6.99 |
| USB 雾化驱动电路板 | 4 | $2.37 | $9.48 |
| **已花费合计** | | | **$113.98** |
| **总预算** | | | **$350.00** |
| **剩余预算** | | | **$236.02** |

## Next Steps

两条硬件路径已验证，云端流水线已运行，第 4 周的重心从调试转向集成——合并两个控制循环、添加应用连接，并在 BME680 到货后进行调试。

| 完成 | 任务 | 说明 |
|:-:|---|---|
| <input type="checkbox" /> | **PIR + 雾化器 + Firebase 端到端集成** | 最高优先级——合并两条已验证路径：PIR 触发 → 雾化器喷雾 → Firebase 事件写入，构建首个完整闭环流水线。 |
| <input type="checkbox" /> | **语音 + PIR 统一状态机** | 将语音指令和 PIR 触发合并为单一状态机，定义优先级（如语音"stop"可中断 PIR 触发的喷雾）并处理并发冲突。 |
| <input type="checkbox" /> | **移动端应用框架** | 构建连接 Firebase 的基础应用，展示带时间戳的喷雾事件历史记录。 |
| <input type="checkbox" /> | **BME680 调试**（如到货） | 验证 I2C 通信，读取原始 VOC/温度/湿度数据，并开始采集浴室 VOC 时间序列数据用于机器学习数据集。 |
