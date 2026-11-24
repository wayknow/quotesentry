# QuoteSentry 演示视频

| 项目 | 内容 |
|---|---|
| 文件 | `QuoteSentry-demo-zh.mp4` |
| 字幕 | `QuoteSentry-demo-zh.srt` |
| 时长 | 2 分 50 秒（169.97 秒） |
| 画面 | 1600 × 1000，H.264，30 fps；内嵌 1440 × 900 最新页面截图 |
| 音频 | 中文旁白，AAC 单声道，22.05 kHz |
| 基于代码 | `3dc70e2 feat: add selectable DeepSeek Flash and V4 Pro models` + 本地对话页模型状态修复 |
| 录制日期 | 2026-11-24 |
| 文件大小 | 约 19 MB |
| MP4 SHA-256 | `4f082f2005d0a5b4ff28abfc65cc4f0f8180f4017814724bb8756ac6210c0d81` |
| SRT SHA-256 | `070985088e6e5bd13450faa571a053e161ca178994a689b048a667187d3702aa` |

## 内容

1. 最新 `seed-08` 三行询价逐行抽取。
2. 连续三轮对话：首轮审单、补充第二行镀锌并重算、解释第三行目录外原因。
3. 可报价、待澄清、目录外三种结果与原文证据回指。
4. 对话不会自动审批：审批、override、导出和发送均需人工按钮。
5. 客户视图与内部成本/毛利隔离。
6. 人工确认、客户 CSV/PDF 导出和发送禁用。
7. 审计时间线中的模型、规则版本、补充证据、审批人与导出动作。
8. “模型可替换、业务资产留在客户侧”的壁垒说明和仿真数据声明。
9. 右上角模型选择器：默认 `DeepSeek Flash`，可切 `DeepSeek V4 Pro`，正式版可按用户需求支持更多模型。

## 边界

- 视频中的客户、SKU、价格和询价均为仿真数据。
- 不宣称真实客户、真实 ROI 或成交提升。
- DeepSeek 只负责字段抽取，价格由确定性规则计算，最终由人审批。
- `SEND_MODE=disabled`，视频只展示导出，不展示真实发送。

## 重新录制

演示步骤、预期结果和故障兜底见 [docs/DEMO.md](../docs/DEMO.md)。录制前先重置演示数据，并确认左下角显示 `DeepSeek 已接入`。

可复现流水线：

```bash
npm run dev                    # 另开终端，保持 5173/3001 运行
node scripts/capture-video-scenes.mjs
bash scripts/tts-demo-scenes.sh 210
swiftc -module-cache-path /tmp/swift-module-cache -O scripts/render-demo-video.swift -o /tmp/render-demo-video
/tmp/render-demo-video demo/QuoteSentry-demo-zh.mp4 demo/QuoteSentry-demo-zh.srt
```

截图脚本依赖本机 Chrome CDP（`127.0.0.1:9222`）；TTS 与视频编码需在系统媒体权限可用的终端中执行。
