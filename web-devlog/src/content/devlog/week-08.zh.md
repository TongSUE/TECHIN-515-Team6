---
week: 8
date: "2026年5月19日 - 5月25日"
title: "外壳收尾、PCB 焊接、灯带固件与整机组装"
status: "In Progress"
show_next_steps: true
summary: >
  最后的冲刺。Yutong 在 Kevin 的帮助下 SLA 打印了下底座并湿磨至
  1000 目；随后用条锯修整、钻孔打开雾化口——树脂裂开了。团队咨询
  Kevin 后选择用同款树脂填补裂缝，Lucia 同步重新建模翻模模具作为
  备用方案，最终修补效果出乎意料地好，两人共同打磨完成。定制 PCB
  到货，Yutong 完成了所有元件及 WS2812B 灯带的焊接。Lucia 集成了五
  种状态响应式灯带动画，将构建系统迁移至 PlatformIO（ESP-IDF 5.x），
  并对语音识别进行了调优——新增"Release"作为"Spray"的替代触发词。
  整机组装后五条触发路径全部验证通过。
credits:
  - name: Lucia
    initials: L
    tags:
      - WS2812B 灯带固件
      - 语音调优
      - 树脂上盖翻模（备用）
      - 整机组装
      - 最终演示幻灯片
  - name: Yutong
    initials: Y
    tags:
      - PCB 焊接
      - 外壳收尾
      - 树脂上盖修补
      - 整机组装
      - 开发日志
prior_week_progress:
  sand-cover: true
  print-base: true
  full-assembly: true
  pcb-soldering: true
  backup-video: false
planned_next:
  - id: backup-video
    label: 录制备用演示视频
    description: "录制一段涵盖五条触发路径的完整演示视频，以备现场演示出现网络或环境问题时使用。"
  - id: final-demo
    label: 最终演示
    description: "在结课演示中展示 AuraSync——设备、应用与 Firebase 全部就绪，五条触发路径均可演示。"
---

## 执行摘要

本周四条主线，项目完成收官。

- **外壳** — 上下两半全部完工。Yutong 在 Kevin 指导下打印并湿磨好了下底座（60 → 1000 目，水冷打磨）；透明上盖用条锯裁边后钻雾化口，钻穿时树脂从孔缘向外放射状开裂。咨询 Kevin 后选择同款树脂填补，Lucia 同步重新建模备用翻模模具。修补效果惊人地干净，两人共同打磨后裂缝几乎不可见，磨砂质感均匀一致。
- **PCB 与电路** — 定制 PCB 到货。Yutong 将所有接插件、雾化片 MOSFET、MT3608 及 WS2812B 灯带引线焊接完毕，经多轮调试排除短路后成功上电。
- **固件** — Lucia 集成了五种状态响应式 WS2812B 灯带动画，将构建系统从 Arduino IDE 迁移至 PlatformIO（ESP-IDF 5.x）。在真实环境中测试后发现"Spray"识别率较差，新增"Release"作为替代触发词，识别效果显著改善。
- **整机组装** — 全部组件装入外壳，五条触发路径逐一验证通过。应用 → Firebase → ESP32 喷雾链路稳定可靠，灯带状态反馈清晰。

<a id="enclosure" style="display:block;height:0;overflow:hidden;scroll-margin-top:7rem"></a>

## 1. 外壳——最终收尾

### 下底座——SLA 打印与打磨

打印机修好后，Yutong 在 Kevin 的指导下完成了下底座树脂打印。打印后处理流程：

1. 去除支撑结构
2. UV 二次固化
3. 湿磨：60 → 120 → 240 → 400 → 600 → 1000 目

湿磨技巧：砂纸全程浸水，既能散热防止树脂受热软化，又能防止粉尘飞扬。

![湿磨下底座——砂纸在每个目数阶段均浸水打磨](images/devlog/sanding-paper.jpg "湿磨——水分保持砂纸清洁，防止发热")

![打磨完成的下底座——SLA 打印、UV 固化并湿磨至 1000 目](images/devlog/sanding-lower-base.jpg "完成后的下底座——树脂表面光洁，可以装配")

### 透明上盖——裁切、钻孔与修补

翻模完成的树脂上盖需要两步收尾：用条锯裁去多余边缘，再在顶部钻出雾化口。

![用条锯裁切上盖多余边缘](images/devlog/band-saw.jpg "条锯修边——裁去多余树脂后再钻孔")

裁边完成后，在顶部中心钻雾化口。钻头钻穿瞬间，树脂从孔缘向外放射状开裂。

咨询 Kevin 后，团队综合评估了三种方案：

| 方案 | 优点 | 缺点 |
|---|---|---|
| 重新翻模 | 效果有保障 | 固化 48 小时以上；成品报废 |
| UV 胶修补 | 快速（数分钟） | 材料不同，可能留下可见痕迹 |
| 同款树脂修补 | 材质匹配，粘合牢固，几乎不留痕 | 需固化 24 小时；外观效果存在不确定性 |

