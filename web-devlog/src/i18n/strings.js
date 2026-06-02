export const strings = {
  en: {
    nav: {
      vision: 'Vision',
      devlog: 'Devlog',
      team: 'Team',
      light: 'Light',
      dark: 'Dark',
      openMenu: 'Open menu',
      closeMenu: 'Close menu',
      langToggle: '中文',
    },
    hero: {
      eyebrow: 'Hardware × ML Lab · Devlog',
      taglineStrong:
        'A standalone, context-aware scent dispenser for intimate home spaces. VOC sensing and on-device ML read the room; a',
      taglineEmphasis: 'chemical feedback loop',
      taglineTail:
        'blocks runaway over-spraying that dumb timed dispensers cannot prevent.',
      pills: [
        'Chemical feedback loop',
        'BME680 + I2S multimodal',
        'Voice · button · auto',
      ],
      pillsAriaLabel: 'Project highlights',
      readDevlog: 'Read devlog',
      viewGithub: 'View GitHub repo',
      explore: 'Explore',
      howItWorks: 'How it works',
      scrollToVision: 'Scroll to vision section',
    },
    vision: {
      eyebrow: 'The vision',
      heading: 'Sense, infer, actuate — one closed loop',
      intro:
        'AuraSync turns bathroom-scale context (odor, shower steam, grooming noise) into actionable signals: inference stays on-device, and chemical feedback keeps spraying within safe bounds. Week-by-week detail lives in the devlog below.',
      cards: [
        {
          title: 'Sensing',
          body: 'BME680 supplies VOC and climate gradients; the I2S mic adds acoustic features. We prioritize trends over absolute values so each room can establish its own baseline.',
          tag: 'Input',
        },
        {
          title: 'Edge ML',
          body: 'On the XIAO ESP32-S3, a ~30s sliding window fuses modalities for a lightweight classifier. Actuation only fires on high confidence, with rules to suppress false alarms (e.g., hairspray + dryer).',
          tag: 'Think',
        },
        {
          title: 'Actuation',
          body: 'After spray, a VOC spike forces Cooldown—voice and button requests are rejected until the air clears, preventing scent overload. We are evaluating ultrasonic atomizers for finer misting.',
          tag: 'Output',
        },
      ],
      calloutTitle: 'Why a chemical feedback loop?',
      calloutBody:
        'Timed dispensers cannot tell when the air is already saturated. After a spray we watch for a VOC spike and enter Cooldown until readings return to baseline — a hardware-friendly interlock that matches our Week 1 functional architecture diagram.',
    },
    timeline: {
      eyebrow: 'Weekly Devlog',
      heading: 'Build log, week by week',
      intro:
        'A running record of how AuraSync gets built — hardware decisions, firmware milestones, CAD iterations, and ML experiments, one week at a time. Each card is a quick summary; click in for schematics, code walkthroughs, and the full design rationale.',
      filterAll: 'All',
      filterInProgress: 'In Progress',
      filterCompleted: 'Completed',
      openEntry: 'Open full entry',
    },
    team: {
      eyebrow: 'The Team',
      heading: 'Who is building AuraSync',
      intro:
        'Two people, one project. Responsibilities overlap by design — both contribute to architecture decisions and review each other\'s work every week.',
      footer: 'MSTI Hardware–Software Lab II · Team 6 · AuraSync',
      people: [
        {
          role: 'Firmware · Voice · App · PCB · Devlog',
          bio: 'Leads firmware architecture and the devlog site. Built the ESP-SR wake-word pipeline, I2S microphone bring-up, KiCAD schematic updates, the unified AuraSync state machine, the mobile app, and the PCB v1 — alongside this devlog site.',
          weeks: [
            {
              label: 'Week 1',
              items: [
                'User flow & state machine design',
                'Devlog site (React + Vite)',
                'System architecture',
              ],
            },
            {
              label: 'Week 2',
              items: [
                'KiCAD schematic & custom footprints',
                'ESP32-S3 firmware skeleton',
                'Pre-Flight Q&A write-up',
              ],
            },
            {
              label: 'Week 3',
              items: [
                'SPH0645 I2S microphone bring-up',
                'ESP-SR wake-word state machine',
                'Real-time Streamlit dashboard',
                'Schematic update (SPH0645 + PIR + 2N2222)',
                'Devlog write-up',
              ],
            },
            {
              label: 'Week 4',
              items: [
                'AuraSync unified firmware (PIR + voice + Firebase)',
                'Dual-layer state machine architecture (co-designed)',
                'Power optimization — WiFi modem sleep + Core 0 throttle',
                'Mobile app — Firebase spray history viewer (Expo + RN)',
              ],
            },
            {
              label: 'Week 5',
              items: [
                'Mobile app real-time display (Expo SDK 54 + Firebase JS SDK 10)',
                'Devlog write-up',
              ],
            },
            {
              label: 'Week 6',
              items: [
                'PCB design v1 — circular board R=45mm, JST connector footprints, LPKF fabricated',
                'Milestone 2 presentation slides',
                'Devlog write-up',
              ],
            },
            {
              label: 'Week 7',
              items: [
                'App UI polish — trigger icons (iaq_poor 🌫️, p3_shower_end 🚿), IAQ pill reposition, reservoir reset flow',
                'Device online status indicator (dual-row header: Firebase + ESP32)',
                'Transparent lid casting (with Lucia)',
                'Open House demo',
                'Devlog write-up',
              ],
            },
            {
              label: 'Week 8',
              items: [
                'PCB bring-up — soldered all components, JST connectors, atomizer MOSFET, MT3608, and WS2812B ring leads',
                'Enclosure lower base — SLA print (with Kevin), support removal, UV cure, wet sanding 60→1000 grit',
                'Resin lid finishing — band saw trim, drill spray hole, resin crack repair with same-material fill, final re-sand',
                'Devlog write-up',
              ],
            },
          ],
        },
        {
          role: 'Hardware · ML · Firmware · Data Collection · CAD',
          bio: 'Drives hardware integration and data science. Brought up the BME680, built the end-to-end ML pipeline — IAQ Random Forest + Shower 1D-CNN — integrated trained models into firmware as C weight arrays, and managed enclosure prototyping and milestone presentations.',
          weeks: [
            {
              label: 'Week 1',
              items: [
                'Hardware selection & BOM',
                'Component procurement',
                'System architecture',
              ],
            },
            {
              label: 'Week 2',
              items: [
                '3D enclosure prototype (CAD)',
                'ML dataset survey & strategy',
                'Data pipeline planning',
              ],
            },
            {
              label: 'Week 3',
              items: [
                'HC-SR501 PIR sensor integration',
                'Ultrasonic atomizer circuit (2N2222 transistor)',
                'Milestone 1 presentation slides',
              ],
            },
            {
              label: 'Week 4',
              items: [
                'BME680 sensor bring-up & I2C validation',
                'Dual-layer state machine architecture (co-designed)',
              ],
            },
            {
              label: 'Week 5',
              items: [
                'BME680 bathroom data collection (16 927 readings, 14 sessions)',
                'IAQ Random Forest pipeline (CV Macro F1 0.77 ± 0.17)',
                'Shower 1D-CNN detector (Val F1 0.77, AUC 0.94)',
                'BSEC2 firmware upgrade (self-calibrating IAQ index)',
              ],
            },
            {
              label: 'Week 6',
              items: [
                'ML firmware integration — IAQ MLP + Shower CNN exported as C weight arrays, on-device inference (Round 2: Val F1 0.902)',
                'Enclosure v2 redesign — cylindrical two-part snap-fit, PLA printed',
                'Milestone 2 presentation slides',
              ],
            },
            {
              label: 'Week 7',
              items: [
                'AuraSync v4 firmware — unified WiFi, IAQ MLP replacing raw gas threshold, restored VOC+PIR trigger, DEMO_MODE flag; all 5 trigger paths verified',
                'Enclosure v3 CAD — raised upper shell, USB-C cutout, revised PCB mount and mic placement',
                'Transparent lid casting — silicone mold + clear resin; frosted-glass finish from PLA layer texture',
                'Open House demo',
              ],
            },
            {
              label: 'Week 8',
              items: [
                'WS2812B 24-LED ring — five state-reactive animations (sleep, IAQ level, spray, cooldown, voice window) via FastLED',
                'PlatformIO migration — ESP-IDF 5.x, pioarduino platform, pinned FastLED 3.9.0',
                'Voice command tuning — added "Release" as second trigger word; threshold 0.45; all 5 trigger paths verified post-assembly',
                'Resin lid re-mold backup — re-modelled silicone mold for recasting; ultimately not needed after repair succeeded',
              ],
            },
          ],
        },
      ],
    },
    week: {
      backToTimeline: '← Back to timeline',
      weekLabel: (n) => `Week ${n}`,
      notesPrefix: 'Notes · ',
      execLabel: 'Opening · Executive summary',
      mainNotes: 'Main notes',
      closingLabel: 'Closing · Next steps',
      figures: 'Figures',
      prevLabel: '← Previous',
      nextLabel: 'Next →',
      errorEyebrow: 'Devlog',
      errorTitle: 'Week not found',
      errorBody: (week) =>
        `There is no entry for week ${week}. Return to the timeline and pick another card.`,
      errorBack: 'Back to timeline',
      noBody:
        'No full Markdown body is defined for this week yet. Add content below the front matter in the weekly',
      noBodyOr: 'file, or set a',
      noBodyIn: 'field in',
    },
    carryover: {
      fromPlan: (n) => `From Week ${n} plan`,
      description: (n) =>
        `Tasks we committed to in Week ${n}. Click a task to jump to its section below.`,
      partial: 'partial',
      summary: (done, partial, total, week) =>
        `${done} done${partial > 0 ? ` · ${partial} partial` : ''} / ${total} total · Week ${week ?? '?'}`,
    },
    credits: {
      label: 'Credits',
    },
    footer: (year) => `© ${year} AuraSync — student project devlog.`,
  },

  zh: {
    nav: {
      vision: '愿景',
      devlog: '开发日志',
      team: '团队',
      light: '浅色',
      dark: '深色',
      openMenu: '打开菜单',
      closeMenu: '关闭菜单',
      langToggle: 'EN',
    },
    hero: {
      eyebrow: '硬件 × 机器学习实验室 · 开发日志',
      taglineStrong:
        '一款面向家居空间的独立式场景感知香氛扩散器。VOC 传感器与端侧机器学习共同感知室内环境；',
      taglineEmphasis: '化学反馈闭环',
      taglineTail: '有效防止定时喷雾器无法避免的过度喷洒问题。',
      pills: ['化学反馈闭环', 'BME680 + I2S 多模态', '语音 · 按键 · 自动'],
      pillsAriaLabel: '项目亮点',
      readDevlog: '阅读开发日志',
      viewGithub: '查看 GitHub 仓库',
      explore: '探索',
      howItWorks: '产品原理',
      scrollToVision: '滚动至愿景章节',
    },
    vision: {
      eyebrow: '产品愿景',
      heading: '感知、推理、执行——一个闭合回路',
      intro:
        'AuraSync 将浴室场景（气味、淋浴蒸汽、梳妆声音）转化为可操作信号：推理完全在设备端完成，化学反馈机制将喷洒次数控制在安全范围内。详细的周进展记录在下方开发日志中。',
      cards: [
        {
          title: '感知',
          body: 'BME680 提供 VOC 与气候梯度数据；I2S 麦克风补充声学特征。系统优先关注趋势而非绝对值，使每个房间都能建立自己的环境基线。',
          tag: '输入',
        },
        {
          title: '端侧推理',
          body: '在 XIAO ESP32-S3 上，约 30 秒的滑动窗口融合多模态数据，输入轻量级分类器。仅在高置信度下触发执行，并内置规则抑制误报（如发胶 + 吹风机场景）。',
          tag: '推理',
        },
        {
          title: '执行',
          body: '喷雾后，VOC 峰值强制系统进入冷却状态——语音和按键请求被拒绝，直至空气恢复正常，防止香氛过量。我们正在评估超声波雾化器以实现更细腻的喷雾效果。',
          tag: '输出',
        },
      ],
      calloutTitle: '为什么需要化学反馈闭环？',
      calloutBody:
        '定时喷雾器无法感知空气是否已经饱和。喷雾后，系统监测 VOC 峰值并进入冷却模式，直至读数恢复基线——这是一种硬件友好的互锁机制，与第 1 周的功能架构图完全对应。',
    },
    timeline: {
      eyebrow: '每周开发日志',
      heading: '逐周构建记录',
      intro:
        '记录 AuraSync 的完整构建过程——硬件决策、固件里程碑、CAD 迭代与机器学习实验，一周一记。每张卡片是简要摘要，点击可查看原理图、代码详解与完整设计思路。',
      filterAll: '全部',
      filterInProgress: '进行中',
      filterCompleted: '已完成',
      openEntry: '查看完整记录',
    },
    team: {
      eyebrow: '团队成员',
      heading: 'AuraSync 的开发者',
      intro:
        '两人一组，共同完成项目。职责划分刻意保持重叠——双方每周都参与架构决策，并互相审阅对方的工作。',
      footer: 'MSTI 硬件-软件实验室 II · 第 6 组 · AuraSync',
      people: [
        {
          role: '固件 · 语音 · 应用 · PCB · 开发日志',
          bio: '负责固件架构与开发日志网站。主导了 ESP-SR 唤醒词流程、I2S 麦克风调试、KiCAD 原理图更新、AuraSync 统一状态机、移动端应用和 PCB v1 设计——同时从零搭建了本开发日志网站。',
          weeks: [
            {
              label: '第 1 周',
              items: ['用户流程与状态机设计', '开发日志网站（React + Vite）', '系统架构设计'],
            },
            {
              label: '第 2 周',
              items: ['KiCAD 原理图与自定义封装', 'ESP32-S3 固件骨架', '课前问答整理'],
            },
            {
              label: '第 3 周',
              items: [
                'SPH0645 I2S 麦克风调试',
                'ESP-SR 唤醒词状态机',
                '实时 Streamlit 串口监控',
                '原理图更新（SPH0645 + PIR + 2N2222）',
                '开发日志撰写',
              ],
            },
            {
              label: '第 4 周',
              items: [
                'AuraSync 统一固件（PIR + 语音 + Firebase）',
                '双层状态机架构设计（与 Lucia 共同设计）',
                '省电优化——WiFi 调制解调器休眠 + Core 0 频率限制',
                '移动端应用——Firebase 喷雾历史查看器（Expo + RN）',
              ],
            },
            {
              label: '第 5 周',
              items: [
                '移动端应用实时展示（Expo SDK 54 + Firebase JS SDK 10）',
                '开发日志撰写',
              ],
            },
            {
              label: '第 6 周',
              items: [
                'PCB 设计 v1——圆形 R=45mm，JST 接插件封装，LPKF 铣床打样',
                'Milestone 2 幻灯片',
                '开发日志撰写',
              ],
            },
            {
              label: '第 7 周',
              items: [
                'App UI 优化——触发图标补全（iaq_poor 🌫️、p3_shower_end 🚿）、IAQ 气泡位置修复、储液槽重置功能',
                '设备在线状态指示（顶栏双行：Firebase + ESP32）',
                '透明上盖翻模（与 Lucia 合作）',
                'Open House 展示',
                '开发日志撰写',
              ],
            },
          ],
        },
        {
          role: '硬件 · 机器学习 · 固件 · 数据采集 · CAD',
          bio: '负责硬件集成与数据科学。完成了 BME680 调试，构建了端到端 ML 流水线——IAQ 随机森林 + 淋浴 1D-CNN——并将训练好的模型以 C 权重数组形式集成进固件实现端侧推理，同时管理外壳原型设计并主导里程碑演示。',
          weeks: [
            {
              label: '第 1 周',
              items: ['硬件选型与物料清单', '元器件采购', '系统架构设计'],
            },
            {
              label: '第 2 周',
              items: ['3D 外壳原型（CAD）', '机器学习数据集调研与策略', '数据流程规划'],
            },
            {
              label: '第 3 周',
              items: [
                'HC-SR501 PIR 传感器集成',
                '超声波雾化器电路（2N2222 三极管）',
                '里程碑 1 演示幻灯片',
              ],
            },
            {
              label: '第 4 周',
              items: [
                'BME680 传感器调试与 I2C 地址验证',
                '双层状态机架构设计（与 Yutong 共同设计）',
              ],
            },
            {
              label: '第 5 周',
              items: [
                'BME680 浴室数据采集（16 927 条读数，14 个会话）',
                'IAQ 随机森林流水线（CV Macro F1 0.77 ± 0.17）',
                '淋浴 1D-CNN 检测器（Val F1 0.77，AUC 0.94）',
                'BSEC2 固件升级（自标定 IAQ 指数）',
              ],
            },
            {
              label: '第 6 周',
              items: [
                'ML 固件集成——IAQ MLP + 淋浴 CNN 导出为 C 权重数组，端侧推理（第二轮 Val F1 0.902）',
                '外壳 v2 重设计——圆柱形两段卡扣结构，PLA 打印',
                'Milestone 2 幻灯片',
              ],
            },
            {
              label: '第 7 周',
              items: [
                'AuraSync v4 固件——统一 WiFi 处理、IAQ MLP 替换原始气体阈值、恢复 VOC+PIR 触发、DEMO_MODE 标志；全部 5 条触发路径硬件验证完成',
                '外壳 v3 CAD——上壳加高、USB-C 开口、修订 PCB 固定与麦克风位置',
                '透明上盖翻模——硅胶模具 + 透明树脂；PLA 层纹赋予磨砂玻璃质感',
                'Open House 展示',
              ],
            },
          ],
        },
      ],
    },
    week: {
      backToTimeline: '← 返回时间轴',
      weekLabel: (n) => `第 ${n} 周`,
      notesPrefix: '备注 · ',
      execLabel: '开场 · 执行摘要',
      mainNotes: '正文',
      closingLabel: '收尾 · 后续计划',
      figures: '图表与截图',
      prevLabel: '← 上一周',
      nextLabel: '下一周 →',
      errorEyebrow: '开发日志',
      errorTitle: '未找到该周',
      errorBody: (week) =>
        `第 ${week} 周暂无内容。请返回时间轴选择其他周。`,
      errorBack: '返回时间轴',
      noBody: '本周尚未添加正文内容。请在周记录文件的 frontmatter 下方添加内容，或设置',
      noBodyOr: '文件的',
      noBodyIn: '字段，位于',
    },
    carryover: {
      fromPlan: (n) => `来自第 ${n} 周的计划`,
      description: (n) => `这是第 ${n} 周承诺完成的任务，点击可跳转至对应章节。`,
      partial: '进行中',
      summary: (done, partial, total, week) =>
        `${done} 项已完成${partial > 0 ? ` · ${partial} 项进行中` : ''} / 共 ${total} 项 · 第 ${week ?? '?'} 周`,
    },
    credits: {
      label: '分工贡献',
    },
    footer: (year) => `© ${year} AuraSync — 学生项目开发日志。`,
  },
}
