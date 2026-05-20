---
week: 7
date: "2026年5月12日 - 5月18日"
title: "AuraSync v4、Open House 展示、App UI 优化与外壳上盖翻模"
status: "In Progress"
show_next_steps: true
summary: >
  本周四条主线。Lucia 将固件升级至 AuraSync v4：新增 DEMO_MODE（3 秒采样、
  30 秒预热），用 60 秒 PIR 锁存机制重写了 P3 VOC 拐点触发，使「喷香水→走到
  传感器前」的演示流程成为可能；修复了 WiFi 重试与 MIN_MODEM 省电模式、Firebase
  命令解析（改用 getJSON）及 API Key 字符错误；新增 pushSensorData() 和
  pollFirebaseSettings()，应用的「空气质量」卡和 Auto-Spray 开关现已实时联动；
  修正了 feature_buffer 预热过滤策略。五条触发路径均已在硬件上验证。整机在
  MSTI 校友 Open House 现场展示，运行顺畅。Yutong 优化了 App UI：触发图标补全、
  IAQ 气泡位置修复、储液槽重置、Firebase/ESP32 双状态顶栏。外壳上盖以硅胶模具
  翻模透明树脂完成，层纹形成磨砂质感；下底座 CAD 完成更新并切片，打印机故障
  已修复。
credits:
  - name: Lucia
    initials: L
    tags:
      - AuraSync v4 固件
      - 外壳 v3 CAD
      - 透明上盖翻模
      - Open House 展示
  - name: Yutong
    initials: Y
    tags:
      - App UI 优化
      - 透明上盖翻模
      - Open House 展示
      - 开发日志
prior_week_progress:
  pcb-finalize: "partial"
  enclosure-lid: true
  enclosure-base: "partial"
  system-integration: true
planned_next:
  - id: sand-cover
    label: 打磨并修整透明上盖
    description: "对翻模完成的透明树脂上盖进行打磨，获得均匀的磨砂玻璃质感，随后与下底座进行配合测试。"
  - id: print-base
    label: 打印外壳下底座
    description: "SLA 打印机已修复——用树脂打印下底座，验证与上盖及 PCB 的尺寸配合。"
  - id: full-assembly
    label: 整机组装
    description: "将上盖与下底座合拢，装入全部组件——PCB、LiPo、BME680、PIR、INMP441、雾化片。运行完整状态机确认组装后功能正常。"
  - id: pcb-video
    label: PCB 焊接与备用演示视频
    description: "定制 PCB 到货后完成最终焊接。录制一段完整流程的备用演示视频，以防现场演示出现网络连接问题。"
---

## 执行摘要

本周四条主线。

- **AuraSync v4 固件** — Lucia 对固件进行了全面整合：新增 `DEMO_MODE`（3 秒采样、30 秒预热、宽松阈值），用 60 秒 PIR 锁存机制重写 P3 VOC 拐点触发，修复 WiFi 重试与 `WIFI_PS_MIN_MODEM`，修复 Firebase `getJSON` 解析和 API Key 字符错误，新增 `pushSensorData()` 和 `pollFirebaseSettings()` 使应用「空气质量」卡和 Auto-Spray 开关实时生效，并修正 `feature_buffer.h` 预热过滤策略；全部五条触发路径已在硬件上验证完成。
- **Open House 现场展示** — 整机系统在 MSTI 校友回归 Open House 活动中进行了实际演示，五种触发类型均正常触发，运行顺畅，获得参与者的积极反馈。
- **App UI 优化** — Yutong 为 `iaq_poor`（🌫️）和 `p3_shower_end`（🚿）补全了触发图标，将 IAQ 气泡移至阻值下方，新增储液槽重置功能，并在顶栏增加了独立显示 Firebase 和 ESP32 连接状态的双行指示器。
- **外壳** — 下底座 CAD 完成 v3 更新。透明上盖以硅胶模具翻模透明树脂制作完成，PLA 层纹带来自然磨砂质感。下底座已建模切片，但打印机故障，修复后将于下周打印。

<a id="firmware" style="display:block;height:0;overflow:hidden;scroll-margin-top:7rem"></a>

## 1. 固件整合——AuraSync v4

### DEMO_MODE

新增 `DEMO_MODE` 编译标志（默认开启），使设备无需等待 30 分钟预热即可在课堂演示中使用。

| 参数 | 正常模式 | DEMO_MODE |
|---|---|---|
| 采样间隔 | ~9 秒 | ~3 秒 |
| IAQ 预热时间 | ~30 分钟 | 30 秒 |
| 检测阈值 | 生产调优 | 宽松，响应更快 |