最终选择**同款树脂修补**：将液态树脂渗入裂缝，固化 24 小时。与此同时，Lucia 重新建模，制作了一套用于重新翻模的备用硅胶模具——最终用不上。

![透明树脂上盖——钻孔导致从孔缘向外放射状开裂](images/devlog/drill-broken-lid.jpg "钻孔裂缝——树脂脆性较大，钻穿瞬间向外开裂")

![同款树脂修补——将液态树脂渗入裂缝，固化 24 小时](images/devlog/repair-using-resin.jpg "树脂修补中——液态树脂填充裂缝，固化 24 小时")

固化后，Lucia 与 Yutong 共同打磨。裂缝几乎不可见，磨砂质感均匀覆盖整个表面。

![修补固化后重新打磨——Lucia 与 Yutong 共同完成收尾](images/devlog/sanding-after-repair.jpg "修补后打磨——裂缝几乎消失，磨砂质感均匀")

<a id="electronics" style="display:block;height:0;overflow:hidden;scroll-margin-top:7rem"></a>

## 2. PCB 与电路

定制 PCB 本周到货。Yutong 将全部元件焊接上板：

- JST 接插件——ESP32-S3、BME680、PIR、INMP441
- 雾化片 MOSFET 驱动电路（含栅极电阻）
- MT3608 升压转换器焊盘
- 24 颗 WS2812B 灯带引线接至 GPIO3（D2）

经过多轮调试排除短路故障后，电路板成功通电上电。

<a id="firmware" style="display:block;height:0;overflow:hidden;scroll-margin-top:7rem"></a>

## 3. 固件——灯带与语音

### WS2812B 灯带集成

Lucia 集成了 24 颗 WS2812B 灯带（FastLED 3.9.0，GPIO3），实现五种状态响应式动画：

| 设备状态 | 动画效果 |
|---|---|
| 休眠 | 蓝色缓慢呼吸 |
| IAQ 好 / 中 / 差 | 绿 / 黄 / 橙色呼吸（随 IAQ 等级变化） |
| 喷雾中 | 白色旋转追光（3–4 颗亮点，30 ms/步） |
| 冷却中 | 青色渐隐 |
| 语音触发窗口 | 紫色双闪 |

帧率上限约 60 fps，通过 `millis()` 增量计时（每帧 16 ms）控制。

### PlatformIO 迁移

固件构建系统从 Arduino IDE（IDF 4.x）迁移至 **PlatformIO**（pioarduino，ESP-IDF 5.x）。FastLED 3.9.0 版本现已锁定，构建可复现，编译器诊断信息也更为清晰。

### 语音指令调优

整机组装完成后，在真实环境中测试了语音识别：

- **"Aura"**（唤醒词）和 **"Stop"**（取消）——识别稳定
- **"Spray"**——在环境噪音中频繁漏识（硬件限制：声学腔体设计对某些音素有衰减）

解决方案：新增 **"Release"** 作为第二触发词，与"Spray"触发相同的喷雾动作。MultiNet7 置信度阈值设为 `0.45f`，"Release"在噪音环境中的识别率显著优于"Spray"。

当前有效语音指令：`aura` / `spray` / `fragrance` / `release` / `stop`

<a id="assembly" style="display:block;height:0;overflow:hidden;scroll-margin-top:7rem"></a>

## 4. 整机组装与集成

全部组件装入组合后的外壳。五条触发路径逐一确认正常触发：

1. **语音** — "Aura" 唤醒 + "Release"/"Spray" 经优先级队列路由触发喷雾
2. **应用** — Firebase 指令可从任意状态（含 SLEEP）接收并执行
3. **IAQ Poor** — 端侧 MLP 将空气质量分类为 Poor，触发喷雾（受 `autoSprayEnabled` 控制）
4. **淋浴 CNN** — 1D-CNN 概率超过阈值，切换至 SPRAYING（受 `autoSprayEnabled` 控制）
5. **VOC 拐点 + PIR（P3）** — 锁存机制：检测到拐点 → PIR 在 60 秒内触发 → 喷雾（受 `autoSprayEnabled` 控制）

![AuraSync 整机组装完成——透明磨砂上盖与树脂下底座合拢，全部组件就位](images/devlog/final-model.jpg "整机组装完成——两半合拢，内部组件全部就位")

![应用触发测试——通过 Firebase 发送喷雾指令，ESP32 实时响应](images/devlog/final-app-control-test.jpg "应用触发——Firebase → ESP32，响应约 1 秒")

<div class="final-triggers-embed"></div>

## 下一步计划

| 完成 | 任务 | 说明 |
|:-:|---|---|
| <input type="checkbox" /> | **录制备用演示视频** | 录制五条触发路径完整演示视频，以备现场连接问题时使用。 |
| <input type="checkbox" /> | **最终演示** | 在结课演示中展示 AuraSync——设备、应用与 Firebase 全部就绪，五条触发路径均可演示。 |
