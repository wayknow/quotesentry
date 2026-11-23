import AVFoundation
import Foundation
import ImageIO
import UniformTypeIdentifiers

let arguments = CommandLine.arguments
guard arguments.count >= 4 else {
    fputs("usage: extract-demo-frames <video> <out-dir> <seconds> [seconds ...]\n", stderr)
    exit(2)
}

let videoURL = URL(fileURLWithPath: arguments[1])
let outDir = URL(fileURLWithPath: arguments[2], isDirectory: true)
try FileManager.default.createDirectory(at: outDir, withIntermediateDirectories: true)

let asset = AVURLAsset(url: videoURL)
let generator = AVAssetImageGenerator(asset: asset)
generator.appliesPreferredTrackTransform = true
generator.requestedTimeToleranceBefore = .zero
generator.requestedTimeToleranceAfter = .zero

for raw in arguments.dropFirst(3) {
    guard let seconds = Double(raw) else { continue }
    let time = CMTime(seconds: seconds, preferredTimescale: 600)
    var actual = CMTime.zero
    let cgImage = try generator.copyCGImage(at: time, actualTime: &actual)
    let name = String(format: "frame-%06.2f.png", seconds)
    let url = outDir.appendingPathComponent(name)
    guard let destination = CGImageDestinationCreateWithURL(url as CFURL, UTType.png.identifier as CFString, 1, nil) else {
        throw NSError(domain: "extract", code: 1)
    }
    CGImageDestinationAddImage(destination, cgImage, nil)
    guard CGImageDestinationFinalize(destination) else { throw NSError(domain: "extract", code: 2) }
    print(url.path)
}