### P3 拐点 + PIR 触发——重写

原有 P3 逻辑要求 VOC 拐点与 PIR 激活同时发生（5 秒窗口内），实际演示中几乎无法触发——因为喷香水之后还需走回 PIR 感应区域。

本次以**锁存机制**重写：检测到 VOC 拐点时记录时间戳；若 PIR 在随后 **60 秒内**触发，则执行喷雾。支持「喷香水 → 走到设备前」的自然演示流程。

### WiFi 与 Firebase 修复

| 问题 | 修复方案 |
|---|---|
| WiFi 连接不稳定 | 新增 3 次重试；每次打印进度和失败状态码 |
| Firebase SSL 超时（`ERROR:mRunUntil1`） | `WIFI_PS_MAX_MODEM` → `WIFI_PS_MIN_MODEM`；原省电模式对 SSL 握手过于激进 |
| 命令读取返回空字符串 | `getString` → `getJSON` + `FirebaseJsonData`；应用发送的是 JSON 对象，非纯字符串 |
| 鉴权失败 | API Key 第 4 位字符修正：数字 `1` → 字母 `l` |

### 应用数据同步——新增

新增两个轮询函数，将设备状态实时推送至 Firebase，应用由此获得真实数据：

**`pushSensorData()`** — 每 5 秒执行。将 `gas_ohm`、`temp_c`、`humidity_pct`、`context` 写入 `/sensors/latest`。应用的「空气质量」卡此前无数据，现在已实时联动。

**`pollFirebaseSettings()`** — 每 10 秒执行。读取 `/settings/autoSprayEnabled`。IAQ Poor、淋浴 CNN、P3 拐点三条自动触发路径现在均检查此标志——应用的 Auto-Spray 开关现在真正生效。

### feature_buffer.h——预热过滤修正

| 修改前 | 修改后 |
|---|---|
| `gas_ohm > 100k` 的读数被截断为 100k 存入 buffer | `gas_ohm > 60k` 的读数直接跳过，不进入 buffer |

截断会在 buffer 中引入人造高值，污染归一化所用的 rolling max 基线。改为直接跳过，使 buffer 只包含预热后的有效读数。

### 五条触发路径验证

全部五条触发路径均在硬件上完成验证：

1. **语音** — ESP-SR 识别关键词 "spray" 并通过优先级队列路由
2. **应用** — Firebase 指令可从任意状态（含 SLEEP）接收并执行
3. **IAQ Poor** — 端侧 MLP 将空气质量分类为 Poor，触发喷雾（受 `autoSprayEnabled` 控制）
4. **淋浴 CNN** — 1D-CNN 概率超过阈值，切换至 SPRAYING（受 `autoSprayEnabled` 控制）
5. **VOC 拐点 + PIR（P3）** — 锁存机制：检测到拐点 → PIR 在 60 秒内触发 → 喷雾（受 `autoSprayEnabled` 控制）

<a id="demo" style="display:block;height:0;overflow:hidden;scroll-margin-top:7rem"></a>

## 2. 整机集成与 Open House 展示

AuraSync v4 完成后，PIR、ML 触发、Firebase 和应用完整流程首次在所有子系统同时运行状态下完成端到端验证。

团队在 **MSTI 校友回归 Open House** 活动中展示了 AuraSync 实物系统。现场系统全程运行，参与者可通过应用触发喷雾并实时观察设备响应，五种触发类型均有演示。展示期间调试顺利，未出现任何问题。

<a id="app-ui" style="display:block;height:0;overflow:hidden;scroll-margin-top:7rem"></a>

## 3. App UI 优化

本周对移动端应用进行了四项针对性改进。

### 触发类型图标补全

此前有两种触发类型在活动记录中显示为 `❓` 和原始键名，现已正式注册：

| Firebase 键 | 标签 | 图标 | 颜色 |
|---|---|---|---|
| `iaq_poor` | IAQ Poor | 🌫️ | 红色 |
| `p3_shower_end` | Shower | 🚿 | 蓝色 |

### IAQ 气泡位置与换行修复

气体质量标签（Good / Moderate / Poor）原先显示在 kΩ 数值**上方**，现已调整至**下方**，与温度和湿度卡片的视觉层次保持一致。同时添加 `numberOfLines={1}` 限制和更小的水平内边距，防止"Moderate"在窄屏上换行。

### 储液槽重置

储液槽估算条右侧新增 `⟳` 按钮，点击后弹出操作菜单：

