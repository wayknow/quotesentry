import AVFoundation
import AppKit
import CoreText
import Foundation

struct Scene {
    let title: String
    let image: String
    let audio: String
    let narration: String
}

struct Cue {
    let start: Double
    let end: Double
    let text: String
}

struct SceneTiming {
    let start: Double
    let duration: Double
    let audioStart: Double
    let audioDuration: Double
    let cues: [Cue]
}

let scenes = [
    Scene(
        title: "询价审单",
        image: "/tmp/qs-video-scenes/00-overview.png",
        audio: "/tmp/qs-tts-scenes/00.caf",
        narration: "外贸报价员每天要把邮件和 Excel 里的多行询价变成可审批报价。难的不是写信，而是判断这一行能不能报、匹配哪个 SKU、价格从哪来、异常谁来处理。QuoteSentry 做的，就是这段审单流程。"
    ),
    Scene(
        title: "对话辅助",
        image: "/tmp/qs-video-scenes/01-chat-intro.png",
        audio: "/tmp/qs-tts-scenes/01.caf",
        narration: "我们不做聊天首页。主界面仍然是报价工作台，对话只用来补充规格和追问异常。大模型负责读取和解释，目录与规则负责判断，审批和导出仍由人点击按钮。"
    ),
    Scene(
        title: "第一轮审单",
        image: "/tmp/qs-video-scenes/02-chat-round1.png",
        audio: "/tmp/qs-tts-scenes/02.caf",
        narration: "一封三行询价。第一行规格完整，硬匹配目录 SKU，金额四百六十五美元。第二行缺少表面处理，系统不猜，标记待澄清。第三行 M14 不在目录，明确目录外，不用相似 SKU 替代。"
    ),
    Scene(
        title: "第二轮补参",
        image: "/tmp/qs-video-scenes/03-chat-round2.png",
        audio: "/tmp/qs-tts-scenes/03.caf",
        narration: "第二轮，销售说：第二行表面处理是镀锌。系统写入人工补充证据，重新跑门禁、目录匹配和确定性计价。第二行随即可报价，整单金额变为一千五百九十二点七八美元。"
    ),
    Scene(
        title: "第三轮解释",
        image: "/tmp/qs-video-scenes/04-chat-round3.png",
        audio: "/tmp/qs-tts-scenes/04.caf",
        narration: "第三轮，追问为什么第三行不能报价。Agent 返回硬匹配的完整失败条件，产品、标准、尺寸、材质、强度和表面处理必须同时满足。系统拒绝相似度替代，这一行不进入正式报价。"
    ),
    Scene(
        title: "对话不审批",
        image: "/tmp/qs-video-scenes/05-chat-approval-guardrail.png",
        audio: "/tmp/qs-tts-scenes/05.caf",
        narration: "用户再说：审批并导出 CSV。对话不会自动审批，只返回摘要和去审批按钮。审批、override、导出和外发，都是承诺动作，必须由责任人明确点击。"
    ),
    Scene(
        title: "客户与内部隔离",
        image: "/tmp/qs-video-scenes/06-approval-before.png",
        audio: "/tmp/qs-tts-scenes/06.caf",
        narration: "进入报价审批。客户视图只包含两条可报价行，不含成本和毛利；内部视图展示销售收入、成本、费用和百分之二十二的整体毛利。"
    ),
    Scene(
        title: "人工确认",
        image: "/tmp/qs-video-scenes/07-approve-modal.png",
        audio: "/tmp/qs-tts-scenes/07.caf",
        narration: "审批前打开确认框，核对版本、金额、毛利率和可报价行数，并填写审批人。这一步把责任从模型移回组织。"
    ),
    Scene(
        title: "审批后导出",
        image: "/tmp/qs-video-scenes/08-approved.png",
        audio: "/tmp/qs-tts-scenes/08.caf",
        narration: "审批通过后，客户 CSV 和 PDF 才解锁。发送仍然禁用，只导出客户文件。客户文件不包含成本、毛利和内部异常。"
    ),
    Scene(
        title: "审计与壁垒",
        image: "/tmp/qs-video-scenes/09-audit.png",
        audio: "/tmp/qs-tts-scenes/09.caf",
        narration: "审计时间线记录模型版本、规则版本、对话补充、审批人和导出动作。有人会问，模型都是大厂的，这是不是套壳。判断方法很简单：把模型换掉，产品还剩下什么。QuoteSentry 会退回规则模式；紧固件目录、报价口径、异常处置和审批责任仍然存在。模型可以替换，业务资产留在客户这里。演示使用仿真数据，不宣称真实客户收益。"
    ),
]

