#import "NativeTouch.h"

// XCTest's touch event primitives, also used by Appium/WebDriverAgent:
// https://github.com/appium/WebDriverAgent/tree/master/PrivateHeaders/XCTest
// Runtime lookup keeps this capture-only dependency out of application targets.
@interface NSObject (WalkthroughTouchEvents)
- (instancetype)initForTouchAtPoint:(CGPoint)point offset:(double)offset;
- (void)liftUpAtOffset:(double)offset;
- (instancetype)initWithName:(NSString *)name interfaceOrientation:(NSInteger)orientation;
- (void)addPointerEventPath:(id)path;
- (BOOL)synthesizeWithError:(NSError **)error;
@end

@implementation NativeTouch
+ (BOOL)tapPoints:(NSArray<NSValue *> *)points error:(NSError **)error {
    Class recordClass = NSClassFromString(@"XCSynthesizedEventRecord");
    Class pathClass = NSClassFromString(@"XCPointerEventPath");
    if (!recordClass || !pathClass || points.count == 0) {
        if (error) *error = [NSError errorWithDomain:@"NativeTouch" code:1
            userInfo:@{NSLocalizedDescriptionKey: @"XCTest touch synthesis is unavailable"}];
        return NO;
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
    return [record synthesizeWithError:error];
}
@end