- **Fill to Full** — 一键将消耗记录重置为 30 ml
- **Set Amount…** — iOS 原生文字输入自定义容量；Android 暂退化为一键归满

重置状态写入 Firebase `settings/`，重启应用后数据持久保留。

### 设备在线状态指示

顶栏改为两行独立状态：

| 行 | 监控对象 |
|---|---|
| **App** 🟢 / 🔴 | 应用 ↔ Firebase 实时连接 |
| **Device** 🟢 / 🔴 | ESP32 是否在线——根据 `sensor.updatedAt` 推断；超过 2 分钟未更新则判定离线 |

30 秒定时器周期性重新评估，即使传感器数据停止更新，指示灯也能及时变红。

<div class="app-ui-update-embed"></div>

<a id="enclosure" style="display:block;height:0;overflow:hidden;scroll-margin-top:7rem"></a>

## 4. 外壳

### 下底座 CAD 更新——v3

Lucia 在 SLA 打印前对下底座模型进行了修订：

| 改动 | 说明 |
|---|---|
| 上壳高度 | 上调以容纳雾化模块高度 |
| USB-C 开口 | 在下壳增加充电开口 |
| PCB 固定方式 | 修订固定方案，确保安装稳固 |
| 麦克风位置 | 调整位置以改善声学间隙 |

本周完成建模与切片，打印机在运行前发生故障。Zubin 于周末完成维修，打印安排在下周进行。

### 透明上盖——硅胶翻模

上盖是外壳的透明段，目标是磨砂玻璃质感，使内部 LED 灯光柔和透出。选择硅胶模具 + 透明树脂工艺实现这一效果。

#### 设计方案

![硅胶模具草图——单体模具设计，以内部占位结构大幅节省硅胶用量](images/devlog/silicone-mold-design.jpg "模具设计草图——Kevin 分享的单体模思路：外箱 + 内部占位结构节省硅胶")

Kevin 分享了**单体模**思路：不采用传统两开模，而是在外箱内将硅胶直接浇注于母模周围，同时以内部占位结构排开大体积硅胶，显著降低材料用量。

#### 制作硅胶模具

以硬纸板在 3D 打印 PLA 母模外搭建外箱。硅胶按比例调配后，在真空腔中脱泡再灌注，防止气泡残留。

<div class="silicone-making-embed"></div>

灌注过程中将一只**玻璃瓶**压入湿硅胶中央作为内部占位结构，节省了大量硅胶。但使用玻璃是个错误的决定——硅胶固化后紧贴光滑玻璃壁形成强附着，瓶子几乎无法取出。最终通过**气泵注气**打破密封，成功将玻璃瓶取出。

![脱模——硅胶与树脂上盖之间无气隙，分段切割硅胶模具以释放成品](images/devlog/silicone-mold-wiggle-cut.jpg "树脂脱模——硅胶过厚且无气隙，分段切割模具取出上盖")

#### 灌注树脂

透明树脂（A+B 1:1 体积比）调配后脱泡，灌入硅胶模具，用木板绑在顶部施加均匀压力，固化 48 小时。

![树脂灌入硅胶模具，顶部以木板绑紧施压，固化中](images/devlog/silicone-mold-with-resin.jpg "树脂灌注中——木板绑紧维持均匀压力")

固化后脱模困难——硅胶壁过厚且树脂与模具之间无气隙，成品无法直接拔出，最终分段切割硅胶模具才将上盖取出。

#### 成果

![成品透明树脂上盖——来自 PLA 母模打印层纹的天然磨砂质感，尚需打磨](images/devlog/enclosure-clear-lid.jpg "成品上盖——透明树脂，PLA 层纹赋予的天然磨砂质感；表面打磨后即可使用")

PLA 打印层纹经由硅胶转印至树脂表面，形成预期的磨砂玻璃效果，无需额外涂层。后续需对表面进行打磨，获得更均匀的质感后即可装配。

## 下一步计划

| 完成 | 任务 | 说明 |
|:-:|---|---|
| <input type="checkbox" /> | **打磨并修整透明上盖** | 对树脂上盖表面进行打磨，获得均匀磨砂质感，随后与下底座进行配合测试。 |
| <input type="checkbox" /> | **打印外壳下底座** | SLA 打印机已修复——打印下底座，验证与上盖及 PCB 的尺寸配合。 |
| <input type="checkbox" /> | **整机组装** | 将上盖与下底座合拢，装入全部组件；运行完整状态机确认功能正常。 |
| <input type="checkbox" /> | **PCB 焊接与备用演示视频** | 定制 PCB 到货后完成最终焊接；录制备用演示视频以防现场连接问题。 |
