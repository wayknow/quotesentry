import AppKit
import CoreImage
import CoreText
import Foundation
import ImageIO

let urlString = "https://wayknow.tech/quotesentry/?tab=chat&doc=seed-08"
let outputDir = URL(fileURLWithPath: CommandLine.arguments.dropFirst().first ?? "submission/assets", isDirectory: true)
try FileManager.default.createDirectory(at: outputDir, withIntermediateDirectories: true)

let navy = NSColor(calibratedRed: 7 / 255, green: 27 / 255, blue: 39 / 255, alpha: 1)
let teal = NSColor(calibratedRed: 20 / 255, green: 184 / 255, blue: 166 / 255, alpha: 1)
let mint = NSColor(calibratedRed: 94 / 255, green: 234 / 255, blue: 212 / 255, alpha: 1)
let slate = NSColor(calibratedRed: 148 / 255, green: 163 / 255, blue: 184 / 255, alpha: 1)
let white = NSColor(calibratedRed: 248 / 255, green: 250 / 255, blue: 252 / 255, alpha: 1)

func qrImage(_ text: String) throws -> CGImage {
    guard let filter = CIFilter(name: "CIQRCodeGenerator") else {
        throw NSError(domain: "qr", code: 1)
    }
    filter.setValue(text.data(using: .utf8), forKey: "inputMessage")
    filter.setValue("H", forKey: "inputCorrectionLevel")
    guard let image = filter.outputImage else { throw NSError(domain: "qr", code: 2) }
    let scaled = image.transformed(by: CGAffineTransform(scaleX: 18, y: 18))
    guard let cgImage = CIContext(options: [.useSoftwareRenderer: true]).createCGImage(scaled, from: scaled.extent) else {
        throw NSError(domain: "qr", code: 3)
    }
    return cgImage
}

func savePNG(_ image: CGImage, to url: URL) throws {
    guard let destination = CGImageDestinationCreateWithURL(url as CFURL, "public.png" as CFString, 1, nil) else {
        throw NSError(domain: "qr", code: 4)
    }
    CGImageDestinationAddImage(destination, image, nil)
    guard CGImageDestinationFinalize(destination) else { throw NSError(domain: "qr", code: 5) }
}

func font(_ name: String, _ size: CGFloat) -> CTFont {
    CTFontCreateWithName(name as CFString, size, nil)
}

func topRect(_ width: Int, _ height: Int, _ x: CGFloat, _ y: CGFloat, _ w: CGFloat, _ h: CGFloat) -> CGRect {
    CGRect(x: x, y: CGFloat(height) - y - h, width: w, height: h)
}

func drawText(_ context: CGContext, text: String, fontName: String, size: CGFloat, color: NSColor, rect: CGRect, alignment: NSTextAlignment = .left) {
    let paragraph = NSMutableParagraphStyle()
    paragraph.alignment = alignment
    paragraph.lineBreakMode = .byWordWrapping
    let attributed = NSAttributedString(string: text, attributes: [
        .font: NSFont(name: fontName, size: size) ?? NSFont.systemFont(ofSize: size),
        .foregroundColor: color,
        .paragraphStyle: paragraph,
    ])
    let framesetter = CTFramesetterCreateWithAttributedString(attributed)
    let frame = CTFramesetterCreateFrame(framesetter, CFRange(location: 0, length: attributed.length), CGPath(rect: rect, transform: nil), nil)
    CTFrameDraw(frame, context)
}

let qr = try qrImage(urlString)

