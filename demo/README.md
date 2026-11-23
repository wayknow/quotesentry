# QuoteSentry 演示视频

| 项目 | 内容 |
|---|---|
| 文件 | `QuoteSentry-demo-zh.mp4` |
| 字幕 | `QuoteSentry-demo-zh.srt` |
| 时长 | 2 分 43 秒（162.67 秒） |
| 画面 | 1600 × 1000，H.264，30 fps；内嵌 1440 × 900 最新页面截图 |
| 音频 | 中文旁白，AAC 单声道，22.05 kHz |
| 基于代码 | `5d73d3b feat: add three-round conversational RFQ review` |
| 录制日期 | 2026-11-23 |
| 文件大小 | 约 18 MB |
| MP4 SHA-256 | `370989b623d923581608d1518d489cd5dd98643c8391f2b6b6d4cdbe585a0e4f` |
| SRT SHA-256 | `d0ac6a1e88ab6d6d97180ae888b84b45f73345d938d95d0f965a57052125617e` |

## 内容

1. 最新 `seed-08` 三行询价逐行抽取。
2. 连续三轮对话：首轮审单、补充第二行镀锌并重算、解释第三行目录外原因。
3. 可报价、待澄清、目录外三种结果与原文证据回指。
4. 对话不会自动审批：审批、override、导出和发送均需人工按钮。
5. 客户视图与内部成本/毛利隔离。
6. 人工确认、客户 CSV/PDF 导出和发送禁用。
7. 审计时间线中的模型、规则版本、补充证据、审批人与导出动作。
8. “模型可替换、业务资产留在客户侧”的壁垒说明和仿真数据声明。

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
swift -module-cache-path /tmp/swift-module-cache scripts/tts-demo-scenes.swift 0.535
swiftc -module-cache-path /tmp/swift-module-cache -O scripts/render-demo-video.swift -o /tmp/render-demo-video
/tmp/render-demo-video demo/QuoteSentry-demo-zh.mp4 demo/QuoteSentry-demo-zh.srt
```

截图脚本依赖本机 Chrome CDP（`127.0.0.1:9222`）；TTS 与视频编码需在系统媒体权限可用的终端中执行。
