import AVFoundation

struct Line {
    let title: String
    let text: String
}

let lines = [
    Line(title: "询价审单", text: "外贸报价员每天要把邮件和 Excel 里的多行询价变成可审批报价。难的不是写信，而是判断这一行能不能报、匹配哪个 SKU、价格从哪来、异常谁来处理。QuoteSentry 做的，就是这段审单流程。"),
    Line(title: "对话辅助", text: "我们不做聊天首页。右上角默认使用 DeepSeek Flash，也可切换到 V4 Pro，正式版本也可以根据用户需求支持更多模型。模型只负责读取和解释，目录与规则负责判断，审批和导出仍由人点击按钮。"),
    Line(title: "第一轮审单", text: "一封三行询价。第一行规格完整，硬匹配目录 SKU，金额四百六十五美元。第二行缺少表面处理，系统不猜，标记待澄清。第三行 M14 不在目录，明确目录外，不用相似 SKU 替代。"),
    Line(title: "第二轮补参", text: "第二轮，销售说：第二行表面处理是镀锌。系统写入人工补充证据，重新跑门禁、目录匹配和确定性计价。第二行随即可报价，整单金额变为一千五百九十二点七八美元。"),
    Line(title: "第三轮解释", text: "第三轮，追问为什么第三行不能报价。Agent 返回硬匹配的完整失败条件，产品、标准、尺寸、材质、强度和表面处理必须同时满足。系统拒绝相似度替代，这一行不进入正式报价。"),
    Line(title: "对话不审批", text: "用户再说：审批并导出 CSV。对话不会自动审批，只返回摘要和去审批按钮。审批、override、导出和外发，都是承诺动作，必须由责任人明确点击。"),
    Line(title: "客户与内部隔离", text: "进入报价审批。客户视图只包含两条可报价行，不含成本和毛利；内部视图展示销售收入、成本、费用和百分之二十二的整体毛利。"),
    Line(title: "人工确认", text: "审批前打开确认框，核对版本、金额、毛利率和可报价行数，并填写审批人。这一步把责任从模型移回组织。"),
    Line(title: "审批后导出", text: "审批通过后，客户 CSV 和 PDF 才解锁。发送仍然禁用，只导出客户文件。客户文件不包含成本、毛利和内部异常。"),
    Line(title: "审计与壁垒", text: "审计时间线记录模型、规则、补充证据、审批人和导出。有人会问这是不是套壳：把模型换掉，紧固件目录、报价口径、异常处置和审批责任仍然存在。模型可以替换，业务资产留在客户这里。演示使用仿真数据。"),
]

let rate = Float(CommandLine.arguments.dropFirst().first ?? "0.535") ?? 0.535
let outDir = URL(fileURLWithPath: "/tmp/qs-tts-scenes")
try? FileManager.default.removeItem(at: outDir)
try FileManager.default.createDirectory(at: outDir, withIntermediateDirectories: true)

func synthesize(_ text: String, to url: URL) throws -> Double {
    let synthesizer = AVSpeechSynthesizer()
    let utterance = AVSpeechUtterance(string: text)
    utterance.voice = AVSpeechSynthesisVoice(identifier: "com.apple.voice.compact.zh-CN.Tingting")
    utterance.rate = rate
    let format = AVAudioFormat(standardFormatWithSampleRate: 22_050, channels: 1)!
    let file = try AVAudioFile(forWriting: url, settings: format.settings)
    var done = false
    let deadline = Date().addingTimeInterval(60)
    synthesizer.write(utterance) { buffer in
        guard let pcm = buffer as? AVAudioPCMBuffer else { return }
        if pcm.frameLength == 0 {
            done = true
            return
        }
        try? file.write(from: pcm)
    }
    while !done && Date() < deadline {
        RunLoop.current.run(until: Date().addingTimeInterval(0.03))
    }
    if !done { throw NSError(domain: "tts", code: 1) }
    let audio = try AVAudioFile(forReading: url)
    return Double(audio.length) / audio.fileFormat.sampleRate
}

var total = 0.0
for (index, line) in lines.enumerated() {
    let url = outDir.appendingPathComponent(String(format: "%02d.caf", index))
    let duration = try synthesize(line.text, to: url)
    total += duration
    print(String(format: "%02d %5.2f %@", index, duration, line.title))
}
print(String(format: "total %.2f", total))