let width = 1600
let height = 1000
let fps: Int32 = 30
let introDuration = 4.0
let sceneTail = 0.85
let outroDuration = 4.0
let outputURL = URL(fileURLWithPath: CommandLine.arguments.dropFirst().first ?? "/tmp/QuoteSentry-demo-zh.mp4")
let srtURL = URL(fileURLWithPath: CommandLine.arguments.dropFirst(2).first ?? "/tmp/QuoteSentry-demo-zh.srt")
let videoOnlyURL = URL(fileURLWithPath: "/tmp/quotesentry-video-only.mov")

let navy = NSColor(calibratedRed: 7 / 255, green: 27 / 255, blue: 39 / 255, alpha: 1)
let navyLight = NSColor(calibratedRed: 12 / 255, green: 42 / 255, blue: 55 / 255, alpha: 1)
let teal = NSColor(calibratedRed: 20 / 255, green: 184 / 255, blue: 166 / 255, alpha: 1)
let mint = NSColor(calibratedRed: 94 / 255, green: 234 / 255, blue: 212 / 255, alpha: 1)
let cream = NSColor(calibratedRed: 255 / 255, green: 248 / 255, blue: 231 / 255, alpha: 1)
let white = NSColor(calibratedRed: 248 / 255, green: 250 / 255, blue: 252 / 255, alpha: 1)
let slate = NSColor(calibratedRed: 148 / 255, green: 163 / 255, blue: 184 / 255, alpha: 1)

func audioDuration(_ path: String) -> Double {
    let asset = AVURLAsset(url: URL(fileURLWithPath: path))
    return CMTimeGetSeconds(asset.duration)
}

func characterCount(_ text: String) -> Int {
    text.count
}

func splitLongClause(_ text: String, limit: Int) -> [String] {
    guard text.count > limit else { return [text] }
    var result: [String] = []
    var start = text.startIndex
    while start < text.endIndex {
        let end = text.index(start, offsetBy: limit, limitedBy: text.endIndex) ?? text.endIndex
        result.append(String(text[start..<end]))
        start = end
    }
    return result
}

func subtitleChunks(_ text: String, limit: Int = 44) -> [String] {
    let sentencePunctuation = CharacterSet(charactersIn: "。！？；")
    let clausePunctuation = CharacterSet(charactersIn: "，,：:")
    var sentences: [String] = []
    var current = ""

    for scalar in text.unicodeScalars {
        current.unicodeScalars.append(scalar)
        if sentencePunctuation.contains(scalar) {
            sentences.append(current)
            current = ""
        }
    }
    if !current.isEmpty { sentences.append(current) }

    var result: [String] = []
    for sentence in sentences {
        if sentence.count <= limit {
            result.append(sentence)
            continue
        }

        var clauses: [String] = []
        var clause = ""
        for scalar in sentence.unicodeScalars {
            clause.unicodeScalars.append(scalar)
            if clausePunctuation.contains(scalar) {
                clauses.append(clause)
                clause = ""
            }
        }
        if !clause.isEmpty { clauses.append(clause) }

        var chunk = ""
        for item in clauses {
            if chunk.count + item.count <= limit {
                chunk += item
            } else {
                if !chunk.isEmpty { result.append(chunk) }
                if item.count <= limit {
                    chunk = item
                } else {
                    let pieces = splitLongClause(item, limit: limit)
                    result.append(contentsOf: pieces.dropLast())
                    chunk = pieces.last ?? ""
                }
            }
        }
        if !chunk.isEmpty { result.append(chunk) }
    }
    return result.filter { !$0.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty }
}