let rawSize = 900
guard let rawContext = CGContext(
    data: nil,
    width: rawSize,
    height: rawSize,
    bitsPerComponent: 8,
    bytesPerRow: 0,
    space: CGColorSpaceCreateDeviceRGB(),
    bitmapInfo: CGImageAlphaInfo.noneSkipLast.rawValue
) else { throw NSError(domain: "qr", code: 6) }
rawContext.setFillColor(NSColor.white.cgColor)
rawContext.fill(CGRect(x: 0, y: 0, width: rawSize, height: rawSize))
rawContext.interpolationQuality = .none
rawContext.draw(qr, in: CGRect(x: 70, y: 70, width: 760, height: 760))
guard let rawImage = rawContext.makeImage() else { throw NSError(domain: "qr", code: 7) }
try savePNG(rawImage, to: outputDir.appendingPathComponent("QuoteSentry-demo-qr.png"))

let width = 1200
let height = 1580
guard let cardContext = CGContext(
    data: nil,
    width: width,
    height: height,
    bitsPerComponent: 8,
    bytesPerRow: 0,
    space: CGColorSpaceCreateDeviceRGB(),
    bitmapInfo: CGImageAlphaInfo.noneSkipLast.rawValue
) else { throw NSError(domain: "qr", code: 8) }
cardContext.setFillColor(navy.cgColor)
cardContext.fill(CGRect(x: 0, y: 0, width: width, height: height))
cardContext.setFillColor(teal.cgColor)
cardContext.fill(topRect(width, height, 80, 92, 8, 150))

drawText(cardContext, text: "AGENT 赛道 / 体验入口", fontName: "PingFangSC-Semibold", size: 21, color: mint, rect: topRect(width, height, 116, 92, 900, 34))
drawText(cardContext, text: "QuoteSentry 报价哨兵", fontName: "PingFangSC-Semibold", size: 62, color: white, rect: topRect(width, height, 112, 132, 1040, 100))
drawText(cardContext, text: "对话补规格，规则算价格，人来审批", fontName: "PingFangSC-Regular", size: 30, color: slate, rect: topRect(width, height, 116, 238, 980, 48))

let panel = topRect(width, height, 120, 330, 960, 1020)
cardContext.addPath(CGPath(roundedRect: panel, cornerWidth: 26, cornerHeight: 26, transform: nil))
cardContext.setFillColor(NSColor.white.cgColor)
cardContext.fillPath()
cardContext.interpolationQuality = .none
cardContext.draw(rawImage, in: topRect(width, height, 170, 382, 860, 860))

drawText(cardContext, text: "扫码体验三轮对话", fontName: "PingFangSC-Semibold", size: 32, color: navy, rect: topRect(width, height, 170, 1270, 860, 46), alignment: .center)
drawText(cardContext, text: "仿真数据显示 · 客户外发已禁用", fontName: "PingFangSC-Regular", size: 19, color: NSColor(calibratedWhite: 0.38, alpha: 1), rect: topRect(width, height, 170, 1320, 860, 30), alignment: .center)

drawText(cardContext, text: "https://wayknow.tech/quotesentry/?tab=chat&doc=seed-08", fontName: "PingFangSC-Regular", size: 20, color: white, rect: topRect(width, height, 80, 1430, 1040, 34), alignment: .center)
drawText(cardContext, text: "仿真数据｜模型只做抽取与解释｜客户外发已禁用", fontName: "PingFangSC-Regular", size: 18, color: slate, rect: topRect(width, height, 80, 1482, 1040, 30), alignment: .center)

guard let cardImage = cardContext.makeImage() else { throw NSError(domain: "qr", code: 9) }
let cardURL = outputDir.appendingPathComponent("QuoteSentry-demo-qr-card.png")
try savePNG(cardImage, to: cardURL)

let detector = CIDetector(ofType: CIDetectorTypeQRCode, context: nil, options: [CIDetectorAccuracy: CIDetectorAccuracyHigh])
let features = detector?.features(in: CIImage(cgImage: rawImage)) ?? []
let payload = (features.first as? CIQRCodeFeature)?.messageString
guard payload == urlString else {
    throw NSError(domain: "qr", code: 10, userInfo: [NSLocalizedDescriptionKey: "QR verification failed: \(payload ?? "nil")"])
}

print(cardURL.path)
print("verified: \(payload!)")
