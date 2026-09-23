import WidgetKit
import SwiftUI
import ActivityKit

public struct PracticeLiveActivityWidget: Widget {
    // Rosa Mexicano (#e4007c)
    private let rosa = Color(red: 228.0 / 255.0, green: 0.0 / 255.0, blue: 124.0 / 255.0)

    public init() {}

    public var body: some WidgetConfiguration {
        ActivityConfiguration(for: PracticeActivityAttributes.self) { context in
            // Lock Screen / StandBy presentation
            LockScreenPracticeView(attributes: context.attributes, state: context.state, rosa: rosa)
        } dynamicIsland: { context in
            DynamicIsland {
                // Expanded Presentation (when long-pressing the Dynamic Island)
                DynamicIslandExpandedRegion(.leading) {
                    HStack(spacing: 6) {
                        JolitoEmblem(size: 18)
                            .accessibilityHidden(true)
                        Text("Jolito")
                            .font(.system(size: 13, weight: .bold))
                    }
                    .padding(.leading, 4)
                }

                DynamicIslandExpandedRegion(.trailing) {
                    Text("\(context.state.completedCount) of \(context.state.totalCount)")
                        .font(.system(size: 12, weight: .medium))
                        .monospacedDigit()
                        .foregroundColor(.secondary)
                        .padding(.trailing, 4)
                }

                DynamicIslandExpandedRegion(.center) {
                    if !context.state.currentPrompt.isEmpty {
                        Text(context.state.currentPrompt)
                            .font(.system(size: 15, weight: .semibold))
                            .multilineTextAlignment(.center)
                            .lineLimit(2)
                            .padding(.horizontal, 4)
                    }
                }

                DynamicIslandExpandedRegion(.bottom) {
                    VStack(spacing: 4) {
                        ProgressView(
                            value: Double(context.state.progressPercentage),
                            total: 100.0
                        )
                        .tint(rosa)
                        .accessibilityLabel("Jolito session progress")
                        .accessibilityValue("\(context.state.completedCount) of \(context.state.totalCount) completed, \(context.state.progressPercentage) percent")
                    }
                    .padding(.horizontal, 4)
                    .padding(.top, 4)
                }
            } compactLeading: {
                // Compact Leading: Official Jolito axolotl mark flanking camera cutout
                JolitoEmblem(size: 20)
                    .accessibilityHidden(true)
            } compactTrailing: {
                // Compact Trailing: Determinate circular progress ring
                PracticeProgressRing(
                    percentage: context.state.progressPercentage,
                    rosa: rosa,
                    size: 18,
                    strokeWidth: 2.5
                )
                .accessibilityLabel("Jolito session progress")
                .accessibilityValue("\(context.state.completedCount) of \(context.state.totalCount) completed, \(context.state.progressPercentage) percent")
            } minimal: {
                // Minimal Presentation (when multiple Live Activities share the island)
                PracticeProgressRing(
                    percentage: context.state.progressPercentage,
                    rosa: rosa,
                    size: 16,
                    strokeWidth: 2.2
                )
                .accessibilityLabel("Jolito session progress")
                .accessibilityValue("\(context.state.completedCount) of \(context.state.totalCount) completed, \(context.state.progressPercentage) percent")
            }
        }
    }
}

public struct JolitoEmblem: View {
    public var size: CGFloat
    private let rosa = Color(red: 228.0 / 255.0, green: 0.0 / 255.0, blue: 124.0 / 255.0)
    private let amber = Color(red: 245.0 / 255.0, green: 158.0 / 255.0, blue: 11.0 / 255.0)
    private let coreDark = Color(red: 18.0 / 255.0, green: 24.0 / 255.0, blue: 21.0 / 255.0)

    public init(size: CGFloat = 20) {
        self.size = size
    }