func buildTimeline() -> ([SceneTiming], Double, Double) {
    var cursor = introDuration
    var timings: [SceneTiming] = []
    for scene in scenes {
        let duration = audioDuration(scene.audio)
        let start = cursor
        let audioStart = start + 0.15
        let chunks = subtitleChunks(scene.narration)
        let totalCharacters = max(1, chunks.reduce(0) { $0 + characterCount($1) })
        var cueStart = audioStart
        var cues: [Cue] = []
        for (index, chunk) in chunks.enumerated() {
            let share = Double(characterCount(chunk)) / Double(totalCharacters)
            let cueEnd = index == chunks.count - 1 ? audioStart + duration : cueStart + duration * share
            cues.append(Cue(start: cueStart, end: cueEnd, text: chunk))
            cueStart = cueEnd
        }
        timings.append(SceneTiming(start: start, duration: duration + sceneTail, audioStart: audioStart, audioDuration: duration, cues: cues))
        cursor += duration + sceneTail
    }
    return (timings, cursor, cursor + outroDuration)
}

func font(_ name: String, _ size: CGFloat) -> CTFont {
    CTFontCreateWithName(name as CFString, size, nil)
}

func topRect(_ x: CGFloat, _ y: CGFloat, _ w: CGFloat, _ h: CGFloat) -> CGRect {
    CGRect(x: x, y: CGFloat(height) - y - h, width: w, height: h)
}

func fill(_ context: CGContext, _ rect: CGRect, _ color: NSColor) {
    context.setFillColor(color.cgColor)
    context.fill(rect)
}

func fillTop(_ context: CGContext, _ x: CGFloat, _ y: CGFloat, _ w: CGFloat, _ h: CGFloat, _ color: NSColor) {
    fill(context, topRect(x, y, w, h), color)
}

func strokeTop(_ context: CGContext, _ x: CGFloat, _ y: CGFloat, _ w: CGFloat, _ h: CGFloat, _ color: NSColor, _ lineWidth: CGFloat = 1) {
    context.setStrokeColor(color.cgColor)
    context.setLineWidth(lineWidth)
    context.stroke(topRect(x, y, w, h))
}

func drawRoundedPanel(_ context: CGContext, _ rect: CGRect, radius: CGFloat, fillColor: NSColor, borderColor: NSColor? = nil) {
    let path = CGPath(roundedRect: rect, cornerWidth: radius, cornerHeight: radius, transform: nil)
    context.addPath(path)
    context.setFillColor(fillColor.cgColor)
    context.fillPath()
    if let borderColor {
        context.addPath(path)
        context.setStrokeColor(borderColor.cgColor)
        context.setLineWidth(1)
        context.strokePath()
    }
}

func drawText(
    _ context: CGContext,
    _ text: String,
    fontName: String,
    size: CGFloat,
    color: NSColor,
    rect: CGRect,
    alignment: NSTextAlignment = .left,
    lineSpacing: CGFloat = 0
) {
    let paragraph = NSMutableParagraphStyle()
    paragraph.alignment = alignment
    paragraph.lineBreakMode = .byWordWrapping
    paragraph.lineSpacing = lineSpacing
    let attributed = NSAttributedString(string: text, attributes: [
        .font: NSFont(name: fontName, size: size) ?? NSFont.systemFont(ofSize: size),
        .foregroundColor: color,
        .paragraphStyle: paragraph,
    ])
    let framesetter = CTFramesetterCreateWithAttributedString(attributed)
    let path = CGPath(rect: rect, transform: nil)
    let frame = CTFramesetterCreateFrame(framesetter, CFRange(location: 0, length: attributed.length), path, nil)
    CTFrameDraw(frame, context)
}

