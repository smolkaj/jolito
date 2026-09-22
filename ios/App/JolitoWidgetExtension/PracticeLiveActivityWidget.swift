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
                        Text("Jolito")
                            .font(.system(size: 13, weight: .bold, design: .rounded))
                            .foregroundColor(rosa)
                    }
                    .padding(.leading, 4)
                }

                DynamicIslandExpandedRegion(.trailing) {
                    HStack(spacing: 4) {
                        Text("\(context.state.completedCount)/\(context.state.totalCount)")
                            .font(.system(size: 13, weight: .semibold, design: .monospaced))
                            .foregroundColor(.secondary)
                        Text("cards")
                            .font(.system(size: 11, weight: .regular))
                            .foregroundColor(.secondary)
                    }
                    .padding(.trailing, 4)
                }

                DynamicIslandExpandedRegion(.center) {
                    if !context.state.currentPrompt.isEmpty {
                        Text(context.state.currentPrompt)
                            .font(.system(size: 15, weight: .semibold, design: .serif))
                            .lineLimit(1)
                    }
                }

                DynamicIslandExpandedRegion(.bottom) {
                    VStack(spacing: 6) {
                        ProgressView(
                            value: Double(context.state.progressPercentage),
                            total: 100.0
                        )
                        .tint(rosa)

                        HStack {
                            Text("\(context.state.remainingCount) remaining")
                                .font(.system(size: 11, weight: .regular))
                                .foregroundColor(.secondary)
                            Spacer()
                            Text("\(context.state.progressPercentage)%")
                                .font(.system(size: 11, weight: .semibold, design: .monospaced))
                                .foregroundColor(rosa)
                        }
                    }
                    .padding(.horizontal, 4)
                    .padding(.top, 2)
                }
            } compactLeading: {
                // Compact Leading: Mini Jolito emblem flanking camera cutout
                Image(systemName: "character.book.closed.fill")
                    .foregroundColor(rosa)
                    .imageScale(.small)
            } compactTrailing: {
                // Compact Trailing: Native circular progress ring
                ProgressView(
                    value: Double(context.state.progressPercentage),
                    total: 100.0
                )
                .progressViewStyle(.circular)
                .tint(rosa)
                .scaleEffect(0.65)
                .frame(width: 18, height: 18)
            } minimal: {
                // Minimal Presentation (when multiple Live Activities share the island)
                ProgressView(
                    value: Double(context.state.progressPercentage),
                    total: 100.0
                )
                .progressViewStyle(.circular)
                .tint(rosa)
                .scaleEffect(0.6)
                .frame(width: 16, height: 16)
            }
        }
    }
}

private struct LockScreenPracticeView: View {
    let state: PracticeActivityAttributes.ContentState
    let rosa: Color

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack(alignment: .center) {
                Image(systemName: "character.book.closed.fill")
                    .foregroundColor(rosa)
                    .imageScale(.medium)
                Text("Jolito Practice")
                    .font(.system(size: 14, weight: .bold, design: .rounded))
                Spacer()
                Text("\(state.completedCount)/\(state.totalCount) cards")
                    .font(.system(size: 12, weight: .medium, design: .monospaced))
                    .foregroundColor(.secondary)
            }

            if !state.currentPrompt.isEmpty {
                Text(state.currentPrompt)
                    .font(.system(size: 16, weight: .semibold, design: .serif))
                    .lineLimit(1)
            }

            ProgressView(value: Double(state.progressPercentage), total: 100.0)
                .tint(rosa)
        }
        .padding(14)
    }
}