    public var body: some View {
        Canvas { context, canvasSize in
            let scale = canvasSize.width / 32.0

            func drawGill(x: CGFloat, y: CGFloat, w: CGFloat, h: CGFloat, r: CGFloat, angle: Angle, origin: CGPoint) {
                var gillContext = context
                gillContext.translateBy(x: origin.x * scale, y: origin.y * scale)
                gillContext.rotate(by: angle)
                gillContext.translateBy(x: -origin.x * scale, y: -origin.y * scale)

                let rect = CGRect(x: x * scale, y: y * scale, width: w * scale, height: h * scale)
                let path = Path(roundedRect: rect, cornerRadius: r * scale)
                gillContext.fill(path, with: .color(rosa))
            }

            // Left gills
            drawGill(x: 3, y: 6.5, w: 11, h: 4.5, r: 2.25, angle: .degrees(-22), origin: CGPoint(x: 8.5, y: 8.75))
            drawGill(x: 1, y: 13.75, w: 12, h: 4.5, r: 2.25, angle: .degrees(0), origin: CGPoint(x: 7, y: 16))
            drawGill(x: 3, y: 21, w: 11, h: 4.5, r: 2.25, angle: .degrees(22), origin: CGPoint(x: 8.5, y: 23.25))

            // Right gills
            drawGill(x: 18, y: 6.5, w: 11, h: 4.5, r: 2.25, angle: .degrees(22), origin: CGPoint(x: 23.5, y: 8.75))
            drawGill(x: 19, y: 13.75, w: 12, h: 4.5, r: 2.25, angle: .degrees(0), origin: CGPoint(x: 25, y: 16))
            drawGill(x: 18, y: 21, w: 11, h: 4.5, r: 2.25, angle: .degrees(-22), origin: CGPoint(x: 23.5, y: 23.25))

            // Center Core (Axolotl Eye)
            let center = CGPoint(x: 16 * scale, y: 16 * scale)

            var outerCircle = Path()
            outerCircle.addArc(center: center, radius: 6 * scale, startAngle: .zero, endAngle: .degrees(360), clockwise: false)
            context.fill(outerCircle, with: .color(coreDark))

            var midCircle = Path()
            midCircle.addArc(center: center, radius: 4.2 * scale, startAngle: .zero, endAngle: .degrees(360), clockwise: false)
            context.fill(midCircle, with: .color(amber))

            var innerCircle = Path()
            innerCircle.addArc(center: center, radius: 2.2 * scale, startAngle: .zero, endAngle: .degrees(360), clockwise: false)
            context.fill(innerCircle, with: .color(.white))
        }
        .frame(width: size, height: size)
    }
}

private struct PracticeProgressRing: View {
    let percentage: Int
    let rosa: Color
    let size: CGFloat
    let strokeWidth: CGFloat

    var body: some View {
        let progress = min(max(CGFloat(percentage) / 100.0, 0.0), 1.0)
        ZStack {
            Circle()
                .stroke(rosa.opacity(0.25), lineWidth: strokeWidth)
            if progress > 0 {
                Circle()
                    .trim(from: 0.0, to: progress)
                    .stroke(rosa, style: StrokeStyle(lineWidth: strokeWidth, lineCap: .round))
                    .rotationEffect(.degrees(-90))
            }
        }
        .frame(width: size, height: size)
    }
}

private struct LockScreenPracticeView: View {
    let attributes: PracticeActivityAttributes
    let state: PracticeActivityAttributes.ContentState
    let rosa: Color

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack(alignment: .center) {
                HStack(spacing: 6) {
                    JolitoEmblem(size: 18)
                        .accessibilityHidden(true)
                    Text(attributes.sessionTitle.isEmpty ? "Jolito Practice" : attributes.sessionTitle)
                        .font(.system(size: 14, weight: .bold))
                }
                Spacer()
                Text("\(state.completedCount) of \(state.totalCount)")
                    .font(.system(size: 12, weight: .medium))
                    .monospacedDigit()
                    .foregroundColor(.secondary)
            }

            if !state.currentPrompt.isEmpty {
                Text(state.currentPrompt)
                    .font(.system(size: 16, weight: .semibold))
                    .lineLimit(2)
            }

            ProgressView(value: Double(state.progressPercentage), total: 100.0)
                .tint(rosa)
                .accessibilityLabel("Jolito session progress")
                .accessibilityValue("\(state.completedCount) of \(state.totalCount) completed, \(state.progressPercentage) percent")
        }
        .padding(14)
    }
}