func drawFittedCaption(_ context: CGContext, _ text: String, fontSize: CGFloat, rect: CGRect) {
    let fontName = "PingFangSC-Regular"
    var chosen = fontSize
    while chosen > 18 {
        let width = (text as NSString).size(withAttributes: [.font: NSFont(name: fontName, size: chosen) ?? NSFont.systemFont(ofSize: chosen)]).width
        if width <= rect.width - 8 { break }
        chosen -= 0.5
    }
    drawText(context, text, fontName: fontName, size: chosen, color: white, rect: rect)
}

func image(_ path: String) -> CGImage? {
    guard let source = CGImageSourceCreateWithURL(URL(fileURLWithPath: path) as CFURL, nil) else { return nil }
    return CGImageSourceCreateImageAtIndex(source, 0, nil)
}

func drawIntro(_ context: CGContext) {
    fill(context, CGRect(x: 0, y: 0, width: width, height: height), navy)

    context.setFillColor(teal.withAlphaComponent(0.08).cgColor)
    for index in 0..<9 {
        let x = CGFloat(index) * 200 - 100
        context.fill(CGRect(x: x, y: 0, width: 1, height: CGFloat(height)))
    }
    for index in 0..<6 {
        let y = CGFloat(index) * 200 - 100
        context.fill(CGRect(x: 0, y: y, width: CGFloat(width), height: 1))
    }

    fillTop(context, 96, 108, 8, 300, teal)
    drawText(context, "QuoteSentry", fontName: "PingFangSC-Semibold", size: 70, color: white, rect: topRect(132, 88, 1000, 124))
    drawText(context, "报价哨兵", fontName: "PingFangSC-Semibold", size: 34, color: mint, rect: topRect(136, 192, 500, 58))
    drawText(context, "对话补规格，规则算价格，人来审批", fontName: "PingFangSC-Medium", size: 30, color: slate, rect: topRect(136, 262, 1000, 52))

    let stats: [(String, String)] = [
        ("3 轮", "连续对话"),
        ("3 行", "逐行审单"),
        ("1 条", "目录外阻断"),
    ]
    for (index, stat) in stats.enumerated() {
        let x = 136 + CGFloat(index) * 390
        drawRoundedPanel(context, topRect(x, 366, 340, 156), radius: 16, fillColor: navyLight, borderColor: teal.withAlphaComponent(0.35))
        drawText(context, stat.0, fontName: "PingFangSC-Semibold", size: 40, color: mint, rect: topRect(x + 28, 386, 280, 56))
        drawText(context, stat.1, fontName: "PingFangSC-Regular", size: 22, color: slate, rect: topRect(x + 30, 450, 280, 38))
    }

    drawText(context, "紧固件外贸询价审单 Agent｜仿真数据｜客户外发已禁用", fontName: "PingFangSC-Regular", size: 20, color: slate, rect: topRect(136, 682, 1200, 40))
    fillTop(context, 0, 934, CGFloat(width) * 0.16, 4, teal)
}

