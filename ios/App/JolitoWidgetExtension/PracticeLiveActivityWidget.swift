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
            LockScreenPracticeView(state: context.state, rosa: rosa)
        } dynamicIsland: { context in
            DynamicIsland {
                // Expanded Presentation (when long-pressing the Dynamic Island)
                DynamicIslandExpandedRegion(.leading) {
                    HStack(spacing: 5) {
                        Image(systemName: "character.book.closed.fill")
                            .foregroundColor(rosa)
                            .imageScale(.medium)
                            .accessibilityHidden(true)
                        Text("Jolito")
                            .font(.system(size: 13, weight: .bold))
                            .foregroundColor(rosa)
                    }
                    .padding(.leading, 4)
                }

                DynamicIslandExpandedRegion(.trailing) {
                    Text("\(context.state.completedCount) of \(context.state.totalCount)")
                        .font(.system(size: 12, weight: .medium))
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
                        .accessibilityLabel("Session progress")
                        .accessibilityValue("\(context.state.completedCount) of \(context.state.totalCount) cards completed, \(context.state.progressPercentage) percent")
                    }
                    .padding(.horizontal, 4)
                    .padding(.top, 4)
                }
            } compactLeading: {
                // Compact Leading: Jolito emblem flanking camera cutout
                Image(systemName: "character.book.closed.fill")
                    .foregroundColor(rosa)
                    .imageScale(.small)
                    .accessibilityHidden(true)
            } compactTrailing: {
                // Compact Trailing: Determinate circular progress ring
                PracticeProgressRing(
                    percentage: context.state.progressPercentage,
                    rosa: rosa,
                    size: 18,
                    strokeWidth: 2.5
                )
                .accessibilityLabel("Session progress")
                .accessibilityValue("\(context.state.completedCount) of \(context.state.totalCount) cards completed, \(context.state.progressPercentage) percent")
            } minimal: {
                // Minimal Presentation (when multiple Live Activities share the island)
                PracticeProgressRing(
                    percentage: context.state.progressPercentage,
                    rosa: rosa,
                    size: 16,
                    strokeWidth: 2.2
                )
                .accessibilityLabel("Session progress")
                .accessibilityValue("\(context.state.completedCount) of \(context.state.totalCount) cards completed, \(context.state.progressPercentage) percent")
            }
        }
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
            Circle()
                .trim(from: 0.0, to: progress)
                .stroke(rosa, style: StrokeStyle(lineWidth: strokeWidth, lineCap: .round))
                .rotationEffect(.degrees(-90))
        }
        .frame(width: size, height: size)
    }
}

private struct LockScreenPracticeView: View {
    let state: PracticeActivityAttributes.ContentState
    let rosa: Color

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack(alignment: .center) {
                HStack(spacing: 6) {
                    Image(systemName: "character.book.closed.fill")
                        .foregroundColor(rosa)
                        .imageScale(.medium)
                        .accessibilityHidden(true)
                    Text("Jolito Practice")
                        .font(.system(size: 14, weight: .bold))
                }
                Spacer()
                Text("\(state.completedCount) of \(state.totalCount) cards")
                    .font(.system(size: 12, weight: .medium))
                    .foregroundColor(.secondary)
            }

            if !state.currentPrompt.isEmpty {
                Text(state.currentPrompt)
                    .font(.system(size: 16, weight: .semibold))
                    .lineLimit(2)
            }

            ProgressView(value: Double(state.progressPercentage), total: 100.0)
                .tint(rosa)
                .accessibilityLabel("Session progress")
                .accessibilityValue("\(state.completedCount) of \(state.totalCount) cards completed, \(state.progressPercentage) percent")
        }
        .padding(14)
    }
}
