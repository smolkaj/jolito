#import "NativeTouch.h"
#import <XCTest/XCTest.h>

// XCTest's touch event primitives, also used by Appium/WebDriverAgent:
// https://github.com/appium/WebDriverAgent/tree/master/PrivateHeaders/XCTest
// Runtime lookup keeps this capture-only dependency out of application targets.
@interface NSObject (WalkthroughTouchEvents)
- (instancetype)initForTouchAtPoint:(CGPoint)point offset:(double)offset;
- (void)liftUpAtOffset:(double)offset;
- (instancetype)initWithName:(NSString *)name interfaceOrientation:(NSInteger)orientation;
- (void)addPointerEventPath:(id)path;
- (id)eventSynthesizer;
- (void)synthesizeEvent:(id)record completion:(void (^)(BOOL, NSError *))completion;
@end

@implementation NativeTouch
+ (void)tapPoints:(NSArray<NSValue *> *)points completion:(void (^)(NSError *))completion {
    Class recordClass = NSClassFromString(@"XCSynthesizedEventRecord");
    Class pathClass = NSClassFromString(@"XCPointerEventPath");
    if (!recordClass || !pathClass || points.count == 0) {
        completion([NSError errorWithDomain:@"NativeTouch" code:1
            userInfo:@{NSLocalizedDescriptionKey: @"XCTest touch synthesis is unavailable"}]);
        return;
    }
    id record = [[recordClass alloc] initWithName:@"Software keyboard touches"
                            interfaceOrientation:UIInterfaceOrientationPortrait];
    double offset = 0;
    for (NSValue *value in points) {
        id path = [[pathClass alloc] initForTouchAtPoint:value.CGPointValue offset:offset];
        [path liftUpAtOffset:offset + 0.045];
        [record addPointerEventPath:path];
        offset += 0.20;
    }
    [[XCUIDevice.sharedDevice eventSynthesizer] synthesizeEvent:record completion:^(BOOL result, NSError *error) {
        completion(error ?: (result ? nil : [NSError errorWithDomain:@"NativeTouch" code:2
            userInfo:@{NSLocalizedDescriptionKey: @"XCTest touch synthesis failed"}]));
    }];
}
@end