func drawOutro(_ context: CGContext, totalDuration: Double, outroStart: Double) {
    fill(context, CGRect(x: 0, y: 0, width: width, height: height), navy)
    fillTop(context, 96, 124, 8, 270, teal)
    drawText(context, "QuoteSentry 报价哨兵", fontName: "PingFangSC-Semibold", size: 54, color: white, rect: topRect(132, 112, 1340, 104))
    drawText(context, "不是更聪明的聊天框，而是能审单、能阻断、能追溯的报价流程。", fontName: "PingFangSC-Regular", size: 28, color: mint, rect: topRect(136, 222, 1280, 48))

    drawText(context, "现在体验", fontName: "PingFangSC-Semibold", size: 19, color: slate, rect: topRect(136, 344, 300, 32))
    drawRoundedPanel(context, topRect(132, 386, 1336, 92), radius: 14, fillColor: navyLight, borderColor: teal.withAlphaComponent(0.4))
    drawText(context, "https://wayknow.tech/quotesentry/?tab=chat&doc=seed-08", fontName: "PingFangSC-Medium", size: 30, color: white, rect: topRect(164, 410, 1270, 48))

    drawText(context, "仿真数据｜模型只做字段抽取与解释｜审批、override、导出均需人工确认", fontName: "PingFangSC-Regular", size: 21, color: cream, rect: topRect(136, 532, 1300, 40))
    drawText(context, "目录、报价口径和异常规则留在客户侧；模型可替换，规则模式仍可运行。", fontName: "PingFangSC-Regular", size: 20, color: slate, rect: topRect(136, 576, 1300, 38))

    let progress = totalDuration > 0 ? min(1, max(0, (totalDuration - outroStart) / max(0.001, totalDuration))) : 0
    fillTop(context, 0, 990, CGFloat(width) * CGFloat(progress), 4, teal)
}

func drawScene(_ context: CGContext, sceneIndex: Int, timing: SceneTiming, elapsed: Double, globalProgress: CGFloat) {
    let scene = scenes[sceneIndex]
    guard let sceneImage = image(scene.image) else { return }
    fill(context, CGRect(x: 0, y: 0, width: width, height: height), navy)

    let imageRect = topRect(80, 16, 1440, 900)
    context.saveGState()
    context.setShadow(offset: CGSize(width: 0, height: 8), blur: 28, color: NSColor.black.withAlphaComponent(0.45).cgColor)
    fill(context, imageRect, NSColor.black)
    context.restoreGState()
    context.draw(sceneImage, in: imageRect)
    strokeTop(context, 80, 16, 1440, 900, teal.withAlphaComponent(0.22), 1)

    fill(context, CGRect(x: 0, y: 0, width: width, height: 84), navy)
    fillTop(context, 0, 916, CGFloat(width), 3, teal)

    let title = String(format: "%02d / 10  %@", sceneIndex + 1, scene.title)
    drawText(context, title, fontName: "PingFangSC-Semibold", size: 16, color: mint, rect: topRect(54, 934, 190, 26))
    drawText(context, "仿真演示", fontName: "PingFangSC-Regular", size: 15, color: cream, rect: topRect(1420, 934, 126, 26), alignment: .right)

    let currentCue = timing.cues.first(where: { elapsed >= $0.start && elapsed < $0.end }) ?? timing.cues.last
    if let currentCue {
        drawFittedCaption(context, currentCue.text, fontSize: 27, rect: topRect(236, 940, 1260, 40))
    }
    fillTop(context, 0, 996, CGFloat(width) * globalProgress, 4, teal)
}

func renderFrame(context: CGContext, time: Double, timings: [SceneTiming], outroStart: Double, totalDuration: Double, intro: Bool, outro: Bool) {
    if intro {
        drawIntro(context)
        return
    }
    if outro || time >= outroStart {
        drawOutro(context, totalDuration: totalDuration, outroStart: outroStart)
        return
    }
    if let sceneIndex = timings.firstIndex(where: { time >= $0.start && time < $0.start + $0.duration }) {
        let timing = timings[sceneIndex]
        drawScene(context, sceneIndex: sceneIndex, timing: timing, elapsed: time, globalProgress: CGFloat(time / totalDuration))
    } else {
        drawIntro(context)
    }
}

func writeVideo(to url: URL, timings: [SceneTiming], outroStart: Double, totalDuration: Double) throws {
    try? FileManager.default.removeItem(at: url)
    let writer = try AVAssetWriter(outputURL: url, fileType: .mov)
    let settings: [String: Any] = [
        AVVideoCodecKey: AVVideoCodecType.h264,
        AVVideoWidthKey: width,
        AVVideoHeightKey: height,
        AVVideoCompressionPropertiesKey: [
            AVVideoAverageBitRateKey: 3_800_000,
            AVVideoMaxKeyFrameIntervalKey: 60,
            AVVideoExpectedSourceFrameRateKey: fps,
            AVVideoProfileLevelKey: AVVideoProfileLevelH264HighAutoLevel,
        ],
    ]
    let input = AVAssetWriterInput(mediaType: .video, outputSettings: settings)
    input.expectsMediaDataInRealTime = false
    let attributes: [String: Any] = [
        kCVPixelBufferPixelFormatTypeKey as String: kCVPixelFormatType_32BGRA,
        kCVPixelBufferWidthKey as String: width,
        kCVPixelBufferHeightKey as String: height,
        kCVPixelBufferCGImageCompatibilityKey as String: true,
        kCVPixelBufferCGBitmapContextCompatibilityKey as String: true,
    ]
    let adaptor = AVAssetWriterInputPixelBufferAdaptor(assetWriterInput: input, sourcePixelBufferAttributes: attributes)
    guard writer.canAdd(input) else { throw NSError(domain: "render", code: 1, userInfo: [NSLocalizedDescriptionKey: "Cannot add video input"]) }
    writer.add(input)
    guard writer.startWriting() else { throw writer.error ?? NSError(domain: "render", code: 2) }
    writer.startSession(atSourceTime: .zero)

    let colorSpace = CGColorSpaceCreateDeviceRGB()
    let bitmapInfo = CGBitmapInfo.byteOrder32Little.rawValue | CGImageAlphaInfo.premultipliedFirst.rawValue
    let frameCount = Int(ceil(totalDuration * Double(fps)))
    let queue = DispatchQueue(label: "quotesentry.render")
    let done = DispatchSemaphore(value: 0)

    queue.async {
        for frame in 0..<frameCount {
            autoreleasepool {
                while !input.isReadyForMoreMediaData {
                    Thread.sleep(forTimeInterval: 0.002)
                }
                guard let pool = adaptor.pixelBufferPool else { return }
                var pixelBuffer: CVPixelBuffer?
                guard CVPixelBufferPoolCreatePixelBuffer(nil, pool, &pixelBuffer) == kCVReturnSuccess, let pixelBuffer else { return }
                CVPixelBufferLockBaseAddress(pixelBuffer, [])
                defer { CVPixelBufferUnlockBaseAddress(pixelBuffer, []) }
                guard let base = CVPixelBufferGetBaseAddress(pixelBuffer) else { return }
                guard let context = CGContext(
                    data: base,
                    width: width,
                    height: height,
                    bitsPerComponent: 8,
                    bytesPerRow: CVPixelBufferGetBytesPerRow(pixelBuffer),
                    space: colorSpace,
                    bitmapInfo: bitmapInfo
                ) else { return }
                context.setShouldAntialias(true)
                context.setAllowsAntialiasing(true)
                let time = Double(frame) / Double(fps)
                renderFrame(
                    context: context,
                    time: time,
                    timings: timings,
                    outroStart: outroStart,
                    totalDuration: totalDuration,
                    intro: time < introDuration,
                    outro: time >= outroStart
                )
                let presentationTime = CMTime(value: Int64(frame), timescale: fps)
                if !adaptor.append(pixelBuffer, withPresentationTime: presentationTime) {
                    fputs("append failed at frame \(frame)\n", stderr)
                }
            }
            if frame % 300 == 0 {
                fputs("rendered \(frame)/\(frameCount)\n", stderr)
            }
        }
        input.markAsFinished()
        writer.finishWriting { done.signal() }
    }

    done.wait()
    if writer.status != .completed {
        throw writer.error ?? NSError(domain: "render", code: 3, userInfo: [NSLocalizedDescriptionKey: "Video writer failed: \(writer.status.rawValue)"])
    }
}

func combine(videoURL: URL, timings: [SceneTiming], outputURL: URL) throws {
    let composition = AVMutableComposition()
    let videoAsset = AVURLAsset(url: videoURL)
    guard let sourceVideo = videoAsset.tracks(withMediaType: .video).first else {
        throw NSError(domain: "render", code: 10, userInfo: [NSLocalizedDescriptionKey: "Missing video track"])
    }
    guard let videoTrack = composition.addMutableTrack(withMediaType: .video, preferredTrackID: kCMPersistentTrackID_Invalid) else {
        throw NSError(domain: "render", code: 11)
    }
    try videoTrack.insertTimeRange(CMTimeRange(start: .zero, duration: videoAsset.duration), of: sourceVideo, at: .zero)

    guard let audioTrack = composition.addMutableTrack(withMediaType: .audio, preferredTrackID: kCMPersistentTrackID_Invalid) else {
        throw NSError(domain: "render", code: 12)
    }
    for scene in scenes {
        let timing = timings[scenes.firstIndex(where: { $0.audio == scene.audio })!]
        let asset = AVURLAsset(url: URL(fileURLWithPath: scene.audio))
        guard let sourceAudio = asset.tracks(withMediaType: .audio).first else { continue }
        let start = CMTime(seconds: timing.audioStart, preferredTimescale: 600)
        try audioTrack.insertTimeRange(CMTimeRange(start: .zero, duration: asset.duration), of: sourceAudio, at: start)
    }

    try? FileManager.default.removeItem(at: outputURL)
    guard let exporter = AVAssetExportSession(asset: composition, presetName: AVAssetExportPresetHighestQuality) else {
        throw NSError(domain: "render", code: 13)
    }
    exporter.outputURL = outputURL
    exporter.outputFileType = .mp4
    exporter.shouldOptimizeForNetworkUse = true
    let done = DispatchSemaphore(value: 0)
    exporter.exportAsynchronously { done.signal() }
    done.wait()
    if exporter.status != .completed {
        throw exporter.error ?? NSError(domain: "render", code: 14, userInfo: [NSLocalizedDescriptionKey: "Export failed: \(exporter.status.rawValue)"])
    }
}

func srtTime(_ seconds: Double) -> String {
    let totalMilliseconds = Int((seconds * 1000).rounded())
    let hours = totalMilliseconds / 3_600_000
    let minutes = (totalMilliseconds % 3_600_000) / 60_000
    let secs = (totalMilliseconds % 60_000) / 1000
    let millis = totalMilliseconds % 1000
    return String(format: "%02d:%02d:%02d,%03d", hours, minutes, secs, millis)
}

func writeSRT(to url: URL, timings: [SceneTiming], outroStart: Double, totalDuration: Double) throws {
    var cues: [Cue] = [Cue(start: 0, end: introDuration, text: "QuoteSentry 报价哨兵\n对话补规格，规则算价格，人来审批")]
    for timing in timings {
        cues.append(contentsOf: timing.cues)
    }
    cues.append(Cue(start: outroStart, end: totalDuration, text: "体验：https://wayknow.tech/quotesentry/?tab=chat&doc=seed-08\n仿真数据｜客户外发已禁用"))

    var lines: [String] = []
    for (index, cue) in cues.enumerated() {
        lines.append("\(index + 1)")
        lines.append("\(srtTime(cue.start)) --> \(srtTime(cue.end))")
        lines.append(cue.text)
        lines.append("")
    }
    try lines.joined(separator: "\n").write(to: url, atomically: true, encoding: .utf8)
}

let (timings, outroStart, totalDuration) = buildTimeline()
fputs(String(format: "timeline: %.2fs (outro at %.2fs)\n", totalDuration, outroStart), stderr)
try writeVideo(to: videoOnlyURL, timings: timings, outroStart: outroStart, totalDuration: totalDuration)
try combine(videoURL: videoOnlyURL, timings: timings, outputURL: outputURL)
try writeSRT(to: srtURL, timings: timings, outroStart: outroStart, totalDuration: totalDuration)
print(String(format: "wrote %@ (%.2fs) and %@", outputURL.path, totalDuration, srtURL.path))
